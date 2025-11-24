-- Add invite_code to epics table for shareable links
ALTER TABLE epics ADD COLUMN invite_code TEXT UNIQUE;

-- Generate invite codes for existing epics
UPDATE epics 
SET invite_code = 'EPIC-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8))
WHERE invite_code IS NULL;