
-- =============================================
-- PHASE 1: HIDDEN CARE SIGNAL INFRASTRUCTURE
-- =============================================

-- Add hidden care signal columns to user_companion
ALTER TABLE public.user_companion 
ADD COLUMN IF NOT EXISTS care_consistency float DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS care_responsiveness float DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS care_balance float DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS care_intent float DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS care_recovery float DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS care_pattern jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS last_7_days_activity jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS completion_timestamps jsonb DEFAULT '[]';

-- Evolution path system
ALTER TABLE public.user_companion 
ADD COLUMN IF NOT EXISTS evolution_path text,
ADD COLUMN IF NOT EXISTS evolution_path_locked boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS path_determination_date date;

-- Dormancy system (replaces immediate death)
ALTER TABLE public.user_companion 
ADD COLUMN IF NOT EXISTS dormant_since date,
ADD COLUMN IF NOT EXISTS dormancy_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS dormancy_recovery_days integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS dormant_image_url text;

-- Bond system
ALTER TABLE public.user_companion 
ADD COLUMN IF NOT EXISTS bond_level integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_interactions integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;

-- Scar system
ALTER TABLE public.user_companion
ADD COLUMN IF NOT EXISTS scarred_image_url text,
ADD COLUMN IF NOT EXISTS scar_history jsonb DEFAULT '[]';

-- Bond milestone portraits
ALTER TABLE public.user_companion
ADD COLUMN IF NOT EXISTS bond_portrait_urls jsonb DEFAULT '{}';

-- =============================================
-- NEW TABLE: companion_pending_consequences
-- Queue delayed effects that trigger later
-- =============================================
CREATE TABLE IF NOT EXISTS public.companion_pending_consequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  consequence_type text NOT NULL,
  trigger_date date NOT NULL,
  payload jsonb DEFAULT '{}',
  processed boolean DEFAULT false,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companion_pending_consequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own pending consequences"
ON public.companion_pending_consequences
FOR SELECT
USING (auth.uid() = user_id);

-- Index for efficient daily processing
CREATE INDEX IF NOT EXISTS idx_pending_consequences_trigger 
ON public.companion_pending_consequences(trigger_date, processed) 
WHERE processed = false;

-- =============================================
-- NEW TABLE: companion_behavior_log
-- Track daily activity patterns for care signal calculation
-- =============================================
CREATE TABLE IF NOT EXISTS public.companion_behavior_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  behavior_date date NOT NULL DEFAULT CURRENT_DATE,
  habits_completed integer DEFAULT 0,
  tasks_completed integer DEFAULT 0,
  check_ins integer DEFAULT 0,
  first_activity_time time,
  last_activity_time time,
  completion_velocity float,
  is_binge boolean DEFAULT false,
  activity_gaps jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, behavior_date)
);

-- Enable RLS
ALTER TABLE public.companion_behavior_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own behavior logs"
ON public.companion_behavior_log
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own behavior logs"
ON public.companion_behavior_log
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own behavior logs"
ON public.companion_behavior_log
FOR UPDATE
USING (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_behavior_log_user_date 
ON public.companion_behavior_log(user_id, behavior_date DESC);

-- =============================================
-- NEW TABLE: companion_memories
-- Store memorable moments for companion to reference
-- =============================================
CREATE TABLE IF NOT EXISTS public.companion_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  memory_type text NOT NULL,
  memory_date date NOT NULL DEFAULT CURRENT_DATE,
  memory_context jsonb DEFAULT '{}',
  referenced_count integer DEFAULT 0,
  last_referenced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companion_memories ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own companion memories"
ON public.companion_memories
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own companion memories"
ON public.companion_memories
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for memory lookups
CREATE INDEX IF NOT EXISTS idx_companion_memories_lookup 
ON public.companion_memories(user_id, companion_id, memory_type);

-- =============================================
-- Expand companion_voice_templates for care-based dialogue
-- =============================================
ALTER TABLE public.companion_voice_templates
ADD COLUMN IF NOT EXISTS care_high_greetings text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS care_medium_greetings text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS care_low_greetings text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS care_critical_greetings text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS recovery_greetings text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS scar_references text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS path_greetings jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS bond_level_dialogue jsonb DEFAULT '{}';
