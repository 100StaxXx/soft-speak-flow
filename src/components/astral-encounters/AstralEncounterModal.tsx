import { useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Adversary, AstralEncounter, MiniGameResult, MiniGameType } from '@/types/astralEncounters';
import { AdversaryReveal } from './AdversaryReveal';
import { EnergyBeamGame } from './EnergyBeamGame';
import { TapSequenceGame } from './TapSequenceGame';
import { BreathSyncGame } from './BreathSyncGame';
import { QuickSwipeGame } from './QuickSwipeGame';
import { EncounterResultScreen } from './EncounterResult';
import { useCompanion } from '@/hooks/useCompanion';
import { calculateXPReward, getResultFromAccuracy } from '@/utils/adversaryGenerator';
import { AdversaryTier } from '@/types/astralEncounters';

interface AstralEncounterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  encounter: AstralEncounter | null;
  adversary: Adversary | null;
  onComplete: (params: { encounterId: string; accuracy: number; phasesCompleted: number }) => void;
}

type Phase = 'reveal' | 'battle' | 'result';

export const AstralEncounterModal = ({
  open,
  onOpenChange,
  encounter,
  adversary,
  onComplete,
}: AstralEncounterModalProps) => {
  const [phase, setPhase] = useState<Phase>('reveal');
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseResults, setPhaseResults] = useState<MiniGameResult[]>([]);
  const [finalResult, setFinalResult] = useState<{
    result: 'perfect' | 'good' | 'partial' | 'fail';
    accuracy: number;
    xpEarned: number;
  } | null>(null);
  
  const { companion } = useCompanion();

  const companionStats = {
    mind: companion?.mind || 50,
    body: companion?.body || 50,
    soul: companion?.soul || 50,
  };

  const handleBeginBattle = useCallback(() => {
    setPhase('battle');
    setCurrentPhaseIndex(0);
    setPhaseResults([]);
  }, []);

  const handleMiniGameComplete = useCallback((result: MiniGameResult) => {
    if (!adversary || !encounter) return;

    const newResults = [...phaseResults, result];
    setPhaseResults(newResults);

    // Check if more phases remain
    if (currentPhaseIndex < adversary.phases - 1) {
      // Move to next phase
      setCurrentPhaseIndex(prev => prev + 1);
    } else {
      // Calculate final result
      const totalAccuracy = Math.round(
        newResults.reduce((sum, r) => sum + r.accuracy, 0) / newResults.length
      );
      const resultType = getResultFromAccuracy(totalAccuracy);
      const xpEarned = calculateXPReward(adversary.tier as AdversaryTier, totalAccuracy);

      setFinalResult({
        result: resultType,
        accuracy: totalAccuracy,
        xpEarned,
      });

      // Complete the encounter
      onComplete({
        encounterId: encounter.id,
        accuracy: totalAccuracy,
        phasesCompleted: adversary.phases,
      });

      setPhase('result');
    }
  }, [adversary, encounter, currentPhaseIndex, phaseResults, onComplete]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset state after close
    setTimeout(() => {
      setPhase('reveal');
      setCurrentPhaseIndex(0);
      setPhaseResults([]);
      setFinalResult(null);
    }, 300);
  }, [onOpenChange]);

  const renderMiniGame = useCallback(() => {
    if (!adversary) return null;

    // For multi-phase battles, use theme-based mini-game rotation
    // Match mini-game to adversary stat type for thematic cohesion
    const themeGameMap: Record<string, MiniGameType[]> = {
      mind: ['tap_sequence', 'breath_sync'],
      body: ['energy_beam', 'quick_swipe'],
      soul: ['breath_sync', 'tap_sequence'],
    };
    
    const themeGames = themeGameMap[adversary.statType] || ['energy_beam', 'tap_sequence'];
    const gameType = adversary.phases === 1 
      ? adversary.miniGameType 
      : themeGames[currentPhaseIndex % themeGames.length];

    const difficulty = adversary.tier === 'legendary' || adversary.tier === 'epic' 
      ? 'hard' 
      : adversary.tier === 'rare' 
        ? 'medium' 
        : 'easy';

    const props = {
      companionStats,
      onComplete: handleMiniGameComplete,
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
    };

    switch (gameType) {
      case 'energy_beam':
        return <EnergyBeamGame {...props} />;
      case 'tap_sequence':
        return <TapSequenceGame {...props} />;
      case 'breath_sync':
        return <BreathSyncGame {...props} />;
      case 'quick_swipe':
        return <QuickSwipeGame {...props} />;
      default:
        return <EnergyBeamGame {...props} />;
    }
  }, [adversary, currentPhaseIndex, companionStats, handleMiniGameComplete]);

  if (!encounter || !adversary) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background border-border">
        <div className="relative min-h-[500px]">
          {/* Cosmic background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
          
          {/* Content */}
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {phase === 'reveal' && (
                <motion.div
                  key="reveal"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <AdversaryReveal 
                    adversary={adversary} 
                    onBeginBattle={handleBeginBattle} 
                  />
                </motion.div>
              )}

              {phase === 'battle' && (
                <motion.div
                  key={`battle-${currentPhaseIndex}`}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                >
                  {/* Phase indicator for multi-phase */}
                  {adversary.phases > 1 && (
                    <div className="flex justify-center gap-2 pt-4">
                      {Array.from({ length: adversary.phases }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-3 h-3 rounded-full ${
                            i < currentPhaseIndex 
                              ? 'bg-green-500' 
                              : i === currentPhaseIndex
                                ? 'bg-primary animate-pulse'
                                : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                  {renderMiniGame()}
                </motion.div>
              )}

              {phase === 'result' && finalResult && (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <EncounterResultScreen
                    adversary={adversary}
                    result={finalResult.result}
                    accuracy={finalResult.accuracy}
                    xpEarned={finalResult.xpEarned}
                    onClose={handleClose}
                    retryAvailableAt={
                      finalResult.result === 'fail' 
                        ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
                        : undefined
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
