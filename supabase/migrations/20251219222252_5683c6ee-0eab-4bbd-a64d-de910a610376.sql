-- Make epic_id nullable on guild tables to support community-only records

-- Guild shouts: make epic_id nullable
ALTER TABLE public.guild_shouts ALTER COLUMN epic_id DROP NOT NULL;

-- Guild rivalries: make epic_id nullable  
ALTER TABLE public.guild_rivalries ALTER COLUMN epic_id DROP NOT NULL;

-- Add check constraint to ensure at least one of epic_id or community_id is set
ALTER TABLE public.guild_shouts ADD CONSTRAINT guild_shouts_context_check 
  CHECK (epic_id IS NOT NULL OR community_id IS NOT NULL);

ALTER TABLE public.guild_rivalries ADD CONSTRAINT guild_rivalries_context_check 
  CHECK (epic_id IS NOT NULL OR community_id IS NOT NULL);