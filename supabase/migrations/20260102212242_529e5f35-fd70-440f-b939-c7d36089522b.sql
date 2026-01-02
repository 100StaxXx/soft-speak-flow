-- Create table to cache generated empty state images
CREATE TABLE IF NOT EXISTS public.user_welcome_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_welcome_images ENABLE ROW LEVEL SECURITY;

-- Users can view their own welcome image
CREATE POLICY "Users can view own welcome image"
  ON public.user_welcome_images
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own welcome image
CREATE POLICY "Users can insert own welcome image"
  ON public.user_welcome_images
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own welcome image
CREATE POLICY "Users can update own welcome image"
  ON public.user_welcome_images
  FOR UPDATE
  USING (auth.uid() = user_id);