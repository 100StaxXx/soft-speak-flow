-- Add Discord Guild Channel support to epics table
-- Minimal impact migration - only adds 3 columns

ALTER TABLE epics 
  ADD COLUMN IF NOT EXISTS discord_channel_id text,
  ADD COLUMN IF NOT EXISTS discord_invite_url text,
  ADD COLUMN IF NOT EXISTS discord_ready boolean DEFAULT false;

-- Add index for efficient queries on discord_ready status
CREATE INDEX IF NOT EXISTS idx_epics_discord_ready 
  ON epics(discord_ready) 
  WHERE discord_ready = true;

-- Add comment for documentation
COMMENT ON COLUMN epics.discord_channel_id IS 'Discord channel ID when guild channel is created';
COMMENT ON COLUMN epics.discord_invite_url IS 'Permanent invite URL for the guild Discord channel';
COMMENT ON COLUMN epics.discord_ready IS 'True when epic has 3+ members and is eligible for Discord channel';
