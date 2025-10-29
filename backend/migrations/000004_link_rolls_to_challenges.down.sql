ALTER TABLE roll_history DROP COLUMN IF EXISTS challenge_id;
ALTER TABLE roll_history DROP COLUMN IF EXISTS skill_applied;
ALTER TABLE roll_history DROP COLUMN IF EXISTS other_modifiers;
ALTER TABLE roll_history DROP COLUMN IF EXISTS modified_d6;
DROP INDEX IF EXISTS idx_roll_history_challenge;