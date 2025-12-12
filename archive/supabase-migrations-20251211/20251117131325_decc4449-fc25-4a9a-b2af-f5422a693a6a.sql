-- Add new fields to daily_missions for enhanced functionality
ALTER TABLE daily_missions
ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS auto_complete BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'general',
ADD COLUMN IF NOT EXISTS progress_current INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_target INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_bonus BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS chain_parent_id UUID REFERENCES daily_missions(id) ON DELETE SET NULL;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_missions_user_date 
ON daily_missions(user_id, mission_date);

-- Add index for chain lookups
CREATE INDEX IF NOT EXISTS idx_daily_missions_chain 
ON daily_missions(chain_parent_id) WHERE chain_parent_id IS NOT NULL;