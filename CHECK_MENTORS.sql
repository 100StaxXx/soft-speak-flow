-- Check if mentors exist in Supabase
-- Run this in your Supabase SQL Editor

-- Count mentors
SELECT COUNT(*) as total_mentors FROM mentors;

-- Show all mentors
SELECT id, name, slug, is_active, created_at FROM mentors ORDER BY created_at;

-- Check if is_active column exists and what values it has
SELECT is_active, COUNT(*) as count 
FROM mentors 
GROUP BY is_active;

