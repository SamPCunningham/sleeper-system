package models

import "time"

const (
	RoleAdmin      = "admin"
	RoleGameMaster = "game_master"
	RolePlayer     = "player"
)

type User struct {
	ID           int       `json:"id" db:"id"`
	Username     string    `json:"username" db:"username"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"` // Never send password in JSON
	SystemRole   string    `json:"system_role" db:"system_role"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

func (u *User) IsAdmin() bool {
	return u.SystemRole == RoleAdmin
}

func (u *User) CanCreateCampaigns() bool {
	return u.SystemRole == RoleAdmin || u.SystemRole == RoleGameMaster
}

type CreateUserRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AdminCreateUserRequest struct {
	Username   string `json:"username"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	SystemRole string `json:"system_role"`
}

type AdminUpdateUserRequest struct {
	Username   string `json:"username"`
	Email      string `json:"email"`
	SystemRole string `json:"system_role"`
}

type SetPasswordRequest struct {
	Password string `json:"password"`
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type AuthResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}
