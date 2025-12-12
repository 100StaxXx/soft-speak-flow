// Adversary Generation Utilities

import { 
  Adversary, 
  AdversaryTheme, 
  AdversaryTier, 
  TriggerType,
  THEME_MINIGAME_MAP,
  THEME_STAT_MAP,
  TIER_CONFIG 
} from '@/types/astralEncounters';

// Adversary name prefixes by theme
const NAME_PREFIXES: Record<AdversaryTheme, string[]> = {
  distraction: ['Riftling', 'Scatter', 'Flickering', 'Wandering'],
  chaos: ['Vortex', 'Maelstrom', 'Turbulent', 'Entropic'],
  stagnation: ['Mire', 'Stillborn', 'Frozen', 'Anchored'],
  laziness: ['Slumber', 'Drift', 'Languor', 'Torpid'],
  anxiety: ['Tremor', 'Spiral', 'Frantic', 'Restless'],
  overthinking: ['Echo', 'Loop', 'Recursive', 'Tangled'],
  doubt: ['Shadow', 'Whisper', 'Fading', 'Hollow'],
  fear: ['Dread', 'Creeping', 'Lurking', 'Umbral'],
  confusion: ['Maze', 'Veiled', 'Obscured', 'Fogbound'],
  vulnerability: ['Exposed', 'Piercing', 'Breaching', 'Unshielded'],
  imbalance: ['Tilting', 'Wavering', 'Unstable', 'Teetering'],
};

// Adversary name suffixes by tier
const NAME_SUFFIXES: Record<AdversaryTier, string[]> = {
  common: ['Wisp', 'Shade', 'Specter', 'Phantom'],
  uncommon: ['Wraith', 'Spirit', 'Haunt', 'Revenant'],
  rare: ['Fiend', 'Demon', 'Harbinger', 'Herald'],
  epic: ['Lord', 'Tyrant', 'Sovereign', 'Monarch'],
  legendary: ['Titan', 'Colossus', 'Primordial', 'Ancient'],
};

// Lore templates by theme
const LORE_TEMPLATES: Record<AdversaryTheme, string[]> = {
  distraction: [
    'Born from scattered thoughts and fractured focus, this entity feeds on mental chaos.',
    'A creature of fleeting moments, it thrives where attention wavers and concentration breaks.',
  ],
  chaos: [
    'Manifested from the entropy of unordered days, this being revels in disorder.',
    'Where plans crumble and routines shatter, this adversary grows stronger.',
  ],
  stagnation: [
    'Formed in the depths of inaction, this entity chains the willing to the unchanging.',
    'A manifestation of paralysis, it whispers that tomorrow is always better.',
  ],
  laziness: [
    'Born from abandoned intentions and forsaken goals, it lulls the ambitious to sleep.',
    'This creature grows fat on postponed dreams and delayed action.',
  ],
  anxiety: [
    'Woven from racing heartbeats and sleepless nights, it amplifies every worry.',
    'A storm of what-ifs given form, feeding on uncertainty and dread.',
  ],
  overthinking: [
    'Created from endless mental loops and circular reasoning, it traps minds in analysis.',
    'This entity spins thoughts into mazes with no exit.',
  ],
  doubt: [
    'A shadow of self-belief, it whispers inadequacy to those who dare to dream.',
    'Born from hesitation and second-guessing, it erodes confidence grain by grain.',
  ],
  fear: [
    'Materialized from primal terrors and modern anxieties, it paralyzes the brave.',
    'This ancient adversary has hunted dreamers since the first star was wished upon.',
  ],
  confusion: [
    'A living labyrinth, this entity thrives when paths blur and direction fades.',
    'Born from lost purpose and wandering souls, it delights in disorientation.',
  ],
  vulnerability: [
    'Forged from moments of exposure and defenselessness, it strikes at unguarded hearts.',
    'This predator hunts those who lower their shields, feeding on raw weakness.',
  ],
  imbalance: [
    'Spawned from tilted scales and unstable foundations, it topples the centered.',
    'Where equilibrium falters and harmony breaks, this adversary finds its strength.',
  ],
};

// Essence names by theme
const ESSENCE_NAMES: Record<AdversaryTheme, string[]> = {
  distraction: ['Focus Essence', 'Clarity Core', 'Concentration Crystal'],
  chaos: ['Order Essence', 'Harmony Shard', 'Balance Core'],
  stagnation: ['Motion Essence', 'Momentum Crystal', 'Flow Core'],
  laziness: ['Vigor Essence', 'Energy Shard', 'Drive Core'],
  anxiety: ['Calm Essence', 'Serenity Crystal', 'Peace Core'],
  overthinking: ['Stillness Essence', 'Simplicity Shard', 'Clarity Core'],
  doubt: ['Confidence Essence', 'Belief Crystal', 'Courage Core'],
  fear: ['Bravery Essence', 'Valor Shard', 'Fearless Core'],
  confusion: ['Direction Essence', 'Pathfinder Shard', 'Clarity Star'],
  vulnerability: ['Shield Essence', 'Guardian Core', 'Protection Crystal'],
  imbalance: ['Equilibrium Essence', 'Stability Shard', 'Center Core'],
};

