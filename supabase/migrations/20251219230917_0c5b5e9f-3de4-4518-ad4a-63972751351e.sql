-- Add guild customization columns to communities table
ALTER TABLE public.communities 
ADD COLUMN IF NOT EXISTS banner_style TEXT DEFAULT 'cosmic',
ADD COLUMN IF NOT EXISTS emblem_icon TEXT DEFAULT 'shield',
ADD COLUMN IF NOT EXISTS frame_style TEXT DEFAULT 'ornate',
ADD COLUMN IF NOT EXISTS glow_effect TEXT DEFAULT 'pulse',
ADD COLUMN IF NOT EXISTS particle_effect TEXT DEFAULT 'stars';

-- Add comments for documentation
COMMENT ON COLUMN public.communities.banner_style IS 'Banner pattern: cosmic, flames, crystal, lightning, nature, void, aurora, nebula';
COMMENT ON COLUMN public.communities.emblem_icon IS 'Guild emblem icon: shield, sword, dragon, crown, phoenix, wolf, star, crystal';
COMMENT ON COLUMN public.communities.frame_style IS 'Card frame style: ornate, crystal, flame, circuit, scale, deity, dimensional';
COMMENT ON COLUMN public.communities.glow_effect IS 'Glow animation: pulse, breathe, shimmer, flicker, shift, none';
COMMENT ON COLUMN public.communities.particle_effect IS 'Particle effect: stars, embers, ice, void, divine, dimensional, none';