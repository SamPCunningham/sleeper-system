-- Add outcome column (success, neutral, failure)
ALTER TABLE roll_history ADD COLUMN outcome VARCHAR(10);

-- Migrate existing data: convert boolean success to outcome
UPDATE roll_history 
SET outcome = CASE 
    WHEN success = true THEN 'success'
    WHEN success = false THEN 'failure'
    ELSE 'neutral'
END;

-- Make outcome NOT NULL after migrating data
ALTER TABLE roll_history ALTER COLUMN outcome SET NOT NULL;

-- We can keep the success column for backward compatibility or drop it
-- Let's keep it for now in case we need to rollback