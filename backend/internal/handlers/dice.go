package handlers

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/SamPCunningham/sleeper-system/internal/database"
	"github.com/SamPCunningham/sleeper-system/internal/models"
	"github.com/go-chi/chi/v5"
)

type DiceHandler struct {
	db *database.Database
}

func NewDiceHandler(db *database.Database) *DiceHandler {
	return &DiceHandler{db: db}
}

// RollNewPool creates a new dice pool for a character
func (h *DiceHandler) RollNewPool(w http.ResponseWriter, r *http.Request) {
	characterID, err := strconv.Atoi(chi.URLParam(r, "characterId"))
	if err != nil {
		http.Error(w, "Invalid character ID", http.StatusBadRequest)
		return
	}

	// Get character's max_daily_dice
	var maxDice int
	err = h.db.Get(&maxDice, "SELECT max_daily_dice FROM characters WHERE id = $1", characterID)
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
	dice := make([]models.PoolDie, maxDice)
	diceQuery := `
		INSERT INTO pool_dice (pool_id, die_result, position)
		VALUES ($1, $2, $3)
		RETURNING id, pool_id, die_result, is_used, position
	`

	rand.Seed(time.Now().UnixNano())
	for i := 0; i < maxDice; i++ {
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

// RecordRoll records a d20 roll in history
func (h *DiceHandler) RecordRoll(w http.ResponseWriter, r *http.Request) {
	var req models.CreateRollRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get the d6 result from the pool die
	var d6Result int
	err := h.db.Get(&d6Result, "SELECT die_result FROM pool_dice WHERE id = $1", req.PoolDiceID)
	if err != nil {
		http.Error(w, "Pool die not found", http.StatusNotFound)
		return
	}

	// Calculate success based on d6 and d20
	success := calculateSuccess(d6Result, req.D20Roll)

	var rollHistory models.RollHistory
	query := `
		INSERT INTO roll_history (character_id, pool_dice_id, d20_roll, action_type, success, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, character_id, pool_dice_id, d20_roll, action_type, success, notes, created_at
	`
	err = h.db.QueryRowx(query, req.CharacterID, req.PoolDiceID, req.D20Roll, req.ActionType, success, req.Notes).StructScan(&rollHistory)
	if err != nil {
		http.Error(w, "Error recording roll", http.StatusInternalServerError)
		return
	}

	// Mark the die as used
	_, err = h.db.Exec("UPDATE pool_dice SET is_used = true WHERE id = $1", req.PoolDiceID)
	if err != nil {
		http.Error(w, "Error marking die as used", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(rollHistory)
}

// calculateSuccess determines if a roll succeeded based on the dice mechanic
func calculateSuccess(d6Result, d20Roll int) bool {
	var threshold int
	switch d6Result {
	case 6:
		return true // Guaranteed success
	case 5:
		threshold = 10 // 50% (11+ succeeds)
	case 3, 4:
		threshold = 15 // 25% (16+ succeeds)
	case 1, 2:
		return false // Can only be neutral or negative
	}
	return d20Roll > threshold
}

// GetRollHistory gets roll history for a character or campaign
func (h *DiceHandler) GetRollHistory(w http.ResponseWriter, r *http.Request) {
	characterID := r.URL.Query().Get("character_id")

	var rolls []models.RollHistory
	var err error

	if characterID != "" {
		query := `
			SELECT id, character_id, pool_dice_id, d20_roll, action_type, success, notes, created_at
			FROM roll_history
			WHERE character_id = $1
			ORDER BY created_at DESC
			LIMIT 50
		`
		err = h.db.Select(&rolls, query, characterID)
	} else {
		http.Error(w, "character_id query parameter required", http.StatusBadRequest)
		return
	}

	if err != nil {
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

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}
