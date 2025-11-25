-- Add is_bonus column to daily_tasks table
ALTER TABLE daily_tasks 
ADD COLUMN is_bonus boolean DEFAULT false;