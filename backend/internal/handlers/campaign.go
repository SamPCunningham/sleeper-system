package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/SamPCunningham/sleeper-system/internal/database"
	"github.com/SamPCunningham/sleeper-system/internal/middleware"
	"github.com/SamPCunningham/sleeper-system/internal/models"
	"github.com/go-chi/chi/v5"
)

type CampaignHandler struct {
	db *database.Database
}

func NewCampaignHandler(db *database.Database) *CampaignHandler {
	return &CampaignHandler{db: db}
}

func (h *CampaignHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.CreateCampaignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Campaign name is required", http.StatusBadRequest)
		return
	}

	var campaign models.Campaign
	query := `
		INSERT INTO campaigns (name, gm_user_id)
		VALUES ($1, $2)
		RETURNING id, name, gm_user_id, current_day, created_at
	`
	err := h.db.QueryRowx(query, req.Name, userID).StructScan(&campaign)
	if err != nil {
		http.Error(w, "Error creating campaign", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(campaign)
}

func (h *CampaignHandler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get campaigns where user is GM or has a character
	query := `
		SELECT DISTINCT c.id, c.name, c.gm_user_id, c.current_day, c.created_at
		FROM campaigns c
		LEFT JOIN characters ch ON c.id = ch.campaign_id
		WHERE c.gm_user_id = $1 OR ch.user_id = $1
		ORDER BY c.created_at DESC
	`

	var campaigns []models.Campaign
	err := h.db.Select(&campaigns, query, userID)
	if err != nil {
		http.Error(w, "Error fetching campaigns", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(campaigns)
}

func (h *CampaignHandler) Get(w http.ResponseWriter, r *http.Request) {
	campaignID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid campaign ID", http.StatusBadRequest)
		return
	}

	var campaign models.Campaign
	query := `SELECT id, name, gm_user_id, current_day, created_at FROM campaigns WHERE id = $1`
	err = h.db.Get(&campaign, query, campaignID)
	if err != nil {
		http.Error(w, "Campaign not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(campaign)
}

func (h *CampaignHandler) IncrementDay(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	campaignID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid campaign ID", http.StatusBadRequest)
		return
	}

	// Check if user is GM
	var gmUserID int
	err = h.db.Get(&gmUserID, "SELECT gm_user_id FROM campaigns WHERE id = $1", campaignID)
	if err != nil || gmUserID != userID {
		http.Error(w, "Only the GM can increment the day", http.StatusForbidden)
		return
	}

	var campaign models.Campaign
	query := `
		UPDATE campaigns 
		SET current_day = current_day + 1
		WHERE id = $1
		RETURNING id, name, gm_user_id, current_day, created_at
	`
	err = h.db.QueryRowx(query, campaignID).StructScan(&campaign)
	if err != nil {
		http.Error(w, "Error incrementing day", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(campaign)
}

func (h *CampaignHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	campaignID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid campaign ID", http.StatusBadRequest)
		return
	}

	// Get all users who have characters in this campaign, plus the GM
	query := `
		SELECT DISTINCT u.id, u.username, u.email, u.created_at
		FROM users u
		LEFT JOIN characters c ON u.id = c.user_id AND c.campaign_id = $1
		LEFT JOIN campaigns camp ON u.id = camp.gm_user_id AND camp.id = $1
		WHERE c.id IS NOT NULL OR camp.id IS NOT NULL
		ORDER BY u.username ASC
	`

	var users []models.User
	err = h.db.Select(&users, query, campaignID)
	if err != nil {
		http.Error(w, "Error fetching users", http.StatusInternalServerError)
		return
	}

	if users == nil {
		users = []models.User{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
