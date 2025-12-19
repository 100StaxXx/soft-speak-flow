import { useState, useCallback, useMemo, useRef } from 'react';
import { 
  BattleState, 
  DamageEvent, 
  TIER_BATTLE_CONFIG,
  calculateResultFromHP 
} from '@/types/battleSystem';
import { AdversaryTier } from '@/types/astralEncounters';

interface UseBattleStateOptions {
  tier: AdversaryTier;
  onPlayerDefeated?: () => void;
  onAdversaryDefeated?: () => void;
  onDamageDealt?: (event: DamageEvent) => void;
}

interface UseBattleStateReturn {
  battleState: BattleState;
  dealDamage: (event: DamageEvent) => void;
  resetBattle: () => void;
  getResult: () => 'perfect' | 'good' | 'fail';
  tierAttackDamage: number;
  damageEvents: DamageEvent[];
}

export function useBattleState({
  tier,
  onPlayerDefeated,
  onAdversaryDefeated,
  onDamageDealt,
}: UseBattleStateOptions): UseBattleStateReturn {
  const config = TIER_BATTLE_CONFIG[tier];
  const callbacksRef = useRef({ onPlayerDefeated, onAdversaryDefeated, onDamageDealt });
  callbacksRef.current = { onPlayerDefeated, onAdversaryDefeated, onDamageDealt };
  
  const [playerHP, setPlayerHP] = useState(config.playerHP);
  const [adversaryHP, setAdversaryHP] = useState(config.adversaryHP);
  const [damageEvents, setDamageEvents] = useState<DamageEvent[]>([]);
  
  const isPlayerDefeated = playerHP <= 0;
  const isAdversaryDefeated = adversaryHP <= 0;
  
  const battleState: BattleState = useMemo(() => ({
    playerHP: Math.max(0, playerHP),
    playerMaxHP: config.playerHP,
    adversaryHP: Math.max(0, adversaryHP),
    adversaryMaxHP: config.adversaryHP,
    isPlayerDefeated,
    isAdversaryDefeated,
    playerHPPercent: Math.max(0, (playerHP / config.playerHP) * 100),
    adversaryHPPercent: Math.max(0, (adversaryHP / config.adversaryHP) * 100),
  }), [playerHP, adversaryHP, config, isPlayerDefeated, isAdversaryDefeated]);
  
  const dealDamage = useCallback((event: DamageEvent) => {
    // Don't process damage if battle is already over
    if (isPlayerDefeated || isAdversaryDefeated) return;
    
    setDamageEvents(prev => [...prev, event]);
    callbacksRef.current.onDamageDealt?.(event);
    
    if (event.target === 'player') {
      setPlayerHP(prev => {
        const newHP = prev - event.amount;
        if (newHP <= 0) {
          // Use setTimeout to avoid state update during render
          setTimeout(() => callbacksRef.current.onPlayerDefeated?.(), 0);
        }
        return Math.max(0, newHP);
      });
    } else {
      setAdversaryHP(prev => {
        const newHP = prev - event.amount;
        if (newHP <= 0) {
          setTimeout(() => callbacksRef.current.onAdversaryDefeated?.(), 0);
        }
        return Math.max(0, newHP);
      });
    }
  }, [isPlayerDefeated, isAdversaryDefeated]);
  
  const resetBattle = useCallback(() => {
    setPlayerHP(config.playerHP);
    setAdversaryHP(config.adversaryHP);
    setDamageEvents([]);
  }, [config]);
  
  const getResult = useCallback(() => {
    return calculateResultFromHP(playerHP, config.playerHP, isPlayerDefeated);
  }, [playerHP, config.playerHP, isPlayerDefeated]);
  
  return {
    battleState,
    dealDamage,
    resetBattle,
    getResult,
    tierAttackDamage: config.attackDamage,
    damageEvents,
  };
}
