// Utility functions for card battle system

import { BattleCard, BattleElement, Move } from '@/types/cardBattle';
import { calculateMaxHP, RARITY_MULTIPLIERS, applyRarityBonus } from './battleCalculations';
import { getDefaultMoveForElement } from '@/hooks/useBattleMoves';
import { Json } from '@/integrations/supabase/types';

// Evolution card from database
interface DBEvolutionCard {
  id: string;
  card_id: string;
  creature_name: string;
  species: string;
  element: string;
  evolution_stage: number;
  rarity: string;
  image_url: string | null;
  stats: Json;
}

// Transform database card to battle card
export function transformToBattleCard(
  dbCard: DBEvolutionCard,
  availableMoves: Move[]
): BattleCard {
  const element = dbCard.element.toLowerCase() as BattleElement;
  
  // Parse stats from JSON
  const rawStats = dbCard.stats as Record<string, number> | null;
  const baseStats = {
    attack: rawStats?.attack ?? rawStats?.strength ?? 50,
    defense: rawStats?.defense ?? rawStats?.resilience ?? 50,
    speed: rawStats?.speed ?? rawStats?.agility ?? 50,
    hp: rawStats?.hp ?? rawStats?.vitality ?? 100,
  };
  
  // Apply rarity bonus
  const stats = {
    attack: applyRarityBonus(baseStats.attack, dbCard.rarity),
    defense: applyRarityBonus(baseStats.defense, dbCard.rarity),
    speed: applyRarityBonus(baseStats.speed, dbCard.rarity),
    hp: applyRarityBonus(baseStats.hp, dbCard.rarity),
  };
  
  // Get moves for this element
  const cardMoves = availableMoves.filter(m => m.element === element);
  const moves = cardMoves.length > 0 
    ? [cardMoves.find(m => m.moveType === 'attack') || cardMoves[0]]
    : [getDefaultMoveForElement(availableMoves, element)];
  
  const battleCard: BattleCard = {
    id: dbCard.id,
    cardId: dbCard.card_id,
    creatureName: dbCard.creature_name,
    species: dbCard.species,
    element,
    evolutionStage: dbCard.evolution_stage,
    rarity: dbCard.rarity,
    imageUrl: dbCard.image_url,
    stats,
    moves,
    currentHP: 0, // Will be set on initialization
    maxHP: 0,     // Will be set on initialization
    statusEffects: [],
    isActive: false,
    isKnockedOut: false,
  };
  
  // Calculate HP
  const maxHP = calculateMaxHP(battleCard);
  battleCard.maxHP = maxHP;
  battleCard.currentHP = maxHP;
  
  return battleCard;
}

// Validate deck selection (3 cards required)
export function validateDeck(cards: BattleCard[]): { valid: boolean; error?: string } {
  if (cards.length !== 3) {
    return { valid: false, error: 'You must select exactly 3 cards' };
  }
  
  // Check for duplicates
  const uniqueIds = new Set(cards.map(c => c.cardId));
  if (uniqueIds.size !== cards.length) {
    return { valid: false, error: 'Each card must be unique' };
  }
  
  return { valid: true };
}

// Get element icon name
export function getElementIcon(element: BattleElement): string {
  switch (element) {
    case 'body': return 'zap';
    case 'mind': return 'brain';
    case 'soul': return 'heart';
  }
}

// Get element color class
export function getElementColorClass(element: BattleElement): string {
  switch (element) {
    case 'body': return 'text-red-500';
    case 'mind': return 'text-blue-500';
    case 'soul': return 'text-emerald-500';
  }
}

// Get element gradient class
export function getElementGradientClass(element: BattleElement): string {
  switch (element) {
    case 'body': return 'from-red-500 to-orange-500';
    case 'mind': return 'from-blue-500 to-purple-500';
    case 'soul': return 'from-emerald-500 to-teal-500';
  }
}

// Calculate battle power rating for a deck
export function calculateDeckPower(cards: BattleCard[]): number {
  if (cards.length === 0) return 0;
  
  const totalStats = cards.reduce((sum, card) => {
    const statSum = card.stats.attack + card.stats.defense + card.stats.speed + card.stats.hp;
    const stageMultiplier = 1 + (card.evolutionStage * 0.15);
    const rarityMultiplier = RARITY_MULTIPLIERS[card.rarity.toLowerCase()] || 1;
    return sum + (statSum * stageMultiplier * rarityMultiplier);
  }, 0);
  
  return Math.floor(totalStats / cards.length);
}

// Suggest optimal deck composition
export function suggestDeckComposition(availableCards: BattleCard[]): BattleCard[] {
  if (availableCards.length <= 3) {
    return availableCards.slice(0, 3);
  }
  
  // Try to get one of each element for type coverage
  const bodyCards = availableCards.filter(c => c.element === 'body');
  const mindCards = availableCards.filter(c => c.element === 'mind');
  const soulCards = availableCards.filter(c => c.element === 'soul');
  
  // Sort each by power
  const sortByPower = (cards: BattleCard[]) => 
    [...cards].sort((a, b) => calculateDeckPower([b]) - calculateDeckPower([a]));
  
  const suggested: BattleCard[] = [];
  
  // Pick best from each element
  if (bodyCards.length > 0) suggested.push(sortByPower(bodyCards)[0]);
  if (mindCards.length > 0) suggested.push(sortByPower(mindCards)[0]);
  if (soulCards.length > 0) suggested.push(sortByPower(soulCards)[0]);
  
  // Fill remaining slots with highest power cards
  if (suggested.length < 3) {
    const remaining = availableCards
      .filter(c => !suggested.includes(c))
      .sort((a, b) => calculateDeckPower([b]) - calculateDeckPower([a]));
    
    while (suggested.length < 3 && remaining.length > 0) {
      suggested.push(remaining.shift()!);
    }
  }
  
  return suggested.slice(0, 3);
}
