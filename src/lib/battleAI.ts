// Battle AI Logic

import { 
  BattleCard, 
  BattleAction, 
  Move, 
  AIConfig, 
  AI_CONFIGS, 
  AIDifficulty,
  BattleElement 
} from '@/types/cardBattle';
import { 
  getTypeMultiplier, 
  isTypeAdvantage, 
  calculateDamage 
} from './battleCalculations';

export interface AIDecisionContext {
  aiCards: BattleCard[];
  playerCards: BattleCard[];
  activeAICardIndex: number;
  activePlayerCardIndex: number;
  turnNumber: number;
  difficulty: AIDifficulty;
}

// Generate AI's deck from available moves and elements
export function generateAIDeck(
  playerCards: BattleCard[], 
  difficulty: AIDifficulty,
  availableMoves: Move[]
): BattleCard[] {
  const config = AI_CONFIGS[difficulty];
  const aiCards: BattleCard[] = [];
  
  // Analyze player's elements
  const playerElements = playerCards.map(c => c.element);
  
  // Choose counter-elements based on difficulty
  const counterElements = config.usesTypeAdvantage
    ? playerElements.map(e => getCounterElement(e))
    : ['body', 'mind', 'soul'] as BattleElement[];
  
  // Generate 3 AI cards
  for (let i = 0; i < 3; i++) {
    const element = counterElements[i % counterElements.length];
    const aiCard = createAICard(element, playerCards[i], config, availableMoves);
    aiCards.push(aiCard);
  }
  
  return aiCards;
}

function getCounterElement(element: BattleElement): BattleElement {
  // Return the element that beats the given element
  switch (element) {
    case 'body': return 'soul';  // Soul beats Body
    case 'mind': return 'body';  // Body beats Mind
    case 'soul': return 'mind';  // Mind beats Soul
  }
}

function createAICard(
  element: BattleElement,
  referenceCard: BattleCard,
  config: AIConfig,
  availableMoves: Move[]
): BattleCard {
  // Scale stats based on difficulty
  const baseStats = referenceCard.stats;
  const scaledStats = {
    attack: Math.floor(baseStats.attack * config.statMultiplier),
    defense: Math.floor(baseStats.defense * config.statMultiplier),
    speed: Math.floor(baseStats.speed * config.statMultiplier),
    hp: Math.floor(baseStats.hp * config.statMultiplier),
  };
  
  // Get moves for this element
  const elementMoves = availableMoves.filter(m => m.element === element);
  const attackMove = elementMoves.find(m => m.moveType === 'attack') || availableMoves[0];
  
  // AI creature names by element
  const creatureNames: Record<BattleElement, string[]> = {
    body: ['Ironclad Guardian', 'Steel Sentinel', 'Bronze Titan'],
    mind: ['Mystic Oracle', 'Thought Weaver', 'Psionic Echo'],
    soul: ['Spirit Wisp', 'Ethereal Shade', 'Astral Phoenix'],
  };
  
  const names = creatureNames[element];
  const name = names[Math.floor(Math.random() * names.length)];
  
  const maxHP = Math.floor(scaledStats.hp * (1 + referenceCard.evolutionStage * 0.15));
  
  return {
    id: `ai-${element}-${Date.now()}-${Math.random()}`,
    cardId: `ai-card-${element}`,
    creatureName: name,
    species: 'AI Adversary',
    element,
    evolutionStage: Math.min(referenceCard.evolutionStage, 5),
    rarity: config.difficulty === 'legendary' ? 'epic' : 'rare',
    imageUrl: null,
    stats: scaledStats,
    moves: [attackMove],
    currentHP: maxHP,
    maxHP,
    statusEffects: [],
    isActive: false,
    isKnockedOut: false,
  };
}

// Main AI decision function
export function getAIAction(context: AIDecisionContext): BattleAction {
  const config = AI_CONFIGS[context.difficulty];
  const aiCard = context.aiCards[context.activeAICardIndex];
  const playerCard = context.playerCards[context.activePlayerCardIndex];
  
  // If current card is KO'd, must switch
  if (aiCard.isKnockedOut) {
    const switchIndex = findBestSwitch(context);
    if (switchIndex !== -1) {
      return { type: 'switch', switchToCardIndex: switchIndex };
    }
    // No valid switch, forfeit
    return { type: 'forfeit' };
  }
  
  // Random chance to make suboptimal play (based on difficulty)
  const makesOptimalPlay = Math.random() < config.optimalPlayChance;
  
  if (!makesOptimalPlay) {
    // Make a random but valid move
    return getRandomAction(context);
  }
  
  // Optimal play logic
  return getOptimalAction(context, config);
}

