package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/SamPCunningham/sleeper-system/internal/database"
	"github.com/SamPCunningham/sleeper-system/internal/handlers"
	customMiddleware "github.com/SamPCunningham/sleeper-system/internal/middleware"
	"github.com/SamPCunningham/sleeper-system/internal/websocket"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"github.com/golang-migrate/migrate/v4"
	_ "github.com/golang-migrate/migrate/v4/database/postgres"
	_ "github.com/golang-migrate/migrate/v4/source/file"

	"golang.org/x/crypto/bcrypt"
)

func runMigrations(databaseURL string) error {
	m, err := migrate.New(
		"file://migrations",
		databaseURL,
	)
	if err != nil {
		return fmt.Errorf("migration init failed: %w", err)
	}
	defer m.Close()

	if err := m.Up(); err != nil && err != migrate.ErrNoChange {
		return fmt.Errorf("migration up failed: %w", err)
	}

	log.Println("✅ Database migrations completed successfully")
	return nil
}

func seedAdminUser(db *database.Database) error {
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		log.Println("ADMIN_PASSWORD not set, skipping admin user creation")
		return nil
	}

	// Check if admin already exists
	var count int
	err := db.Get(&count, "SELECT COUNT(*) FROM users WHERE system_role = 'admin'")
	if err != nil {
		return fmt.Errorf("error checking for existing admin: %w", err)
	}
	if count > 0 {
		log.Println("Admin user already exists, skipping creation")
		return nil
	}

	// Get admin details from env or use defaults
	adminUsername := os.Getenv("ADMIN_USERNAME")
	if adminUsername == "" {
		adminUsername = "admin"
	}
	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "admin@sleeper.local"
	}

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("error hashing password: %w", err)
	}

	// Insert admin user
	query := `
        INSERT INTO users (username, email, password_hash, system_role)
        VALUES ($1, $2, $3, 'admin')
        RETURNING id
    `
	var userID int
	err = db.QueryRow(query, adminUsername, adminEmail, string(hashedPassword)).Scan(&userID)
	if err != nil {
		return fmt.Errorf("error creating admin user: %w", err)
	}

	log.Printf("✅ Admin user created successfully! (ID: %d, Username: %s, Email: %s)", userID, adminUsername, adminEmail)
	return nil
}

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	log.Println("Running database migrations...")
	if err := runMigrations(databaseURL); err != nil {
		log.Printf(" Migration error (continuing anyway): %v", err)
	}

	db, err := database.NewDatabase(databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := seedAdminUser(db); err != nil {
		log.Printf(" Seed error (continuing anyway): %v", err)
	}

	wsHub := websocket.NewHub()
	go wsHub.Run()

	wsHandler := websocket.NewHandler(wsHub)

	authHandler := handlers.NewAuthHandler(db)
	adminHandler := handlers.NewAdminHandler(db)
	campaignHandler := handlers.NewCampaignHandler(db, wsHub)
	characterHandler := handlers.NewCharacterHandler(db)
	diceHandler := handlers.NewDiceHandler(db, wsHub)
	challengeHandler := handlers.NewChallengeHandler(db, wsHub)

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{os.Getenv("FRONTEND_URL")},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Post("/api/auth/register", authHandler.Register)
	r.Post("/api/auth/login", authHandler.Login)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, "OK")
	})

	r.Get("/ws/campaigns/{campaignId}", wsHandler.ServeWS)

	r.Group(func(r chi.Router) {
		r.Use(customMiddleware.AuthMiddleware)

		r.Route("/api/admin", func(r chi.Router) {
			r.Use(customMiddleware.RequireAdmin)
			r.Get("/users", adminHandler.ListUsers)
			r.Post("/users", adminHandler.CreateUser)
			r.Get("/users/{id}", adminHandler.GetUser)
			r.Put("/users/{id}", adminHandler.UpdateUser)
			r.Post("/users/{id}/set-password", adminHandler.SetPassword)
			r.Delete("/users/{id}", adminHandler.DeleteUser)
		})

		r.Post("/api/campaigns", campaignHandler.Create)
		r.Get("/api/campaigns", campaignHandler.List)
		r.Get("/api/campaigns/{id}", campaignHandler.Get)
		r.Post("/api/campaigns/{id}/increment-day", campaignHandler.IncrementDay)
		r.Get("/api/campaigns/{id}/users", campaignHandler.ListUsers)

		r.Get("/api/campaigns/{id}/members", campaignHandler.ListMembers)
		r.Post("/api/campaigns/{id}/members", campaignHandler.AddMember)
		r.Delete("/api/campaigns/{id}/members", campaignHandler.RemoveMember)

		r.Post("/api/characters", characterHandler.Create)
		r.Get("/api/campaigns/{campaignId}/characters", characterHandler.ListByCampaign)
		r.Get("/api/characters/{id}", characterHandler.Get)
		r.Put("/api/characters/{id}", characterHandler.Update)

		r.Post("/api/characters/{characterId}/dice-pool", diceHandler.RollNewPool)
		r.Get("/api/characters/{characterId}/dice-pool", diceHandler.GetCurrentPool)
		r.Post("/api/dice/{dieId}/use", diceHandler.UseDie)
		r.Post("/api/rolls", diceHandler.RecordRoll)
		r.Get("/api/rolls", diceHandler.GetRollHistory)
		r.Post("/api/characters/{characterId}/dice-pool/manual", diceHandler.ManualRollPool)
		r.Put("/api/dice/{dieId}", diceHandler.UpdatePoolDie)

		r.Post("/api/challenges", challengeHandler.Create)
		r.Get("/api/campaigns/{campaignId}/challenges", challengeHandler.ListByCampaign)
		r.Post("/api/challenges/{id}/complete", challengeHandler.Complete)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}

	fmt.Printf("Server starting on port %s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
