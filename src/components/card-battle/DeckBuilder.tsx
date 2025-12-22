// Deck Builder Component for Battle System

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Swords, Sparkles, Info, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { BattleCard, AIDifficulty } from '@/types/cardBattle';
import { transformToBattleCard, validateDeck, calculateDeckPower, suggestDeckComposition } from '@/lib/cardBattleUtils';
import { useBattleMoves } from '@/hooks/useBattleMoves';
import { BattleCardComponent } from './BattleCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface DeckBuilderProps {
  onStartBattle: (deck: BattleCard[], difficulty: AIDifficulty) => void;
  onCancel: () => void;
}

const DIFFICULTY_CONFIG: Record<AIDifficulty, { label: string; description: string; color: string }> = {
  easy: { label: 'Easy', description: 'Perfect for learning the ropes', color: 'text-green-500' },
  medium: { label: 'Medium', description: 'A balanced challenge', color: 'text-yellow-500' },
  hard: { label: 'Hard', description: 'For experienced battlers', color: 'text-orange-500' },
  legendary: { label: 'Legendary', description: 'Only the strongest survive', color: 'text-red-500' },
};

export function DeckBuilder({ onStartBattle, onCancel }: DeckBuilderProps) {
  const { user } = useAuth();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  
  // Fetch user's evolution cards
  const { data: dbCards, isLoading: isLoadingCards } = useQuery({
    queryKey: ['evolution-cards', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('companion_evolution_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('evolution_stage', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
  
  // Fetch available moves
  const { data: moves, isLoading: isLoadingMoves } = useBattleMoves();
  
  // Transform to battle cards
  const availableCards = useMemo(() => {
    if (!dbCards || !moves) return [];
    return dbCards.map(card => transformToBattleCard(card, moves));
  }, [dbCards, moves]);
  
  // Selected cards
  const selectedCards = useMemo(() => {
    return selectedCardIds
      .map(id => availableCards.find(c => c.id === id))
      .filter(Boolean) as BattleCard[];
  }, [selectedCardIds, availableCards]);
  
  // Deck validation
  const deckValidation = useMemo(() => {
    if (selectedCards.length === 0) {
      return { valid: false, error: 'Select 3 cards for your deck' };
    }
    return validateDeck(selectedCards);
  }, [selectedCards]);
  
  // Deck power rating
  const deckPower = useMemo(() => calculateDeckPower(selectedCards), [selectedCards]);
  
  const handleCardClick = (cardId: string) => {
    setSelectedCardIds(prev => {
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, cardId];
    });
  };
  
  const handleAutoSelect = () => {
    const suggested = suggestDeckComposition(availableCards);
    setSelectedCardIds(suggested.map(c => c.id));
  };
  
  const handleStartBattle = () => {
    if (deckValidation.valid) {
      onStartBattle(selectedCards, difficulty);
    }
  };
  
  const isLoading = isLoadingCards || isLoadingMoves;
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (availableCards.length < 3) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <Swords className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Not Enough Cards</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You need at least 3 evolution cards to battle. Keep growing your companion to earn more cards!
          </p>
          <Button variant="outline" onClick={onCancel}>
            Go Back
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold flex items-center justify-center gap-2">
          <Swords className="w-6 h-6 text-primary" />
          Build Your Deck
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select 3 cards for battle
        </p>
      </div>
      
      {/* Selected Deck */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Your Deck</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Power: <span className="font-bold text-primary">{deckPower}</span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAutoSelect}
                className="text-xs"
              >
                <Sparkles className="w-3 h-3 mr-1" />
                Auto-Select
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 justify-center min-h-[180px] items-center">
            {[0, 1, 2].map(slot => {
              const card = selectedCards[slot];
              return (
                <motion.div
                  key={slot}
                  className={cn(
                    'w-32 h-44 rounded-lg border-2 border-dashed flex items-center justify-center',
                    card ? 'border-primary' : 'border-muted'
                  )}
                  layout
                >
                  {card ? (
                    <BattleCardComponent
                      card={card}
                      size="md"
                      onClick={() => handleCardClick(card.id)}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Slot {slot + 1}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
          
          {!deckValidation.valid && (
            <p className="text-xs text-amber-500 text-center mt-2">
              {deckValidation.error}
            </p>
          )}
        </CardContent>
      </Card>
      
      {/* Available Cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Available Cards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-[300px] overflow-y-auto p-1">
            <AnimatePresence>
              {availableCards.map(card => {
                const isSelected = selectedCardIds.includes(card.id);
                return (
                  <motion.div
                    key={card.id}
                    className="relative"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <BattleCardComponent
                      card={card}
                      size="sm"
                      isActive={isSelected}
                      onClick={() => handleCardClick(card.id)}
                      disabled={!isSelected && selectedCardIds.length >= 3}
                    />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
      
      {/* Difficulty Selection */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Difficulty</label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as AIDifficulty)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DIFFICULTY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className={config.color}>{config.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Info className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-sm">{DIFFICULTY_CONFIG[difficulty].description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Higher difficulty = more XP rewards!
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>
      
      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button
          onClick={handleStartBattle}
          disabled={!deckValidation.valid}
          className="flex-1"
        >
          <Swords className="w-4 h-4 mr-2" />
          Start Battle
        </Button>
      </div>
    </div>
  );
}
