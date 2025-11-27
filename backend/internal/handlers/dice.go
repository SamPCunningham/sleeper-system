package handlers

import (
	"encoding/json"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/SamPCunningham/sleeper-system/internal/database"
	"github.com/SamPCunningham/sleeper-system/internal/models"
	"github.com/SamPCunningham/sleeper-system/internal/websocket"
	"github.com/go-chi/chi/v5"
)

type DiceHandler struct {
	db  *database.Database
	hub *websocket.Hub
}

func NewDiceHandler(db *database.Database, hub *websocket.Hub) *DiceHandler {
	return &DiceHandler{db: db, hub: hub}
}

// RollNewPool creates a new dice pool for a character
func (h *DiceHandler) RollNewPool(w http.ResponseWriter, r *http.Request) {
	characterID, err := strconv.Atoi(chi.URLParam(r, "characterId"))
	if err != nil {
		http.Error(w, "Invalid character ID", http.StatusBadRequest)
		return
	}

	// Get character's max_daily_dice and campaign_id
	var charInfo struct {
		MaxDice    int `db:"max_daily_dice"`
		CampaignID int `db:"campaign_id"`
	}
	err = h.db.Get(&charInfo, "SELECT max_daily_dice, campaign_id FROM characters WHERE id = $1", characterID)
	if err != nil {
		http.Error(w, "Character not found", http.StatusNotFound)
		return
	}

	// Create new dice pool
	var pool models.DicePool
	poolQuery := `
		INSERT INTO dice_pools (character_id)
		VALUES ($1)
		RETURNING id, character_id, rolled_at
	`
	err = h.db.QueryRowx(poolQuery, characterID).StructScan(&pool)
	if err != nil {
		http.Error(w, "Error creating dice pool", http.StatusInternalServerError)
		return
	}

	// Roll and insert dice
	dice := make([]models.PoolDie, charInfo.MaxDice)
	diceQuery := `
		INSERT INTO pool_dice (pool_id, die_result, position)
		VALUES ($1, $2, $3)
		RETURNING id, pool_id, die_result, is_used, position
	`

	rand.Seed(time.Now().UnixNano())
	for i := 0; i < charInfo.MaxDice; i++ {
		result := rand.Intn(6) + 1 // 1-6
		err = h.db.QueryRowx(diceQuery, pool.ID, result, i+1).StructScan(&dice[i])
		if err != nil {
			http.Error(w, "Error creating dice", http.StatusInternalServerError)
			return
		}
	}

	response := models.DicePoolWithDice{
		DicePool: pool,
		Dice:     dice,
	}

	// Broadcast dice pool update
	h.hub.BroadcastToCampaign(charInfo.CampaignID, websocket.MessageTypeDicePoolUpdated, map[string]any{
		"character_id": characterID,
		"pool":         response,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// GetCurrentPool gets the most recent dice pool for a character
func (h *DiceHandler) GetCurrentPool(w http.ResponseWriter, r *http.Request) {
	characterID, err := strconv.Atoi(chi.URLParam(r, "characterId"))
	if err != nil {
		http.Error(w, "Invalid character ID", http.StatusBadRequest)
		return
	}

	// Get most recent pool
	var pool models.DicePool
	poolQuery := `
		SELECT id, character_id, rolled_at
		FROM dice_pools
		WHERE character_id = $1
		ORDER BY rolled_at DESC
		LIMIT 1
	`
	err = h.db.Get(&pool, poolQuery, characterID)
	if err != nil {
		http.Error(w, "No dice pool found", http.StatusNotFound)
		return
	}

	// Get dice for this pool
	var dice []models.PoolDie
	diceQuery := `
		SELECT id, pool_id, die_result, is_used, position
		FROM pool_dice
		WHERE pool_id = $1
		ORDER BY position ASC
	`
	err = h.db.Select(&dice, diceQuery, pool.ID)
	if err != nil {
		http.Error(w, "Error fetching dice", http.StatusInternalServerError)
		return
	}

	response := models.DicePoolWithDice{
		DicePool: pool,
		Dice:     dice,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// UseDie marks a die as used
func (h *DiceHandler) UseDie(w http.ResponseWriter, r *http.Request) {
	dieID, err := strconv.Atoi(chi.URLParam(r, "dieId"))
	if err != nil {
		http.Error(w, "Invalid die ID", http.StatusBadRequest)
		return
	}

	var die models.PoolDie
	query := `
		UPDATE pool_dice
		SET is_used = true
		WHERE id = $1
		RETURNING id, pool_id, die_result, is_used, position
	`
	err = h.db.QueryRowx(query, dieID).StructScan(&die)
	if err != nil {
		http.Error(w, "Error updating die", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(die)
}

// calculateOutcome determines the outcome based on the dice mechanic
func calculateOutcome(d6Result, d20Roll int) string {
	switch d6Result {
	case 6:
		return "success"
	case 5:
		if d20Roll >= 11 {
			return "success"
		}
		return "neutral"
	case 3, 4:
		if d20Roll >= 16 {
			return "success"
		} else if d20Roll >= 6 {
			return "neutral"
		}
		return "failure"
	case 1, 2:
		if d20Roll >= 11 {
			return "neutral"
		}
		return "failure"
	default:
		return "neutral"
	}
}

// RecordRoll records a d20 roll in history
func (h *DiceHandler) RecordRoll(w http.ResponseWriter, r *http.Request) {
	var req models.CreateRollRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get the d6 result from the pool die and character info
	var dieInfo struct {
		DieResult  int `db:"die_result"`
		CampaignID int `db:"campaign_id"`
	}
	err := h.db.Get(&dieInfo, `
		SELECT pd.die_result, c.campaign_id 
		FROM pool_dice pd
		JOIN dice_pools dp ON pd.pool_id = dp.id
		JOIN characters c ON dp.character_id = c.id
		WHERE pd.id = $1
	`, req.PoolDiceID)
	if err != nil {
		http.Error(w, "Pool die not found", http.StatusNotFound)
		return
	}

	// Calculate modified d6
	modifiedD6 := dieInfo.DieResult
	if req.SkillApplied {
		// Get character's skill modifier
		var skillMod int
		err = h.db.Get(&skillMod, "SELECT skill_modifier FROM characters WHERE id = $1", req.CharacterID)
		if err != nil {
			log.Printf("Error fetching skill modifier: %v", err)
		} else {
			log.Printf("Applying skill modifier: %d to base d6: %d", skillMod, modifiedD6)
			modifiedD6 += skillMod
		}
	}
	modifiedD6 += req.OtherModifiers
	// Cap at 1-6
	if modifiedD6 < 1 {
		modifiedD6 = 1
	}
	if modifiedD6 > 6 {
		modifiedD6 = 6
	}

	log.Printf("Final modified d6: %d (base: %d, skill: %v, other: %d)",
		modifiedD6, dieInfo.DieResult, req.SkillApplied, req.OtherModifiers)

	// Calculate outcome based on modified d6 and d20
	outcome := calculateOutcome(modifiedD6, req.D20Roll)

	// Also calculate old success boolean for backward compatibility
	var success *bool
	if outcome == "success" {
		s := true
		success = &s
	} else if outcome == "failure" {
		s := false
		success = &s
	}
	// neutral = nil

	var rollHistory models.RollHistory
	query := `
		INSERT INTO roll_history (
			character_id, pool_dice_id, d20_roll, action_type, success, outcome, notes,
			challenge_id, skill_applied, other_modifiers, modified_d6
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, character_id, pool_dice_id, d20_roll, action_type, success, outcome, notes,
		          challenge_id, skill_applied, other_modifiers, modified_d6, created_at
	`
	err = h.db.QueryRowx(query,
		req.CharacterID, req.PoolDiceID, req.D20Roll, req.ActionType, success, outcome, req.Notes,
		req.ChallengeID, req.SkillApplied, req.OtherModifiers, modifiedD6,
	).StructScan(&rollHistory)
	if err != nil {
		log.Printf("Error recording roll: %v", err)
		http.Error(w, "Error recording roll", http.StatusInternalServerError)
		return
	}

	// Mark the die as used
	_, err = h.db.Exec("UPDATE pool_dice SET is_used = true WHERE id = $1", req.PoolDiceID)
	if err != nil {
		http.Error(w, "Error marking die as used", http.StatusInternalServerError)
		return
	}

	// Get character name for the broadcast
	var charName string
	h.db.Get(&charName, "SELECT name FROM characters WHERE id = $1", req.CharacterID)

	// Broadcast roll completion to campaign
	h.hub.BroadcastToCampaign(dieInfo.CampaignID, websocket.MessageTypeRollComplete, map[string]any{
		"roll":           rollHistory,
		"character_name": charName,
		"character_id":   req.CharacterID,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rollHistory)
}

// GetRollHistory gets roll history for a character or campaign
func (h *DiceHandler) GetRollHistory(w http.ResponseWriter, r *http.Request) {
	characterID := r.URL.Query().Get("character_id")
	campaignID := r.URL.Query().Get("campaign_id")

	var rolls []models.RollHistoryWithCharacter
	var err error

	if characterID != "" {
		// Get rolls for a specific character
		query := `
				SELECT 
					rh.id, rh.character_id, rh.pool_dice_id, rh.d20_roll, 
					rh.action_type, rh.success, rh.notes, rh.created_at,
					rh.challenge_id, rh.skill_applied, rh.other_modifiers, rh.modified_d6,
					rh.outcome,
					c.name as character_name
				FROM roll_history rh
				JOIN characters c ON rh.character_id = c.id
				WHERE rh.character_id = $1
				ORDER BY rh.created_at DESC
				LIMIT 50
			`
		err = h.db.Select(&rolls, query, characterID)
	} else if campaignID != "" {
		// Get rolls for entire campaign
		query := `
				SELECT 
					rh.id, rh.character_id, rh.pool_dice_id, rh.d20_roll, 
					rh.action_type, rh.success, rh.notes, rh.created_at,
					rh.challenge_id, rh.skill_applied, rh.other_modifiers, rh.modified_d6,
					rh.outcome,
					c.name as character_name
				FROM roll_history rh
				JOIN characters c ON rh.character_id = c.id
				WHERE c.campaign_id = $1
				ORDER BY rh.created_at DESC
				LIMIT 100
			`
		err = h.db.Select(&rolls, query, campaignID)
	} else {
		http.Error(w, "character_id or campaign_id query parameter required", http.StatusBadRequest)
		return
	}

	if err != nil {
		log.Printf("Error fetching roll history: %v", err)
		http.Error(w, "Error fetching roll history", http.StatusInternalServerError)

		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rolls)
}

// ManualRollPool creates a new dice pool with manually entered results
func (h *DiceHandler) ManualRollPool(w http.ResponseWriter, r *http.Request) {
	characterID, err := strconv.Atoi(chi.URLParam(r, "characterId"))
	if err != nil {
		http.Error(w, "Invalid character ID", http.StatusBadRequest)
		return
	}

	var req struct {
		DiceResults []int `json:"dice_results"` // e.g. [4, 6, 2]
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate dice results
	if len(req.DiceResults) == 0 {
		http.Error(w, "At least one die result required", http.StatusBadRequest)
		return
	}
	for _, result := range req.DiceResults {
		if result < 1 || result > 6 {
			http.Error(w, "Dice results must be between 1 and 6", http.StatusBadRequest)
			return
		}
	}

	// Get campaign ID for broadcast
	var campaignID int
	err = h.db.Get(&campaignID, "SELECT campaign_id FROM characters WHERE id = $1", characterID)
	if err != nil {
		http.Error(w, "Character not found", http.StatusNotFound)
		return
	}

	// Create new dice pool
	var pool models.DicePool
	poolQuery := `
		INSERT INTO dice_pools (character_id)
		VALUES ($1)
		RETURNING id, character_id, rolled_at
	`
	err = h.db.QueryRowx(poolQuery, characterID).StructScan(&pool)
	if err != nil {
		http.Error(w, "Error creating dice pool", http.StatusInternalServerError)
		return
	}

	// Insert manually entered dice
	dice := make([]models.PoolDie, len(req.DiceResults))
	diceQuery := `
		INSERT INTO pool_dice (pool_id, die_result, position)
		VALUES ($1, $2, $3)
		RETURNING id, pool_id, die_result, is_used, position
	`

	for i, result := range req.DiceResults {
		err = h.db.QueryRowx(diceQuery, pool.ID, result, i+1).StructScan(&dice[i])
		if err != nil {
			http.Error(w, "Error creating dice", http.StatusInternalServerError)
			return
		}
	}

	response := models.DicePoolWithDice{
		DicePool: pool,
		Dice:     dice,
	}

	// Broadcast dice pool update
	h.hub.BroadcastToCampaign(campaignID, websocket.MessageTypeDicePoolUpdated, map[string]any{
		"character_id": characterID,
		"pool":         response,
	})

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}
