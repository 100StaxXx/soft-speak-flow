-- Add companion mood tracking based on user check-ins
ALTER TABLE user_companion ADD COLUMN IF NOT EXISTS current_mood text DEFAULT 'neutral';
ALTER TABLE user_companion ADD COLUMN IF NOT EXISTS last_mood_update timestamp with time zone DEFAULT now();

-- Add public sharing flag for epics
ALTER TABLE epics ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Create index for finding public epics
CREATE INDEX IF NOT EXISTS idx_epics_public ON epics(is_public) WHERE is_public = true;

-- Add RLS policy for viewing public epics
CREATE POLICY "Anyone can view public epics" ON epics
  FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);