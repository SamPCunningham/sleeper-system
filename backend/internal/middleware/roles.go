package middleware

import (
	"net/http"

	"github.com/SamPCunningham/sleeper-system/internal/models"
)

// RequireRole middleware checks if the user has one of the allowed system roles
func RequireRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			userRole, ok := GetUserRole(r.Context())
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			for _, role := range allowedRoles {
				if userRole == role {
					next.ServeHTTP(w, r)
					return
				}
			}

			http.Error(w, "Forbidden - insufficient permissions", http.StatusForbidden)
		})
	}
}

// RequireAdmin is a convenience middleware for admin-only routes
func RequireAdmin(next http.Handler) http.Handler {
	return RequireRole(models.RoleAdmin)(next)
}

// RequireCampaignCreator is a middleware for routes that require campaign creation permission
func RequireCampaignCreator(next http.Handler) http.Handler {
	return RequireRole(models.RoleAdmin, models.RoleGameMaster)(next)
}
