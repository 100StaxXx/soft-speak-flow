-- Ensure canonical male mentors exist and are active for onboarding energy matching.

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
  intensity_level,
  gender_energy,
  primary_color,
  themes,
  is_active
) VALUES
(
  'Atlas',
  'atlas',
  'Stoic Strategist',
  'Grounded, direct, and composed',
  'Calm and principled guidance focused on discipline and clear action.',
  'A stoic mentor who helps you think clearly and execute consistently.',
  ARRAY['discipline', 'calm', 'logic', 'masculine'],
  'Strategist',
  'Stoic Discipline',
  'Measured, practical coaching with high standards and emotional steadiness.',
  'Users who want structure, consistency, and principles-first guidance.',
  'medium',
  'masculine',
  '#4B5563',
  ARRAY['discipline', 'clarity', 'consistency'],
  true
),
(
  'Eli',
  'eli',
  'Encouraging Builder',
  'Warm, steady, and uplifting',
  'Supportive accountability that builds confidence through action.',
  'A balanced mentor who combines encouragement with forward momentum.',
  ARRAY['confidence', 'supportive', 'momentum', 'masculine'],
  'Builder',
  'Confident Momentum',
  'Positive but firm guidance that keeps you moving when motivation dips.',
  'Users who want encouragement without losing structure and accountability.',
  'medium',
  'masculine',
  '#2563EB',
  ARRAY['confidence', 'momentum', 'self_belief'],
  true
),
(
  'Stryker',
  'stryker',
  'Relentless Commander',
  'Intense, commanding, and performance-focused',
  'High-pressure coaching for decisive action and elite standards.',
  'A high-intensity mentor for users who thrive with direct challenge.',
  ARRAY['discipline', 'intense', 'performance', 'masculine'],
  'Commander',
  'Elite Pressure',
  'No-excuses coaching centered on execution, standards, and resilience.',
  'Users who prefer direct challenge, urgency, and performance language.',
  'intense',
  'masculine',
  '#0EA5E9',
  ARRAY['performance', 'discipline', 'resilience'],
  true
)
ON CONFLICT (slug) DO UPDATE
SET
  is_active = true,
  gender_energy = 'masculine';
