package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/SamPCunningham/sleeper-system/internal/database"
	"github.com/SamPCunningham/sleeper-system/internal/middleware"
	"github.com/SamPCunningham/sleeper-system/internal/models"
	"github.com/SamPCunningham/sleeper-system/internal/websocket"
	"github.com/go-chi/chi/v5"
)

type CampaignHandler struct {
	db  *database.Database
	hub *websocket.Hub
}

func NewCampaignHandler(db *database.Database, hub *websocket.Hub) *CampaignHandler {
	return &CampaignHandler{db: db, hub: hub}
}

func (h *CampaignHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if user can create campaigns (admin or game_master)
	userRole, _ := middleware.GetUserRole(r.Context())
	if userRole != models.RoleAdmin && userRole != models.RoleGameMaster {
		http.Error(w, "Only admins and game masters can create campaigns", http.StatusForbidden)
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

	// Add GM as campaign member
	_, err = h.db.Exec("INSERT INTO campaign_members (campaign_id, user_id) VALUES ($1, $2)", campaign.ID, userID)
	if err != nil {
		// Log but don't fail - campaign was created
		// This could happen if membership was somehow already added
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

	userRole, _ := middleware.GetUserRole(r.Context())

	var campaigns []models.Campaign
	var err error

	if userRole == models.RoleAdmin {
		// Admins see all campaigns
		query := `
			SELECT id, name, gm_user_id, current_day, created_at
			FROM campaigns
			ORDER BY created_at DESC
		`
		err = h.db.Select(&campaigns, query)
	} else {
		// Regular users see campaigns they're members of
		query := `
			SELECT DISTINCT c.id, c.name, c.gm_user_id, c.current_day, c.created_at
			FROM campaigns c
			JOIN campaign_members cm ON c.id = cm.campaign_id
			WHERE cm.user_id = $1
			ORDER BY c.created_at DESC
		`
		err = h.db.Select(&campaigns, query, userID)
	}

	if err != nil {
		http.Error(w, "Error fetching campaigns", http.StatusInternalServerError)
		return
	}

	if campaigns == nil {
		campaigns = []models.Campaign{}
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

	// Broadcast day increment to all connected clients
	h.hub.BroadcastToCampaign(campaignID, websocket.MessageTypeDayIncremented, map[string]any{
		"campaign_id": campaignID,
		"current_day": campaign.CurrentDay,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(campaign)
}

func (h *CampaignHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	campaignID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid campaign ID", http.StatusBadRequest)
		return
	}

	// Get all campaign members (for assigning characters)
	query := `
		SELECT DISTINCT u.id, u.username, u.email, u.system_role, u.created_at
		FROM users u
		JOIN campaign_members cm ON u.id = cm.user_id
		WHERE cm.campaign_id = $1
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

// ListMembers returns all members of a campaign
func (h *CampaignHandler) ListMembers(w http.ResponseWriter, r *http.Request) {
	campaignID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid campaign ID", http.StatusBadRequest)
		return
	}

	query := `
		SELECT 
			cm.id, cm.campaign_id, cm.user_id, cm.joined_at,
			u.username, u.email, u.system_role,
			(c.gm_user_id = cm.user_id) as is_gm
		FROM campaign_members cm
		JOIN users u ON cm.user_id = u.id
		JOIN campaigns c ON cm.campaign_id = c.id
		WHERE cm.campaign_id = $1
		ORDER BY is_gm DESC, u.username ASC
	`

	var members []models.CampaignMemberWithUser
	err = h.db.Select(&members, query, campaignID)
	if err != nil {
		http.Error(w, "Error fetching members", http.StatusInternalServerError)
		return
	}

	if members == nil {
		members = []models.CampaignMemberWithUser{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}

// AddMember adds a user to a campaign (GM only)
func (h *CampaignHandler) AddMember(w http.ResponseWriter, r *http.Request) {
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

	// Check if user is GM or admin
	userRole, _ := middleware.GetUserRole(r.Context())
	var gmUserID int
	err = h.db.Get(&gmUserID, "SELECT gm_user_id FROM campaigns WHERE id = $1", campaignID)
	if err != nil {
		http.Error(w, "Campaign not found", http.StatusNotFound)
		return
	}

	if gmUserID != userID && userRole != models.RoleAdmin {
		http.Error(w, "Only the GM or an admin can add members", http.StatusForbidden)
		return
	}

	var req models.AddCampaignMemberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Verify the user exists
	var exists bool
	err = h.db.Get(&exists, "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)", req.UserID)
	if err != nil || !exists {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	// Add member
	var member models.CampaignMember
	query := `
		INSERT INTO campaign_members (campaign_id, user_id)
		VALUES ($1, $2)
		ON CONFLICT (campaign_id, user_id) DO NOTHING
		RETURNING id, campaign_id, user_id, joined_at
	`
	err = h.db.QueryRowx(query, campaignID, req.UserID).StructScan(&member)
	if err != nil {
		// Check if it was a conflict (user already a member)
		var existingMember models.CampaignMember
		checkQuery := `SELECT id, campaign_id, user_id, joined_at FROM campaign_members WHERE campaign_id = $1 AND user_id = $2`
		if h.db.Get(&existingMember, checkQuery, campaignID, req.UserID) == nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(existingMember)
			return
		}
		http.Error(w, "Error adding member", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(member)
}

// RemoveMember removes a user from a campaign (GM only)
func (h *CampaignHandler) RemoveMember(w http.ResponseWriter, r *http.Request) {
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

	memberUserID, err := strconv.Atoi(chi.URLParam(r, "userId"))
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Check if user is GM or admin
	userRole, _ := middleware.GetUserRole(r.Context())
	var gmUserID int
	err = h.db.Get(&gmUserID, "SELECT gm_user_id FROM campaigns WHERE id = $1", campaignID)
	if err != nil {
		http.Error(w, "Campaign not found", http.StatusNotFound)
		return
	}

	if gmUserID != userID && userRole != models.RoleAdmin {
		http.Error(w, "Only the GM or an admin can remove members", http.StatusForbidden)
		return
	}

	// Prevent removing the GM
	if memberUserID == gmUserID {
		http.Error(w, "Cannot remove the GM from their campaign", http.StatusForbidden)
		return
	}

	// Remove member
	result, err := h.db.Exec("DELETE FROM campaign_members WHERE campaign_id = $1 AND user_id = $2", campaignID, memberUserID)
	if err != nil {
		http.Error(w, "Error removing member", http.StatusInternalServerError)
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		http.Error(w, "Member not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Member removed successfully"})
}
