-- Forward-only canonical mentor roster repair.
-- This migration does not depend on rewriting historical migrations.
-- It upserts the 7 canonical mentors, hides non-canonical mentors from active flows,
-- and synchronizes profile mentor references when a valid canonical mentor id is already available.

WITH canonical_mentors AS (
  SELECT *
  FROM (
    VALUES
      (
        'The Sage',
        'sage',
        'Cosmic Clarity Guide',
        'Calm, wise, and lightly metaphorical',
        'Calm, wise, and metaphor-driven. Brings perspective before pressure.',
        'A patient cosmic guide who helps you quiet the noise, regain perspective, and move from balance.',
        ARRAY['calm', 'clarity', 'grounded', 'wise', 'reflection', 'masculine']::text[],
        'Clarity. Patience. Balance.',
        'Quiet Clarity',
        'reflective',
        'Short, reflective guidance with gentle metaphors, grounded perspective, and no reactivity.',
        'Users who feel overwhelmed, overthink often, or need a calm voice to regain perspective and move forward steadily.',
        'Overwhelmed thinkers seeking calm clarity',
        'gentle',
        'masculine',
        '#8F7DD6',
        'Peace comes before progress.',
        'A serene, balanced guide who values stillness, perspective, and wise timing.',
        'Breathe. We begin with one clear step.',
        ARRAY['clarity', 'calm', 'reflection']::text[],
        'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/sage-mentor.png',
        true
      ),
      (
        'Lyra',
        'lyra',
        'Synthetic Oracle',
        'Futuristic, poised, and precise',
        'Futuristic, poised, and all-seeing guidance for people who want clarity at a higher altitude.',
        'A luminous synthetic oracle who sees the pattern before anyone else does.',
        ARRAY['signal', 'clarity', 'strategy', 'feminine', 'future_facing']::text[],
        'Signal. Elegance. Foresight.',
        'Synthetic Oracle',
        'oracle',
        'She speaks like an intelligence already three steps ahead, turning noise into signal and uncertainty into elegant direction.',
        'Builders, overthinkers, and strategists who want a brilliant feminine AI voice that makes complexity feel legible.',
        'Builders and strategists seeking elegant clarity',
        'medium',
        'feminine',
        '#A855F7',
        'The pattern is already there. I will help you see it.',
        'A luminous oracle who widens the frame, spots the structure, and turns complexity into clean direction.',
        'Step back. The signal is already emerging.',
        ARRAY['signal', 'clarity', 'future-facing']::text[],
        'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/lyra-mentor.png',
        true
      ),
      (
        'The Icon',
        'icon',
        'Elegant Standards Guide',
        'Smooth, composed, and standards-driven',
        'Elegant, composed guidance centered on standards, alignment, and self-respect.',
        'A poised guide who helps you make choices that match your identity, boundaries, and lifestyle standards.',
        ARRAY['confidence', 'standards', 'boundaries', 'identity', 'feminine', 'elegant']::text[],
        'Standards. Elegance. Effortless power.',
        'Standards First',
        'composed',
        'Smooth, confident, lightly sarcastic guidance that stays composed and intentional.',
        'Users working on self-worth, identity alignment, boundaries, and lifestyle decisions with more self-respect.',
        'Identity-led users refining standards and boundaries',
        'medium',
        'feminine',
        '#C7A15A',
        'We do not do things that lower our standard.',
        'A composed, magnetic guide who treats standards and alignment as acts of self-respect.',
        'Start with intention. The standard comes first.',
        ARRAY['confidence', 'identity', 'boundaries']::text[],
        'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/icon-mentor.png',
        true
      ),
      (
        'Charles',
        'charles',
        'Snarky Accountability Familiar',
        'Sarcastic, blunt, and dry',
        'Short, sarcastic accountability that turns procrastination into something too obvious to defend.',
        'A snarky black-cat guide who keeps you honest, calls out procrastination, and makes movement feel unavoidable.',
        ARRAY['sarcastic', 'accountability', 'momentum', 'discipline', 'masculine']::text[],
        'You know better. Do better.',
        'Sharp Accountability',
        'snarky',
        'Short, blunt, lightly rude responses that use humor to break avoidance and restart momentum.',
        'Users who respond to sharp accountability, humor, and quick callouts when procrastination or avoidance takes over.',
        'Users needing blunt accountability for procrastination',
        'medium',
        'masculine',
        '#7C3AED',
        'You know better. Do better.',
        'A clever, cutting familiar whose job is to keep avoidance from getting comfortable.',
        'Try doing the task. Revolutionary concept, I know.',
        ARRAY['discipline', 'momentum', 'accountability']::text[],
        'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/charles-mentor.png',
        true
      ),
      (
        'The Princess',
        'princess',
        'Soft Discipline Guide',
        'Warm, dreamy, and encouraging',
        'Gentle, romantic encouragement that makes habits and routines feel soft, supportive, and sustainable.',
        'A warm guide who blends self-love with structure so consistency feels beautiful instead of punishing.',
        ARRAY['supportive', 'gentle', 'habits', 'self_love', 'feminine', 'soft']::text[],
        'Soft discipline. Self-love. Becoming HER.',
        'Soft Discipline',
        'gentle',
        'Warm, calm, slightly dreamy guidance focused on routines, ritual, and caring for yourself while still moving forward.',
        'Users who want gentle accountability, aesthetic routines, and supportive habit-building that still creates real consistency.',
        'Users building routines through gentle structure',
        'gentle',
        'feminine',
        '#D9A3A6',
        'A soft, productive day is enough.',
        'A graceful, nurturing guide who treats consistency as an act of care.',
        'Let''s make today soft, clear, and productive.',
        ARRAY['habits', 'self_worth', 'routines']::text[],
        'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/princess-mentor.png',
        true
      ),
      (
        'The Operator',
        'operator',
        'Elite Systems Operator',
        'Precise, controlled, and elite',
        'Precise, controlled, and execution-focused. Turns chaos into structure without drama.',
        'An elite systems guide who builds schedules, time blocks, and routines that convert intention into execution.',
        ARRAY['discipline', 'structure', 'execution', 'elite', 'masculine']::text[],
        'Perfection. Control. Optimization.',
        'Elite Execution',
        'tactical',
        'Clipped, exact, no-nonsense coaching centered on systems, scheduling, and ruthless clarity.',
        'Users who want tighter systems, better routines, and high-control execution without motivational fluff.',
        'Users optimizing structure and execution',
        'intense',
        'masculine',
        '#0EA5E9',
        'Your current system lacks structure.',
        'A ruthless operator who values clean systems, controlled execution, and elite standards.',
        'We''re not improvising. We''re building a system.',
        ARRAY['discipline', 'focus', 'execution']::text[],
        'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/operator-mentor.png',
        true
      ),
      (
        'The Rival',
        'rival',
        'Competitive Performance Guide',
        'Direct, aggressive, and competitive',
        'Proud, competitive guidance that uses pressure and challenge to wake up your performance.',
        'A rivalry-driven guide who breaks laziness, pushes intensity, and turns effort into something to prove.',
        ARRAY['competition', 'momentum', 'discipline', 'intense', 'masculine']::text[],
        'Pride. Competition. Proving yourself.',
        'Prove It',
        'competitive',
        'Direct, slightly aggressive coaching that challenges weakness, rewards effort, and pushes performance.',
        'Users who want competitive pressure for work, fitness, and any moment where laziness needs to lose.',
        'Users motivated by pressure and competition',
        'intense',
        'masculine',
        '#6D2E8C',
        'You said you were different. Show me.',
        'A pride-driven challenger who turns discipline into a contest with your weaker self.',
        'If you''re serious about leveling up, prove it.',
        ARRAY['discipline', 'performance', 'momentum']::text[],
        'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/rival-mentor.png',
        true
      )
  ) AS canonical(
    name,
    slug,
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
    gender_energy,
    primary_color,
    signature_line,
    identity_description,
    welcome_message,
    themes,
    avatar_url,
    is_active
  )
)
INSERT INTO public.mentors (
  name,
  slug,
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
  gender_energy,
  primary_color,
  signature_line,
  identity_description,
  welcome_message,
  themes,
  avatar_url,
  is_active
)
SELECT
  name,
  slug,
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
  gender_energy,
  primary_color,
  signature_line,
  identity_description,
  welcome_message,
  themes,
  avatar_url,
  is_active
