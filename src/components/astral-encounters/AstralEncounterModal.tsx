import { useState, useCallback, useEffect, lazy, Suspense, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Adversary, AstralEncounter, MiniGameResult, MiniGameType } from '@/types/astralEncounters';
import { DamageEvent, calculateResultFromHP, TIER_BATTLE_DURATION } from '@/types/battleSystem';
import { BattleVSScreen } from './BattleVSScreen';
import { EncounterResultScreen } from './EncounterResult';
import { GameInstructionsOverlay } from './GameInstructionsOverlay';
import { PracticeRoundWrapper } from './PracticeRoundWrapper';
import { BattleSceneHeader } from './BattleSceneHeader';
import { BossBattleIntro } from '@/components/narrative/BossBattleIntro';
import { BattleOverlay, DamageNumberContainer } from './battle';
import { useCompanion } from '@/hooks/useCompanion';
import { useAdversaryImage } from '@/hooks/useAdversaryImage';
import { useBattleState } from '@/hooks/useBattleState';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateXPReward } from '@/utils/adversaryGenerator';
import { AdversaryTier } from '@/types/astralEncounters';
import { MiniGameSkeleton } from '@/components/skeletons';
import type { BossBattleContext } from '@/types/narrativeTypes';

// Lazy load mini-games for bundle optimization
const EnergyBeamGame = lazy(() => import('./EnergyBeamGame').then(m => ({ default: m.EnergyBeamGame })));
const TapSequenceGame = lazy(() => import('./TapSequenceGame').then(m => ({ default: m.TapSequenceGame })));
const AstralFrequencyGame = lazy(() => import('./AstralFrequencyGame').then(m => ({ default: m.AstralFrequencyGame })));
const EclipseTimingGame = lazy(() => import('./EclipseTimingGame').then(m => ({ default: m.EclipseTimingGame })));
const StarfallDodgeGame = lazy(() => import('./StarfallDodgeGame').then(m => ({ default: m.StarfallDodgeGame })));

const SoulSerpentGame = lazy(() => import('./SoulSerpentGame').then(m => ({ default: m.SoulSerpentGame })));
const OrbMatchGame = lazy(() => import('./OrbMatchGame').then(m => ({ default: m.OrbMatchGame })));
const GalacticMatchGame = lazy(() => import('./GalacticMatchGame').then(m => ({ default: m.GalacticMatchGame })));

// Track which games user has practiced (persists in session)
const practicedGames = new Set<MiniGameType>();

interface AstralEncounterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  encounter: AstralEncounter | null;
  adversary: Adversary | null;
  questInterval?: number;
  onComplete: (params: { encounterId: string; accuracy: number; phasesCompleted: number }) => Promise<boolean>;
  onPass?: () => void;
  // Boss battle props
  isBossBattle?: boolean;
  bossBattleContext?: BossBattleContext;
  onBossBattleCancel?: () => void;
}

type Phase = 'boss_intro' | 'reveal' | 'instructions' | 'practice' | 'battle' | 'result';

