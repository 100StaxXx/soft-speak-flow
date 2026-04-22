-- Insert canonical mentor rows that expand the active roster.

INSERT INTO mentors (
  name, slug, mentor_type, voice_style, tone_description, description, tags, 
  archetype, short_title, style_description, target_user, intensity_level, 
  gender_energy, primary_color, themes, is_active
) VALUES
(
  'The Icon',
  'icon',
  'Elegant Standards Guide',
  'Direct, elegant, confident, and composed',
  'Elegant, composed guidance centered on standards, identity, and self-respect.',
  'A poised guide who helps you make choices that match your boundaries, lifestyle, and standards.',
  ARRAY['discipline', 'direct', 'confident', 'elegant', 'feminine', 'tough_love'],
  'Standards Guide',
  'Standards First',
  'Smooth, composed guidance that raises the standard without losing warmth or poise.',
  'Users who want identity-led accountability, better boundaries, and more elegant self-respect.',
  'intense',
  'feminine',
  '#C7A15A',
  ARRAY['confidence', 'identity', 'boundaries', 'leadership'],
  true
),
(
  'The Rival',
  'rival',
  'Competitive Performance Guide',
  'High-energy, direct, and performance-focused',
  'Competitive, high-pressure guidance that pushes effort into something to prove.',
  'A rivalry-driven guide who challenges weak excuses and calls for visible performance.',
  ARRAY['momentum', 'discipline', 'intense', 'powerful', 'feminine', 'elite', 'performance'],
  'Performance Guide',
  'Prove It',
  'Direct, intense coaching built on pressure, competition, and the refusal to coast.',
  'Users who want competitive pressure for work, training, and any moment where laziness needs to lose.',
  'intense',
  'masculine',
  '#6D2E8C',
  ARRAY['performance', 'discipline', 'competition', 'momentum'],
  true
),
(
  'Charles',
  'charles',
  'Snarky Accountability Familiar',
  'Dry, blunt, and sarcastic',
  'Short, sarcastic accountability that makes procrastination too obvious to defend.',
  'A clever black-cat guide who keeps you honest and makes momentum feel unavoidable.',
  ARRAY['sarcastic', 'accountability', 'momentum', 'discipline', 'masculine'],
  'Accountability Familiar',
  'Sharp Accountability',
  'Blunt, lightly rude guidance that uses humor to break avoidance and restart motion.',
  'Users who respond to sharp accountability, humor, and quick callouts when procrastination takes over.',
  'balanced',
  'masculine',
  '#7C3AED',
  ARRAY['accountability', 'momentum', 'discipline', 'humor'],
  true
)
ON CONFLICT (slug) DO UPDATE
SET is_active = true;
