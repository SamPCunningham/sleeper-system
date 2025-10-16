-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns table
CREATE TABLE campaigns (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    gm_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_day INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Characters table
CREATE TABLE characters (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    skill_name VARCHAR(100),
    skill_modifier INTEGER DEFAULT 1,
    weakness_name VARCHAR(100),
    weakness_modifier INTEGER DEFAULT -1,
    max_daily_dice INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dice pools table
CREATE TABLE dice_pools (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    rolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pool dice table (pivot for dice in a pool)
CREATE TABLE pool_dice (
    id SERIAL PRIMARY KEY,
    pool_id INTEGER NOT NULL REFERENCES dice_pools(id) ON DELETE CASCADE,
    die_result INTEGER NOT NULL CHECK (die_result >= 1 AND die_result <= 6),
    is_used BOOLEAN DEFAULT FALSE,
    position INTEGER NOT NULL,
    UNIQUE(pool_id, position)
);

-- Roll history table
CREATE TABLE roll_history (
    id SERIAL PRIMARY KEY,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    pool_dice_id INTEGER REFERENCES pool_dice(id) ON DELETE SET NULL,
    d20_roll INTEGER CHECK (d20_roll >= 1 AND d20_roll <= 20),
    action_type VARCHAR(100),
    success BOOLEAN,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaign images table
CREATE TABLE campaign_images (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    url VARCHAR(500) NOT NULL,
    description TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX idx_characters_campaign ON characters(campaign_id);
CREATE INDEX idx_characters_user ON characters(user_id);
CREATE INDEX idx_dice_pools_character ON dice_pools(character_id);
CREATE INDEX idx_pool_dice_pool ON pool_dice(pool_id);
CREATE INDEX idx_roll_history_character ON roll_history(character_id);
CREATE INDEX idx_campaign_images_campaign ON campaign_images(campaign_id);