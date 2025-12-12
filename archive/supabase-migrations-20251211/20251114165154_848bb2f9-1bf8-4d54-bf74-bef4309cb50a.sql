-- Create mentors table
CREATE TABLE public.mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  avatar_url TEXT,
  mentor_type TEXT NOT NULL UNIQUE,
  tone_description TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  voice_style TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on mentors
ALTER TABLE public.mentors ENABLE ROW LEVEL SECURITY;

-- Anyone can view mentors
CREATE POLICY "Anyone can view mentors"
  ON public.mentors
  FOR SELECT
  USING (true);

-- Only admins can manage mentors
CREATE POLICY "Admins can insert mentors"
  ON public.mentors
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update mentors"
  ON public.mentors
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete mentors"
  ON public.mentors
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Update profiles table to include mentor selection (preferences already exists)
ALTER TABLE public.profiles
ADD COLUMN selected_mentor_id UUID REFERENCES public.mentors(id);

-- Update pep_talks table
ALTER TABLE public.pep_talks
ADD COLUMN mentor_id UUID REFERENCES public.mentors(id),
ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Update videos table
ALTER TABLE public.videos
ADD COLUMN mentor_id UUID REFERENCES public.mentors(id),
ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Update quotes table
ALTER TABLE public.quotes
ADD COLUMN mentor_id UUID REFERENCES public.mentors(id),
ADD COLUMN tags TEXT[] DEFAULT '{}';

-- Update playlists table
ALTER TABLE public.playlists
ADD COLUMN mentor_id UUID REFERENCES public.mentors(id),
ADD COLUMN tags TEXT[] DEFAULT '{}';