// Main Card Battle Hook

import { useState, useCallback, useMemo } from 'react';
import { 
  BattleState, 
  BattleCard, 
  BattleAction, 
  TurnResult, 
  Move,
  AIDifficulty,
  BattleRewards,
  BATTLE_XP_CONFIG
} from '@/types/cardBattle';
import { 
  calculateDamage, 
  calculateMaxHP, 
  generateNarration,
  getTypeMultiplier 
} from '@/lib/battleCalculations';
import { generateAIDeck, getAIAction } from '@/lib/battleAI';

interface UseCardBattleOptions {
  playerCards: BattleCard[];
  difficulty: AIDifficulty;
  availableMoves: Move[];
  onBattleEnd?: (result: 'win' | 'lose', rewards: BattleRewards) => void;
}

interface UseCardBattleReturn {
  battleState: BattleState;
  activePlayerCard: BattleCard | null;
  activeAICard: BattleCard | null;
  executeAction: (action: BattleAction) => void;
  switchCard: (cardIndex: number) => void;
  forfeit: () => void;
  isProcessingTurn: boolean;
  lastTurnResult: TurnResult | null;
  canSwitch: boolean;
  rewards: BattleRewards | null;
}

export function useCardBattle({
  playerCards: inputPlayerCards,
  difficulty,
  availableMoves,
  onBattleEnd,
}: UseCardBattleOptions): UseCardBattleReturn {
  // Initialize player cards with HP
  const initializedPlayerCards = useMemo(() => 
    inputPlayerCards.map(card => ({
      ...card,
      maxHP: calculateMaxHP(card),
      currentHP: calculateMaxHP(card),
      statusEffects: [],
      isActive: false,
      isKnockedOut: false,
    }))
  , [inputPlayerCards]);
  
  // Generate AI deck
  const initializedAICards = useMemo(() => 
    generateAIDeck(initializedPlayerCards, difficulty, availableMoves)
  , [initializedPlayerCards, difficulty, availableMoves]);
  
  const [battleState, setBattleState] = useState<BattleState>(() => ({
    phase: 'battle',
    turnNumber: 1,
    playerCards: initializedPlayerCards.map((c, i) => ({ ...c, isActive: i === 0 })),
    aiCards: initializedAICards.map((c, i) => ({ ...c, isActive: i === 0 })),
    activePlayerCardIndex: 0,
    activeAICardIndex: 0,
    turnHistory: [],
    totalPlayerDamage: 0,
    totalAIDamage: 0,
    isPlayerTurn: true,
    battleId: `battle-${Date.now()}`,
  }));
  
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  const [lastTurnResult, setLastTurnResult] = useState<TurnResult | null>(null);
  const [rewards, setRewards] = useState<BattleRewards | null>(null);
  
  const activePlayerCard = battleState.playerCards[battleState.activePlayerCardIndex] || null;
  const activeAICard = battleState.aiCards[battleState.activeAICardIndex] || null;
  
  const canSwitch = battleState.playerCards.some(
    (card, i) => !card.isKnockedOut && i !== battleState.activePlayerCardIndex
  );
  
  const calculateRewards = useCallback((won: boolean, state: BattleState): BattleRewards => {
    const config = BATTLE_XP_CONFIG;
    const diffMultiplier = config.difficultyMultipliers[difficulty];
    
    let baseXP = won ? config.baseWinXP : config.baseLoseXP;
    baseXP = Math.floor(baseXP * diffMultiplier);
    
    let bonusXP = 0;
    
    // Perfect bonus: no cards KO'd
    const perfectBonus = won && state.playerCards.every(c => !c.isKnockedOut);
    if (perfectBonus) {
      bonusXP += Math.floor(baseXP * (config.perfectMultiplier - 1));
    }
    
    // Speed bonus: won quickly
    const speedBonus = won && state.turnNumber <= config.speedBonusTurns;
    if (speedBonus) {
      bonusXP += Math.floor(baseXP * (config.speedMultiplier - 1));
    }
    
    // Type advantage uses
    const typeBonus = state.turnHistory.filter(t => t.typeAdvantage === 'player').length > 0;
    if (typeBonus) {
      const advantageHits = state.turnHistory.filter(t => t.typeAdvantage === 'player').length;
      bonusXP += advantageHits * config.typeAdvantageBonus;
    }
    
    return {
      baseXP,
      bonusXP,
      totalXP: baseXP + bonusXP,
      perfectBonus,
      speedBonus,
      typeBonus,
    };
  }, [difficulty]);
  
  const checkBattleEnd = useCallback((state: BattleState): 'win' | 'lose' | null => {
    const allPlayerKO = state.playerCards.every(c => c.isKnockedOut);
    const allAIKO = state.aiCards.every(c => c.isKnockedOut);
    
    if (allPlayerKO) return 'lose';
    if (allAIKO) return 'win';
    return null;
  }, []);
  
  const processTurn = useCallback((playerAction: BattleAction) => {
    setIsProcessingTurn(true);
    
    setBattleState(prev => {
      const newState = { ...prev };
      let playerCard = { ...newState.playerCards[newState.activePlayerCardIndex] };
      let aiCard = { ...newState.aiCards[newState.activeAICardIndex] };
      
      // Get AI action
      const aiAction = getAIAction({
        aiCards: newState.aiCards,
        playerCards: newState.playerCards,
        activeAICardIndex: newState.activeAICardIndex,
        activePlayerCardIndex: newState.activePlayerCardIndex,
        turnNumber: newState.turnNumber,
        difficulty,
      });
      
      let playerDamageDealt = 0;
      let aiDamageDealt = 0;
      let playerCardKO = false;
      let aiCardKO = false;
      let typeAdvantage: 'player' | 'ai' | 'neutral' = 'neutral';
      let criticalHit = false;
      let narration = '';
      
      // Process player action
      if (playerAction.type === 'attack' && playerAction.moveId) {
        const move = playerCard.moves.find(m => m.id === playerAction.moveId) || playerCard.moves[0];
        const result = calculateDamage(playerCard, aiCard, move);
        
        playerDamageDealt = result.damage;
        criticalHit = result.isCritical;
        
        if (result.typeMultiplier > 1) typeAdvantage = 'player';
        else if (result.typeMultiplier < 1) typeAdvantage = 'ai';
        
        aiCard.currentHP = Math.max(0, aiCard.currentHP - result.damage);
        narration = generateNarration(playerCard.creatureName, aiCard.creatureName, move, result);
        
        if (aiCard.currentHP <= 0) {
          aiCard.isKnockedOut = true;
          aiCardKO = true;
        }
      } else if (playerAction.type === 'switch' && playerAction.switchToCardIndex !== undefined) {
        // Handle switch
        newState.playerCards[newState.activePlayerCardIndex] = { ...playerCard, isActive: false };
        newState.activePlayerCardIndex = playerAction.switchToCardIndex;
        playerCard = { ...newState.playerCards[playerAction.switchToCardIndex], isActive: true };
        narration = `${playerCard.creatureName} enters the battle!`;
      }
      
      // Process AI action (if AI card not KO'd)
      if (!aiCard.isKnockedOut) {
        if (aiAction.type === 'attack' && aiAction.moveId) {
          const aiMove = aiCard.moves.find(m => m.id === aiAction.moveId) || aiCard.moves[0];
          const aiResult = calculateDamage(aiCard, playerCard, aiMove);
          
          aiDamageDealt = aiResult.damage;
          playerCard.currentHP = Math.max(0, playerCard.currentHP - aiResult.damage);
          
          narration += ` ${generateNarration(aiCard.creatureName, playerCard.creatureName, aiMove, aiResult)}`;
          
          if (playerCard.currentHP <= 0) {
            playerCard.isKnockedOut = true;
            playerCardKO = true;
          }
        } else if (aiAction.type === 'switch' && aiAction.switchToCardIndex !== undefined) {
          newState.aiCards[newState.activeAICardIndex] = { ...aiCard, isActive: false };
          newState.activeAICardIndex = aiAction.switchToCardIndex;
          aiCard = { ...newState.aiCards[aiAction.switchToCardIndex], isActive: true };
          narration += ` ${aiCard.creatureName} enters the battle!`;
        }
      }
      
      // Update cards in state
      newState.playerCards = [...newState.playerCards];
      newState.playerCards[newState.activePlayerCardIndex] = playerCard;
      newState.aiCards = [...newState.aiCards];
      newState.aiCards[newState.activeAICardIndex] = aiCard;
      
      // Record turn
      const turnResult: TurnResult = {
        turnNumber: newState.turnNumber,
        playerAction,
        aiAction,
        playerDamageDealt,
        aiDamageDealt,
        playerCardKO,
        aiCardKO,
        typeAdvantage,
        criticalHit,
        statusApplied: null,
        narration,
      };
      
      newState.turnHistory = [...newState.turnHistory, turnResult];
      newState.totalPlayerDamage += playerDamageDealt;
      newState.totalAIDamage += aiDamageDealt;
      newState.turnNumber += 1;
      
      setLastTurnResult(turnResult);
      
      // Check for battle end
      const result = checkBattleEnd(newState);
      if (result) {
        newState.phase = result === 'win' ? 'victory' : 'defeat';
        const battleRewards = calculateRewards(result === 'win', newState);
        setRewards(battleRewards);
        onBattleEnd?.(result, battleRewards);
      }
      
      return newState;
    });
    
    setIsProcessingTurn(false);
  }, [difficulty, checkBattleEnd, calculateRewards, onBattleEnd]);
  
  const executeAction = useCallback((action: BattleAction) => {
    if (isProcessingTurn || battleState.phase !== 'battle') return;
    processTurn(action);
  }, [isProcessingTurn, battleState.phase, processTurn]);
  
  const switchCard = useCallback((cardIndex: number) => {
    executeAction({ type: 'switch', switchToCardIndex: cardIndex });
  }, [executeAction]);
  
  const forfeit = useCallback(() => {
    setBattleState(prev => ({
      ...prev,
      phase: 'defeat',
    }));
    const battleRewards = calculateRewards(false, battleState);
    setRewards(battleRewards);
    onBattleEnd?.('lose', battleRewards);
  }, [battleState, calculateRewards, onBattleEnd]);
  
  return {
    battleState,
    activePlayerCard,
    activeAICard,
    executeAction,
    switchCard,
    forfeit,
    isProcessingTurn,
    lastTurnResult,
    canSwitch,
    rewards,
  };
}
