-- Add Discord guild channel columns to epics table
ALTER TABLE epics ADD COLUMN IF NOT EXISTS discord_channel_id text;
ALTER TABLE epics ADD COLUMN IF NOT EXISTS discord_invite_url text;
ALTER TABLE epics ADD COLUMN IF NOT EXISTS discord_ready boolean DEFAULT false;

-- Create index for efficient queries on discord_ready
CREATE INDEX IF NOT EXISTS idx_epics_discord_ready ON epics(discord_ready) WHERE discord_ready = true;
