package models

import "time"

type CampaignMember struct {
	ID         int       `json:"id" db:"id"`
	CampaignID int       `json:"campaign_id" db:"campaign_id"`
	UserID     int       `json:"user_id" db:"user_id"`
	JoinedAt   time.Time `json:"joined_at" db:"joined_at"`
}

// CampaignMemberWithUser includes user details for display
type CampaignMemberWithUser struct {
	CampaignMember
	Username   string `json:"username" db:"username"`
	Email      string `json:"email" db:"email"`
	SystemRole string `json:"system_role" db:"system_role"`
	IsGM       bool   `json:"is_gm" db:"is_gm"`
}

type AddCampaignMemberRequest struct {
	UserID int `json:"user_id"`
}
