CREATE TABLE challenges (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    difficulty_modifier INTEGER NOT NULL DEFAULT 0,
    is_group_challenge BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_challenges_campaign ON challenges(campaign_id);
CREATE INDEX idx_challenges_active ON challenges(campaign_id, is_active);