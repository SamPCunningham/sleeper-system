package models

import "time"

type Campaign struct {
	ID         int       `json:"id" db:"id"`
	Name       string    `json:"name" db:"name"`
	GMUserID   int       `json:"gm_user_id" db:"gm_user_id"`
	CurrentDay int       `json:"current_day" db:"current_day"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type CreateCampaignRequest struct {
	Name string `json:"name"`
}
