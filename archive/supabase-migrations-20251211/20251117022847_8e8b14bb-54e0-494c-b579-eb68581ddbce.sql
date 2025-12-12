-- Add RLS policy to allow users to delete their own activity feed items
CREATE POLICY "Users can delete own activity"
  ON activity_feed
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Add unique constraint for welcome messages (one per user)
CREATE UNIQUE INDEX idx_unique_welcome_per_user 
  ON activity_feed (user_id, activity_type) 
  WHERE activity_type = 'welcome';

-- Add function to prevent duplicate activity entries for specific types
CREATE OR REPLACE FUNCTION prevent_duplicate_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- For certain activity types, check if one already exists
  IF NEW.activity_type IN ('welcome') THEN
    IF EXISTS (
      SELECT 1 FROM activity_feed 
      WHERE user_id = NEW.user_id 
      AND activity_type = NEW.activity_type
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      -- Silently ignore duplicate instead of raising error
      RETURN NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to prevent duplicates
CREATE TRIGGER check_duplicate_activity
  BEFORE INSERT ON activity_feed
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_activity();