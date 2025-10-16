package models

import "time"

type DicePool struct {
	ID          int       `json:"id" db:"id"`
	CharacterID int       `json:"character_id" db:"character_id"`
	RolledAt    time.Time `json:"rolled_at" db:"rolled_at"`
}

type PoolDie struct {
	ID        int  `json:"id" db:"id"`
	PoolID    int  `json:"pool_id" db:"pool_id"`
	DieResult int  `json:"die_result" db:"die_result"`
	IsUsed    bool `json:"is_used" db:"is_used"`
	Position  int  `json:"position" db:"position"`
}

type DicePoolWithDice struct {
	DicePool
	Dice []PoolDie `json:"dice"`
}

type RollHistory struct {
	ID          int       `json:"id" db:"id"`
	CharacterID int       `json:"character_id" db:"character_id"`
	PoolDiceID  *int      `json:"pool_dice_id" db:"pool_dice_id"`
	D20Roll     *int      `json:"d20_roll" db:"d20_roll"`
	ActionType  *string   `json:"action_type" db:"action_type"`
	Success     *bool     `json:"success" db:"success"`
	Notes       *string   `json:"notes" db:"notes"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type CreateRollRequest struct {
	CharacterID int     `json:"character_id"`
	PoolDiceID  int     `json:"pool_dice_id"`
	D20Roll     int     `json:"d20_roll"`
	ActionType  *string `json:"action_type"`
	Notes       *string `json:"notes"`
}
