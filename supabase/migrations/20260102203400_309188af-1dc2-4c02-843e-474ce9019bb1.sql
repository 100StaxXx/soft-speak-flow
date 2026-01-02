-- Create epic_journey_paths table to cache generated path images
CREATE TABLE public.epic_journey_paths (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES public.epics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  milestone_index INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  prompt_context JSONB,
  generated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(epic_id, milestone_index)
);

-- Enable RLS
ALTER TABLE public.epic_journey_paths ENABLE ROW LEVEL SECURITY;

-- Users can view their own journey paths
CREATE POLICY "Users can view their own journey paths"
  ON public.epic_journey_paths FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own journey paths
CREATE POLICY "Users can insert their own journey paths"
  ON public.epic_journey_paths FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own journey paths
CREATE POLICY "Users can update their own journey paths"
  ON public.epic_journey_paths FOR UPDATE
  USING (auth.uid() = user_id);

-- Create storage bucket for journey path images
INSERT INTO storage.buckets (id, name, public)
VALUES ('journey-paths', 'journey-paths', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for journey paths bucket
CREATE POLICY "Anyone can view journey path images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'journey-paths');

CREATE POLICY "Authenticated users can upload journey path images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'journey-paths' AND auth.role() = 'authenticated');

-- Create index for faster lookups
CREATE INDEX idx_epic_journey_paths_epic_id ON public.epic_journey_paths(epic_id);
CREATE INDEX idx_epic_journey_paths_user_id ON public.epic_journey_paths(user_id);