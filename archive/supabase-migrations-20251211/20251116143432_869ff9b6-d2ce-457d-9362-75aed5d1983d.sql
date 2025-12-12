-- Add transcript column to daily_pep_talks table to store word-level timestamps
ALTER TABLE public.daily_pep_talks 
ADD COLUMN IF NOT EXISTS transcript jsonb;