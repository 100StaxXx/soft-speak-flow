-- Add legacy traits column to user_companion for tracking inherited traits from deceased companions
ALTER TABLE public.user_companion 
ADD COLUMN IF NOT EXISTS legacy_traits jsonb DEFAULT '[]'::jsonb;

-- Add legacy traits column to companion_memorials to preserve what traits were passed on
ALTER TABLE public.companion_memorials 
ADD COLUMN IF NOT EXISTS legacy_traits_passed jsonb DEFAULT '[]'::jsonb;

-- Add index for querying by legacy traits
CREATE INDEX IF NOT EXISTS idx_user_companion_legacy_traits ON public.user_companion USING gin(legacy_traits);

-- Comment for documentation
COMMENT ON COLUMN public.user_companion.legacy_traits IS 'Array of traits inherited from previous deceased companions: [{trait, source_companion, source_element, passed_at}]';
COMMENT ON COLUMN public.companion_memorials.legacy_traits_passed IS 'Array of legacy traits this companion passed to the next generation';