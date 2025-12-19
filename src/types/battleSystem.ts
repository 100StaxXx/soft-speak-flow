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

// HP configurations by tier - REBALANCED for longer battles (4-6 milestones needed)
export const TIER_BATTLE_CONFIG: Record<AdversaryTier, TierBattleConfig> = {
  common: {
    playerHP: 100,
    adversaryHP: 100,   // ~5 milestones needed
    attackDamage: 12,   // Reduced for longer battles
  },
  uncommon: {
    playerHP: 100,
    adversaryHP: 120,   // ~6 milestones
    attackDamage: 15,
  },
  rare: {
    playerHP: 100,
    adversaryHP: 150,   // ~7-8 milestones
    attackDamage: 18,
  },
  epic: {
    playerHP: 100,
    adversaryHP: 180,   // ~9 milestones
    attackDamage: 22,
  },
  legendary: {
    playerHP: 100,
    adversaryHP: 220,   // ~11 milestones
    attackDamage: 28,
  },
};

// REBALANCED: Milestone-based damage values (no per-action damage)
export const GAME_DAMAGE_VALUES = {
  // Tap Sequence - damage only on level complete
  tap_sequence: {
    levelComplete: 20,
    perfectLevel: 30,         // Bonus for no mistakes
    wrongTap: 'tier_attack',
  },
  
  // Galactic Match - damage only on level complete
  galactic_match: {
    levelComplete: 20,
    perfectLevel: 30,         // No wrong pairs
    wrongMatch: 'tier_attack',
  },
  
  // Soul Serpent - damage based on score milestones
  soul_serpent: {
    scoreMilestone: 25,       // Every 10 stardust
    collision: 50,
  },
  
  // Starfall Dodge - damage based on survival time
  starfall_dodge: {
    survivalMilestone: 20,    // Every 10 seconds survived
    hitByProjectile: 'tier_attack',
  },
  
  // Energy Beam - damage only on wave clear
  energy_beam: {
    waveComplete: 25,
    bossKill: 15,
    playerHit: 'tier_attack',
  },
  
  // Orb Match - damage on level complete
  orb_match: {
    levelComplete: 25,        // After reaching score target
    specialActivation: 10,    // Special orbs still valuable
    noMoves: 10,
  },
  
  // Eclipse Timing - damage on section complete
  eclipse_timing: {
    sectionComplete: 20,      // Every ~30 notes
    comboMilestone: 10,       // Bonus per 20 combo
    miss: 'tier_attack',
  },
  
  // Astral Frequency - damage on distance milestones
  astral_frequency: {
    distanceMilestone: 20,    // Every 100m traveled
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
