-- Add category column to habits table for auto-categorization
ALTER TABLE habits 
ADD COLUMN category TEXT 
CHECK (category IN ('mind', 'body', 'soul'));