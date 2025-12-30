-- Add sort_order column to habits table
ALTER TABLE habits ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Initialize sort_order based on created_at for existing habits
UPDATE habits SET sort_order = sub.row_num - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) as row_num
  FROM habits
) sub
WHERE habits.id = sub.id;