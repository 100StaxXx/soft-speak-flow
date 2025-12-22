// Hook to fetch battle moves from database

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Move, BattleElement, MoveType, StatusEffect } from '@/types/cardBattle';

interface DBMove {
  id: string;
  name: string;
  description: string | null;
  element: string;
  base_power: number;
  accuracy: number;
  move_type: string;
  status_effect: string | null;
  status_chance: number | null;
  energy_cost: number;
  cooldown_turns: number | null;
}

function transformDBMove(dbMove: DBMove): Move {
  return {
    id: dbMove.id,
    name: dbMove.name,
    description: dbMove.description,
    element: dbMove.element as BattleElement,
    basePower: dbMove.base_power,
    accuracy: dbMove.accuracy,
    moveType: dbMove.move_type as MoveType,
    statusEffect: dbMove.status_effect as StatusEffect | null,
    statusChance: dbMove.status_chance || 0,
    energyCost: dbMove.energy_cost,
    cooldownTurns: dbMove.cooldown_turns || 0,
  };
}

export function useBattleMoves() {
  return useQuery({
    queryKey: ['battle-moves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('card_moves')
        .select('*')
        .order('element', { ascending: true });
      
      if (error) throw error;
      
      return (data as DBMove[]).map(transformDBMove);
    },
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}

export function useMovesByElement(element: BattleElement) {
  const { data: allMoves, ...rest } = useBattleMoves();
  
  return {
    ...rest,
    data: allMoves?.filter(move => move.element === element),
  };
}

// Get a default attack move for a given element
export function getDefaultMoveForElement(moves: Move[], element: BattleElement): Move {
  const elementMoves = moves.filter(m => m.element === element && m.moveType === 'attack');
  if (elementMoves.length > 0) {
    return elementMoves[0];
  }
  
  // Fallback: any attack move
  const anyAttack = moves.find(m => m.moveType === 'attack');
  if (anyAttack) {
    return anyAttack;
  }
  
  // Ultimate fallback: create a basic move
  return {
    id: `default-${element}`,
    name: 'Basic Attack',
    description: 'A basic attack',
    element,
    basePower: 20,
    accuracy: 100,
    moveType: 'attack',
    statusEffect: null,
    statusChance: 0,
    energyCost: 1,
    cooldownTurns: 0,
  };
}