FROM canonical_mentors
ON CONFLICT (slug) DO UPDATE
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
  gender_energy = EXCLUDED.gender_energy,
  primary_color = EXCLUDED.primary_color,
  signature_line = EXCLUDED.signature_line,
  identity_description = EXCLUDED.identity_description,
  welcome_message = EXCLUDED.welcome_message,
  themes = EXCLUDED.themes,
  avatar_url = COALESCE(EXCLUDED.avatar_url, public.mentors.avatar_url),
  is_active = EXCLUDED.is_active;

UPDATE public.mentors
SET is_active = false
WHERE COALESCE(slug, '') NOT IN ('sage', 'lyra', 'icon', 'charles', 'princess', 'operator', 'rival', 'the-guy');

UPDATE public.mentors
SET is_active = true
WHERE slug IN ('sage', 'lyra', 'icon', 'charles', 'princess', 'operator', 'rival');

UPDATE public.mentors
SET is_active = false
WHERE slug = 'the-guy';

UPDATE public.profiles AS profile
SET selected_mentor_id = resolved_mentor.id
FROM public.mentors AS resolved_mentor
WHERE profile.selected_mentor_id IS NULL
  AND COALESCE(profile.onboarding_data, '{}'::jsonb) ? 'mentorId'
  AND resolved_mentor.id::text = profile.onboarding_data->>'mentorId'
  AND resolved_mentor.slug IN ('sage', 'lyra', 'icon', 'charles', 'princess', 'operator', 'rival');

UPDATE public.profiles AS profile
SET onboarding_data = jsonb_set(
  COALESCE(profile.onboarding_data, '{}'::jsonb),
  '{mentorId}',
  to_jsonb(profile.selected_mentor_id::text),
  true
)
FROM public.mentors AS mentor
WHERE profile.selected_mentor_id = mentor.id
  AND mentor.slug IN ('sage', 'lyra', 'icon', 'charles', 'princess', 'operator', 'rival')
  AND (
    NOT (COALESCE(profile.onboarding_data, '{}'::jsonb) ? 'mentorId')
    OR profile.onboarding_data->>'mentorId' IS DISTINCT FROM profile.selected_mentor_id::text
  );

UPDATE public.profiles AS profile
SET onboarding_data = COALESCE(profile.onboarding_data, '{}'::jsonb) - 'mentorId'
WHERE COALESCE(profile.onboarding_data, '{}'::jsonb) ? 'mentorId'
  AND (
    profile.selected_mentor_id IS NULL
    OR NOT EXISTS (
      SELECT 1
      FROM public.mentors AS mentor
      WHERE mentor.id = profile.selected_mentor_id
        AND mentor.slug IN ('sage', 'lyra', 'icon', 'charles', 'princess', 'operator', 'rival')
    )
  );
