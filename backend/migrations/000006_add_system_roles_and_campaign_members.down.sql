-- Remove campaign_members table
DROP TABLE IF EXISTS campaign_members;

-- Remove system_role from users
ALTER TABLE users DROP COLUMN IF EXISTS system_role;