-- Add category field to daily_tasks for Mind/Body/Soul categorization
ALTER TABLE daily_tasks 
ADD COLUMN category text CHECK (category IN ('mind', 'body', 'soul'));

-- Add theme_color field to epics for themed color palettes
ALTER TABLE epics 
ADD COLUMN theme_color text DEFAULT 'heroic' CHECK (theme_color IN ('heroic', 'warrior', 'mystic', 'nature', 'solar'));

-- Add index for category filtering
CREATE INDEX idx_daily_tasks_category ON daily_tasks(category) WHERE category IS NOT NULL;