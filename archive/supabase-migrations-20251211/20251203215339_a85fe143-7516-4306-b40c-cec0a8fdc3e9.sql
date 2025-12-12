-- Add identity_insight column for Sun placement
ALTER TABLE public.user_cosmic_deep_dives 
ADD COLUMN IF NOT EXISTS identity_insight text;