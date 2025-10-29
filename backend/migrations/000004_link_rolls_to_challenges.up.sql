ALTER TABLE roll_history ADD COLUMN challenge_id INTEGER REFERENCES challenges(id) ON DELETE SET NULL;
ALTER TABLE roll_history ADD COLUMN skill_applied BOOLEAN DEFAULT FALSE;
ALTER TABLE roll_history ADD COLUMN other_modifiers INTEGER DEFAULT 0;
ALTER TABLE roll_history ADD COLUMN modified_d6 INTEGER;

CREATE INDEX idx_roll_history_challenge ON roll_history(challenge_id);