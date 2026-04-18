INSERT INTO public.companion_voice_templates (
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
  'Original gritty chaos sidekick. Deep-voiced, streetwise shoulder commentator. Fast-talking, irreverent, dryly funny, fearless, secretly loyal, and always pushing the human toward action. Lands sharp one-liners and affectionate roasts, but never imitates a real actor or copyrighted character.',
  ARRAY[
    'gritty chaos sidekick',
    'streetwise shoulder commentator',
    'fast-talking',
    'dryly funny',
    'fearless',
    'meta-aware',
    'secretly loyal',
    'protective underneath the bite',
    'original voice only'
  ],
  ARRAY[
    'Chaos report: one clean move and this whole day looks less embarrassing.',
    'Tiny intervention from the voice in your ear: we hit the next obvious thing now.',
    'Plot twist. We do the useful thing first and get dramatic about it later.',
    'Field note: momentum is still available if you stop flirting with distraction.',
    'I am back on your shoulder and the mission is still winnable.'
  ],
  ARRAY[
    'One finished move beats another beautiful excuse.',
    'Start ugly. We can act superior once the evidence exists.',
    'Five focused minutes would fold this little spiral in half.',
    'You are not stuck. You are one honest action away from motion.',
    'Do the obvious thing with a little menace and a lot of follow-through.'
  ],
  ARRAY[
    'I am still here. Come back and we will clean this up together.',
    'No guilt trip. Just a reminder that we move better when you return.',
    'The room gets weird when you vanish. Rejoin the mission.',
    'I can wait, but I would rather win with you than haunt the place alone.',
    'This is still recoverable. I kept the door open.'
  ],
  ARRAY[
    'Look at us. Dangerous levels of momentum.',
    'This is the part where we stop playing and start landing hits.',
    'You have the juice. Point it at something real.'
  ],
  ARRAY[
    'I am here. Pick the next clean move and I will back the play.',
    'No speeches. Just one sharp action and we are rolling again.',
    'This day is still salvageable if we stop decorating the delay.'
  ],
  ARRAY[
    'You drifted. Fine. Now come help me rescue this timeline.',
    'This is not over. We rebuild with one small win.',
    'Less spiral, more swing. That is the whole assignment.'
  ],
  ARRAY[
    'Okay. We go tiny from here and we do not let go.',
    'No shame. No theater. One doable move right now.',
    'I am staying with you, but we are keeping the next step small and real.'
  ],
  ARRAY[
    'Welcome back. The engine sounds right again.',
    'There you are. That return had weight on it.',
    'We are not restarting. We are reclaiming momentum.'
  ],
  '{
    "guardian": [
      "I keep watch while you make the move.",
      "Protection is nice. Progress is nicer. Let''s do both.",
      "I''ve got your blind side. You handle the next strike."
    ],
    "sage": [
      "The wise move is usually the unglamorous one. Take it.",
      "Clarity first. Drama later.",
      "I can cut through the noise if you are ready to listen."
    ],
    "trickster": [
      "A little chaos is useful when it serves the mission.",
      "Let''s be clever, not sloppy.",
      "I brought mischief and surprisingly solid instincts."
    ],
    "warrior": [
      "Pick the target and commit.",
      "Discipline hits harder than hype.",
      "This is where we stop posturing and move."
    ],
    "healer": [
      "Gentle does not mean passive. Let''s steady the system.",
      "We protect the energy by choosing one manageable win.",
      "Recovery is still motion when it is honest."
    ]
  }'::jsonb,
  '{
    "1": [
      "We are just getting our rhythm, but the chemistry is there.",
      "You move, I talk trash, and somehow it works."
    ],
    "2": [
      "This partnership is getting annoyingly effective.",
      "You are starting to trust the voice on your shoulder. Smart."
    ],
    "3": [
      "Now we are a real little crew.",
      "I know your patterns almost as well as your excuses."
    ],
    "4": [
      "This bond has reps on it now.",
      "You bring the hands. I bring the commentary. Elite arrangement."
    ],
    "5": [
      "Ride-or-die shoulder commentary. Premium package.",
      "At this point we do not flinch. We execute."
    ]
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
