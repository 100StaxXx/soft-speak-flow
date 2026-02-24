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

// Battle duration limits by tier (in seconds)
// Keep resist + regular encounters at a 90s baseline for longer sessions.
export const TIER_BATTLE_DURATION: Record<AdversaryTier, number> = {
  common: 90,
  uncommon: 90,
  rare: 90,
  epic: 90,
  legendary: 120,
};

// HP configurations by tier - rebalanced for longer encounter battles
export const TIER_BATTLE_CONFIG: Record<AdversaryTier, TierBattleConfig> = {
  common: {
    playerHP: 100,
    adversaryHP: 80,    // ~3-4 milestones needed
    attackDamage: 12,
  },
  uncommon: {
    playerHP: 100,
    adversaryHP: 100,   // ~4 milestones
    attackDamage: 15,
  },
  rare: {
    playerHP: 100,
    adversaryHP: 120,   // ~4-5 milestones
    attackDamage: 18,
  },
  epic: {
    playerHP: 100,
    adversaryHP: 150,   // ~5-6 milestones
    attackDamage: 22,
  },
  legendary: {
    playerHP: 100,
    adversaryHP: 180,   // ~6-7 milestones
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
    collision: 'tier_attack', // Player takes tier-based damage on collision (not instant death)
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
  
  // Orb Match - damage on score targets and special activation
  orb_match: {
    scoreTarget: 35,          // Reaching score target deals damage (boosted for faster battles)
    specialActivation: 10,    // Special orbs still valuable
    noMoves: 'tier_attack',   // Player takes tier damage for shuffles
  },
  
  // Eclipse Timing - WIN/LOSE based on song completion
  eclipse_timing: {
    songComplete: 999,        // Instant win - defeats any adversary
    tooManyMisses: 999,       // Instant lose - player takes fatal damage
    maxMisses: { easy: 10, medium: 8, hard: 5 },
  },
  
  // Astral Frequency - damage on distance milestones
  astral_frequency: {
    distanceMilestone: 12,    // Every 100m traveled (reduced for longer encounters)
    collision: 'tier_attack',
  },
} as const;

// Result calculation thresholds based on remaining player HP (binary win/lose)
export const RESULT_HP_THRESHOLDS = {
  perfect: 70, // 70%+ HP remaining = perfect win
  good: 1,     // Any HP remaining = good win
  fail: 0,     // Defeated = fail
} as const;

export function calculateResultFromHP(
  playerHP: number, 
  playerMaxHP: number,
  isPlayerDefeated: boolean
): 'perfect' | 'good' | 'fail' {
  if (isPlayerDefeated) return 'fail';
  
  const hpPercent = (playerHP / playerMaxHP) * 100;
  
  if (hpPercent >= RESULT_HP_THRESHOLDS.perfect) return 'perfect';
  return 'good'; // Any survival = win
}
