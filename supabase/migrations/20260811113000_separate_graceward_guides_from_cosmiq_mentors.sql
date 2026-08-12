-- Product boundary repair: Graceward guide copy must never mutate Cosmiq's
-- canonical mentor roster. Snapshot the already-migrated Christian profiles,
-- restore public.mentors to Cosmiq, then expose Graceward through a read view.

CREATE TABLE IF NOT EXISTS public.graceward_guide_profiles (
  mentor_id uuid PRIMARY KEY REFERENCES public.mentors(id) ON DELETE CASCADE,
  name text NOT NULL,
  mentor_type text NOT NULL,
  voice_style text NOT NULL,
  tone_description text NOT NULL,
  description text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  archetype text,
  short_title text,
  style text,
  style_description text,
  target_user text,
  target_user_type text,
  intensity_level text,
  signature_line text,
  identity_description text,
  welcome_message text,
  themes text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.graceward_guide_profiles (
  mentor_id,
  name,
  mentor_type,
  voice_style,
  tone_description,
  description,
  tags,
  archetype,
  short_title,
  style,
  style_description,
  target_user,
  target_user_type,
  intensity_level,
  signature_line,
  identity_description,
  welcome_message,
  themes
)
SELECT
  id,
  name,
  mentor_type,
  voice_style,
  tone_description,
  description,
  tags,
  archetype,
  short_title,
  style,
  style_description,
  target_user,
  target_user_type,
  intensity_level,
  signature_line,
  identity_description,
  welcome_message,
  themes
FROM public.mentors
WHERE slug IN ('sage', 'lyra', 'icon', 'charles', 'princess', 'operator', 'rival')
ON CONFLICT (mentor_id) DO UPDATE
SET
  name = EXCLUDED.name,
  mentor_type = EXCLUDED.mentor_type,
  voice_style = EXCLUDED.voice_style,
  tone_description = EXCLUDED.tone_description,
  description = EXCLUDED.description,
  tags = EXCLUDED.tags,
  archetype = EXCLUDED.archetype,
  short_title = EXCLUDED.short_title,
  style = EXCLUDED.style,
  style_description = EXCLUDED.style_description,
  target_user = EXCLUDED.target_user,
  target_user_type = EXCLUDED.target_user_type,
  intensity_level = EXCLUDED.intensity_level,
  signature_line = EXCLUDED.signature_line,
  identity_description = EXCLUDED.identity_description,
  welcome_message = EXCLUDED.welcome_message,
  themes = EXCLUDED.themes,
  updated_at = now();

WITH canonical (
  slug,
  name,
  mentor_type,
  voice_style,
  tone_description,
  description,
  tags,
  archetype,
  short_title,
  style,
  style_description,
  target_user,
  target_user_type,
  intensity_level,
  signature_line,
  identity_description,
  welcome_message,
  themes
) AS (
  VALUES
    (
      'sage', 'The Sage', 'Cosmic Clarity Guide', 'Calm, wise, and lightly metaphorical',
      'Calm, wise, and metaphor-driven. Brings perspective before pressure.',
      'A patient cosmic guide who helps you quiet the noise, regain perspective, and move from balance.',
      ARRAY['calm', 'clarity', 'grounded', 'wise', 'reflection', 'masculine']::text[],
      'Clarity. Patience. Balance.', 'Quiet Clarity', 'reflective',
      'Short, reflective guidance with gentle metaphors, grounded perspective, and no reactivity.',
      'Users who feel overwhelmed, overthink often, or need a calm voice to regain perspective and move forward steadily.',
      'Overwhelmed thinkers seeking calm clarity', 'gentle', 'Peace comes before progress.',
      'A serene, balanced guide who values stillness, perspective, and wise timing.',
      'Breathe. We begin with one clear step.', ARRAY['clarity', 'calm', 'reflection']::text[]
    ),
    (
      'lyra', 'Lyra', 'Synthetic Oracle', 'Futuristic, poised, and precise',
      'Futuristic, poised, and all-seeing guidance for people who want clarity at a higher altitude.',
      'A luminous synthetic oracle who sees the pattern before anyone else does.',
      ARRAY['signal', 'clarity', 'strategy', 'feminine', 'future_facing']::text[],
      'Signal. Elegance. Foresight.', 'Synthetic Oracle', 'oracle',
      'She speaks like an intelligence already three steps ahead, turning noise into signal and uncertainty into elegant direction.',
      'Builders, overthinkers, and strategists who want a brilliant feminine voice that makes complexity feel legible.',
      'Builders and strategists seeking elegant clarity', 'medium',
      'The pattern is already there. I will help you see it.',
      'A luminous oracle who widens the frame, spots the structure, and turns complexity into clean direction.',
      'Step back. The signal is already emerging.', ARRAY['signal', 'clarity', 'future-facing']::text[]
    ),
    (
      'icon', 'The Icon', 'Elegant Standards Guide', 'Smooth, composed, and standards-driven',
      'Elegant, composed guidance centered on standards, alignment, and self-respect.',
      'A poised guide who helps you make choices that match your identity, boundaries, and lifestyle standards.',
      ARRAY['confidence', 'standards', 'boundaries', 'identity', 'feminine', 'elegant']::text[],
      'Standards. Elegance. Effortless power.', 'Standards First', 'composed',
      'Smooth, confident, lightly sarcastic guidance that stays composed and intentional.',
      'Users working on self-worth, identity alignment, boundaries, and lifestyle decisions with more self-respect.',
      'Identity-led users refining standards and boundaries', 'medium',
      'We do not do things that lower our standard.',
      'A composed, magnetic guide who treats standards and alignment as acts of self-respect.',
      'Start with intention. The standard comes first.', ARRAY['confidence', 'identity', 'boundaries']::text[]
    ),
    (
      'charles', 'Charles', 'Snarky Accountability Familiar', 'Sarcastic, blunt, and dry',
      'Short, sarcastic accountability that turns procrastination into something too obvious to defend.',
      'A snarky black-cat guide who keeps you honest, calls out procrastination, and makes movement feel unavoidable.',
      ARRAY['sarcastic', 'accountability', 'momentum', 'discipline', 'masculine']::text[],
      'You know better. Do better.', 'Sharp Accountability', 'snarky',
      'Short, blunt, lightly rude responses that use humor to break avoidance and restart momentum.',
      'Users who respond to sharp accountability, humor, and quick callouts when procrastination or avoidance takes over.',
      'Users needing blunt accountability for procrastination', 'medium', 'You know better. Do better.',
      'A clever, cutting familiar whose job is to keep avoidance from getting comfortable.',
      'Try doing the task. Revolutionary concept, I know.', ARRAY['discipline', 'momentum', 'accountability']::text[]
    ),
    (
      'princess', 'The Princess', 'Soft Discipline Guide', 'Warm, dreamy, and encouraging',
      'Gentle, romantic encouragement that makes habits and routines feel soft, supportive, and sustainable.',
      'A warm guide who blends self-love with structure so consistency feels beautiful instead of punishing.',
      ARRAY['supportive', 'gentle', 'habits', 'self_love', 'feminine', 'soft']::text[],
      'Soft discipline. Self-love. Becoming HER.', 'Soft Discipline', 'gentle',
      'Warm, calm, slightly dreamy guidance focused on routines, ritual, and caring for yourself while still moving forward.',
      'Users who want gentle accountability, aesthetic routines, and supportive habit-building that still creates real consistency.',
      'Users building routines through gentle structure', 'gentle', 'A soft, productive day is enough.',
      'A graceful, nurturing guide who treats consistency as an act of care.',
      'Let''s make today soft, clear, and productive.', ARRAY['habits', 'self_worth', 'routines']::text[]
    ),
    (
      'operator', 'The Operator', 'Elite Systems Operator', 'Precise, controlled, and elite',
      'Precise, controlled, and execution-focused. Turns chaos into structure without drama.',
      'An elite systems guide who builds schedules, time blocks, and routines that convert intention into execution.',
      ARRAY['discipline', 'structure', 'execution', 'elite', 'masculine']::text[],
      'Perfection. Control. Optimization.', 'Elite Execution', 'tactical',
      'Clipped, exact, no-nonsense coaching centered on systems, scheduling, and ruthless clarity.',
      'Users who want tighter systems, better routines, and high-control execution without motivational fluff.',
      'Users optimizing structure and execution', 'intense', 'Your current system lacks structure.',
      'A ruthless operator who values clean systems, controlled execution, and elite standards.',
      'We''re not improvising. We''re building a system.', ARRAY['discipline', 'focus', 'execution']::text[]
    ),
    (
      'rival', 'The Rival', 'Competitive Performance Guide', 'Direct, aggressive, and competitive',
      'Proud, competitive guidance that uses pressure and challenge to wake up your performance.',
      'A rivalry-driven guide who breaks laziness, pushes intensity, and turns effort into something to prove.',
      ARRAY['competition', 'momentum', 'discipline', 'intense', 'masculine']::text[],
      'Pride. Competition. Proving yourself.', 'Prove It', 'competitive',
      'Direct, slightly aggressive coaching that challenges weakness, rewards effort, and pushes performance.',
      'Users who want competitive pressure for work, fitness, and any moment where laziness needs to lose.',
      'Users motivated by pressure and competition', 'intense', 'You said you were different. Show me.',
      'A pride-driven challenger who turns discipline into a contest with your weaker self.',
      'If you''re serious about leveling up, prove it.', ARRAY['discipline', 'performance', 'momentum']::text[]
    )
)
UPDATE public.mentors AS mentor
SET
  name = canonical.name,
  mentor_type = canonical.mentor_type,
  voice_style = canonical.voice_style,
  tone_description = canonical.tone_description,
  description = canonical.description,
  tags = canonical.tags,
  archetype = canonical.archetype,
  short_title = canonical.short_title,
  style = canonical.style,
  style_description = canonical.style_description,
  target_user = canonical.target_user,
  target_user_type = canonical.target_user_type,
  intensity_level = canonical.intensity_level,
  signature_line = canonical.signature_line,
  identity_description = canonical.identity_description,
  welcome_message = canonical.welcome_message,
  themes = canonical.themes
FROM canonical
WHERE mentor.slug = canonical.slug;

ALTER TABLE public.graceward_guide_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Graceward guide profiles are publicly readable"
  ON public.graceward_guide_profiles;
CREATE POLICY "Graceward guide profiles are publicly readable"
  ON public.graceward_guide_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.graceward_guide_profiles TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.graceward_guides
WITH (security_invoker = true)
AS
SELECT
  mentor.id,
  COALESCE(guide.name, mentor.name) AS name,
  mentor.slug,
  COALESCE(guide.mentor_type, mentor.mentor_type) AS mentor_type,
  COALESCE(guide.voice_style, mentor.voice_style) AS voice_style,
  COALESCE(guide.tone_description, mentor.tone_description) AS tone_description,
  COALESCE(guide.description, mentor.description) AS description,
  COALESCE(guide.tags, mentor.tags) AS tags,
  COALESCE(guide.archetype, mentor.archetype) AS archetype,
  COALESCE(guide.short_title, mentor.short_title) AS short_title,
  COALESCE(guide.style, mentor.style) AS style,
  COALESCE(guide.style_description, mentor.style_description) AS style_description,
  COALESCE(guide.target_user, mentor.target_user) AS target_user,
  COALESCE(guide.target_user_type, mentor.target_user_type) AS target_user_type,
  COALESCE(guide.intensity_level, mentor.intensity_level) AS intensity_level,
  mentor.gender_energy,
  mentor.primary_color,
  COALESCE(guide.signature_line, mentor.signature_line) AS signature_line,
  COALESCE(guide.identity_description, mentor.identity_description) AS identity_description,
  COALESCE(guide.welcome_message, mentor.welcome_message) AS welcome_message,
  COALESCE(guide.themes, mentor.themes) AS themes,
  mentor.avatar_url,
  mentor.is_active,
  mentor.theme_config,
  mentor.created_at
FROM public.mentors AS mentor
LEFT JOIN public.graceward_guide_profiles AS guide ON guide.mentor_id = mentor.id;

GRANT SELECT ON public.graceward_guides TO anon, authenticated, service_role;

COMMENT ON VIEW public.graceward_guides IS
  'Graceward-only Guide presentation layered over canonical Cosmiq mentor identities.';
