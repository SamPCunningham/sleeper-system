package models

import "time"

type Challenge struct {
	ID                 int       `json:"id" db:"id"`
	CampaignID         int       `json:"campaign_id" db:"campaign_id"`
	CreatedByUserID    int       `json:"created_by_user_id" db:"created_by_user_id"`
	Description        string    `json:"description" db:"description"`
	DifficultyModifier int       `json:"difficulty_modifier" db:"difficulty_modifier"`
	IsGroupChallenge   bool      `json:"is_group_challenge" db:"is_group_challenge"`
	IsActive           bool      `json:"is_active" db:"is_active"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
}

type ChallengeWithStats struct {
	Challenge
	TotalAttempts      int `json:"total_attempts" db:"total_attempts"`
	SuccessfulAttempts int `json:"successful_attempts" db:"successful_attempts"`
	FailedAttempts     int `json:"failed_attempts" db:"failed_attempts"`
}

type CreateChallengeRequest struct {
	CampaignID         int    `json:"campaign_id"`
	Description        string `json:"description"`
	DifficultyModifier int    `json:"difficulty_modifier"`
	IsGroupChallenge   bool   `json:"is_group_challenge"`
}
