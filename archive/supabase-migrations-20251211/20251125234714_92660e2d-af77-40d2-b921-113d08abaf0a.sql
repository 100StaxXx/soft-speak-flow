-- Add Discord guild channel columns to epics table
ALTER TABLE epics ADD COLUMN discord_channel_id text;
ALTER TABLE epics ADD COLUMN discord_invite_url text;
ALTER TABLE epics ADD COLUMN discord_ready boolean DEFAULT false;

-- Create index for efficient queries on discord_ready
CREATE INDEX idx_epics_discord_ready ON epics(discord_ready) WHERE discord_ready = true;