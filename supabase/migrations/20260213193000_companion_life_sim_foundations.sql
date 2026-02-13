-- Companion Life-Sim Foundations
-- Adds rituals, requests, habitat, campaign progression, and social snapshots.

ALTER TABLE public.user_companion
  ADD COLUMN IF NOT EXISTS current_emotional_arc text DEFAULT 'forming',
  ADD COLUMN IF NOT EXISTS routine_stability_score numeric(5,2) DEFAULT 50,
  ADD COLUMN IF NOT EXISTS request_fatigue integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS habitat_theme text DEFAULT 'cosmic_nest';

CREATE TABLE IF NOT EXISTS public.companion_ritual_defs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  ritual_type text NOT NULL,
  base_bond_delta integer NOT NULL DEFAULT 1,
  base_care_delta numeric(5,2) NOT NULL DEFAULT 0.02,
  cooldown_hours integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companion_daily_rituals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  ritual_def_id uuid NOT NULL REFERENCES public.companion_ritual_defs(id) ON DELETE CASCADE,
  ritual_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'pending',
  urgency text NOT NULL DEFAULT 'gentle',
  completed_at timestamp with time zone,
  completion_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, companion_id, ritual_def_id, ritual_date)
);

CREATE TABLE IF NOT EXISTS public.companion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  request_type text NOT NULL,
  title text NOT NULL,
  prompt text NOT NULL,
  urgency text NOT NULL DEFAULT 'gentle',
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  due_at timestamp with time zone,
  resolved_at timestamp with time zone,
  response_style text,
  consequence_hint text,
  request_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companion_request_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.companion_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  action text NOT NULL,
  action_note text,
  impact_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companion_habitat_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL UNIQUE REFERENCES public.user_companion(id) ON DELETE CASCADE,
  biome text NOT NULL DEFAULT 'cosmic_nest',
  ambiance text NOT NULL DEFAULT 'serene',
  quality_tier text NOT NULL DEFAULT 'medium',
  decor_slots jsonb NOT NULL DEFAULT '{"foreground": null, "midground": null, "background": null}'::jsonb,
  unlocked_themes text[] NOT NULL DEFAULT ARRAY['cosmic_nest'],
  last_scene_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companion_habitat_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_name text NOT NULL,
  slot text NOT NULL,
  rarity text NOT NULL DEFAULT 'common',
  is_equipped boolean NOT NULL DEFAULT false,
  unlock_source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  acquired_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, companion_id, item_key)
);

