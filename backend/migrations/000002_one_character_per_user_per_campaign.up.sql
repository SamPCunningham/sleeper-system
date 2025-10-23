-- Add unique constraint: one character per user per campaign
-- But allow NULL user_id for unassigned characters
CREATE UNIQUE INDEX idx_one_active_char_per_user_campaign 
ON characters(campaign_id, user_id) 
WHERE user_id IS NOT NULL;