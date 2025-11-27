package main

import (
	"fmt"
	"log"
	"os"

	"github.com/jmoiron/sqlx"
	"github.com/joho/godotenv"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	// Load .env file
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}

	// Get required environment variables
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	adminUsername := os.Getenv("ADMIN_USERNAME")
	if adminUsername == "" {
		adminUsername = "admin"
	}

	adminEmail := os.Getenv("ADMIN_EMAIL")
	if adminEmail == "" {
		adminEmail = "admin@sleeper.local"
	}

	adminPassword := os.Getenv("ADMIN_PASSWORD")
	if adminPassword == "" {
		log.Fatal("ADMIN_PASSWORD environment variable is required")
	}

	// Connect to database
	db, err := sqlx.Connect("postgres", databaseURL)
	if err != nil {
		log.Fatalf("Error connecting to database: %v", err)
	}
	defer db.Close()

	// Check if admin already exists
	var count int
	err = db.Get(&count, "SELECT COUNT(*) FROM users WHERE system_role = 'admin'")
	if err != nil {
		log.Fatalf("Error checking for existing admin: %v", err)
	}

	if count > 0 {
		fmt.Println("Admin user already exists. Skipping seed.")
		return
	}

	// Hash the password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Error hashing password: %v", err)
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
		log.Fatalf("Error creating admin user: %v", err)
	}

	fmt.Printf("Admin user created successfully!\n")
	fmt.Printf("  ID:       %d\n", userID)
	fmt.Printf("  Username: %s\n", adminUsername)
	fmt.Printf("  Email:    %s\n", adminEmail)
	fmt.Printf("  Role:     admin\n")
}
