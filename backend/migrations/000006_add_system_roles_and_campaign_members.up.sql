-- Add system_role to users (admin, game_master, player)
ALTER TABLE users ADD COLUMN system_role VARCHAR(20) DEFAULT 'player' NOT NULL;

-- Create campaign_members table for explicit membership
CREATE TABLE campaign_members (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(campaign_id, user_id)
);

CREATE INDEX idx_campaign_members_campaign ON campaign_members(campaign_id);
CREATE INDEX idx_campaign_members_user ON campaign_members(user_id);

-- Backfill: Add GMs as members of their campaigns
INSERT INTO campaign_members (campaign_id, user_id)
SELECT id, gm_user_id FROM campaigns
ON CONFLICT DO NOTHING;

-- Backfill: Add players who have characters as members
INSERT INTO campaign_members (campaign_id, user_id)
SELECT DISTINCT campaign_id, user_id FROM characters
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;