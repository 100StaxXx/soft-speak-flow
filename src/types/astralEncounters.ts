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
  | 'rune_resonance'
  | 'astral_serpent'
  | 'orb_match';

export type TriggerType = 'quest_milestone' | 'weekly' | 'epic_checkpoint';

export type EncounterResult = 'perfect' | 'good' | 'partial' | 'fail';

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

export interface MiniGameResult {
  success: boolean;
  accuracy: number; // 0-100
  result: EncounterResult;
}

export interface EncounterPhase {
  miniGameType: MiniGameType;
  completed: boolean;
  accuracy: number;
}

// Theme to mini-game mapping
export const THEME_MINIGAME_MAP: Record<AdversaryTheme, MiniGameType> = {
  distraction: 'tap_sequence',
  chaos: 'tap_sequence',
  stagnation: 'astral_serpent',
  laziness: 'astral_serpent',
  anxiety: 'orb_match',
  overthinking: 'orb_match',
  doubt: 'starfall_dodge',
  fear: 'starfall_dodge',
  confusion: 'orb_match',
  vulnerability: 'eclipse_timing',
  imbalance: 'orb_match',
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

// Result XP multipliers
export const RESULT_MULTIPLIERS: Record<EncounterResult, number> = {
  perfect: 1.5,
  good: 1.0,
  partial: 0.5,
  fail: 0,
};