export const AstralEncounterModal = ({
  open,
  onOpenChange,
  encounter,
  adversary,
  questInterval = 3,
  onComplete,
  onPass,
  isBossBattle = false,
  bossBattleContext,
  onBossBattleCancel,
}: AstralEncounterModalProps) => {
  const [phase, setPhase] = useState<Phase>('reveal');
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [phaseResults, setPhaseResults] = useState<MiniGameResult[]>([]);
  const [usedTiltControls, setUsedTiltControls] = useState(false);
  const [finalResult, setFinalResult] = useState<{
    result: 'perfect' | 'good' | 'fail';
    accuracy: number;
    xpEarned: number;
    tiltBonus?: boolean;
  } | null>(null);
  const [showScreenShake, setShowScreenShake] = useState(false);
  const [battleTimeLeft, setBattleTimeLeft] = useState(0);
  const [battleTimeTotal, setBattleTimeTotal] = useState(0);
  const { companion, refetch: refetchCompanion } = useCompanion();
  const battleEndedRef = useRef(false);

  // Force fresh companion data when modal opens to avoid stale evolution state
  useEffect(() => {
    if (open) {
      refetchCompanion();
    }
  }, [open, refetchCompanion]);

  // Query current evolution card for creature name - include current_stage in key for proper cache invalidation
  const { data: currentCard } = useQuery({
    queryKey: ['current-evolution-card', companion?.id, companion?.current_stage],
    queryFn: async () => {
      if (!companion?.id) return null;
      const { data } = await supabase
        .from('companion_evolution_cards')
        .select('creature_name')
        .eq('companion_id', companion.id)
        .eq('evolution_stage', companion.current_stage || 0)
        .maybeSingle();
      return data;
    },
    enabled: !!companion?.id && open,
  });

  // Initialize battle state
  const {
    battleState,
    dealDamage,
    resetBattle,
    getResult,
    tierAttackDamage,
    damageEvents,
  } = useBattleState({
    tier: (adversary?.tier as AdversaryTier) || 'common',
    onPlayerDefeated: () => {
      if (battleEndedRef.current) return;
      battleEndedRef.current = true;
      handleBattleEnd('fail');
    },
    onAdversaryDefeated: () => {
      if (battleEndedRef.current) return;
      battleEndedRef.current = true;
      handleBattleEnd('victory');
    },
    onDamageDealt: (event) => {
      if (event.target === 'player') {
        setShowScreenShake(true);
        setTimeout(() => setShowScreenShake(false), 300);
      }
    },
  });

  // Handle battle end (victory or defeat)
  const handleBattleEnd = useCallback(async (outcome: 'victory' | 'fail') => {
    if (!adversary || !encounter) return;
    
    const result = outcome === 'fail' ? 'fail' : getResult();
    const accuracy = outcome === 'fail' ? 0 : Math.round(battleState.playerHPPercent);
    const xpEarned = outcome === 'fail' ? 0 : calculateXPReward(
      adversary.tier as AdversaryTier, 
      accuracy,
      usedTiltControls
    );

    const didPersist = await onComplete({
      encounterId: encounter.id,
      accuracy,
      phasesCompleted: outcome === 'fail' ? currentPhaseIndex : adversary.phases,
    });

    if (!didPersist) {
      onOpenChange(false);
      return;
    }

    setFinalResult({
      result,
      accuracy,
      xpEarned,
      tiltBonus: usedTiltControls,
    });

    setPhase('result');
  }, [adversary, encounter, getResult, battleState.playerHPPercent, onComplete, currentPhaseIndex, usedTiltControls, onOpenChange]);

  // Reset phase when modal opens - set to boss_intro for boss battles
  useEffect(() => {
    if (open) {
      setPhase(isBossBattle ? 'boss_intro' : 'reveal');
      setCurrentPhaseIndex(0);
      setPhaseResults([]);
      setFinalResult(null);
      setUsedTiltControls(false);
      battleEndedRef.current = false;
      resetBattle();
      // Initialize battle timer based on adversary tier
      const tier = (adversary?.tier as AdversaryTier) || 'common';
      const duration = TIER_BATTLE_DURATION[tier];
      setBattleTimeLeft(duration);
      setBattleTimeTotal(duration);
    }
  }, [open, isBossBattle, resetBattle, adversary?.tier]);

  // Battle countdown timer
  useEffect(() => {
    if (phase !== 'battle' || battleEndedRef.current) return;
    
    if (battleTimeLeft <= 0) {
      // Time expired - auto-resolve based on HP comparison
      if (!battleEndedRef.current) {
        battleEndedRef.current = true;
        const adversaryDamagePercent = 100 - battleState.adversaryHPPercent;
        const playerDamagePercent = 100 - battleState.playerHPPercent;
        // Player wins if they dealt more % damage to adversary
        const outcome = adversaryDamagePercent > playerDamagePercent ? 'victory' : 'fail';
        handleBattleEnd(outcome);
      }
      return;
    }
    
    const timer = setInterval(() => {
      setBattleTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [phase, battleTimeLeft, battleState.adversaryHPPercent, battleState.playerHPPercent, handleBattleEnd]);

  // Fetch/generate adversary image
  const { imageUrl: adversaryImageUrl, isLoading: isLoadingImage } = useAdversaryImage({
    theme: adversary?.theme || '',
    tier: adversary?.tier || '',
    name: adversary?.name || '',
    enabled: !!adversary && open,
  });

  // Map 6-stat system to card combat stats for encounters
  const companionStats = {
    mind: Math.floor(((companion?.wisdom ?? 300) + (companion?.creativity ?? 300)) / 12),
    body: Math.floor(((companion?.vitality ?? 300) + (companion?.discipline ?? 300)) / 12),
    soul: Math.floor(((companion?.resolve ?? 300) + (companion?.alignment ?? 300)) / 12),
  };

  // Get current mini-game type for instructions (only active games: galactic_match, orb_match, tap_sequence, energy_beam)
  const getCurrentGameType = useCallback((): MiniGameType => {
    if (!adversary) return 'energy_beam';
    
    const themeGameMap: Record<string, MiniGameType[]> = {
      mind: ['tap_sequence', 'galactic_match', 'orb_match'],
      body: ['energy_beam'],
      soul: ['orb_match', 'galactic_match'], // Fallback to mind games for soul
    };
    
    const themeGames = themeGameMap[adversary.statType] || ['energy_beam', 'tap_sequence'];
    return adversary.phases === 1 
      ? adversary.miniGameType 
      : themeGames[currentPhaseIndex % themeGames.length];
  }, [adversary, currentPhaseIndex]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // State reset now happens in useEffect when open changes
  }, [onOpenChange]);

  const handleBossIntroComplete = useCallback(() => {
    setPhase('reveal');
  }, []);

  const handleBossIntroCancel = useCallback(() => {
    onBossBattleCancel?.();
    handleClose();
  }, [onBossBattleCancel, handleClose]);

  const handleBeginBattle = useCallback(() => {
    setPhase('instructions');
    setCurrentPhaseIndex(0);
    setPhaseResults([]);
    battleEndedRef.current = false;
    resetBattle();
  }, [resetBattle]);

  const handleInstructionsReady = useCallback(() => {
    const currentGameType = getCurrentGameType();
    // Show practice if user hasn't practiced this game type yet in this session
    if (!practicedGames.has(currentGameType)) {
      setPhase('practice');
    } else {
      setPhase('battle');
    }
  }, [getCurrentGameType]);

  const handlePracticeComplete = useCallback(() => {
    const currentGameType = getCurrentGameType();
    practicedGames.add(currentGameType); // Mark as practiced
    setPhase('battle');
  }, [getCurrentGameType]);

  const handleSkipPractice = useCallback(() => {
    const currentGameType = getCurrentGameType();
    practicedGames.add(currentGameType); // Mark as practiced even when skipped
    setPhase('battle');
  }, [getCurrentGameType]);

  // Handle damage events from mini-games
  const handleDamage = useCallback((event: DamageEvent) => {
    if (battleEndedRef.current) return;
    dealDamage(event);
  }, [dealDamage]);

  const handleMiniGameComplete = useCallback((result: MiniGameResult) => {
    if (!adversary || !encounter || battleEndedRef.current) return;

    // Track if tilt controls were used
    if (result.usedTiltControls) {
      setUsedTiltControls(true);
    }

    const newResults = [...phaseResults, result];
    setPhaseResults(newResults);

    // Check if battle already ended via HP
    if (battleState.isPlayerDefeated || battleState.isAdversaryDefeated) {
      return; // Battle end already handled
    }

    // FIXED: Continue battle until HP is depleted - no auto-win on phase complete
    if (currentPhaseIndex < adversary.phases - 1) {
      // More phases available - continue to next phase
      setCurrentPhaseIndex(prev => prev + 1);
      setPhase('instructions');
    } else {
      // All phases exhausted but adversary still alive - loop back to continue battle
      setCurrentPhaseIndex(0);
      setPhase('instructions');
    }
  }, [adversary, encounter, currentPhaseIndex, phaseResults, battleState.isPlayerDefeated, battleState.isAdversaryDefeated]);

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
      onDamage: handleDamage,
      tierAttackDamage,
      compact: true,
    };

    const GameComponent = (() => {
      switch (gameType) {
        case 'energy_beam': return EnergyBeamGame;
        case 'tap_sequence': return TapSequenceGame;
        case 'astral_frequency': return AstralFrequencyGame;
        case 'eclipse_timing': return EclipseTimingGame;
        case 'starfall_dodge': return StarfallDodgeGame;
        case 'soul_serpent': return SoulSerpentGame;
        case 'orb_match': return OrbMatchGame;
        case 'galactic_match': return GalacticMatchGame;
        default: return EnergyBeamGame;
      }
    })();

    return (
      <Suspense fallback={<MiniGameSkeleton />}>
        <GameComponent {...props} />
      </Suspense>
    );
  }, [adversary, getCurrentGameType, companionStats, handleMiniGameComplete, questInterval, handleDamage, tierAttackDamage]);

  if (!encounter || !adversary) return null;

  // Games that need fullscreen rendering outside the Dialog (shelved games removed)
  const FULLSCREEN_GAMES: MiniGameType[] = [];
  const currentGameType = getCurrentGameType();
  const needsFullscreen = (phase === 'battle' || phase === 'practice') && FULLSCREEN_GAMES.includes(currentGameType);

  return (
    <>
      {/* Fullscreen overlay for games that need it (like StarfallDodge) */}
      {open && needsFullscreen && (
        <div className="fixed inset-0 z-[100] bg-background">
          {/* Practice mode in fullscreen */}
          {phase === 'practice' && (
            <PracticeRoundWrapper
              gameType={currentGameType}
              companionStats={companionStats}
              onPracticeComplete={handlePracticeComplete}
              onSkipPractice={handleSkipPractice}
              isFullscreen
            />
          )}
          
          {/* Battle mode in fullscreen */}
          {phase === 'battle' && (
            <>
              {/* Battle HP Overlay */}
              <BattleOverlay
                battleState={battleState}
                adversaryImageUrl={adversaryImageUrl || undefined}
                adversaryName={adversary.name}
                showScreenShake={showScreenShake}
                battleTimeLeft={battleTimeLeft}
                battleTimeTotal={battleTimeTotal}
              />
              
              {/* Floating damage numbers */}
              <DamageNumberContainer damageEvents={damageEvents} className="z-50" />
              
              {/* Phase indicators */}
              {adversary.phases > 1 && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex gap-2">
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
              
              {/* The fullscreen game */}
              {renderMiniGame()}
            </>
          )}
        </div>
      )}

      {/* Regular Dialog for non-fullscreen phases/games */}
      <Dialog open={open && !needsFullscreen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden bg-background border-border">
          <motion.div 
            className="relative min-h-[500px] max-h-[90dvh] overflow-hidden flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 24px)' }}
            animate={showScreenShake ? { x: [0, -4, 4, -2, 2, 0] } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
            
            {/* Floating damage numbers for non-fullscreen games */}
            {phase === 'battle' && !needsFullscreen && (
              <DamageNumberContainer damageEvents={damageEvents} className="z-50" />
            )}
            
            <div className="relative z-10 flex flex-col h-full min-h-[500px]">
              <AnimatePresence mode="wait">
                {/* Boss Battle Intro Phase */}
                {phase === 'boss_intro' && isBossBattle && bossBattleContext && (
                  <motion.div
                    key="boss_intro"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <BossBattleIntro
                      context={bossBattleContext}
                      onBeginBattle={handleBossIntroComplete}
                      onCancel={handleBossIntroCancel}
                    />
                  </motion.div>
                )}

                {phase === 'reveal' && (
                  <motion.div
                    key="reveal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <BattleVSScreen 
                      adversary={adversary}
                      adversaryImageUrl={adversaryImageUrl || undefined}
                      isLoadingImage={isLoadingImage}
                      companionImageUrl={companion?.current_image_url || undefined}
                      companionName={currentCard?.creature_name || companion?.spirit_animal || "Companion"}
                      companionStage={companion?.current_stage || 0}
                      onReady={handleBeginBattle}
                      onPass={onPass}
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

                {phase === 'practice' && (
                  <motion.div
                    key={`practice-${currentPhaseIndex}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <PracticeRoundWrapper
                      gameType={getCurrentGameType()}
                      companionStats={companionStats}
                      onPracticeComplete={handlePracticeComplete}
                      onSkipPractice={handleSkipPractice}
                    />
                  </motion.div>
                )}

                {phase === 'battle' && !needsFullscreen && (
                  <motion.div
                    key={`battle-${currentPhaseIndex}`}
                    initial={{ opacity: 0, x: 50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -50 }}
                    className="flex flex-col flex-1 min-h-0"
                  >
                    {/* Battle HP Overlay */}
                    <BattleOverlay
                      battleState={battleState}
                      adversaryImageUrl={adversaryImageUrl || undefined}
                      adversaryName={adversary.name}
                      battleTimeLeft={battleTimeLeft}
                      battleTimeTotal={battleTimeTotal}
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
                    
                    {/* Game container - flex-1 to fill remaining space */}
                    <div className="flex-1 min-h-0">
                      {renderMiniGame()}
                    </div>
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
                      tiltBonus={finalResult.tiltBonus}
                      companionImageUrl={companion?.current_image_url || undefined}
                      companionName={currentCard?.creature_name || companion?.spirit_animal || 'Your companion'}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
};