CREATE TABLE IF NOT EXISTS public.companion_campaign_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_key text UNIQUE NOT NULL,
  chapter_index integer NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  unlock_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  branch_group text,
  branch_outcomes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ambient_theme text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companion_campaign_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL UNIQUE REFERENCES public.user_companion(id) ON DELETE CASCADE,
  current_node_id uuid REFERENCES public.companion_campaign_nodes(id) ON DELETE SET NULL,
  current_chapter integer NOT NULL DEFAULT 0,
  unlocked_node_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  completed_node_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  choice_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_advanced_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.companion_social_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.user_companion(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL DEFAULT 'daily',
  headline text NOT NULL,
  snapshot_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility text NOT NULL DEFAULT 'friends',
  published_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_daily_rituals_lookup
  ON public.companion_daily_rituals(user_id, companion_id, ritual_date);

CREATE INDEX IF NOT EXISTS idx_companion_requests_lookup
  ON public.companion_requests(user_id, companion_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_companion_request_history_lookup
  ON public.companion_request_history(user_id, companion_id, action_at DESC);

CREATE INDEX IF NOT EXISTS idx_companion_habitat_items_lookup
  ON public.companion_habitat_items(user_id, companion_id, slot);

CREATE INDEX IF NOT EXISTS idx_companion_campaign_nodes_lookup
  ON public.companion_campaign_nodes(chapter_index, node_key);

CREATE INDEX IF NOT EXISTS idx_companion_social_snapshots_lookup
  ON public.companion_social_snapshots(user_id, published_at DESC);

ALTER TABLE public.companion_ritual_defs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_daily_rituals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_habitat_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_habitat_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_campaign_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_campaign_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companion_social_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read companion ritual defs" ON public.companion_ritual_defs;
CREATE POLICY "Authenticated can read companion ritual defs"
  ON public.companion_ritual_defs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can manage own companion daily rituals" ON public.companion_daily_rituals;
CREATE POLICY "Users can manage own companion daily rituals"
  ON public.companion_daily_rituals
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own companion requests" ON public.companion_requests;
CREATE POLICY "Users can manage own companion requests"
  ON public.companion_requests
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own companion request history" ON public.companion_request_history;
CREATE POLICY "Users can manage own companion request history"
  ON public.companion_request_history
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own companion habitat state" ON public.companion_habitat_state;
CREATE POLICY "Users can manage own companion habitat state"
  ON public.companion_habitat_state
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own companion habitat items" ON public.companion_habitat_items;
CREATE POLICY "Users can manage own companion habitat items"
  ON public.companion_habitat_items
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated can read companion campaign nodes" ON public.companion_campaign_nodes;
CREATE POLICY "Authenticated can read companion campaign nodes"
  ON public.companion_campaign_nodes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can manage own companion campaign progress" ON public.companion_campaign_progress;
CREATE POLICY "Users can manage own companion campaign progress"
  ON public.companion_campaign_progress
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own companion social snapshots" ON public.companion_social_snapshots;
CREATE POLICY "Users can manage own companion social snapshots"
  ON public.companion_social_snapshots
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_companion_ritual_defs_updated_at ON public.companion_ritual_defs;
CREATE TRIGGER update_companion_ritual_defs_updated_at
  BEFORE UPDATE ON public.companion_ritual_defs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_companion_daily_rituals_updated_at ON public.companion_daily_rituals;
CREATE TRIGGER update_companion_daily_rituals_updated_at
  BEFORE UPDATE ON public.companion_daily_rituals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_companion_requests_updated_at ON public.companion_requests;
CREATE TRIGGER update_companion_requests_updated_at
  BEFORE UPDATE ON public.companion_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_companion_habitat_state_updated_at ON public.companion_habitat_state;
CREATE TRIGGER update_companion_habitat_state_updated_at
  BEFORE UPDATE ON public.companion_habitat_state
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_companion_habitat_items_updated_at ON public.companion_habitat_items;
CREATE TRIGGER update_companion_habitat_items_updated_at
  BEFORE UPDATE ON public.companion_habitat_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_companion_campaign_nodes_updated_at ON public.companion_campaign_nodes;
CREATE TRIGGER update_companion_campaign_nodes_updated_at
  BEFORE UPDATE ON public.companion_campaign_nodes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_companion_campaign_progress_updated_at ON public.companion_campaign_progress;
CREATE TRIGGER update_companion_campaign_progress_updated_at
  BEFORE UPDATE ON public.companion_campaign_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.companion_ritual_defs (code, title, description, ritual_type, base_bond_delta, base_care_delta, cooldown_hours, active)
VALUES
  ('morning_attunement', 'Morning Attunement', 'Start the day by checking your companion''s mood and grounding your intent.', 'attention', 1, 0.03, 18, true),
  ('nourish_presence', 'Nourish Presence', 'Share attention and positive reinforcement to stabilize your bond.', 'nurture', 2, 0.04, 12, true),
  ('growth_practice', 'Growth Practice', 'Complete one growth-oriented ritual together to build consistency.', 'growth', 2, 0.05, 20, true),
  ('evening_reflection', 'Evening Reflection', 'Close the day by reflecting on wins, misses, and how to recover tomorrow.', 'reflection', 1, 0.04, 16, true),
  ('recovery_touchpoint', 'Recovery Touchpoint', 'If the day drifted, perform a gentle recovery action to re-center your companion.', 'nurture', 1, 0.06, 8, true)
ON CONFLICT (code) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  ritual_type = EXCLUDED.ritual_type,
  base_bond_delta = EXCLUDED.base_bond_delta,
  base_care_delta = EXCLUDED.base_care_delta,
  cooldown_hours = EXCLUDED.cooldown_hours,
  active = EXCLUDED.active,
  updated_at = now();

INSERT INTO public.companion_campaign_nodes (node_key, chapter_index, title, summary, unlock_rules, branch_group, branch_outcomes, ambient_theme)
VALUES
  (
    'chapter_1_opening_bond',
    1,
    'First Vow',
    'Your companion asks for a promise: consistency over perfection.',
    '{"min_bond_level": 1}'::jsonb,
    'chapter_1',
    '{"steady": "chapter_2_trust_trial", "drift": "chapter_2_repair_call"}'::jsonb,
    'cosmic_dawn'
  ),
  (
    'chapter_2_trust_trial',
    2,
    'Trust Trial',
    'A steady week opens a trust trial where your companion mirrors your discipline.',
    '{"min_routine_stability_score": 55}'::jsonb,
    'chapter_2',
    '{"steady": "chapter_3_resonance", "drift": "chapter_3_fragile_echo"}'::jsonb,
    'starlit_valley'
  ),
  (
    'chapter_2_repair_call',
    2,
    'Repair Call',
    'After missed care, your companion invites a repair ritual instead of retreating.',
    '{"max_routine_stability_score": 54}'::jsonb,
    'chapter_2',
    '{"repair": "chapter_3_resonance", "ignore": "chapter_3_fragile_echo"}'::jsonb,
    'moonlit_garden'
  ),
  (
    'chapter_3_resonance',
    3,
    'Resonance Bloom',
    'Your shared rhythm starts to reshape the habitat itself.',
    '{"min_bond_level": 3}'::jsonb,
    null,
    '{}'::jsonb,
    'aurora_grove'
  ),
  (
    'chapter_3_fragile_echo',
    3,
    'Fragile Echo',
    'The bond wavers, but a focused recovery arc can restore momentum.',
    '{"min_request_fatigue": 2}'::jsonb,
    null,
    '{}'::jsonb,
    'ashen_hollow'
  )
ON CONFLICT (node_key) DO UPDATE SET
  chapter_index = EXCLUDED.chapter_index,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  unlock_rules = EXCLUDED.unlock_rules,
  branch_group = EXCLUDED.branch_group,
  branch_outcomes = EXCLUDED.branch_outcomes,
  ambient_theme = EXCLUDED.ambient_theme,
  updated_at = now();
