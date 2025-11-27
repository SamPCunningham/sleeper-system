package handlers

import (
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/SamPCunningham/sleeper-system/internal/database"
	"github.com/SamPCunningham/sleeper-system/internal/models"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	db *database.Database
}

func NewAuthHandler(db *database.Database) *AuthHandler {
	return &AuthHandler{db: db}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Username == "" || req.Email == "" || req.Password == "" {
		http.Error(w, "Username, email, and password are required", http.StatusBadRequest)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	// Insert user (defaults to 'player' role)
	var user models.User
	query := `
		INSERT INTO users (username, email, password_hash, system_role)
		VALUES ($1, $2, $3, 'player')
		RETURNING id, username, email, system_role, created_at
	`
	err = h.db.QueryRowx(query, req.Username, req.Email, string(hashedPassword)).StructScan(&user)
	if err != nil {
		http.Error(w, "Error creating user (username or email may already exist)", http.StatusConflict)
		return
	}

	// Generate JWT
	token, err := generateToken(user.ID, user.SystemRole)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	response := models.AuthResponse{
		Token: token,
		User:  user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get user by email
	var user models.User
	query := `SELECT id, username, email, password_hash, system_role, created_at FROM users WHERE email = $1`
	err := h.db.Get(&user, query, req.Email)
	if err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	// Check password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}

	// Generate JWT with role
	token, err := generateToken(user.ID, user.SystemRole)
	if err != nil {
		http.Error(w, "Error generating token", http.StatusInternalServerError)
		return
	}

	response := models.AuthResponse{
		Token: token,
		User:  user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func generateToken(userID int, role string) (string, error) {
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"role":    role,
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
	})

	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}
