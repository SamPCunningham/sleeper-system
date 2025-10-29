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

type CreateRollRequest struct {
	CharacterID    int     `json:"character_id"`
	PoolDiceID     int     `json:"pool_dice_id"`
	D20Roll        int     `json:"d20_roll"`
	ActionType     *string `json:"action_type"`
	Notes          *string `json:"notes"`
	ChallengeID    *int    `json:"challenge_id"`
	SkillApplied   bool    `json:"skill_applied"`
	OtherModifiers int     `json:"other_modifiers"`
}

type RollHistory struct {
	ID             int       `json:"id" db:"id"`
	CharacterID    int       `json:"character_id" db:"character_id"`
	PoolDiceID     *int      `json:"pool_dice_id" db:"pool_dice_id"`
	D20Roll        *int      `json:"d20_roll" db:"d20_roll"`
	ActionType     *string   `json:"action_type" db:"action_type"`
	Success        *bool     `json:"success" db:"success"`
	Notes          *string   `json:"notes" db:"notes"`
	ChallengeID    *int      `json:"challenge_id" db:"challenge_id"`
	SkillApplied   bool      `json:"skill_applied" db:"skill_applied"`
	OtherModifiers int       `json:"other_modifiers" db:"other_modifiers"`
	ModifiedD6     *int      `json:"modified_d6" db:"modified_d6"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
}
