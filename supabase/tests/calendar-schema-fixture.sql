-- Isolated local test fixture, NOT a migration or a substitute for live-schema QA.
-- Existing calendar tables/policies below are loaded from their actual migrations.
CREATE ROLE authenticated;
CREATE ROLE anon;
CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$
  SELECT current_setting('request.jwt.claim.role',true);
$$;
CREATE FUNCTION public.is_service_role() RETURNS boolean LANGUAGE sql AS $$ SELECT current_user='service_role'; $$;
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TABLE public.daily_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
  task_text text NOT NULL, task_date date, scheduled_time time, estimated_duration integer,
  location text, notes text, completed boolean NOT NULL DEFAULT false, completed_at timestamptz,
  xp_reward integer NOT NULL DEFAULT 10, difficulty text NOT NULL DEFAULT 'easy',
  is_main_quest boolean NOT NULL DEFAULT false, source text NOT NULL DEFAULT 'manual', habit_source_id uuid,
  CONSTRAINT daily_tasks_source_check CHECK (source IN ('manual','voice','nlp','inbox','recurring','onboarding','plan_my_day','outlook_sync','faithful_step','companion')),
  CONSTRAINT daily_tasks_regular_requires_time_or_inbox CHECK (habit_source_id IS NOT NULL OR task_date IS NULL OR scheduled_time IS NOT NULL OR source IN ('outlook_sync','faithful_step')),
  CONSTRAINT daily_tasks_inbox_time_null CHECK (task_date IS NOT NULL OR scheduled_time IS NULL)
);
GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
