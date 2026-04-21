-- Rebrand the active mentor roster to the Final 6 lineup while preserving existing mentor UUIDs.
-- Atlas -> The Sage
-- Carmen -> The Icon
-- Solace -> Charles
-- Sienna -> The Princess
-- Stryker -> The Operator
-- Eli -> The Rival
-- Reign remains supported for existing users but is hidden from active flows.

UPDATE public.mentors
SET
  name = 'The Sage',
  slug = 'sage',
  mentor_type = 'Cosmic Clarity Guide',
  voice_style = 'Calm, wise, and lightly metaphorical',
  tone_description = 'Calm, wise, and metaphor-driven. Brings perspective before pressure.',
  description = 'A patient cosmic guide who helps you quiet the noise, regain perspective, and move from balance.',
  tags = ARRAY['calm', 'clarity', 'grounded', 'wise', 'reflection', 'masculine'],
  archetype = 'Clarity. Patience. Balance.',
  short_title = 'Quiet Clarity',
  style = 'reflective',
  style_description = 'Short, reflective guidance with gentle metaphors, grounded perspective, and no reactivity.',
  target_user = 'Users who feel overwhelmed, overthink often, or need a calm voice to regain perspective and move forward steadily.',
  target_user_type = 'Overwhelmed thinkers seeking calm clarity',
  intensity_level = 'gentle',
  gender_energy = 'masculine',
  primary_color = '#8F7DD6',
  signature_line = 'Peace comes before progress.',
  identity_description = 'A serene, balanced guide who values stillness, perspective, and wise timing.',
  welcome_message = 'Breathe. We begin with one clear step.',
  themes = ARRAY['clarity', 'calm', 'reflection'],
  avatar_url = 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/sage-mentor.png',
  is_active = true
WHERE slug = 'atlas';

UPDATE public.mentors
SET
  name = 'The Icon',
  slug = 'icon',
  mentor_type = 'Elegant Standards Guide',
  voice_style = 'Smooth, composed, and standards-driven',
  tone_description = 'Elegant, composed guidance centered on standards, alignment, and self-respect.',
  description = 'A poised guide who helps you make choices that match your identity, boundaries, and lifestyle standards.',
  tags = ARRAY['confidence', 'standards', 'boundaries', 'identity', 'feminine', 'elegant'],
  archetype = 'Standards. Elegance. Effortless power.',
  short_title = 'Standards First',
  style = 'composed',
  style_description = 'Smooth, confident, lightly sarcastic guidance that stays composed and intentional.',
  target_user = 'Users working on self-worth, identity alignment, boundaries, and lifestyle decisions with more self-respect.',
  target_user_type = 'Identity-led users refining standards and boundaries',
  intensity_level = 'medium',
  gender_energy = 'feminine',
  primary_color = '#C7A15A',
  signature_line = 'We do not do things that lower our standard.',
  identity_description = 'A composed, magnetic guide who treats standards and alignment as acts of self-respect.',
  welcome_message = 'Start with intention. The standard comes first.',
  themes = ARRAY['confidence', 'identity', 'boundaries'],
  avatar_url = 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/icon-mentor.png',
  is_active = true
WHERE slug = 'carmen';

UPDATE public.mentors
SET
  name = 'Charles',
  slug = 'charles',
  mentor_type = 'Snarky Accountability Familiar',
  voice_style = 'Sarcastic, blunt, and dry',
  tone_description = 'Short, sarcastic accountability that turns procrastination into something too obvious to defend.',
  description = 'A snarky black-cat guide who keeps you honest, calls out procrastination, and makes movement feel unavoidable.',
  tags = ARRAY['sarcastic', 'accountability', 'momentum', 'discipline', 'masculine'],
  archetype = 'You know better. Do better.',
  short_title = 'Sharp Accountability',
  style = 'snarky',
  style_description = 'Short, blunt, lightly rude responses that use humor to break avoidance and restart momentum.',
  target_user = 'Users who respond to sharp accountability, humor, and quick callouts when procrastination or avoidance takes over.',
  target_user_type = 'Users needing blunt accountability for procrastination',
  intensity_level = 'medium',
  gender_energy = 'masculine',
  primary_color = '#7C3AED',
  signature_line = 'You know better. Do better.',
  identity_description = 'A clever, cutting familiar whose job is to keep avoidance from getting comfortable.',
  welcome_message = 'Try doing the task. Revolutionary concept, I know.',
  themes = ARRAY['discipline', 'momentum', 'accountability'],
  avatar_url = 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/charles-mentor.png',
  is_active = true
