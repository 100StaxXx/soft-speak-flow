// Card Battle System Type Definitions

export type BattleElement = 'body' | 'mind' | 'soul';
export type MoveType = 'attack' | 'defend' | 'buff' | 'debuff' | 'heal';
export type BattleResult = 'win' | 'lose' | 'draw' | 'forfeit';
export type OpponentType = 'ai' | 'pvp';

// Status effects for Option 3 expansion
export type StatusEffect = 
  | 'burn'      // Damage over time
  | 'freeze'    // Skip turn chance
  | 'confuse'   // May hit self
  | 'poison'    // Stacking damage
  | 'stun'      // Guaranteed skip
  | 'shield'    // Damage reduction
  | 'regen'     // Heal over time
  | 'boost'     // Attack increase
  | 'weaken';   // Attack decrease

export interface Move {
  id: string;
  name: string;
  description: string | null;
  element: BattleElement;
  basePower: number;
  accuracy: number;
  moveType: MoveType;
  statusEffect: StatusEffect | null;
  statusChance: number;
  energyCost: number;
  cooldownTurns: number;
}

export interface BattleCard {
  id: string;
  cardId: string;
  creatureName: string;
  species: string;
  element: BattleElement;
  evolutionStage: number;
  rarity: string;
  imageUrl: string | null;
  stats: {
    attack: number;
    defense: number;
    speed: number;
    hp: number;
  };
  moves: Move[];
  // Runtime battle state
  currentHP: number;
  maxHP: number;
  statusEffects: ActiveStatusEffect[];
  isActive: boolean;
  isKnockedOut: boolean;
}

export interface ActiveStatusEffect {
  effect: StatusEffect;
  turnsRemaining: number;
  stacks?: number;
}

export interface BattleAction {
  type: 'attack' | 'switch' | 'defend' | 'forfeit';
  moveId?: string;
  targetCardIndex?: number;
  switchToCardIndex?: number;
}

export interface TurnResult {
  turnNumber: number;
  playerAction: BattleAction;
  aiAction: BattleAction;
  playerDamageDealt: number;
  aiDamageDealt: number;
  playerCardKO: boolean;
  aiCardKO: boolean;
  typeAdvantage: 'player' | 'ai' | 'neutral';
  criticalHit: boolean;
  statusApplied: StatusEffect | null;
  narration: string;
}

export interface BattleState {
  phase: 'setup' | 'battle' | 'switching' | 'victory' | 'defeat';
  turnNumber: number;
  playerCards: BattleCard[];
  aiCards: BattleCard[];
  activePlayerCardIndex: number;
  activeAICardIndex: number;
  turnHistory: TurnResult[];
  totalPlayerDamage: number;
  totalAIDamage: number;
  isPlayerTurn: boolean;
  battleId: string;
}

// AI difficulty levels for Option 3 expansion
export type AIDifficulty = 'easy' | 'medium' | 'hard' | 'legendary';

export interface AIConfig {
  difficulty: AIDifficulty;
  // Probability of making optimal choice (0-1)
  optimalPlayChance: number;
  // Whether AI considers type advantages
  usesTypeAdvantage: boolean;
  // Whether AI predicts player moves
  predictsMoves: boolean;
  // Card power scaling (1.0 = same as player)
  statMultiplier: number;
}

export const AI_CONFIGS: Record<AIDifficulty, AIConfig> = {
  easy: {
    difficulty: 'easy',
    optimalPlayChance: 0.3,
    usesTypeAdvantage: false,
    predictsMoves: false,
    statMultiplier: 0.8,
  },
  medium: {
    difficulty: 'medium',
    optimalPlayChance: 0.6,
    usesTypeAdvantage: true,
    predictsMoves: false,
    statMultiplier: 1.0,
  },
  hard: {
    difficulty: 'hard',
    optimalPlayChance: 0.85,
    usesTypeAdvantage: true,
    predictsMoves: true,
    statMultiplier: 1.1,
  },
  legendary: {
    difficulty: 'legendary',
    optimalPlayChance: 0.95,
    usesTypeAdvantage: true,
    predictsMoves: true,
    statMultiplier: 1.3,
  },
};

// XP and reward calculations
export interface BattleRewards {
  baseXP: number;
  bonusXP: number;
  totalXP: number;
  perfectBonus: boolean; // No cards KO'd
  speedBonus: boolean;   // Won in few turns
  typeBonus: boolean;    // Used type advantages effectively
}

export const BATTLE_XP_CONFIG: {
  baseWinXP: number;
  baseLoseXP: number;
  perfectMultiplier: number;
  speedBonusTurns: number;
  speedMultiplier: number;
  typeAdvantageBonus: number;
  difficultyMultipliers: Record<AIDifficulty, number>;
} = {
  baseWinXP: 50,
  baseLoseXP: 10,
  perfectMultiplier: 1.5,
  speedBonusTurns: 10,
  speedMultiplier: 1.25,
  typeAdvantageBonus: 10,
  difficultyMultipliers: {
    easy: 0.75,
    medium: 1.0,
    hard: 1.5,
    legendary: 2.0,
  },
};
