-- Create table to cache AI-generated personalized cosmic deep dive content
CREATE TABLE public.user_cosmic_deep_dives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placement TEXT NOT NULL,
  sign TEXT NOT NULL,
  for_date DATE NOT NULL,
  
  -- Generated content
  title TEXT NOT NULL,
  tagline TEXT NOT NULL,
  overview TEXT NOT NULL,
  strengths TEXT[] NOT NULL DEFAULT '{}',
  challenges TEXT[] NOT NULL DEFAULT '{}',
  in_relationships TEXT NOT NULL,
  in_work TEXT NOT NULL,
  in_wellness TEXT NOT NULL,
  compatible_signs TEXT[] NOT NULL DEFAULT '{}',
  daily_practice TEXT NOT NULL,
  
  -- Personalization additions
  chart_synergy TEXT,
  todays_focus TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, placement, sign, for_date)
);

-- Enable RLS
ALTER TABLE public.user_cosmic_deep_dives ENABLE ROW LEVEL SECURITY;

-- Users can view their own deep dives
CREATE POLICY "Users can view own cosmic deep dives"
ON public.user_cosmic_deep_dives
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own deep dives
CREATE POLICY "Users can insert own cosmic deep dives"
ON public.user_cosmic_deep_dives
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can manage all (for edge function)
CREATE POLICY "Service can manage all cosmic deep dives"
ON public.user_cosmic_deep_dives
FOR ALL
USING (is_service_role());

-- Create index for fast lookups
CREATE INDEX idx_user_cosmic_deep_dives_lookup 
ON public.user_cosmic_deep_dives(user_id, placement, sign, for_date);