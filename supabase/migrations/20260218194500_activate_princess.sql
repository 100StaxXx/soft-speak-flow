-- Ensure The Princess exists as an active mentor for selection and onboarding.

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
  style_description,
  target_user,
  target_user_type,
  intensity_level,
  gender_energy,
  primary_color,
  themes,
  is_active
) VALUES (
  'The Princess',
  'princess',
  'Soft Discipline Guide',
  'Warm, dreamy, and encouraging',
  'Gentle, romantic encouragement that makes habits and routines feel soft, supportive, and sustainable.',
  'A warm guide who blends self-love with structure so consistency feels beautiful instead of punishing.',
  ARRAY['supportive', 'gentle', 'habits', 'self_love', 'feminine', 'soft'],
  'Soft Discipline',
  'Soft Discipline',
  'Warm, calm guidance focused on ritual, consistency, and caring for yourself while still moving forward.',
  'Users building routines through gentle structure, softness, and sustainable self-respect.',
  'Users building routines through gentle structure, softness, and sustainable self-respect.',
  'gentle',
  'feminine',
  '#D9A3A6',
  ARRAY['habits', 'self_worth', 'routines', 'calm'],
  true
)
ON CONFLICT (slug) DO UPDATE
SET is_active = true;
