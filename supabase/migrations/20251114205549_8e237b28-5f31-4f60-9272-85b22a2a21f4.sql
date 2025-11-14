-- Create storage bucket for hero media
INSERT INTO storage.buckets (id, name, public)
VALUES ('hero-media', 'hero-media', true);

-- Create hero_slides table
CREATE TABLE public.hero_slides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID REFERENCES public.mentors(id) ON DELETE CASCADE,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  text TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

-- Anyone can view active hero slides
CREATE POLICY "Anyone can view active hero slides"
ON public.hero_slides
FOR SELECT
USING (is_active = true);

-- Admins can manage hero slides
CREATE POLICY "Admins can insert hero slides"
ON public.hero_slides
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update hero slides"
ON public.hero_slides
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete hero slides"
ON public.hero_slides
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for hero-media bucket
CREATE POLICY "Anyone can view hero media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'hero-media');

CREATE POLICY "Admins can upload hero media"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'hero-media' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update hero media"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'hero-media' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete hero media"
ON storage.objects
FOR DELETE
USING (bucket_id = 'hero-media' AND has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_hero_slides_mentor ON public.hero_slides(mentor_id);
CREATE INDEX idx_hero_slides_position ON public.hero_slides(position);