-- Add transcript field to pep_talks table for timed captions
ALTER TABLE public.pep_talks 
ADD COLUMN IF NOT EXISTS transcript JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.pep_talks.transcript IS 'Timed transcript with word-level timestamps for synchronized captions. Format: [{"word": "text", "start": 0.0, "end": 0.5}]';