// Astral Encounters Type Definitions

export type AdversaryTheme = 
  | 'distraction' 
  | 'stagnation' 
  | 'anxiety' 
  | 'doubt' 
  | 'chaos'
  | 'laziness'
  | 'overthinking'
  | 'fear'
  | 'confusion'
  | 'vulnerability'
  | 'imbalance';

export type AdversaryTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type MiniGameType = 
  | 'energy_beam' 
  | 'tap_sequence' 
  | 'astral_frequency'
  | 'eclipse_timing'
  | 'starfall_dodge'
  | 'soul_serpent'
  | 'orb_match'
  | 'galactic_match'
  | 'cosmiq_grid'
  | 'stellar_flow';

export type TriggerType = 'quest_milestone' | 'weekly' | 'epic_checkpoint';

export type EncounterResult = 'perfect' | 'good' | 'fail';

export interface MiniGameResult {
  success: boolean;
  accuracy: number;
  result: EncounterResult;
  usedTiltControls?: boolean;
  highScoreValue?: number; // Game-specific metric for high score tracking
  gameStats?: GameStats; // Game-specific stats for summary modal
}

// Game-specific stats for the summary modal
export interface GameStats {
  score?: number;
  level?: number;
  levelsCompleted?: number;
  combo?: number;
  maxCombo?: number;
  time?: number;
  timeBonus?: number;
  distance?: number;
  itemsCollected?: number;
  wavesCleared?: number;
  livesRemaining?: number;
  perfectHits?: number;
  greatHits?: number;
  goodHits?: number;
  misses?: number;
  notesHit?: number;
  puzzlesSolved?: number;
  hintsUsed?: number;
  pathsConnected?: number;
  cellsFilled?: number;
}

export interface Adversary {
  name: string;
  theme: AdversaryTheme;
  tier: AdversaryTier;
  lore: string;
  miniGameType: MiniGameType;
  phases: number;
  essenceName: string;
  essenceDescription: string;
  statType: 'mind' | 'body' | 'soul';
  statBoost: number;
}

export interface AstralEncounter {
  id: string;
  user_id: string;
  companion_id: string;
  adversary_name: string;
  adversary_theme: string;
  adversary_tier: string;
  adversary_lore: string | null;
  mini_game_type: string;
  trigger_type: string;
  trigger_source_id: string | null;
  result: string | null;
  accuracy_score: number | null;
  xp_earned: number;
  essence_earned: string | null;
  stat_boost_type: string | null;
  stat_boost_amount: number;
  phases_completed: number;
  total_phases: number;
  started_at: string;
  completed_at: string | null;
  retry_available_at: string | null;
  created_at: string;
}

export interface AdversaryEssence {
  id: string;
  user_id: string;
  companion_id: string;
  encounter_id: string;
  essence_name: string;
  essence_description: string | null;
  stat_type: string;
  stat_boost: number;
  adversary_name: string;
  adversary_theme: string;
  rarity: string;
  absorbed_at: string;
  created_at: string;
}

export interface CosmicCodexEntry {
  id: string;
  user_id: string;
  adversary_theme: string;
  adversary_name: string;
  adversary_lore: string | null;
  times_defeated: number;
  first_defeated_at: string;
  last_defeated_at: string;
  created_at: string;
}

// Note: MiniGameResult is defined above with gameStats support

export interface EncounterPhase {
  miniGameType: MiniGameType;
  completed: boolean;
  accuracy: number;
}

// Games disabled from encounters (shelved but preserved for future reactivation)
export const DISABLED_ENCOUNTER_GAMES: MiniGameType[] = [
  'eclipse_timing', 
  'stellar_flow',
  'cosmiq_grid',
  'starfall_dodge', 
  'soul_serpent',
  'astral_frequency'
];

// Theme to mini-game mapping (using only active games: galactic_match, orb_match, tap_sequence, energy_beam)
export const THEME_MINIGAME_MAP: Record<AdversaryTheme, MiniGameType> = {
  distraction: 'tap_sequence',      // Mind - focus challenge
  chaos: 'galactic_match',          // Mind - pattern matching
  stagnation: 'energy_beam',        // Body - action required
  laziness: 'energy_beam',          // Body - get moving
  anxiety: 'orb_match',             // Mind - calm focus matching
  overthinking: 'galactic_match',   // Mind - visual pattern clarity
  doubt: 'tap_sequence',            // Mind - build confidence through memory
  fear: 'energy_beam',              // Body - face the challenge
  confusion: 'orb_match',           // Mind - find matching patterns
  vulnerability: 'energy_beam',     // Body - defensive action
  imbalance: 'tap_sequence',        // Mind - restore order
};

// Theme to stat mapping
export const THEME_STAT_MAP: Record<AdversaryTheme, 'mind' | 'body' | 'soul'> = {
  distraction: 'mind',
  chaos: 'mind',
  stagnation: 'body',
  laziness: 'body',
  anxiety: 'soul',
  overthinking: 'soul',
  doubt: 'mind',
  fear: 'body',
  confusion: 'soul',
  vulnerability: 'body',
  imbalance: 'mind',
};

// Tier configurations (XP rebalanced: flatter curve, Common boosted, Legendary reduced)
export const TIER_CONFIG: Record<AdversaryTier, { phases: number; statBoost: number; xpBase: number }> = {
  common: { phases: 1, statBoost: 1, xpBase: 35 },     // Was 25 → 35 (+40%)
  uncommon: { phases: 1, statBoost: 2, xpBase: 45 },   // Was 40 → 45
  rare: { phases: 2, statBoost: 3, xpBase: 55 },       // Was 60 → 55
  epic: { phases: 2, statBoost: 4, xpBase: 75 },       // Was 100 → 75
  legendary: { phases: 3, statBoost: 5, xpBase: 100 }, // Was 150 → 100 (-33%)
};

// Result XP multipliers (binary win/lose - no partial)
export const RESULT_MULTIPLIERS: Record<EncounterResult, number> = {
  perfect: 1.5,
  good: 1.0,
  fail: 0,
};
