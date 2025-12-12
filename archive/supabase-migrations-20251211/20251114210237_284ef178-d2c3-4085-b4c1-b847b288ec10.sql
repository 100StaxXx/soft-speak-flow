-- Add theme configuration to mentors table
ALTER TABLE public.mentors
ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT '{
  "primary": "270 60% 50%",
  "secondary": "240 6% 20%",
  "accent": "270 50% 35%",
  "background": "0 0% 7%",
  "foreground": "0 0% 100%",
  "card": "240 6% 15%",
  "border_radius": "1.25rem",
  "border_style": "rounded",
  "glow_effect": true,
  "texture": "none",
  "motion_effect": "none"
}'::jsonb;

-- Add description for theme usage
COMMENT ON COLUMN public.mentors.theme_config IS 'Complete theme configuration including colors (HSL format), border styles, effects, and visual identity for the mentor';