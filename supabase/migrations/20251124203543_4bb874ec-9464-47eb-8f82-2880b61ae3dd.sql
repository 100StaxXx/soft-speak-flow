-- ============================================
-- CRITICAL SECURITY FIXES
-- ============================================

-- Fix 1: Strengthen profiles table RLS policies
-- Drop existing policies and recreate with additional security
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
  )
  WITH CHECK (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id 
    AND auth.uid() IS NOT NULL
  );

-- Fix 2: Add RLS to push_subscriptions table if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'push_subscriptions'
  ) THEN
    ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Users can manage own subscriptions" ON public.push_subscriptions;
    
    CREATE POLICY "Users can manage own subscriptions"
      ON public.push_subscriptions
      FOR ALL
      USING (
        auth.uid() = user_id 
        AND auth.uid() IS NOT NULL
      )
      WITH CHECK (
        auth.uid() = user_id 
        AND auth.uid() IS NOT NULL
      );
  END IF;
END $$;

-- ============================================
-- BATTLE SYSTEM SECURITY
-- ============================================

-- Fix 3: Add proper battle system RLS policies
-- Only allow system/service role to create and modify battle data

-- Create service role check function
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.jwt() ->> 'role' = 'service_role'
$$;

-- Battle matches policies
CREATE POLICY "Service can insert matches"
  ON public.battle_matches
  FOR INSERT
  WITH CHECK (is_service_role());

CREATE POLICY "Service can update matches"
  ON public.battle_matches
  FOR UPDATE
  USING (is_service_role());

-- Battle participants policies  
CREATE POLICY "Service can insert participants"
  ON public.battle_participants
  FOR INSERT
  WITH CHECK (is_service_role());

CREATE POLICY "Service can update participants"
  ON public.battle_participants
  FOR UPDATE
  USING (is_service_role());

-- Battle rounds policies
CREATE POLICY "Service can insert rounds"
  ON public.battle_rounds
  FOR INSERT
  WITH CHECK (is_service_role());

CREATE POLICY "Service can update rounds"
  ON public.battle_rounds
  FOR UPDATE
  USING (is_service_role());

-- Battle rankings policies
CREATE POLICY "Service can insert rankings"
  ON public.battle_rankings
  FOR INSERT
  WITH CHECK (is_service_role());

CREATE POLICY "Service can update rankings"
  ON public.battle_rankings
  FOR UPDATE
  USING (is_service_role());

-- ============================================
-- XP SYSTEM PROTECTION
-- ============================================

-- Fix 4: Create xp_events table with proper validation if it doesn't exist
CREATE TABLE IF NOT EXISTS public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id uuid REFERENCES public.user_companion(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  xp_amount integer NOT NULL CHECK (xp_amount > 0 AND xp_amount <= 100),
  source_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on xp_events
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own xp events" ON public.xp_events;
DROP POLICY IF EXISTS "Users can insert own xp events" ON public.xp_events;

-- Only allow viewing, system creates XP events
CREATE POLICY "Users can view own xp events"
  ON public.xp_events
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert xp events"
  ON public.xp_events
  FOR INSERT
  WITH CHECK (is_service_role());

-- ============================================
-- EPIC INVITE CODE VALIDATION
-- ============================================

-- Fix 5: Add invite code validation for epic_members
DROP POLICY IF EXISTS "Users can join public epics" ON public.epic_members;

CREATE POLICY "Users can join public epics with valid invite"
  ON public.epic_members
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
    AND (
      -- Can join public epics
      (epic_id IN (
        SELECT id FROM public.epics 
        WHERE is_public = true
      ))
      -- Note: Invite code validation should be handled in application logic
      -- as RLS cannot access request parameters
    )
  );

-- ============================================
-- MENTOR NUDGES PROTECTION
-- ============================================

-- Fix 6: Restrict mentor_nudges INSERT to service role only
DROP POLICY IF EXISTS "Users can insert nudges" ON public.mentor_nudges;

CREATE POLICY "Service can insert nudges"
  ON public.mentor_nudges
  FOR INSERT
  WITH CHECK (is_service_role());

-- ============================================
-- AI LOGS ADDITIONAL PROTECTION
-- ============================================

-- Fix 7: Strengthen ai_output_validation_log policies
DROP POLICY IF EXISTS "Users can view their own validation logs" ON public.ai_output_validation_log;

CREATE POLICY "Users can view their own validation logs"
  ON public.ai_output_validation_log
  FOR SELECT
  USING (
    auth.uid() = user_id 
    AND auth.uid() IS NOT NULL
  );

-- Only service role can insert validation logs
CREATE POLICY "Service can insert validation logs"
  ON public.ai_output_validation_log
  FOR INSERT
  WITH CHECK (is_service_role());

-- ============================================
-- TASK REMINDER SYSTEM
-- ============================================

-- Fix 8: Create and secure task_reminders_log table
CREATE TABLE IF NOT EXISTS public.task_reminders_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id uuid REFERENCES public.daily_tasks(id) ON DELETE CASCADE,
  sent_at timestamp with time zone DEFAULT now() NOT NULL,
  delivery_status text DEFAULT 'sent',
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.task_reminders_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own reminder logs
CREATE POLICY "Users can view own reminder logs"
  ON public.task_reminders_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert reminder logs
DROP POLICY IF EXISTS "System can insert reminder logs" ON public.task_reminders_log;

CREATE POLICY "Service can insert reminder logs"
  ON public.task_reminders_log
  FOR INSERT
  WITH CHECK (is_service_role());

-- ============================================
-- COMPANION EVOLUTIONS VALIDATION
-- ============================================

-- Fix 9: Strengthen companion_evolutions to prevent artificial inflation
DROP POLICY IF EXISTS "Users can insert own evolutions" ON public.companion_evolutions;

CREATE POLICY "Service can insert evolutions"
  ON public.companion_evolutions
  FOR INSERT
  WITH CHECK (is_service_role());

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_xp_events_user_id ON public.xp_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_events_companion_id ON public.xp_events(companion_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_user_id ON public.task_reminders_log(user_id);
CREATE INDEX IF NOT EXISTS idx_task_reminders_task_id ON public.task_reminders_log(task_id);