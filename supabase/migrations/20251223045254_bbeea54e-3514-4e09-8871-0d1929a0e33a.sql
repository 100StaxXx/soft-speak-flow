-- Add request_type column to influencer_creation_log for rate limiting different request types
ALTER TABLE influencer_creation_log ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'code_creation';