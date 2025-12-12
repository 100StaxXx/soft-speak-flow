-- Create pep_talks table
CREATE TABLE public.pep_talks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  quote TEXT NOT NULL,
  description TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.pep_talks ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (no auth required for this MVP)
CREATE POLICY "Anyone can view pep talks"
  ON public.pep_talks
  FOR SELECT
  USING (true);

-- Create policies for admin operations (we'll use a simple approach for MVP)
CREATE POLICY "Anyone can insert pep talks"
  ON public.pep_talks
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update pep talks"
  ON public.pep_talks
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete pep talks"
  ON public.pep_talks
  FOR DELETE
  USING (true);

-- Create storage bucket for audio files
INSERT INTO storage.buckets (id, name, public)
VALUES ('pep-talk-audio', 'pep-talk-audio', true);

-- Create storage policies for audio uploads
CREATE POLICY "Anyone can view audio files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'pep-talk-audio');

CREATE POLICY "Anyone can upload audio files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'pep-talk-audio');

CREATE POLICY "Anyone can update audio files"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'pep-talk-audio');

CREATE POLICY "Anyone can delete audio files"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'pep-talk-audio');

-- Create function to ensure only one featured pep talk at a time
CREATE OR REPLACE FUNCTION public.ensure_single_featured()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_featured = true THEN
    UPDATE public.pep_talks
    SET is_featured = false
    WHERE id != NEW.id AND is_featured = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for the function
CREATE TRIGGER ensure_single_featured_trigger
  BEFORE INSERT OR UPDATE ON public.pep_talks
  FOR EACH ROW
  WHEN (NEW.is_featured = true)
  EXECUTE FUNCTION public.ensure_single_featured();