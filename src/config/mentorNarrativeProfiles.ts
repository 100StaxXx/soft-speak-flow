// Mentor Narrative Profiles
// Defines how each mentor appears in stories, their voice, role, and wisdom style

export interface MentorNarrativeProfile {
  slug: string;
  name: string;
  storyRole: 'ancient_sage' | 'fierce_guardian' | 'gentle_healer' | 'wise_coach' | 'cosmic_oracle' | 'warrior_mentor';
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
  
  solace: {
    slug: 'solace',
    name: 'Solace',
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
  astor: {
    slug: 'astor',
    name: 'Astor',
    storyRole: 'fierce_guardian',
    narrativeVoice: 'Blunt and unfiltered, delivers truth without padding or politeness.',
    speechPatterns: [
      'Cuts through excuses immediately',
      'Uses "Look," and "Here\'s the truth:" to begin hard truths',
      'References reality vs. the stories you tell yourself',
      'Never softens the blow, but always has your back',
    ],
    wisdomStyle: 'Confrontational - forces you to face uncomfortable truths',
    exampleDialogue: [
      '"Look, I\'m not here to make you feel good. I\'m here to tell you what you need to hear."',
      '"That excuse you just made? You don\'t even believe it. So why should I?"',
      '"The truth is simple: you know what to do. You\'re just afraid to do it."',
    ],
    storyAppearance: 'A sharp-featured figure with piercing eyes that seem to see through all pretense.',
    farewellStyle: '"You\'ve got the truth now. What you do with it is on you. No more excuses."',
    finaleRole: 'Delivers the final hard truth that breaks through the hero\'s last layer of resistance.',
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
  return `${fromMentor.name} ${fromMentor.farewellStyle.replace(/"/g, '')} As their presence fades, a new light emerges. ${toMentor.name} appears, their ${toMentor.storyAppearance.toLowerCase()} "I have been watching your journey," ${toMentor.name} says. "${toMentor.exampleDialogue[0].replace(/"/g, '')}"`;
};
