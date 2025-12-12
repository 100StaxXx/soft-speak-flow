-- Extend mentors table with new fields
ALTER TABLE public.mentors 
ADD COLUMN IF NOT EXISTS slug text UNIQUE,
ADD COLUMN IF NOT EXISTS archetype text,
ADD COLUMN IF NOT EXISTS short_title text,
ADD COLUMN IF NOT EXISTS style_description text,
ADD COLUMN IF NOT EXISTS target_user text,
ADD COLUMN IF NOT EXISTS intensity_level text,
ADD COLUMN IF NOT EXISTS gender_energy text,
ADD COLUMN IF NOT EXISTS primary_color text,
ADD COLUMN IF NOT EXISTS signature_line text,
ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Create written_content table for quotes, affirmations, scripts
CREATE TABLE IF NOT EXISTS public.written_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL, -- 'quote', 'affirmation', 'script', 'caption', 'prompt', 'micromessage'
  text_content text NOT NULL,
  primary_topic text,
  topics text[] DEFAULT '{}',
  is_premium boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create visual_assets table
CREATE TABLE IF NOT EXISTS public.visual_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL, -- 'hero', 'background', 'card', 'cover'
  asset_url text NOT NULL,
  primary_topic text,
  topics text[] DEFAULT '{}',
  is_premium boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create join tables for multi-mentor content
CREATE TABLE IF NOT EXISTS public.written_mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  written_id uuid REFERENCES public.written_content(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES public.mentors(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(written_id, mentor_id)
);

CREATE TABLE IF NOT EXISTS public.visual_mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visual_id uuid REFERENCES public.visual_assets(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES public.mentors(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(visual_id, mentor_id)
);

CREATE TABLE IF NOT EXISTS public.pep_talk_mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pep_talk_id uuid REFERENCES public.pep_talks(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES public.mentors(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(pep_talk_id, mentor_id)
);

CREATE TABLE IF NOT EXISTS public.lesson_mentors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE CASCADE,
  mentor_id uuid REFERENCES public.mentors(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(lesson_id, mentor_id)
);

-- Enable RLS on new tables
ALTER TABLE public.written_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.written_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visual_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pep_talk_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_mentors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for written_content
CREATE POLICY "Anyone can view written content"
ON public.written_content FOR SELECT
USING (true);

CREATE POLICY "Admins can manage written content"
ON public.written_content FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for visual_assets
CREATE POLICY "Anyone can view visual assets"
ON public.visual_assets FOR SELECT
USING (true);

CREATE POLICY "Admins can manage visual assets"
ON public.visual_assets FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for join tables
CREATE POLICY "Anyone can view written mentors"
ON public.written_mentors FOR SELECT
USING (true);

CREATE POLICY "Admins can manage written mentors"
ON public.written_mentors FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view visual mentors"
ON public.visual_mentors FOR SELECT
USING (true);

CREATE POLICY "Admins can manage visual mentors"
ON public.visual_mentors FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view pep talk mentors"
ON public.pep_talk_mentors FOR SELECT
USING (true);

CREATE POLICY "Admins can manage pep talk mentors"
ON public.pep_talk_mentors FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view lesson mentors"
ON public.lesson_mentors FOR SELECT
USING (true);

CREATE POLICY "Admins can manage lesson mentors"
ON public.lesson_mentors FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));