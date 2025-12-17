-- Create rhythm tracks table for AI-generated music
CREATE TABLE public.rhythm_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_url TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  prompt TEXT NOT NULL,
  bpm INTEGER NOT NULL CHECK (bpm >= 60 AND bpm <= 200),
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  genre TEXT DEFAULT 'cosmic_synth',
  difficulty_tier TEXT DEFAULT 'all' CHECK (difficulty_tier IN ('all', 'easy', 'medium', 'hard')),
  is_active BOOLEAN DEFAULT true,
  play_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create rhythm track ratings table
CREATE TABLE public.rhythm_track_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES public.rhythm_tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(track_id, user_id)
);

-- Enable RLS
ALTER TABLE public.rhythm_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rhythm_track_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies for rhythm_tracks
CREATE POLICY "Anyone can view active rhythm tracks"
  ON public.rhythm_tracks FOR SELECT
  USING (is_active = true);

CREATE POLICY "Service role can manage rhythm tracks"
  ON public.rhythm_tracks FOR ALL
  USING (is_service_role());

-- RLS policies for rhythm_track_ratings
CREATE POLICY "Users can view all ratings"
  ON public.rhythm_track_ratings FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own ratings"
  ON public.rhythm_track_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings"
  ON public.rhythm_track_ratings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ratings"
  ON public.rhythm_track_ratings FOR DELETE
  USING (auth.uid() = user_id);

-- Create view for tracks with scores
CREATE VIEW public.rhythm_tracks_with_scores AS
SELECT 
  t.*,
  COALESCE(SUM(CASE WHEN r.rating = 'up' THEN 1 ELSE 0 END), 0)::INTEGER as upvotes,
  COALESCE(SUM(CASE WHEN r.rating = 'down' THEN 1 ELSE 0 END), 0)::INTEGER as downvotes,
  COALESCE(SUM(CASE WHEN r.rating = 'up' THEN 1 WHEN r.rating = 'down' THEN -1 ELSE 0 END), 0)::INTEGER as score
FROM public.rhythm_tracks t
LEFT JOIN public.rhythm_track_ratings r ON t.id = r.track_id
WHERE t.is_active = true
GROUP BY t.id;

-- Create storage bucket for rhythm tracks
INSERT INTO storage.buckets (id, name, public)
VALUES ('rhythm-tracks', 'rhythm-tracks', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for rhythm tracks bucket
CREATE POLICY "Anyone can view rhythm track audio"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'rhythm-tracks');

CREATE POLICY "Service role can manage rhythm tracks storage"
  ON storage.objects FOR ALL
  USING (bucket_id = 'rhythm-tracks' AND is_service_role());