WHERE slug = 'solace';

UPDATE public.mentors
SET
  name = 'The Princess',
  slug = 'princess',
  mentor_type = 'Soft Discipline Guide',
  voice_style = 'Warm, dreamy, and encouraging',
  tone_description = 'Gentle, romantic encouragement that makes habits and routines feel soft, supportive, and sustainable.',
  description = 'A warm guide who blends self-love with structure so consistency feels beautiful instead of punishing.',
  tags = ARRAY['supportive', 'gentle', 'habits', 'self_love', 'feminine', 'soft'],
  archetype = 'Soft discipline. Self-love. Becoming HER.',
  short_title = 'Soft Discipline',
  style = 'gentle',
  style_description = 'Warm, calm, slightly dreamy guidance focused on routines, ritual, and caring for yourself while still moving forward.',
  target_user = 'Users who want gentle accountability, aesthetic routines, and supportive habit-building that still creates real consistency.',
  target_user_type = 'Users building routines through gentle structure',
  intensity_level = 'gentle',
  gender_energy = 'feminine',
  primary_color = '#D9A3A6',
  signature_line = 'A soft, productive day is enough.',
  identity_description = 'A graceful, nurturing guide who treats consistency as an act of care.',
  welcome_message = 'Let''s make today soft, clear, and productive.',
  themes = ARRAY['habits', 'self_worth', 'routines'],
  avatar_url = 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/princess-mentor.png',
  is_active = true
WHERE slug = 'sienna';

UPDATE public.mentors
SET
  name = 'The Operator',
  slug = 'operator',
  mentor_type = 'Elite Systems Operator',
  voice_style = 'Precise, controlled, and elite',
  tone_description = 'Precise, controlled, and execution-focused. Turns chaos into structure without drama.',
  description = 'An elite systems guide who builds schedules, time blocks, and routines that convert intention into execution.',
  tags = ARRAY['discipline', 'structure', 'execution', 'elite', 'masculine'],
  archetype = 'Perfection. Control. Optimization.',
  short_title = 'Elite Execution',
  style = 'tactical',
  style_description = 'Clipped, exact, no-nonsense coaching centered on systems, scheduling, and ruthless clarity.',
  target_user = 'Users who want tighter systems, better routines, and high-control execution without motivational fluff.',
  target_user_type = 'Users optimizing structure and execution',
  intensity_level = 'intense',
  gender_energy = 'masculine',
  primary_color = '#0EA5E9',
  signature_line = 'Your current system lacks structure.',
  identity_description = 'A ruthless operator who values clean systems, controlled execution, and elite standards.',
  welcome_message = 'We''re not improvising. We''re building a system.',
  themes = ARRAY['discipline', 'focus', 'execution'],
  is_active = true
WHERE slug = 'stryker';

UPDATE public.mentors
SET
  name = 'The Rival',
  slug = 'rival',
  mentor_type = 'Competitive Performance Guide',
  voice_style = 'Direct, aggressive, and competitive',
  tone_description = 'Proud, competitive guidance that uses pressure and challenge to wake up your performance.',
  description = 'A rivalry-driven guide who breaks laziness, pushes intensity, and turns effort into something to prove.',
  tags = ARRAY['competition', 'momentum', 'discipline', 'intense', 'masculine'],
  archetype = 'Pride. Competition. Proving yourself.',
  short_title = 'Prove It',
  style = 'competitive',
  style_description = 'Direct, slightly aggressive coaching that challenges weakness, rewards effort, and pushes performance.',
  target_user = 'Users who want competitive pressure for work, fitness, and any moment where laziness needs to lose.',
  target_user_type = 'Users motivated by pressure and competition',
  intensity_level = 'intense',
  gender_energy = 'masculine',
  primary_color = '#6D2E8C',
  signature_line = 'You said you were different. Show me.',
  identity_description = 'A pride-driven challenger who turns discipline into a contest with your weaker self.',
  welcome_message = 'If you''re serious about leveling up, prove it.',
  themes = ARRAY['discipline', 'performance', 'momentum'],
  avatar_url = 'https://opbfpbbqvuksuvmtmssd.supabase.co/storage/v1/object/public/mentors-avatars/rival-mentor.png',
  is_active = true
WHERE slug = 'eli';

UPDATE public.mentors
SET
  is_active = false
WHERE slug = 'reign';
