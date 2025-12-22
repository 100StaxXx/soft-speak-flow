// Main Battle Arena Component

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCardBattle } from '@/hooks/useCardBattle';
import { BattleCard, Move, AIDifficulty, BattleRewards } from '@/types/cardBattle';
import { BattleCardComponent } from './BattleCard';
import { BattleHUD } from './BattleHUD';
import { MoveSelector, CardSwitchModal } from './MoveSelector';
import { BattleResults } from './BattleResults';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface BattleArenaProps {
  playerCards: BattleCard[];
  availableMoves: Move[];
  difficulty: AIDifficulty;
  onBattleEnd: (result: 'win' | 'lose', rewards: BattleRewards) => void;
  onExit: () => void;
}

export function BattleArena({
  playerCards,
  availableMoves,
  difficulty,
  onBattleEnd,
  onExit,
}: BattleArenaProps) {
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [showForfeitDialog, setShowForfeitDialog] = useState(false);
  const [battleEnded, setBattleEnded] = useState(false);
  const [finalResult, setFinalResult] = useState<'win' | 'lose'>('lose');
  
  const handleBattleEnd = useCallback((result: 'win' | 'lose', rewards: BattleRewards) => {
    setFinalResult(result);
    setBattleEnded(true);
    onBattleEnd(result, rewards);
  }, [onBattleEnd]);
  
  const {
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
  } = useCardBattle({
    playerCards,
    difficulty,
    availableMoves,
    onBattleEnd: handleBattleEnd,
  });
  
  const handleSelectMove = (moveId: string) => {
    executeAction({ type: 'attack', moveId });
  };
  
  const handleSwitchCard = (index: number) => {
    setShowSwitchModal(false);
    switchCard(index);
  };
  
  const handleForfeit = () => {
    setShowForfeitDialog(false);
    forfeit();
  };
  
  const switchableCards = battleState.playerCards
    .map((card, index) => ({ card, index }))
    .filter(({ card, index }) => !card.isKnockedOut && index !== battleState.activePlayerCardIndex);
  
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-background via-background to-primary/5 overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
      </div>
      
      {/* Battle Content */}
      <div className="relative z-10 flex flex-col h-screen p-4">
        {/* Forfeit Button */}
        <div className="absolute top-4 right-4 z-20">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForfeitDialog(true)}
            className="text-muted-foreground"
          >
            <Flag className="w-4 h-4 mr-1" />
            Forfeit
          </Button>
        </div>
        
        {/* AI Side */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* AI Bench */}
          <div className="flex gap-2 mb-4">
            {battleState.aiCards.map((card, index) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <BattleCardComponent
                  card={card}
                  isActive={index === battleState.activeAICardIndex}
                  isEnemy={true}
                  size="sm"
                />
              </motion.div>
            ))}
          </div>
          
          {/* Active AI Card */}
          <AnimatePresence mode="wait">
            {activeAICard && (
              <motion.div
                key={activeAICard.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0, x: 50 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                <BattleCardComponent
                  card={activeAICard}
                  isActive={true}
                  isEnemy={true}
                  size="lg"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        {/* Battle HUD */}
        <div className="py-4">
          <BattleHUD
            playerCard={activePlayerCard}
            aiCard={activeAICard}
            turnNumber={battleState.turnNumber}
            lastTurnResult={lastTurnResult}
            isProcessing={isProcessingTurn}
          />
        </div>
        
        {/* Player Side */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Active Player Card */}
          <AnimatePresence mode="wait">
            {activePlayerCard && (
              <motion.div
                key={activePlayerCard.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0, x: -50 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                <BattleCardComponent
                  card={activePlayerCard}
                  isActive={true}
                  size="lg"
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Player Bench */}
          <div className="flex gap-2 mt-4">
            {battleState.playerCards.map((card, index) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <BattleCardComponent
                  card={card}
                  isActive={index === battleState.activePlayerCardIndex}
                  size="sm"
                  onClick={() => {
                    if (!card.isKnockedOut && index !== battleState.activePlayerCardIndex) {
                      handleSwitchCard(index);
                    }
                  }}
                  disabled={card.isKnockedOut || index === battleState.activePlayerCardIndex || isProcessingTurn}
                />
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Move Selector */}
        <div className="py-4">
          {activePlayerCard && battleState.phase === 'battle' && (
            <MoveSelector
              moves={activePlayerCard.moves}
              onSelectMove={handleSelectMove}
              onSwitchCard={() => setShowSwitchModal(true)}
              canSwitch={canSwitch}
              disabled={isProcessingTurn}
            />
          )}
        </div>
      </div>
      
      {/* Switch Modal */}
      <AnimatePresence>
        {showSwitchModal && (
          <CardSwitchModal
            cards={switchableCards}
            onSelect={handleSwitchCard}
            onCancel={() => setShowSwitchModal(false)}
          />
        )}
      </AnimatePresence>
      
      {/* Forfeit Confirmation */}
      <AlertDialog open={showForfeitDialog} onOpenChange={setShowForfeitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Forfeit Battle?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to forfeit? You'll receive reduced XP for losing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Fighting</AlertDialogCancel>
            <AlertDialogAction onClick={handleForfeit}>
              Forfeit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Battle Results */}
      <AnimatePresence>
        {battleEnded && rewards && (
          <BattleResults
            result={finalResult}
            rewards={rewards}
            turnsPlayed={battleState.turnNumber}
            onContinue={onExit}
            onRematch={() => {
              setBattleEnded(false);
              window.location.reload(); // Simple rematch for now
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
