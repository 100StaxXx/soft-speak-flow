-- Create user_reflections table for night journal
CREATE TABLE IF NOT EXISTS public.user_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reflection_date DATE NOT NULL,
  mood TEXT NOT NULL CHECK (mood IN ('good', 'neutral', 'tough')),
  note TEXT,
  ai_reply TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, reflection_date)
);

-- Enable RLS on user_reflections
ALTER TABLE public.user_reflections ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_reflections
CREATE POLICY "Users can view own reflections"
  ON public.user_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reflections"
  ON public.user_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reflections"
  ON public.user_reflections FOR UPDATE
  USING (auth.uid() = user_id);

-- Create challenge_tasks table
CREATE TABLE IF NOT EXISTS public.challenge_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  task_title TEXT NOT NULL,
  task_description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on challenge_tasks
ALTER TABLE public.challenge_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for challenge_tasks
CREATE POLICY "Anyone can view challenge tasks"
  ON public.challenge_tasks FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage challenge tasks"
  ON public.challenge_tasks FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Modify challenges table
ALTER TABLE public.challenges 
  DROP CONSTRAINT IF EXISTS challenges_mentor_id_fkey,
  DROP COLUMN IF EXISTS mentor_id,
  ADD COLUMN IF NOT EXISTS total_days INT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Update total_days from duration_days if it exists
UPDATE public.challenges SET total_days = duration_days WHERE total_days IS NULL;

-- Now make total_days NOT NULL if it has values
ALTER TABLE public.challenges ALTER COLUMN total_days SET NOT NULL;

-- Modify user_challenges table
ALTER TABLE public.user_challenges
  ADD COLUMN IF NOT EXISTS current_day INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Update existing records to use status
UPDATE public.user_challenges 
SET status = CASE 
  WHEN completed = true THEN 'completed'
  WHEN is_active = true THEN 'active'
  ELSE 'ended'
END
WHERE status = 'active';

-- Drop old columns after migration
ALTER TABLE public.user_challenges
  DROP COLUMN IF EXISTS is_active,
  DROP COLUMN IF EXISTS completed;

-- Add constraint to ensure only one active challenge per user
CREATE UNIQUE INDEX IF NOT EXISTS one_active_challenge_per_user 
  ON public.user_challenges (user_id) 
  WHERE status = 'active';