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
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	db, err := database.NewDatabase(databaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

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
