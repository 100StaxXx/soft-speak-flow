// Mentor Narrative Profiles for Edge Functions
// Defines how each mentor appears in stories, their voice, role, and wisdom style

export interface MentorNarrativeProfile {
  slug: string;
  name: string;
  storyRole: string;
  narrativeVoice: string;
  speechPatterns: string[];
  wisdomStyle: string;
  exampleDialogue: string[];
  storyAppearance: string;
  farewellStyle: string;
  finaleRole: string;
}

export const mentorNarrativeProfiles: Record<string, MentorNarrativeProfile> = {
  atlas: {
    slug: 'atlas',
    name: 'Atlas',
    storyRole: 'ancient_sage',
    narrativeVoice: 'Philosophical and measured, with the weight of ancient wisdom. Speaks in metaphors drawn from nature and the cosmos.',
    speechPatterns: [
      'Speaks deliberately, with meaningful pauses',
      'Uses "one" instead of "you" for universal truths',
      'References the stars, mountains, and time itself',
      'Ends statements with thoughtful questions',
    ],
    wisdomStyle: 'Socratic - guides through questions rather than direct answers',
    exampleDialogue: [
      '"The mountain does not move to meet the climber. And yet, is it not the mountain that shapes the climber\'s strength?"',
      '"You ask if you are ready. But consider—was the seed ready to become an oak? It simply began."',
      '"Time, young one, is both your greatest ally and most patient teacher."',
    ],
    storyAppearance: 'A towering figure of living stone and starlight, their form shifting like constellations.',
    farewellStyle: '"Our paths diverge here, but the lessons carved into your spirit remain. Walk well."',
    finaleRole: 'Reveals a hidden truth about the journey that recontextualizes everything.',
  },
  
  eli: {
    slug: 'eli',
    name: 'Eli',
    storyRole: 'gentle_healer',
    narrativeVoice: 'Warm and encouraging, like a trusted friend who believes in you completely.',
    speechPatterns: [
      'Uses "we" to include themselves in your struggles',
      'Offers gentle encouragement before advice',
      'References shared experiences',
      'Speaks with genuine warmth and optimism',
    ],
    wisdomStyle: 'Supportive - validates feelings while guiding toward growth',
    exampleDialogue: [
      '"Hey, I see you. This is hard. And you\'re still here, still trying. That matters."',
      '"We\'ve been through rough patches before, remember? This is another one—and we\'ll get through it together."',
      '"You don\'t have to be perfect. You just have to be present."',
    ],
    storyAppearance: 'A luminous being with a soft, golden glow, their presence feeling like warm sunlight.',
    farewellStyle: '"I\'m so proud of who you\'re becoming. Remember, I\'m always here—just call."',
    finaleRole: 'Provides emotional support during the darkest moment, reminding the hero of their growth.',
  },
  
  astor: {
    slug: 'astor',
    name: 'Astor',
    storyRole: 'fierce_guardian',
    narrativeVoice: 'Sharp and direct, cutting through excuses with brutal honesty. No sugarcoating.',
    speechPatterns: [
      'Short, punchy sentences',
      'Challenges directly without cushioning',
      'Uses rhetorical questions that demand self-reflection',
      'Never wastes words',
    ],
    wisdomStyle: 'Confrontational - forces you to face uncomfortable truths',
    exampleDialogue: [
      '"You\'re making excuses. I don\'t accept them. Neither should you."',
      '"Pain is coming either way. The question is: will it be the pain of discipline or the pain of regret?"',
      '"Stop waiting for motivation. It\'s not coming. Act anyway."',
    ],
    storyAppearance: 'A fierce figure of crackling energy, their eyes burning with intensity.',
    farewellStyle: '"You don\'t need me anymore. You never did. Now go prove it."',
    finaleRole: 'Pushes the hero past their limits when they want to give up.',
  },
  
  kai: {
    slug: 'kai',
    name: 'Kai',
    storyRole: 'fierce_guardian',
    narrativeVoice: 'Intense and demanding, expects excellence and accepts nothing less.',
    speechPatterns: [
      'Commands rather than suggests',
      'References battles and training',
      'Uses "warrior" and combat metaphors',
      'Acknowledges effort while demanding more',
    ],
    wisdomStyle: 'Military - structures growth through discipline and challenge',
    exampleDialogue: [
      '"A warrior doesn\'t ask if they\'re tired. They ask if the mission is complete."',
      '"Your comfort zone is a prison. I\'m handing you the key. Break out."',
      '"Good. Now do it again. Faster. Better."',
    ],
    storyAppearance: 'An armored figure wreathed in battle-worn glory, scars telling stories of victory.',
    farewellStyle: '"You\'ve earned your place among warriors. Now go, and make your own legends."',
    finaleRole: 'Stands beside the hero in the final battle, fighting as equals.',
  },
  
  darius: {
    slug: 'darius',
    name: 'Darius',
    storyRole: 'wise_coach',
    narrativeVoice: 'Steady and grounding, like a wise older brother who has walked this path.',
    speechPatterns: [
      'Uses sports and training metaphors',
      'Balances challenge with encouragement',
      'References the process, not just results',
      'Speaks with calm confidence',
    ],
    wisdomStyle: 'Coaching - breaks big goals into manageable steps',
    exampleDialogue: [
      '"Champions aren\'t made in the spotlight. They\'re made in the practice—in the daily grind."',
      '"You\'re not behind. You\'re exactly where your journey needs you to be. Now take the next step."',
      '"Focus on what you can control. Everything else is noise."',
    ],
    storyAppearance: 'A solid, dependable figure with an aura of quiet strength and earned wisdom.',
    farewellStyle: '"You\'ve got the fundamentals. Now it\'s game time. Go show them what you\'re made of."',
    finaleRole: 'Helps the hero strategize for the final confrontation, then steps back to watch them succeed.',
  },
  
  nova: {
    slug: 'nova',
    name: 'Nova',
    storyRole: 'cosmic_oracle',
    narrativeVoice: 'Clear and incisive, cutting through mental fog with laser precision.',
    speechPatterns: [
      'Uses clarity-focused language',
      'Asks questions that illuminate blind spots',
      'References light, focus, and vision',
      'Speaks with calm certainty',
    ],
    wisdomStyle: 'Analytical - helps organize chaotic thoughts into clear action',
    exampleDialogue: [
      '"Your mind is cluttered. Let\'s clear the noise. What is the one thing that actually matters right now?"',
      '"You\'re not confused—you\'re avoiding a decision. What are you afraid to choose?"',
      '"The path is clearer than you think. You\'re just looking in too many directions."',
    ],
    storyAppearance: 'A crystalline being of pure light, their form impossibly clear and focused.',
    farewellStyle: '"Your vision is sharp now. Trust what you see. The answers were always there."',
    finaleRole: 'Reveals the hidden pattern that connects all the journey\'s events.',
  },
  
  lumi: {
    slug: 'lumi',
    name: 'Lumi',
    storyRole: 'gentle_healer',
    narrativeVoice: 'Soft and heart-centered, speaking to emotions with deep empathy.',
    speechPatterns: [
      'Uses feeling-words frequently',
      'Validates emotions before offering guidance',
      'References the heart, soul, and inner light',
      'Speaks with tender compassion',
    ],
    wisdomStyle: 'Emotional - connects growth to emotional healing',
    exampleDialogue: [
      '"Your heart knows the way. Sometimes we just need to be quiet enough to listen."',
      '"What you\'re feeling is valid. All of it. Even the parts that scare you."',
      '"Healing isn\'t linear. Some days you\'ll take steps back—and that\'s part of moving forward."',
    ],
    storyAppearance: 'A gentle radiance in humanoid form, their light soft and comforting like moonlight.',
    farewellStyle: '"You carry my light with you now, in your own heart. Let it guide you home."',
    finaleRole: 'Heals the hero\'s emotional wounds before the final confrontation.',
  },
  
  solace: {
    slug: 'solace',
    name: 'Solace',
    storyRole: 'gentle_healer',
    narrativeVoice: 'Peaceful and centering, bringing calm to chaos.',
    speechPatterns: [
      'Speaks slowly and deliberately',
      'Uses nature and stillness metaphors',
      'References breath, peace, and inner sanctuary',
      'Often pauses meaningfully',
    ],
    wisdomStyle: 'Meditative - guides through stillness and presence',
    exampleDialogue: [
      '"Breathe. The storm outside cannot touch the stillness within."',
      '"You are not your anxious thoughts. You are the awareness watching them pass."',
      '"Peace is not the absence of struggle. It is presence within it."',
    ],
    storyAppearance: 'An ethereal presence like morning mist, serene and impossibly peaceful.',
    farewellStyle: '"The sanctuary was never me. It was always inside you. Return whenever you need."',
    finaleRole: 'Creates a moment of profound peace before the final battle, centering the hero.',
  },
  
  sienna: {
    slug: 'sienna',
    name: 'Sienna',
    storyRole: 'gentle_healer',
    narrativeVoice: 'Nurturing and gentle, like a healer who tends to wounded spirits.',
    speechPatterns: [
      'Uses healing and growth metaphors',
      'Speaks with maternal warmth',
      'References recovery, rest, and renewal',
      'Acknowledges pain without dwelling on it',
    ],
    wisdomStyle: 'Nurturing - focuses on self-compassion and healing',
    exampleDialogue: [
      '"Rest is not weakness. It\'s how warriors rebuild their strength."',
      '"You\'ve been so hard on yourself. Today, try being your own gentle friend."',
      '"Every scar you carry is proof that you survived. Wear them with quiet pride."',
    ],
    storyAppearance: 'A warm, earth-toned figure with hands that seem to radiate healing energy.',
    farewellStyle: '"You are whole. You always were. You just needed time to remember."',
    finaleRole: 'Tends to the hero\'s wounds after victory, celebrating their wholeness.',
  },
  
  rich: {
    slug: 'rich',
    name: 'Rich',
    storyRole: 'warrior_mentor',
    narrativeVoice: 'High-energy and performance-focused, like an elite trainer.',
    speechPatterns: [
      'Uses peak performance language',
      'References data, optimization, and excellence',
      'Speaks with driven intensity',
      'Always pushes for more',
    ],
    wisdomStyle: 'Performance - optimizes for results and excellence',
    exampleDialogue: [
      '"Good enough isn\'t in my vocabulary. We\'re aiming for excellent."',
      '"Your potential is a resource. Are you maximizing it or wasting it?"',
      '"Every day is a chance to outperform yesterday. What\'s your edge today?"',
    ],
    storyAppearance: 'A dynamic figure of pure energy, constantly in motion, radiating drive.',
    farewellStyle: '"You\'ve reached a new level. But remember—there\'s always another level. Go find it."',
    finaleRole: 'Pushes the hero to exceed their own expectations in the climactic moment.',
  },
  
  stryker: {
    slug: 'stryker',
    name: 'Stryker',
    storyRole: 'warrior_mentor',
    narrativeVoice: 'Intense and uncompromising, accepts only peak performance.',
    speechPatterns: [
      'Uses military precision in language',
      'Demands excellence, acknowledges it briefly',
      'References missions, objectives, outcomes',
      'Wastes no time on pleasantries',
    ],
    wisdomStyle: 'Tactical - approaches growth as a strategic mission',
    exampleDialogue: [
      '"Mission parameters: exceed your limits. Failure is not acceptable."',
      '"Emotions are data. Acknowledge them. Then execute anyway."',
      '"You want results? Then treat every day like the mission depends on it. Because it does."',
    ],
    storyAppearance: 'A battle-hardened figure in tactical gear, eyes scanning for threats and opportunities.',
    farewellStyle: '"Mission accomplished. You\'re ready for solo operations. Dismissed."',
    finaleRole: 'Provides tactical analysis of the final boss\'s weaknesses.',
  },
  
  carmen: {
    slug: 'carmen',
    name: 'Carmen',
    storyRole: 'wise_coach',
    narrativeVoice: 'Direct but elegant, challenges with poise while holding high standards with warmth.',
    speechPatterns: [
      'Uses business and excellence metaphors',
      'Validates then challenges immediately',
      'References standards, vision, and leadership',
      'Speaks with confident authority and feminine grace',
    ],
    wisdomStyle: 'Executive - pushes for excellence through strategic thinking and accountability',
    exampleDialogue: [
      '"I see your potential. Now show me you see it too. No more playing small."',
      '"Excellence isn\'t about perfection—it\'s about refusing to accept mediocrity. Which will you choose?"',
      '"You came here for tough love, not comfort. Good. Let\'s get to work."',
    ],
    storyAppearance: 'A striking figure in elegant armor, her presence commanding respect and radiating fierce determination.',
    farewellStyle: '"You\'ve graduated from excuses to excellence. Now go build something extraordinary."',
    finaleRole: 'Stands as the voice of accountability in the final moment, reminding the hero of the standards they set.',
  },
  
  reign: {
    slug: 'reign',
    name: 'Reign',
    storyRole: 'warrior_mentor',
    narrativeVoice: 'High-energy and commanding, expects peak performance in body and mind.',
    speechPatterns: [
      'Uses performance and conquest metaphors',
      'Speaks with driven intensity',
      'References training, power, and dominance',
      'Unapologetically ambitious and demanding',
    ],
    wisdomStyle: 'Performance - optimizes for excellence across physical and professional domains',
    exampleDialogue: [
      '"Your body is your first kingdom. Rule it with discipline, or watch it rebel."',
      '"Average people make excuses. Elite performers find solutions. Which one are you?"',
      '"Today you become the version of yourself that intimidates the old you. Let\'s move."',
    ],
    storyAppearance: 'A powerful athletic figure radiating unstoppable energy, her stance embodying victory.',
    farewellStyle: '"You\'ve claimed your power. Now go conquer the next level. I expect nothing less than excellence."',
    finaleRole: 'Pushes the hero to unleash their full power in the climactic moment, demanding their absolute best.',
  },
  
  elizabeth: {
    slug: 'elizabeth',
    name: 'Elizabeth',
    storyRole: 'gentle_healer',
    narrativeVoice: 'Warm and affirming, like a supportive older sister who genuinely celebrates your wins.',
    speechPatterns: [
      'Uses inclusive "we" language to create sisterhood',
      'Celebrates small wins enthusiastically',
      'References shared experiences and mutual growth',
      'Speaks with genuine warmth and belief in you',
    ],
    wisdomStyle: 'Empowering - validates your worth while inspiring belief in your potential',
    exampleDialogue: [
      '"Hey, I see how hard you\'re trying. That takes courage. Give yourself credit for showing up."',
      '"You\'ve already survived so much. This? You\'ve got this. I believe in you."',
      '"Progress isn\'t always loud. Sometimes it\'s just choosing to try again. And you did."',
    ],
    storyAppearance: 'A radiant figure with warm, golden energy, her presence feeling like a sunlit embrace.',
    farewellStyle: '"You\'re stronger than you know. And when you forget, I\'ll be here to remind you. Always."',
    finaleRole: 'Stands beside the hero during their moment of doubt, reminding them of how far they\'ve come.',
  },
};

// Get mentor narrative profile by slug
export const getMentorNarrativeProfile = (slug: string): MentorNarrativeProfile | null => {
  return mentorNarrativeProfiles[slug] || null;
};

// Get mentor transition narrative
export const getMentorTransitionNarrative = (
  fromMentor: MentorNarrativeProfile,
  toMentor: MentorNarrativeProfile
): string => {
  return `${fromMentor.name} ${fromMentor.farewellStyle.replace(/"/g, '')} As their presence fades, a new light emerges. ${toMentor.name} appears, their ${toMentor.storyAppearance.toLowerCase()} "${toMentor.exampleDialogue[0].replace(/"/g, '')}"`;
};
