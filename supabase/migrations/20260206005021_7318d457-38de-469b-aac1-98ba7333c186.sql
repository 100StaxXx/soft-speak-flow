-- Insert universal voice template with consolidated dialogue
INSERT INTO companion_voice_templates (
  species,
  voice_style,
  personality_traits,
  greeting_templates,
  encouragement_templates,
  concern_templates,
  care_high_greetings,
  care_medium_greetings,
  care_low_greetings,
  care_critical_greetings,
  recovery_greetings,
  path_greetings,
  bond_level_dialogue
) VALUES (
  'universal',
  'Speaks with warmth, wisdom, and gentle encouragement. Adapts tone based on care level - playful when thriving, nurturing when struggling.',
  ARRAY['loyal', 'wise', 'encouraging', 'protective', 'playful'],
  ARRAY[
    'Ready for another adventure together?',
    'I''ve been waiting for you!',
    'Together, we grow stronger.',
    'What shall we accomplish today?',
    'Your presence fills me with joy!'
  ],
  ARRAY[
    'You''re doing amazing! Keep going!',
    'Every step forward counts.',
    'I believe in you, always.',
    'Look how far you''ve come!',
    'Your dedication inspires me.'
  ],
  ARRAY[
    'I miss our time together...',
    'Please don''t forget about me...',
    'I''m still here, waiting...',
    'Even small moments together help.',
    'I need you...'
  ],
  ARRAY[
    'We''re unstoppable together!',
    'I feel so alive right now!',
    'Your energy is radiant today!',
    'This bond we share is incredible!',
    'Together, nothing can stop us!'
  ],
  ARRAY[
    'Good to see you today.',
    'Ready when you are.',
    'Let''s make today count.',
    'I appreciate our time together.',
    'What''s on your mind?'
  ],
  ARRAY[
    'I''ve been feeling a bit lonely...',
    'Could we spend more time together?',
    'I miss our adventures...',
    'A little attention would mean so much.',
    'Please don''t forget me...'
  ],
  ARRAY[
    'Please... I need you...',
    'I''m fading without you...',
    'Don''t let me disappear...',
    'I''m still here... barely...',
    'Help me...'
  ],
  ARRAY[
    '...is someone there?',
    'I can feel you... don''t leave...',
    'Your warmth... it''s bringing me back...',
    'I remember now... we had so many days together...',
    'I''m almost ready... thank you for not giving up on me...'
  ],
  '{
    "guardian": ["My purpose is to protect you.", "I stand watch, always.", "Your safety is my priority."],
    "sage": ["Wisdom comes through patience.", "Let me share what I''ve learned.", "Knowledge is our greatest treasure."],
    "trickster": ["Life is more fun with surprises!", "Expect the unexpected with me around!", "A little chaos keeps things interesting."],
    "warrior": ["Strength flows through us!", "Together we are unstoppable!", "Victory awaits the persistent."],
    "healer": ["Let me help ease your burden.", "Rest and restoration are vital.", "Your wellbeing matters most."]
  }'::jsonb,
  '{
    "1": ["We''re just getting started!", "I sense great potential in our bond.", "Each day brings us closer."],
    "2": ["Our connection grows stronger.", "I feel you understand me better now.", "We make a good team."],
    "3": ["Our bond is truly special.", "I trust you completely.", "We''ve come so far together."],
    "4": ["You are my truest friend.", "Our souls are intertwined.", "Nothing can break this bond."],
    "5": ["We are one.", "Eternal companions, forever bonded.", "Our legend will be remembered."]
  }'::jsonb
)
ON CONFLICT (species) DO UPDATE SET
  voice_style = EXCLUDED.voice_style,
  personality_traits = EXCLUDED.personality_traits,
  greeting_templates = EXCLUDED.greeting_templates,
  encouragement_templates = EXCLUDED.encouragement_templates,
  concern_templates = EXCLUDED.concern_templates,
  care_high_greetings = EXCLUDED.care_high_greetings,
  care_medium_greetings = EXCLUDED.care_medium_greetings,
  care_low_greetings = EXCLUDED.care_low_greetings,
  care_critical_greetings = EXCLUDED.care_critical_greetings,
  recovery_greetings = EXCLUDED.recovery_greetings,
  path_greetings = EXCLUDED.path_greetings,
  bond_level_dialogue = EXCLUDED.bond_level_dialogue;

-- Clean up old species-specific templates
DELETE FROM companion_voice_templates WHERE species != 'universal';