// Essence descriptions by theme
const ESSENCE_DESCRIPTIONS: Record<AdversaryTheme, string> = {
  distraction: 'Sharpens mental acuity and strengthens focus.',
  chaos: 'Brings order to turbulent thoughts.',
  stagnation: 'Ignites the spark of movement and progress.',
  laziness: 'Fuels the body with renewed energy.',
  anxiety: 'Soothes the spirit and calms racing thoughts.',
  overthinking: 'Quiets the endless mental chatter.',
  doubt: 'Reinforces self-belief and inner strength.',
  fear: 'Transforms terror into courageous resolve.',
  confusion: 'Illuminates the path forward with clarity.',
  vulnerability: 'Fortifies inner defenses and builds resilience.',
  imbalance: 'Restores harmony and centers the spirit.',
};

// Get random item from array
const randomFrom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Determine tier based on trigger
export const getTierFromTrigger = (
  triggerType: TriggerType, 
  epicProgress?: number
): AdversaryTier => {
  if (triggerType === 'weekly') {
    return 'uncommon';
  }
  
  if (triggerType === 'quest_milestone') {
    return 'common';
  }
  
  if (triggerType === 'epic_checkpoint' && epicProgress !== undefined) {
    if (epicProgress >= 100) return 'legendary';
    if (epicProgress >= 75) return 'epic';
    if (epicProgress >= 50) return 'rare';
    return 'uncommon';
  }
  
  return 'common';
};

// Get theme based on epic category or random
export const getThemeForTrigger = (
  triggerType: TriggerType,
  epicCategory?: string
): AdversaryTheme => {
  // Map epic categories to themes
  if (triggerType === 'epic_checkpoint' && epicCategory) {
    const categoryMap: Record<string, AdversaryTheme[]> = {
      fitness: ['stagnation', 'laziness'],
      health: ['stagnation', 'laziness'],
      body: ['stagnation', 'laziness'],
      mind: ['distraction', 'overthinking'],
      learning: ['distraction', 'overthinking'],
      focus: ['distraction', 'chaos'],
      soul: ['anxiety', 'fear'],
      spiritual: ['anxiety', 'doubt'],
      wellness: ['anxiety', 'fear'],
      productivity: ['chaos', 'laziness'],
      creative: ['doubt', 'fear'],
    };
    
    const normalizedCategory = epicCategory.toLowerCase();
    for (const [key, themes] of Object.entries(categoryMap)) {
      if (normalizedCategory.includes(key)) {
        return randomFrom(themes);
      }
    }
  }
  
  // Random theme for other triggers
  const allThemes: AdversaryTheme[] = [
    'distraction', 'chaos', 'stagnation', 'laziness',
    'anxiety', 'overthinking', 'doubt', 'fear',
    'confusion', 'vulnerability', 'imbalance'
  ];
  return randomFrom(allThemes);
};

// Generate a complete adversary
export const generateAdversary = (
  triggerType: TriggerType,
  epicProgress?: number,
  epicCategory?: string
): Adversary => {
  const tier = getTierFromTrigger(triggerType, epicProgress);
  const theme = getThemeForTrigger(triggerType, epicCategory);
  const config = TIER_CONFIG[tier];
  
  const prefix = randomFrom(NAME_PREFIXES[theme]);
  const suffix = randomFrom(NAME_SUFFIXES[tier]);
  const name = `${prefix} ${suffix}`;
  
  const lore = randomFrom(LORE_TEMPLATES[theme]);
  const essenceName = randomFrom(ESSENCE_NAMES[theme]);
  const essenceDescription = ESSENCE_DESCRIPTIONS[theme];
  
  return {
    name,
    theme,
    tier,
    lore,
    miniGameType: THEME_MINIGAME_MAP[theme],
    phases: config.phases,
    essenceName,
    essenceDescription,
    statType: THEME_STAT_MAP[theme],
    statBoost: config.statBoost,
  };
};

// Calculate XP reward based on tier and result
export const calculateXPReward = (
  tier: AdversaryTier,
  accuracy: number
): number => {
  const baseXP = TIER_CONFIG[tier].xpBase;
  
  if (accuracy >= 90) return Math.round(baseXP * 1.5);
  if (accuracy >= 70) return baseXP;
  if (accuracy >= 50) return Math.round(baseXP * 0.5);
  return 0;
};

// Get result from accuracy
export const getResultFromAccuracy = (accuracy: number): 'perfect' | 'good' | 'partial' | 'fail' => {
  if (accuracy >= 90) return 'perfect';
  if (accuracy >= 70) return 'good';
  if (accuracy >= 50) return 'partial';
  return 'fail';
};