function findBestSwitch(context: AIDecisionContext): number {
  const { aiCards, playerCards, activePlayerCardIndex } = context;
  const playerCard = playerCards[activePlayerCardIndex];
  
  // Find alive cards that have type advantage
  const validCards = aiCards
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => !card.isKnockedOut && !card.isActive);
  
  if (validCards.length === 0) return -1;
  
  // Prefer type advantage
  const advantageCard = validCards.find(({ card }) => 
    isTypeAdvantage(card.element, playerCard.element)
  );
  
  if (advantageCard) return advantageCard.index;
  
  // Otherwise pick healthiest card
  validCards.sort((a, b) => 
    (b.card.currentHP / b.card.maxHP) - (a.card.currentHP / a.card.maxHP)
  );
  
  return validCards[0].index;
}

function getRandomAction(context: AIDecisionContext): BattleAction {
  const aiCard = context.aiCards[context.activeAICardIndex];
  
  // 80% chance to attack, 20% to switch (if possible)
  if (Math.random() < 0.8 || !hasValidSwitch(context)) {
    const move = aiCard.moves[Math.floor(Math.random() * aiCard.moves.length)];
    return { type: 'attack', moveId: move.id };
  }
  
  return { type: 'switch', switchToCardIndex: findBestSwitch(context) };
}

function hasValidSwitch(context: AIDecisionContext): boolean {
  return context.aiCards.some((card, i) => 
    !card.isKnockedOut && i !== context.activeAICardIndex
  );
}

function getOptimalAction(context: AIDecisionContext, config: AIConfig): BattleAction {
  const { aiCards, playerCards, activeAICardIndex, activePlayerCardIndex } = context;
  const aiCard = aiCards[activeAICardIndex];
  const playerCard = playerCards[activePlayerCardIndex];
  
  // Check if we should switch for type advantage
  if (config.usesTypeAdvantage) {
    const currentMultiplier = getTypeMultiplier(aiCard.element, playerCard.element);
    
    // If we have disadvantage, consider switching
    if (currentMultiplier < 1) {
      const betterSwitch = aiCards.findIndex((card, i) => 
        i !== activeAICardIndex && 
        !card.isKnockedOut && 
        getTypeMultiplier(card.element, playerCard.element) > currentMultiplier
      );
      
      if (betterSwitch !== -1 && Math.random() < 0.7) { // 70% chance to switch
        return { type: 'switch', switchToCardIndex: betterSwitch };
      }
    }
  }
  
  // Otherwise, use best available move
  const bestMove = selectBestMove(aiCard, playerCard);
  return { type: 'attack', moveId: bestMove.id };
}

function selectBestMove(attacker: BattleCard, defender: BattleCard): Move {
  if (attacker.moves.length === 1) {
    return attacker.moves[0];
  }
  
  // Score each move
  const scoredMoves = attacker.moves.map(move => {
    const { damage } = calculateDamage(attacker, defender, move, { forceHit: true });
    return { move, score: damage };
  });
  
  // Sort by score descending
  scoredMoves.sort((a, b) => b.score - a.score);
  
  return scoredMoves[0].move;
}

// Predict player's next move (for hard/legendary difficulty)
export function predictPlayerMove(context: AIDecisionContext): BattleAction | null {
  const config = AI_CONFIGS[context.difficulty];
  
  if (!config.predictsMoves) return null;
  
  const playerCard = context.playerCards[context.activePlayerCardIndex];
  const aiCard = context.aiCards[context.activeAICardIndex];
  
  // Simple prediction: assume player will use their highest damage move
  // Or switch if at type disadvantage
  
  if (getTypeMultiplier(playerCard.element, aiCard.element) < 1) {
    // Player might switch
    return { type: 'switch', switchToCardIndex: 0 };
  }
  
  // Player likely attacks
  return { type: 'attack' };
}
