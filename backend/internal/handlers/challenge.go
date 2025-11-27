package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/SamPCunningham/sleeper-system/internal/database"
	"github.com/SamPCunningham/sleeper-system/internal/middleware"
	"github.com/SamPCunningham/sleeper-system/internal/models"
	"github.com/SamPCunningham/sleeper-system/internal/websocket"
	"github.com/go-chi/chi/v5"
)

type ChallengeHandler struct {
	db  *database.Database
	hub *websocket.Hub
}

func NewChallengeHandler(db *database.Database, hub *websocket.Hub) *ChallengeHandler {
	return &ChallengeHandler{db: db, hub: hub}
}

func (h *ChallengeHandler) ListByCampaign(w http.ResponseWriter, r *http.Request) {
	campaignID, err := strconv.Atoi(chi.URLParam(r, "campaignId"))
	if err != nil {
		http.Error(w, "Invalid campaign ID", http.StatusBadRequest)
		return
	}

	query := `
		SELECT 
			ch.id, ch.campaign_id, ch.created_by_user_id, ch.description, 
			ch.difficulty_modifier, ch.is_group_challenge,
			ch.is_active, ch.created_at,
			COUNT(rh.id) as total_attempts,
			COUNT(CASE WHEN rh.success = true THEN 1 END) as successful_attempts,
			COUNT(CASE WHEN rh.success = false THEN 1 END) as failed_attempts
		FROM challenges ch
		LEFT JOIN roll_history rh ON ch.id = rh.challenge_id
		WHERE ch.campaign_id = $1 AND ch.is_active = true
		GROUP BY ch.id
		ORDER BY ch.created_at DESC
	`

	var challenges []models.ChallengeWithStats
	err = h.db.Select(&challenges, query, campaignID)
	if err != nil {
		log.Printf("Error fetching challenges: %v", err)
		http.Error(w, "Error fetching challenges", http.StatusInternalServerError)
		return
	}

	if challenges == nil {
		challenges = []models.ChallengeWithStats{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(challenges)
}

func (h *ChallengeHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.CreateChallengeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Check if user is GM
	var gmUserID int
	err := h.db.Get(&gmUserID, "SELECT gm_user_id FROM campaigns WHERE id = $1", req.CampaignID)
	if err != nil || gmUserID != userID {
		http.Error(w, "Only the GM can create challenges", http.StatusForbidden)
		return
	}

	var challenge models.Challenge
	query := `
		INSERT INTO challenges (campaign_id, created_by_user_id, description, difficulty_modifier, is_group_challenge)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, campaign_id, created_by_user_id, description, difficulty_modifier, is_group_challenge, is_active, created_at
	`
	err = h.db.QueryRowx(query, req.CampaignID, userID, req.Description, req.DifficultyModifier, req.IsGroupChallenge).StructScan(&challenge)
	if err != nil {
		http.Error(w, "Error creating challenge", http.StatusInternalServerError)
		return
	}

	// Broadcast new challenge to campaign
	h.hub.BroadcastToCampaign(req.CampaignID, websocket.MessageTypeChallengeUpdate, map[string]any{
		"action":    "created",
		"challenge": challenge,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(challenge)
}

func (h *ChallengeHandler) Complete(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	challengeID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid challenge ID", http.StatusBadRequest)
		return
	}

	// Check if user is GM and get campaign ID
	var campaignInfo struct {
		GMUserID   int `db:"gm_user_id"`
		CampaignID int `db:"campaign_id"`
	}
	query := `
		SELECT c.gm_user_id, ch.campaign_id
		FROM challenges ch
		JOIN campaigns c ON ch.campaign_id = c.id
		WHERE ch.id = $1
	`
	err = h.db.Get(&campaignInfo, query, challengeID)
	if err != nil || campaignInfo.GMUserID != userID {
		http.Error(w, "Only the GM can mark challenges complete", http.StatusForbidden)
		return
	}

	var challenge models.Challenge
	updateQuery := `
		UPDATE challenges
		SET is_active = false
		WHERE id = $1
		RETURNING id, campaign_id, created_by_user_id, description, difficulty_modifier, is_group_challenge, is_active, created_at
	`
	err = h.db.QueryRowx(updateQuery, challengeID).StructScan(&challenge)
	if err != nil {
		http.Error(w, "Error completing challenge", http.StatusInternalServerError)
		return
	}

	// Broadcast challenge completion
	h.hub.BroadcastToCampaign(campaignInfo.CampaignID, websocket.MessageTypeChallengeUpdate, map[string]any{
		"action":    "completed",
		"challenge": challenge,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(challenge)
}
