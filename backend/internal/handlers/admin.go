package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/SamPCunningham/sleeper-system/internal/database"
	"github.com/SamPCunningham/sleeper-system/internal/models"
	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/bcrypt"
)

type AdminHandler struct {
	db *database.Database
}

func NewAdminHandler(db *database.Database) *AdminHandler {
	return &AdminHandler{db: db}
}

// ListUsers returns all users in the system
func (h *AdminHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT id, username, email, system_role, created_at
		FROM users
		ORDER BY created_at DESC
	`

	var users []models.User
	err := h.db.Select(&users, query)
	if err != nil {
		log.Printf("Error fetching users: %v", err)
		http.Error(w, "Error fetching users", http.StatusInternalServerError)
		return
	}

	if users == nil {
		users = []models.User{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

// GetUser returns a single user by ID
func (h *AdminHandler) GetUser(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var user models.User
	query := `SELECT id, username, email, system_role, created_at FROM users WHERE id = $1`
	err = h.db.Get(&user, query, userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// CreateUser creates a new user (admin only)
func (h *AdminHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req models.AdminCreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate input
	if req.Username == "" || req.Email == "" || req.Password == "" {
		http.Error(w, "Username, email, and password are required", http.StatusBadRequest)
		return
	}

	// Validate role
	if req.SystemRole == "" {
		req.SystemRole = models.RolePlayer
	}
	if req.SystemRole != models.RoleAdmin && req.SystemRole != models.RoleGameMaster && req.SystemRole != models.RolePlayer {
		http.Error(w, "Invalid system role. Must be: admin, game_master, or player", http.StatusBadRequest)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	// Insert user
	var user models.User
	query := `
		INSERT INTO users (username, email, password_hash, system_role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, username, email, system_role, created_at
	`
	err = h.db.QueryRowx(query, req.Username, req.Email, string(hashedPassword), req.SystemRole).StructScan(&user)
	if err != nil {
		log.Printf("Error creating user: %v", err)
		http.Error(w, "Error creating user (username or email may already exist)", http.StatusConflict)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(user)
}

// UpdateUser updates a user's details (admin only)
func (h *AdminHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var req models.AdminUpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate role if provided
	if req.SystemRole != "" {
		if req.SystemRole != models.RoleAdmin && req.SystemRole != models.RoleGameMaster && req.SystemRole != models.RolePlayer {
			http.Error(w, "Invalid system role. Must be: admin, game_master, or player", http.StatusBadRequest)
			return
		}
	}

	// Build update query dynamically based on provided fields
	var user models.User
	query := `
		UPDATE users
		SET username = COALESCE(NULLIF($1, ''), username),
		    email = COALESCE(NULLIF($2, ''), email),
		    system_role = COALESCE(NULLIF($3, ''), system_role)
		WHERE id = $4
		RETURNING id, username, email, system_role, created_at
	`
	err = h.db.QueryRowx(query, req.Username, req.Email, req.SystemRole, userID).StructScan(&user)
	if err != nil {
		log.Printf("Error updating user: %v", err)
		http.Error(w, "Error updating user", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// SetPassword sets a user's password (admin only)
func (h *AdminHandler) SetPassword(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var req models.SetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Password == "" {
		http.Error(w, "Password is required", http.StatusBadRequest)
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Error hashing password", http.StatusInternalServerError)
		return
	}

	// Update password
	result, err := h.db.Exec("UPDATE users SET password_hash = $1 WHERE id = $2", string(hashedPassword), userID)
	if err != nil {
		http.Error(w, "Error updating password", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Password updated successfully"})
}

// DeleteUser soft-deletes or deactivates a user
// For now, we'll do a hard delete but you could add an 'active' column later
func (h *AdminHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	userID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Prevent deleting the last admin
	var adminCount int
	err = h.db.Get(&adminCount, "SELECT COUNT(*) FROM users WHERE system_role = 'admin'")
	if err != nil {
		http.Error(w, "Error checking admin count", http.StatusInternalServerError)
		return
	}

	var targetRole string
	err = h.db.Get(&targetRole, "SELECT system_role FROM users WHERE id = $1", userID)
	if err != nil {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if targetRole == models.RoleAdmin && adminCount <= 1 {
		http.Error(w, "Cannot delete the last admin user", http.StatusForbidden)
		return
	}

	// Delete user (cascades to characters, etc.)
	result, err := h.db.Exec("DELETE FROM users WHERE id = $1", userID)
	if err != nil {
		log.Printf("Error deleting user: %v", err)
		http.Error(w, "Error deleting user", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "User deleted successfully"})
}
