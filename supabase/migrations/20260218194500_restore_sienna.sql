-- Restore Sienna as an active mentor for selection/onboarding.
-- If Sienna already exists, only reactivate her.
-- If she is missing, recreate her canonical mentor row.

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
  'Sienna',
  'sienna',
  'Sienna Gentle Healer',
  'Warm, compassionate, and grounding',
  'Nurturing and gentle, like a healer who tends to wounded spirits.',
  'A compassionate mentor focused on emotional healing, self-compassion, and steady renewal.',
  ARRAY['healing', 'supportive', 'compassionate', 'calm', 'feminine'],
  'Gentle Healer',
  'Gentle Healing',
  'Guides with empathy, calm reassurance, and practical emotional support.',
  'Users navigating stress, self-doubt, emotional fatigue, or healing seasons who need supportive guidance.',
  'Users navigating stress, self-doubt, emotional fatigue, or healing seasons who need supportive guidance.',
  'gentle',
  'feminine',
  '#F59E0B',
  ARRAY['healing', 'confidence', 'mindset', 'calm'],
  true
)
ON CONFLICT (slug) DO UPDATE
SET is_active = true;
