// Battle Damage Calculations and Type Matrix

import { BattleElement, BattleCard, Move, StatusEffect } from '@/types/cardBattle';

// Type advantage matrix: attacker -> defender -> multiplier
// Body > Mind > Soul > Body (rock-paper-scissors triangle)
const TYPE_MATRIX: Record<BattleElement, Record<BattleElement, number>> = {
  body: {
    body: 1.0,
    mind: 1.5,  // Body is strong against Mind
    soul: 0.75, // Body is weak against Soul
  },
  mind: {
    body: 0.75, // Mind is weak against Body
    mind: 1.0,
    soul: 1.5,  // Mind is strong against Soul
  },
  soul: {
    body: 1.5,  // Soul is strong against Body
    mind: 0.75, // Soul is weak against Mind
    soul: 1.0,
  },
};

export function getTypeMultiplier(attackerElement: BattleElement, defenderElement: BattleElement): number {
  return TYPE_MATRIX[attackerElement][defenderElement];
}

export function getTypeAdvantageDescription(attackerElement: BattleElement, defenderElement: BattleElement): string {
  const multiplier = getTypeMultiplier(attackerElement, defenderElement);
  if (multiplier > 1) return 'Super effective!';
  if (multiplier < 1) return 'Not very effective...';
  return '';
}

export function isTypeAdvantage(attackerElement: BattleElement, defenderElement: BattleElement): boolean {
  return getTypeMultiplier(attackerElement, defenderElement) > 1;
}

export function isTypeDisadvantage(attackerElement: BattleElement, defenderElement: BattleElement): boolean {
  return getTypeMultiplier(attackerElement, defenderElement) < 1;
}

// Critical hit calculation
const CRITICAL_BASE_CHANCE = 0.1; // 10% base crit chance
const CRITICAL_MULTIPLIER = 1.5;

export function rollCriticalHit(attackerSpeed: number = 50): boolean {
  // Higher speed slightly increases crit chance
  const critChance = CRITICAL_BASE_CHANCE + (attackerSpeed / 1000);
  return Math.random() < critChance;
}

// Accuracy check
export function rollAccuracy(moveAccuracy: number, attackerStats: { speed: number }, defenderStats: { speed: number }): boolean {
  // Speed difference affects accuracy
  const speedDiff = attackerStats.speed - defenderStats.speed;
  const adjustedAccuracy = moveAccuracy + (speedDiff / 2);
  return Math.random() * 100 < Math.min(100, adjustedAccuracy);
}

// Main damage calculation
export interface DamageCalculationResult {
  damage: number;
  isCritical: boolean;
  typeMultiplier: number;
  effectiveness: 'super' | 'normal' | 'weak';
  missed: boolean;
}

export function calculateDamage(
  attacker: BattleCard,
  defender: BattleCard,
  move: Move,
  options: { forceCrit?: boolean; forceHit?: boolean } = {}
): DamageCalculationResult {
  // Check accuracy first
  const hit = options.forceHit || rollAccuracy(move.accuracy, attacker.stats, defender.stats);
  
  if (!hit) {
    return {
      damage: 0,
      isCritical: false,
      typeMultiplier: 1,
      effectiveness: 'normal',
      missed: true,
    };
  }
  
  // Base damage formula
  const baseDamage = move.basePower * (attacker.stats.attack / Math.max(1, defender.stats.defense));
  
  // Type multiplier
  const typeMultiplier = getTypeMultiplier(move.element, defender.element);
  
  // Evolution stage bonus (+10% per stage)
  const stageBonus = 1 + (attacker.evolutionStage * 0.1);
  
  // Critical hit
  const isCritical = options.forceCrit || rollCriticalHit(attacker.stats.speed);
  const critMultiplier = isCritical ? CRITICAL_MULTIPLIER : 1;
  
  // Random variance (85-100%)
  const variance = 0.85 + (Math.random() * 0.15);
  
  // Calculate final damage
  let damage = Math.floor(baseDamage * typeMultiplier * stageBonus * critMultiplier * variance);
  
  // Minimum damage of 1 if move has power
  if (move.basePower > 0 && damage < 1) {
    damage = 1;
  }
  
  // Determine effectiveness
  let effectiveness: 'super' | 'normal' | 'weak' = 'normal';
  if (typeMultiplier > 1) effectiveness = 'super';
  else if (typeMultiplier < 1) effectiveness = 'weak';
  
  return {
    damage,
    isCritical,
    typeMultiplier,
    effectiveness,
    missed: false,
  };
}

// Calculate HP from card stats and evolution stage
export function calculateMaxHP(card: { stats: { hp: number }; evolutionStage: number }): number {
  const baseHP = card.stats.hp || 100;
  const stageMultiplier = 1 + (card.evolutionStage * 0.15); // +15% HP per stage
  return Math.floor(baseHP * stageMultiplier);
}

// Status effect damage calculations
export function calculateStatusDamage(effect: StatusEffect, maxHP: number, stacks: number = 1): number {
  switch (effect) {
    case 'burn':
      return Math.floor(maxHP * 0.0625 * stacks); // 6.25% per stack
    case 'poison':
      return Math.floor(maxHP * 0.0625 * stacks); // Stacking poison
    default:
      return 0;
  }
}

// Healing calculations
export function calculateHealing(healer: BattleCard, move: Move): number {
  if (move.moveType !== 'heal') return 0;
  
  const baseHeal = move.basePower;
  const stageBonus = 1 + (healer.evolutionStage * 0.1);
  
  return Math.floor(baseHeal * stageBonus);
}

// Defense move damage reduction
export function calculateDefenseReduction(defender: BattleCard, move: Move): number {
  if (move.moveType !== 'defend') return 1; // No reduction
  
  // Defend reduces incoming damage by 50%
  return 0.5;
}

// Generate battle narration
export function generateNarration(
  attackerName: string,
  defenderName: string,
  move: Move,
  result: DamageCalculationResult
): string {
  if (result.missed) {
    return `${attackerName}'s ${move.name} missed!`;
  }
  
  let narration = `${attackerName} used ${move.name}!`;
  
  if (result.effectiveness === 'super') {
    narration += ' It\'s super effective!';
  } else if (result.effectiveness === 'weak') {
    narration += ' It\'s not very effective...';
  }
  
  if (result.isCritical) {
    narration += ' A critical hit!';
  }
  
  narration += ` ${defenderName} took ${result.damage} damage!`;
  
  return narration;
}

// Rarity stat multipliers
export const RARITY_MULTIPLIERS: Record<string, number> = {
  common: 1.0,
  uncommon: 1.1,
  rare: 1.25,
  epic: 1.4,
  legendary: 1.6,
};

export function applyRarityBonus(baseStat: number, rarity: string): number {
  const multiplier = RARITY_MULTIPLIERS[rarity.toLowerCase()] || 1.0;
  return Math.floor(baseStat * multiplier);
}
