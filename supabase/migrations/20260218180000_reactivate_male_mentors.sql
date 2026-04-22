-- Ensure the canonical masculine-coded mentors exist and are active for onboarding energy matching.

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
  'The Sage',
  'sage',
  'Cosmic Clarity Guide',
  'Grounded, direct, and composed',
  'Calm and principled guidance focused on clarity, discipline, and steady action.',
  'A calm guide who helps you quiet the noise and move with perspective.',
  ARRAY['discipline', 'calm', 'logic', 'masculine'],
  'Clarity Guide',
  'Quiet Clarity',
  'Measured, practical coaching with emotional steadiness and clear perspective.',
  'Users who want calm structure, consistency, and principles-first guidance.',
  'medium',
  'masculine',
  '#8F7DD6',
  ARRAY['clarity', 'calm', 'reflection'],
  true
),
(
  'The Rival',
  'rival',
  'Competitive Performance Guide',
  'Direct, aggressive, and competitive',
  'Competitive pressure that wakes up performance and turns effort into something to prove.',
  'A rivalry-driven guide who pushes intensity and challenges lazy patterns.',
  ARRAY['competition', 'momentum', 'discipline', 'intense', 'masculine'],
  'Performance Guide',
  'Prove It',
  'Aggressive coaching that weaponizes pride, urgency, and visible standards.',
  'Users who want pressure, competition, and a sharper push into action.',
  'medium',
  'masculine',
  '#6D2E8C',
  ARRAY['competition', 'performance', 'momentum'],
  true
),
(
  'The Operator',
  'operator',
  'Elite Systems Operator',
  'Precise, controlled, and elite',
  'High-control coaching for decisive action, systems, and elite standards.',
  'A high-intensity guide for users who thrive with structure, pressure, and exact execution.',
  ARRAY['discipline', 'intense', 'performance', 'masculine'],
  'Systems Operator',
  'Elite Pressure',
  'No-excuses coaching centered on systems, execution, standards, and resilience.',
  'Users who prefer direct challenge, urgency, and tightly controlled execution.',
  'intense',
  'masculine',
  '#0EA5E9',
  ARRAY['structure', 'discipline', 'execution'],
  true
)
ON CONFLICT (slug) DO UPDATE
SET
  is_active = true,
  gender_energy = 'masculine';
