-- Create table to cache AI-generated adversary images
CREATE TABLE public.adversary_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  theme TEXT NOT NULL,
  tier TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(theme, tier)
);

-- Enable RLS
ALTER TABLE public.adversary_images ENABLE ROW LEVEL SECURITY;

-- Anyone can read adversary images (they're shared assets)
CREATE POLICY "Anyone can view adversary images"
ON public.adversary_images
FOR SELECT
USING (true);

-- Only service role can insert (edge function)
CREATE POLICY "Service role can insert adversary images"
ON public.adversary_images
FOR INSERT
WITH CHECK (true);