// Battle System Type Definitions

import { AdversaryTier } from './astralEncounters';

export type DamageTarget = 'player' | 'adversary';

export interface DamageEvent {
  target: DamageTarget;
  amount: number;
  source: string; // e.g., "correct_tap", "collision", "match_3"
  isCritical?: boolean;
}

export interface BattleState {
  playerHP: number;
  playerMaxHP: number;
  adversaryHP: number;
  adversaryMaxHP: number;
  isPlayerDefeated: boolean;
  isAdversaryDefeated: boolean;
  playerHPPercent: number;
  adversaryHPPercent: number;
}

export interface TierBattleConfig {
  playerHP: number;
  adversaryHP: number;
  attackDamage: number; // Damage adversary deals per hit
}

// HP configurations by tier
export const TIER_BATTLE_CONFIG: Record<AdversaryTier, TierBattleConfig> = {
  common: {
    playerHP: 100,
    adversaryHP: 80,
    attackDamage: 15,
  },
  uncommon: {
    playerHP: 100,
    adversaryHP: 100,
    attackDamage: 18,
  },
  rare: {
    playerHP: 100,
    adversaryHP: 130,
    attackDamage: 22,
  },
  epic: {
    playerHP: 100,
    adversaryHP: 160,
    attackDamage: 28,
  },
  legendary: {
    playerHP: 100,
    adversaryHP: 200,
    attackDamage: 35,
  },
};

// Damage values for each mini-game action
export const GAME_DAMAGE_VALUES = {
  // Tap Sequence
  tap_sequence: {
    correctTap: 8,
    levelComplete: 25,
    wrongTap: 'tier_attack', // Uses tier attack damage
  },
  
  // Galactic Match
  galactic_match: {
    correctMatch: 12,
    levelComplete: 20,
    wrongMatch: 'tier_attack',
  },
  
  // Soul Serpent (endless)
  soul_serpent: {
    collectStardust: 5,
    collision: 50, // Self-inflicted
  },
  
  // Starfall Dodge
  starfall_dodge: {
    collectCrystal: 4,
    hitByProjectile: 'tier_attack',
  },
  
  // Energy Beam
  energy_beam: {
    destroyAsteroid: 3,
    destroyEnemy: 8,
    destroyBoss: 20,
    playerHit: 'tier_attack',
  },
  
  // Orb Match
  orb_match: {
    match3: 5,
    match4: 10,
    match5: 18,
    noMoves: 10, // Player takes damage
  },
  
  // Eclipse Timing
  eclipse_timing: {
    perfect: 6,
    great: 4,
    good: 2,
    miss: 'tier_attack',
  },
  
  // Rune Resonance
  rune_resonance: {
    perfectHit: 8,
    goodHit: 5,
    miss: 'tier_attack',
  },
  
  // Astral Frequency (endless runner)
  astral_frequency: {
    collectOrb: 4,
    perfectLock: 15,
    collision: 'tier_attack',
  },
} as const;

// Result calculation thresholds based on remaining player HP
export const RESULT_HP_THRESHOLDS = {
  perfect: 80, // 80%+ HP remaining
  good: 50,    // 50-79% HP remaining
  partial: 25, // 25-49% HP remaining
  fail: 0,     // Defeated or < 25%
} as const;

export function calculateResultFromHP(
  playerHP: number, 
  playerMaxHP: number,
  isPlayerDefeated: boolean
): 'perfect' | 'good' | 'partial' | 'fail' {
  if (isPlayerDefeated) return 'fail';
  
  const hpPercent = (playerHP / playerMaxHP) * 100;
  
  if (hpPercent >= RESULT_HP_THRESHOLDS.perfect) return 'perfect';
  if (hpPercent >= RESULT_HP_THRESHOLDS.good) return 'good';
  if (hpPercent >= RESULT_HP_THRESHOLDS.partial) return 'partial';
  return 'fail';
}
