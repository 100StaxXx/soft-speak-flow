-- Add Tamagotchi lifecycle columns to user_companion
ALTER TABLE public.user_companion 
ADD COLUMN IF NOT EXISTS is_alive boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS death_date date,
ADD COLUMN IF NOT EXISTS death_cause text,
ADD COLUMN IF NOT EXISTS care_score integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS recovery_progress integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS scars jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS hunger integer DEFAULT 100,
ADD COLUMN IF NOT EXISTS happiness integer DEFAULT 100;

-- Create memorial table for dead companions
CREATE TABLE IF NOT EXISTS public.companion_memorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  companion_name text NOT NULL,
  spirit_animal text NOT NULL,
  core_element text,
  days_together integer NOT NULL,
  death_date date NOT NULL,
  death_cause text NOT NULL,
  final_evolution_stage integer DEFAULT 1,
  final_image_url text,
  memorial_image_url text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on companion_memorials
ALTER TABLE public.companion_memorials ENABLE ROW LEVEL SECURITY;

-- Users can view their own memorials
CREATE POLICY "Users can view their own memorials"
ON public.companion_memorials
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own memorials (via edge function)
CREATE POLICY "Users can create their own memorials"
ON public.companion_memorials
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_companion_memorials_user_id ON public.companion_memorials(user_id);

-- Add comment for documentation
COMMENT ON TABLE public.companion_memorials IS 'Stores memorials for companions that have died from neglect';