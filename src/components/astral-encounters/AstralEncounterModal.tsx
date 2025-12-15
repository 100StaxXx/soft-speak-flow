import { useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Adversary, AstralEncounter, MiniGameResult, MiniGameType } from '@/types/astralEncounters';
import { AdversaryReveal } from './AdversaryReveal';
import { EnergyBeamGame } from './EnergyBeamGame';
import { TapSequenceGame } from './TapSequenceGame';
import { AstralFrequencyGame } from './AstralFrequencyGame';
import { EclipseTimingGame } from './EclipseTimingGame';
import { StarfallDodgeGame } from './StarfallDodgeGame';
import { RuneResonanceGame } from './RuneResonanceGame';
import { AstralSerpentGame } from './AstralSerpentGame';
import { OrbMatchGame } from './OrbMatchGame';
import { EncounterResultScreen } from './EncounterResult';
import { GameInstructionsOverlay } from './GameInstructionsOverlay';
import { BattleSceneHeader } from './BattleSceneHeader';
import { useCompanion } from '@/hooks/useCompanion';
import { calculateXPReward, getResultFromAccuracy } from '@/utils/adversaryGenerator';
import { AdversaryTier } from '@/types/astralEncounters';

interface AstralEncounterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  encounter: AstralEncounter | null;
  adversary: Adversary | null;
  questInterval?: number;
  onComplete: (params: { encounterId: string; accuracy: number; phasesCompleted: number }) => void;
}

type Phase = 'reveal' | 'instructions' | 'battle' | 'result';

export const AstralEncounterModal = ({
  open,
  onOpenChange,
  encounter,
  adversary,
  questInterval = 3,
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

  // Get current mini-game type for instructions
  const getCurrentGameType = useCallback((): MiniGameType => {
    if (!adversary) return 'energy_beam';
    
    const themeGameMap: Record<string, MiniGameType[]> = {
      mind: ['tap_sequence', 'starfall_dodge'],
      body: ['energy_beam', 'eclipse_timing'],
      soul: ['astral_frequency', 'rune_resonance'],
    };
    
    const themeGames = themeGameMap[adversary.statType] || ['energy_beam', 'tap_sequence'];
    return adversary.phases === 1 
      ? adversary.miniGameType 
      : themeGames[currentPhaseIndex % themeGames.length];
  }, [adversary, currentPhaseIndex]);

  const handleBeginBattle = useCallback(() => {
    setPhase('instructions');
    setCurrentPhaseIndex(0);
    setPhaseResults([]);
  }, []);

  const handleInstructionsReady = useCallback(() => {
    setPhase('battle');
  }, []);

  const handleMiniGameComplete = useCallback((result: MiniGameResult) => {
    if (!adversary || !encounter) return;

    const newResults = [...phaseResults, result];
    setPhaseResults(newResults);

    if (currentPhaseIndex < adversary.phases - 1) {
      setCurrentPhaseIndex(prev => prev + 1);
      setPhase('instructions');
    } else {
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
    setTimeout(() => {
      setPhase('reveal');
      setCurrentPhaseIndex(0);
      setPhaseResults([]);
      setFinalResult(null);
    }, 300);
  }, [onOpenChange]);

  const renderMiniGame = useCallback(() => {
    if (!adversary) return null;

    const gameType = getCurrentGameType();

    const difficulty = adversary.tier === 'legendary' || adversary.tier === 'epic' 
      ? 'hard' 
      : adversary.tier === 'rare' 
        ? 'medium' 
        : 'easy';

    const intervalScale = (questInterval - 3) * 0.15;

    const props = {
      companionStats,
      onComplete: handleMiniGameComplete,
      difficulty: difficulty as 'easy' | 'medium' | 'hard',
      questIntervalScale: intervalScale,
    };

    switch (gameType) {
      case 'energy_beam':
        return <EnergyBeamGame {...props} />;
      case 'tap_sequence':
        return <TapSequenceGame {...props} />;
      case 'astral_frequency':
        return <AstralFrequencyGame {...props} />;
      case 'eclipse_timing':
        return <EclipseTimingGame {...props} />;
      case 'starfall_dodge':
        return <StarfallDodgeGame {...props} />;
      case 'rune_resonance':
        return <RuneResonanceGame {...props} />;
      case 'astral_serpent':
        return <AstralSerpentGame {...props} />;
      case 'orb_match':
        return <OrbMatchGame {...props} />;
      default:
        return <EnergyBeamGame {...props} />;
    }
  }, [adversary, getCurrentGameType, companionStats, handleMiniGameComplete, questInterval]);

  if (!encounter || !adversary) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-background border-border">
        <div className="relative min-h-[500px]">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
          
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

              {phase === 'instructions' && (
                <motion.div
                  key={`instructions-${currentPhaseIndex}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <GameInstructionsOverlay 
                    gameType={getCurrentGameType()}
                    onReady={handleInstructionsReady}
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
                  <BattleSceneHeader
                    companionImageUrl={companion?.current_image_url || undefined}
                    companionName={companion?.spirit_animal || "Companion"}
                    adversary={adversary}
                  />

                  {adversary.phases > 1 && (
                    <div className="flex justify-center gap-2 py-2">
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
