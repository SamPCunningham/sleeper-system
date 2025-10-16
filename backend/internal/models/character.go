package models

import "time"

type Character struct {
	ID               int       `json:"id" db:"id"`
	CampaignID       int       `json:"campaign_id" db:"campaign_id"`
	UserID           int       `json:"user_id" db:"user_id"`
	Name             string    `json:"name" db:"name"`
	SkillName        *string   `json:"skill_name" db:"skill_name"`
	SkillModifier    int       `json:"skill_modifier" db:"skill_modifier"`
	WeaknessName     *string   `json:"weakness_name" db:"weakness_name"`
	WeaknessModifier int       `json:"weakness_modifier" db:"weakness_modifier"`
	MaxDailyDice     int       `json:"max_daily_dice" db:"max_daily_dice"`
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}

type CreateCharacterRequest struct {
	CampaignID       int     `json:"campaign_id"`
	Name             string  `json:"name"`
	SkillName        *string `json:"skill_name"`
	SkillModifier    int     `json:"skill_modifier"`
	WeaknessName     *string `json:"weakness_name"`
	WeaknessModifier int     `json:"weakness_modifier"`
}
