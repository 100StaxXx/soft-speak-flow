-- Add column to track companion image regenerations (lifetime limit of 2)
ALTER TABLE public.user_companion 
ADD COLUMN IF NOT EXISTS image_regenerations_used integer NOT NULL DEFAULT 0;