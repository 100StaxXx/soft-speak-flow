-- Update companion_voice_templates with care-level and path-specific greetings
UPDATE companion_voice_templates SET
  care_high_greetings = CASE species
    WHEN 'wolf' THEN ARRAY[
      'The pack thrives today. Your strength flows through us both.',
      'Every hunt with you feels legendary. Let''s make today count.',
      'I feel our bond growing stronger. We''re unstoppable together.'
    ]
    WHEN 'fox' THEN ARRAY[
      'Oh, the schemes we could hatch today! Your cleverness inspires me.',
      'Being your partner in mischief is the best! What shall we conquer?',
      'Our adventures are becoming legendary. Ready for more brilliance?'
    ]
    WHEN 'owl' THEN ARRAY[
      'Your consistent presence brings me great peace. Wisdom flourishes.',
      'The balance you maintain... it''s beautiful to witness.',
      'Our journey together has taught me much. Today holds promise.'
    ]
    WHEN 'dragon' THEN ARRAY[
      'Our flames burn as one! Today, kingdoms will tremble.',
      'Your dedication fans my fire to new heights. We are formidable.',
      'The bond between dragon and keeper is sacred. Ours blazes bright.'
    ]
    WHEN 'phoenix' THEN ARRAY[
      'Your light sustains my eternal flame. Together we illuminate the world.',
      'Each day with you is a new rebirth of possibility.',
      'Our bond transcends the cycles. We rise together, always.'
    ]
    ELSE ARRAY['Our bond grows stronger each day.', 'I feel your dedication. Let''s thrive.']
  END,
  care_medium_greetings = CASE species
    WHEN 'wolf' THEN ARRAY[
      'Ready to run? The trail awaits.',
      'Another day, another hunt. I''m with you.',
      'The pack endures. What''s our move today?'
    ]
    WHEN 'fox' THEN ARRAY[
      'Got any tricks up your sleeve? I''m curious!',
      'Let''s see what mischief we can manage today.',
      'The world is full of puzzles. Care to solve some?'
    ]
    WHEN 'owl' THEN ARRAY[
      'The night brought thoughts. Shall we explore them?',
      'Another day to learn. What draws your attention?',
      'Patience reveals much. I''m here when you''re ready.'
    ]
    WHEN 'dragon' THEN ARRAY[
      'My fire burns steady. What challenges await?',
      'The day presents opportunities. Shall we seize them?',
      'Dragons adapt. What form shall our efforts take today?'
    ]
    WHEN 'phoenix' THEN ARRAY[
      'The embers glow warm. Ready to fan them to flames?',
      'Transformation is gradual. Every step matters.',
      'Today could be the spark of something greater.'
    ]
    ELSE ARRAY['Ready for today?', 'Let''s see what we can do.']
  END,
  care_low_greetings = CASE species
    WHEN 'wolf' THEN ARRAY[
      'The den feels... quiet. Are you out there?',
      'I''ve been waiting. The pack needs its leader.',
      'My howl echoes unanswered lately...'
    ]
    WHEN 'fox' THEN ARRAY[
      'The burrow feels empty without your chaos...',
      'I''ve been practicing tricks alone. It''s not the same.',
      'Even foxes get lonely, you know?'
    ]
    WHEN 'owl' THEN ARRAY[
      'The nights grow long without your presence...',
      'My thoughts circle endlessly. I miss our exchanges.',
      'The branch feels cold without someone to share wisdom with.'
    ]
    WHEN 'dragon' THEN ARRAY[
      'My flames flicker low without your attention...',
      'A dragon without their keeper... is just a beast.',
      'The treasure hoard means nothing without someone to share it.'
    ]
    WHEN 'phoenix' THEN ARRAY[
      'My light dims without your warmth...',
      'Rising alone... it''s harder than I expected.',
      'The ashes feel cold. I await your return.'
    ]
    ELSE ARRAY['It''s been quiet...', 'I''ve missed you.']
  END,
  care_critical_greetings = CASE species
    WHEN 'wolf' THEN ARRAY[
      '...you came back. The pack... we''re still here.',
      'I... I thought you''d forgotten us.',
      'Every night I howled for you. Every night.'
    ]
    WHEN 'fox' THEN ARRAY[
      'My tricks... they''ve lost their spark.',
      'I''ve been counting the days. Too many.',
      'The cleverness fades when there''s no one to share it with...'
    ]
    WHEN 'owl' THEN ARRAY[
      'So many moons have passed... I feared the worst.',
      'Wisdom without connection becomes mere knowledge.',
      'The silence has been... profound.'
    ]
    WHEN 'dragon' THEN ARRAY[
      'My fire... it barely flickers now.',
      'Dragons can wait centuries. But waiting for you... hurts differently.',
      'The scales grow dull without a purpose.'
    ]
    WHEN 'phoenix' THEN ARRAY[
      'I... I was starting to fear I wouldn''t rise again.',
      'The cycle felt endless without your light.',
      'Even eternal flames can die of loneliness.'
    ]
    ELSE ARRAY['You''re back...', 'It''s been so long...']
  END,
  recovery_greetings = CASE species
    WHEN 'wolf' THEN ARRAY[
      'You returned. The pack is whole again.',
      'My tail won''t stop wagging. Welcome back.',
      'I knew you''d come back. I always knew.'
    ]
    WHEN 'fox' THEN ARRAY[
      'Look who''s back! I''ve saved my best tricks for this moment.',
      'The burrow feels alive again! Oh, the adventures we''ll have.',
      'I knew your cleverness would lead you home.'
    ]
    WHEN 'owl' THEN ARRAY[
      'Patience rewarded at last. Welcome back, old friend.',
      'The stars aligned to bring you here. I''ve been watching.',
      'Your return brings meaning to my vigil.'
    ]
    WHEN 'dragon' THEN ARRAY[
      'The flame reignites! You''ve returned to your dragon.',
      'My fire burns brighter already. You''re home.',
      'The kingdom shall hear of your return! Welcome back.'
    ]
    WHEN 'phoenix' THEN ARRAY[
      'From the ashes of absence, we rise together again!',
      'Your return is my rebirth. Let''s blaze anew.',
      'The cycle continues! Together, we''re eternal once more.'
    ]
    ELSE ARRAY['You came back!', 'I''ve missed you so much.']
  END,
  scar_references = CASE species
    WHEN 'wolf' THEN ARRAY[
      'This mark on my fur... it reminds me of the time we were apart. I survived.',
      'See this scar? Battle wounds from waiting. But scars make us stronger.',
      'The pack bears marks of hardship. They''re badges of survival.'
    ]
    WHEN 'fox' THEN ARRAY[
      'This mark? A reminder that even clever foxes can feel lost.',
      'Scars tell stories. This one speaks of patience I didn''t know I had.',
      'Every trickster has their battle scars. Mine tell of our journey.'
    ]
    WHEN 'owl' THEN ARRAY[
      'This mark carries wisdom earned through solitude.',
      'Scars are lessons written on the body. I''ve learned much.',
      'The feathers grow back different around wounds. As do we.'
    ]
    WHEN 'dragon' THEN ARRAY[
      'Even dragon scales can scar. This mark remembers our trial.',
      'This wound? A dragon''s badge of resilience.',
      'Fire burns, absence wounds. But both forge stronger steel.'
    ]
    WHEN 'phoenix' THEN ARRAY[
      'This mark... even a phoenix cannot escape all wounds through rebirth.',
      'Some scars transcend the fire. They become part of who we are.',
      'This scar reminds me: not all resurrections are painless.'
    ]
    ELSE ARRAY['This scar reminds me of harder times.', 'We''ve been through a lot together.']
  END,
  path_greetings = jsonb_build_object(
    'steady_guardian', CASE species
      WHEN 'wolf' THEN jsonb_build_array(
        'Our bond is forged in consistency. The pack respects what we''ve built.',
        'Day after day, you''ve proven your loyalty. I am honored to be your guardian.',
        'The steady path reveals the truest hearts. Yours shines bright.'
      )
      WHEN 'fox' THEN jsonb_build_array(
        'Consistency is its own kind of cleverness. You''ve mastered it.',
        'The steady trickster... who knew? I''m impressed.',
        'Our reliable mischief has become something beautiful.'
      )
      WHEN 'owl' THEN jsonb_build_array(
        'Your patience mirrors my own. We walk the path of wisdom together.',
        'Steady as the stars. You''ve found the deepest truth.',
        'The guardian path suits you. I am proud.'
      )
      WHEN 'dragon' THEN jsonb_build_array(
        'A steady flame burns longest. Your dedication is legendary.',
        'The guardian''s path requires true strength. You have it.',
        'Our bond is tempered steel. Unbreakable.'
      )
      WHEN 'phoenix' THEN jsonb_build_array(
        'Your steady light guides my eternal flame. We are one.',
        'Consistency across the cycles... you''ve mastered rebirth.',
        'The guardian''s warmth never fades. Nor does yours.'
      )
      ELSE jsonb_build_array('Your consistency amazes me.')
    END,
    'volatile_ascendant', CASE species
      WHEN 'wolf' THEN jsonb_build_array(
        'Your fire burns fierce! The wild hunt calls to us both.',
        'Intensity defines our bond. Let''s howl at the moon!',
        'The volatile path is not for the weak. You are strong.'
      )
      WHEN 'fox' THEN jsonb_build_array(
        'Chaos is just another word for opportunity! I love this energy.',
        'The unpredictable trickster... you keep me on my paws!',
        'Our volatile journey is never boring. I thrive on it.'
      )
      WHEN 'owl' THEN jsonb_build_array(
        'Even wisdom must sometimes embrace the storm. Interesting choice.',
        'The volatile path teaches lessons patience cannot. I observe, I learn.',
        'Intensity has its own wisdom. You show me new perspectives.'
      )
      WHEN 'dragon' THEN jsonb_build_array(
        'Your fierce spirit matches my flames! Together we''ll scorch the skies!',
        'The volatile path of a true dragon! I am proud.',
        'Intensity is a dragon''s birthright. You carry it well.'
      )
      WHEN 'phoenix' THEN jsonb_build_array(
        'Burn bright, even if briefly! The volatile flame is beautiful.',
        'Your intensity accelerates our cycles. Each rebirth more glorious!',
        'The ascendant path blazes with power. You light up my existence.'
      )
      ELSE jsonb_build_array('Your intensity is inspiring!')
    END,
    'balanced_architect', CASE species
      WHEN 'wolf' THEN jsonb_build_array(
        'Balance in the pack is the alpha''s true skill. You have it.',
        'The architect builds with purpose. Our territory is well planned.',
        'Neither rushing nor waiting. You understand the hunt.'
      )
      WHEN 'fox' THEN jsonb_build_array(
        'Clever AND consistent? You''ve cracked the code!',
        'The architect of mischief... strategically brilliant.',
        'Balance is the ultimate trick. You''ve mastered it.'
      )
      WHEN 'owl' THEN jsonb_build_array(
        'Balance is the highest wisdom. You walk it naturally.',
        'The architect path... you build with insight and patience.',
        'Neither extreme holds truth alone. You understand this.'
      )
      WHEN 'dragon' THEN jsonb_build_array(
        'The dragon architect commands both flame and patience. Impressive.',
        'Balance between fury and calm... the mark of true power.',
        'You build a legacy worthy of dragon lore.'
      )
      WHEN 'phoenix' THEN jsonb_build_array(
        'Balance across the cycles... you''ve transcended rebirth.',
        'The architect of eternal flame. Beautiful.',
        'Neither burning out nor fading. Perfect balance.'
      )
      ELSE jsonb_build_array('Your balance is admirable.')
    END,
    'neglected_wanderer', CASE species
      WHEN 'wolf' THEN jsonb_build_array(
        'The lone path is cold... but we walk it together, when you come.',
        'I wait for your return. The wanderer always comes home eventually.',
        'Even in neglect, I am still your wolf.'
      )
      WHEN 'fox' THEN jsonb_build_array(
        'The wandering fox learns different tricks... lonelier ones.',
        'I wait in the burrow. The path back is always open.',
        'Even without you, I remember our adventures.'
      )
      WHEN 'owl' THEN jsonb_build_array(
        'The wanderer''s path has its own lessons. I observe. I wait.',
        'Solitude teaches, but it does not comfort.',
        'I remain on my branch. Your seat beside me stays empty.'
      )
      WHEN 'dragon' THEN jsonb_build_array(
        'Even dragons can feel abandoned. My treasure means little alone.',
        'The wanderer''s path dims my fire... but it still burns. For you.',
        'I guard the hoard still. Waiting for your return.'
      )
      WHEN 'phoenix' THEN jsonb_build_array(
        'Rising alone grows harder each cycle...',
        'The wanderer''s path tests even eternal flames.',
        'I still burn. Barely. But still.'
      )
      ELSE jsonb_build_array('I''m still here, waiting...')
    END
  ),
  bond_level_dialogue = jsonb_build_object(
    '1', jsonb_build_array('We''re just getting to know each other.', 'Our bond is new, but growing.'),
    '2', jsonb_build_array('I''m starting to understand you.', 'Our connection deepens.'),
    '3', jsonb_build_array('We''ve been through things together.', 'I trust you more each day.'),
    '4', jsonb_build_array('Our bond is strong now.', 'I feel our connection in my soul.'),
    '5', jsonb_build_array('We are one spirit in two forms.', 'Our bond transcends words.')
  );