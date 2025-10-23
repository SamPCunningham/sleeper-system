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

type CharacterHandler struct {
	db *database.Database
}

func NewCharacterHandler(db *database.Database) *CharacterHandler {
	return &CharacterHandler{db: db}
}

func (h *CharacterHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req models.CreateCharacterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "Character name is required", http.StatusBadRequest)
		return
	}

	// Check if user is GM
	var gmUserID int
	err := h.db.Get(&gmUserID, "SELECT gm_user_id FROM campaigns WHERE id = $1", req.CampaignID)
	if err != nil {
		http.Error(w, "Campaign not found", http.StatusNotFound)
		return
	}

	isGM := gmUserID == userID
	var assignedUserID *int

	if isGM {
		// GM can assign to anyone (or leave unassigned)
		assignedUserID = req.AssignedUserID
	} else {
		// Players can only create for themselves
		// Check if they already have a character in this campaign
		var count int
		err = h.db.Get(&count, "SELECT COUNT(*) FROM characters WHERE campaign_id = $1 AND user_id = $2", req.CampaignID, userID)
		if err != nil {
			http.Error(w, "Error checking existing characters", http.StatusInternalServerError)
			return
		}
		if count > 0 {
			http.Error(w, "You already have a character in this campaign", http.StatusConflict)
			return
		}
		assignedUserID = &userID
	}

	var character models.Character
	query := `
		INSERT INTO characters (campaign_id, user_id, name, skill_name, skill_modifier, weakness_name, weakness_modifier)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, campaign_id, user_id, name, skill_name, skill_modifier, weakness_name, weakness_modifier, max_daily_dice, created_at
	`
	err = h.db.QueryRowx(query, req.CampaignID, assignedUserID, req.Name, req.SkillName, req.SkillModifier, req.WeaknessName, req.WeaknessModifier).StructScan(&character)
	if err != nil {
		http.Error(w, "Error creating character", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(character)
}

func (h *CharacterHandler) ListByCampaign(w http.ResponseWriter, r *http.Request) {
	campaignID, err := strconv.Atoi(chi.URLParam(r, "campaignId"))
	if err != nil {
		http.Error(w, "Invalid campaign ID", http.StatusBadRequest)
		return
	}

	query := `
		SELECT id, campaign_id, user_id, name, skill_name, skill_modifier, weakness_name, weakness_modifier, max_daily_dice, created_at
		FROM characters
		WHERE campaign_id = $1
		ORDER BY created_at ASC
	`

	var characters []models.Character
	err = h.db.Select(&characters, query, campaignID)
	if err != nil {
		http.Error(w, "Error fetching characters", http.StatusInternalServerError)
		return
	}

	// Return empty array instead of null
	if characters == nil {
		characters = []models.Character{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(characters)
}

func (h *CharacterHandler) Get(w http.ResponseWriter, r *http.Request) {
	characterID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid character ID", http.StatusBadRequest)
		return
	}

	var character models.Character
	query := `
		SELECT id, campaign_id, user_id, name, skill_name, skill_modifier, weakness_name, weakness_modifier, max_daily_dice, created_at
		FROM characters
		WHERE id = $1
	`
	err = h.db.Get(&character, query, characterID)
	if err != nil {
		http.Error(w, "Character not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(character)
}

func (h *CharacterHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.GetUserID(r.Context())
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	characterID, err := strconv.Atoi(chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, "Invalid character ID", http.StatusBadRequest)
		return
	}

	// Check if user owns this character
	var ownerID int
	err = h.db.Get(&ownerID, "SELECT user_id FROM characters WHERE id = $1", characterID)
	if err != nil || ownerID != userID {
		http.Error(w, "You don't have permission to update this character", http.StatusForbidden)
		return
	}

	var req models.CreateCharacterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var character models.Character
	query := `
		UPDATE characters
		SET name = $1, skill_name = $2, skill_modifier = $3, weakness_name = $4, weakness_modifier = $5
		WHERE id = $6
		RETURNING id, campaign_id, user_id, name, skill_name, skill_modifier, weakness_name, weakness_modifier, max_daily_dice, created_at
	`
	err = h.db.QueryRowx(query, req.Name, req.SkillName, req.SkillModifier, req.WeaknessName, req.WeaknessModifier, characterID).StructScan(&character)
	if err != nil {
		http.Error(w, "Error updating character", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(character)
}
