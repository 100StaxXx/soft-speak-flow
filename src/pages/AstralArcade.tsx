import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArcadeGameCard } from '@/components/astral-encounters/ArcadeGameCard';
import { GameInstructionsOverlay } from '@/components/astral-encounters/GameInstructionsOverlay';
import { BattleOverlay, DamageNumberContainer } from '@/components/astral-encounters/battle';
import { BattleVSScreen } from '@/components/astral-encounters/BattleVSScreen';
import { useCompanion } from '@/hooks/useCompanion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useArcadeHighScores } from '@/hooks/useArcadeHighScores';
import { useAchievements } from '@/hooks/useAchievements';
import { useBattleState } from '@/hooks/useBattleState';
import { useAdversaryImage } from '@/hooks/useAdversaryImage';
import { MiniGameType, MiniGameResult, Adversary } from '@/types/astralEncounters';
import { DamageEvent } from '@/types/battleSystem';
import { generateArcadeAdversary } from '@/utils/adversaryGenerator';
import { playEncounterTrigger, playEncounterMusic, stopEncounterMusic, playArcadeHighScore } from '@/utils/soundEffects';
import { pauseAmbientForEvent, resumeAmbientAfterEvent } from '@/utils/ambientMusic';
import { toast } from 'sonner';
import { PracticeRoundWrapper } from '@/components/astral-encounters';
import { MiniGameSkeleton } from '@/components/skeletons';
import {
  ArrowLeft,
  Zap,
  Target,
  Radio,
  Clock,
  Shield,
  Hexagon,
  Gamepad2,
  Grid3X3,
  Trophy,
  Sparkles,
  Swords,
  Heart,
} from 'lucide-react';

// Lazy load mini-games for bundle optimization
const EnergyBeamGame = lazy(() => import('@/components/astral-encounters/EnergyBeamGame').then(m => ({ default: m.EnergyBeamGame })));
const TapSequenceGame = lazy(() => import('@/components/astral-encounters/TapSequenceGame').then(m => ({ default: m.TapSequenceGame })));
const AstralFrequencyGame = lazy(() => import('@/components/astral-encounters/AstralFrequencyGame').then(m => ({ default: m.AstralFrequencyGame })));
const EclipseTimingGame = lazy(() => import('@/components/astral-encounters/EclipseTimingGame').then(m => ({ default: m.EclipseTimingGame })));
const StarfallDodgeGame = lazy(() => import('@/components/astral-encounters/StarfallDodgeGame').then(m => ({ default: m.StarfallDodgeGame })));

const SoulSerpentGame = lazy(() => import('@/components/astral-encounters/SoulSerpentGame').then(m => ({ default: m.SoulSerpentGame })));
const OrbMatchGame = lazy(() => import('@/components/astral-encounters/OrbMatchGame').then(m => ({ default: m.OrbMatchGame })));
const GalacticMatchGame = lazy(() => import('@/components/astral-encounters/GalacticMatchGame').then(m => ({ default: m.GalacticMatchGame })));

// Track which games user has practiced in this arcade session
const arcadePracticedGames = new Set<MiniGameType>();

const GAMES = [
  { type: 'energy_beam' as MiniGameType, label: 'Star Defender', icon: Zap, stat: 'body' as const },
  { type: 'tap_sequence' as MiniGameType, label: 'Tap Sequence', icon: Target, stat: 'mind' as const },
  { type: 'astral_frequency' as MiniGameType, label: 'Cosmiq Dash', icon: Radio, stat: 'soul' as const },
  { type: 'eclipse_timing' as MiniGameType, label: 'Stellar Beats', icon: Clock, stat: 'soul' as const },
  { type: 'starfall_dodge' as MiniGameType, label: 'Starfall Dodge', icon: Shield, stat: 'body' as const },
  { type: 'soul_serpent' as MiniGameType, label: 'Soul Serpent', icon: Gamepad2, stat: 'body' as const },
  { type: 'orb_match' as MiniGameType, label: 'Orb Match', icon: Grid3X3, stat: 'mind' as const },
  { type: 'galactic_match' as MiniGameType, label: 'Galactic Match', icon: Grid3X3, stat: 'mind' as const },
];

type Difficulty = 'easy' | 'medium' | 'hard';
type GamePhase = 'instructions' | 'practice' | 'vs_screen' | 'playing' | 'result';
type ArcadeMode = 'practice' | 'battle';
type BattleResult = 'victory' | 'defeat' | null;

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
} as const;

const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] as const }
  }
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 20 }
  }
} as const;

const gameCardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.9 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 25 }
  }
} as const;

export default function AstralArcade() {
  const navigate = useNavigate();
  const { companion } = useCompanion();
  const { getHighScore, setHighScore, getTotalGamesWithHighScores, getFormattedHighScore } = useArcadeHighScores();
  const { checkArcadeDiscovery } = useAchievements();

  const [activeGame, setActiveGame] = useState<MiniGameType | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('instructions');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [arcadeMode, setArcadeMode] = useState<ArcadeMode>('practice');
  const [adversary, setAdversary] = useState<Adversary | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult>(null);
  const [screenShake, setScreenShake] = useState(false);

  // Get adversary image
  const { imageUrl: adversaryImageUrl, isLoading: isLoadingImage } = useAdversaryImage({
    theme: adversary?.theme || '',
    tier: adversary?.tier || '',
    name: adversary?.name || '',
    enabled: !!adversary && arcadeMode === 'battle',
  });

  // Query current evolution card for creature name
  const { data: currentCard } = useQuery({
    queryKey: ['current-evolution-card', companion?.id],
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
    enabled: !!companion?.id,
  });

  // Battle callbacks - defined outside useBattleState to avoid hook rules violation
  const handlePlayerDefeated = useCallback(() => {
    setBattleResult('defeat');
    setGamePhase('result');
  }, []);

  const handleAdversaryDefeated = useCallback(() => {
    setBattleResult('victory');
    setGamePhase('result');
  }, []);

  const handleDamageDealt = useCallback((event: DamageEvent) => {
    if (event.target === 'player') {
      setScreenShake(true);
      setTimeout(() => setScreenShake(false), 300);
    }
  }, []);

  // Battle state hook
  const {
    battleState,
    dealDamage,
    resetBattle,
    getResult,
    tierAttackDamage,
    damageEvents,
  } = useBattleState({
    tier: adversary?.tier || 'common',
    onPlayerDefeated: handlePlayerDefeated,
    onAdversaryDefeated: handleAdversaryDefeated,
    onDamageDealt: handleDamageDealt,
  });

  const companionStats = companion ? {
    mind: companion.mind ?? 10,
    body: companion.body ?? 10,
    soul: companion.soul ?? 10,
  } : { mind: 10, body: 10, soul: 10 };

  // Handle selecting a game
  const handleSelectGame = useCallback((gameType: MiniGameType) => {
    setActiveGame(gameType);
    setBattleResult(null);
    
    if (arcadeMode === 'battle') {
      // Generate adversary for battle mode
      const newAdversary = generateArcadeAdversary(difficulty);
      setAdversary(newAdversary);
      resetBattle();
      setGamePhase('instructions');
    } else {
      setGamePhase('instructions');
    }
  }, [arcadeMode, difficulty, resetBattle]);

  // After instructions, go to practice, VS screen, or playing
  const handleInstructionsReady = useCallback(() => {
    if (arcadeMode === 'battle') {
      setGamePhase('vs_screen');
    } else if (activeGame && !arcadePracticedGames.has(activeGame)) {
      setGamePhase('practice');
    } else {
      setGamePhase('playing');
    }
  }, [activeGame, arcadeMode]);

  const handleVSScreenReady = useCallback(() => {
    setGamePhase('playing');
  }, []);

  const handlePracticeComplete = useCallback(() => {
    if (activeGame) {
      arcadePracticedGames.add(activeGame);
    }
    setGamePhase('playing');
  }, [activeGame]);

  const handleSkipPractice = useCallback(() => {
    if (activeGame) {
      arcadePracticedGames.add(activeGame);
    }
    setGamePhase('playing');
  }, [activeGame]);

  // Handle damage from games (for battle mode)
  const handleDamage = useCallback((event: DamageEvent) => {
    if (arcadeMode === 'battle') {
      dealDamage(event);
    }
  }, [arcadeMode, dealDamage]);

  // Handle game complete
  const handleGameComplete = useCallback((result: MiniGameResult) => {
    if (arcadeMode === 'practice') {
      // Practice mode - just update high scores using game-specific value
      if (activeGame && result.highScoreValue !== undefined) {
        const isNewHighScore = setHighScore(activeGame, result.highScoreValue);
        if (isNewHighScore) {
          playArcadeHighScore();
          toast.success('New High Score!', {
            description: getFormattedHighScore(activeGame) || '',
            icon: '🏆',
          });
        }
      }
      setActiveGame(null);
    } else {
      // Battle mode - game ended, determine outcome
      // If neither side is defeated yet, deal final damage based on accuracy
      if (!battleState.isPlayerDefeated && !battleState.isAdversaryDefeated) {
        if (result.accuracy >= 50) {
          // Good performance - deal damage to adversary
          const damage = Math.round(result.accuracy * 0.5);
          dealDamage({ target: 'adversary', amount: damage, source: 'game_complete' });
        } else {
          // Poor performance - take damage
          dealDamage({ target: 'player', amount: tierAttackDamage, source: 'game_fail' });
        }
        
        // If damage didn't end the battle, force a result based on remaining HP
        // Use setTimeout to let state updates settle
        setTimeout(() => {
          setBattleResult(prev => {
            // Only set if not already set by defeat callbacks
            if (prev === null) {
              // Determine winner by remaining HP percentage
              const playerHPPercent = battleState.playerHP / battleState.playerMaxHP;
              const adversaryHPPercent = battleState.adversaryHP / battleState.adversaryMaxHP;
              return playerHPPercent >= adversaryHPPercent ? 'victory' : 'defeat';
            }
            return prev;
          });
          setGamePhase('result');
        }, 100);
      }
    }
  }, [activeGame, arcadeMode, battleState, dealDamage, setHighScore, tierAttackDamage]);

  // Exit game and reset state
  const handleExitGame = useCallback(() => {
    setActiveGame(null);
    setAdversary(null);
    setBattleResult(null);
    setGamePhase('instructions');
  }, []);

  // Retry battle
  const handleRetryBattle = useCallback(() => {
    if (adversary) {
      resetBattle();
      setBattleResult(null);
      setGamePhase('playing');
    }
  }, [adversary, resetBattle]);

  // Award discovery badge and play entrance sound + background music
  useEffect(() => {
    checkArcadeDiscovery();
    pauseAmbientForEvent();
    playEncounterTrigger();
    
    const musicTimeout = setTimeout(() => {
      playEncounterMusic();
    }, 500);
    
    return () => {
      clearTimeout(musicTimeout);
      stopEncounterMusic();
      resumeAmbientAfterEvent();
    };
  }, [checkArcadeDiscovery]);

  // Memoize star positions for consistent rendering
  const stars = useMemo(() => 
    [...Array(50)].map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      delay: `${Math.random() * 3}s`,
      duration: `${2 + Math.random() * 2}s`,
      opacity: 0.3 + Math.random() * 0.5,
    })), []
  );

  const renderGame = () => {
    if (!activeGame) return null;

    const gameProps = {
      companionStats,
      difficulty,
      onComplete: handleGameComplete,
      ...(arcadeMode === 'battle' && {
        onDamage: handleDamage,
        tierAttackDamage,
      }),
    };

    const GameComponent = (() => {
      switch (activeGame) {
        case 'energy_beam': return EnergyBeamGame;
        case 'tap_sequence': return TapSequenceGame;
        case 'astral_frequency': return AstralFrequencyGame;
        case 'eclipse_timing': return EclipseTimingGame;
        case 'starfall_dodge': return StarfallDodgeGame;
        case 'soul_serpent': return SoulSerpentGame;
        case 'orb_match': return OrbMatchGame;
        case 'galactic_match': return GalacticMatchGame;
        default: return null;
      }
    })();

    if (!GameComponent) return null;

    return (
      <Suspense fallback={<MiniGameSkeleton />}>
        <GameComponent {...gameProps} />
      </Suspense>
    );
  };

  const renderBattleResult = () => {
    if (!battleResult) return null;

    const isVictory = battleResult === 'victory';
    const resultText = getResult();
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="h-full flex flex-col items-center justify-center text-center p-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${
            isVictory 
              ? 'bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border-2 border-emerald-500/50' 
              : 'bg-gradient-to-br from-red-500/20 to-red-600/20 border-2 border-red-500/50'
          }`}
        >
          {isVictory ? (
            <Trophy className="w-12 h-12 text-emerald-400" />
          ) : (
            <Heart className="w-12 h-12 text-red-400" />
          )}
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`text-3xl font-bold mb-2 ${
            isVictory ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {isVictory ? 'Victory!' : 'Defeated'}
        </motion.h2>

        {adversary && (
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground mb-4"
          >
            {isVictory 
              ? `You vanquished ${adversary.name}!`
              : `${adversary.name} was too powerful...`
            }
          </motion.p>
        )}

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col gap-2 mb-6"
        >
          <div className="text-sm text-muted-foreground">
            HP Remaining: <span className={isVictory ? 'text-emerald-400' : 'text-red-400'}>
              {battleState.playerHP}/{battleState.playerMaxHP}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            Result: <span className="text-primary capitalize">{resultText}</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex gap-3"
        >
          <Button variant="outline" onClick={handleExitGame}>
            Exit
          </Button>
          <Button 
            onClick={handleRetryBattle}
            className={isVictory 
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600' 
              : 'bg-gradient-to-r from-purple-500 to-pink-500'
            }
          >
            {isVictory ? 'Battle Again' : 'Retry'}
          </Button>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Animated starfield background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 via-background to-background" />
          {stars.map((star) => (
            <div
              key={star.id}
              className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
              style={{
                left: star.left,
                top: star.top,
                animationDelay: star.delay,
                animationDuration: star.duration,
                opacity: star.opacity,
              }}
            />
          ))}
        </div>

        {/* Active game overlay */}
        {activeGame && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
            {/* Battle Overlay - show during battle mode playing */}
            {arcadeMode === 'battle' && gamePhase === 'playing' && adversary && (
              <BattleOverlay
                battleState={battleState}
                companionImageUrl={companion?.current_image_url || undefined}
                companionName={companion?.spirit_animal || 'Companion'}
                adversaryImageUrl={adversaryImageUrl || undefined}
                adversaryName={adversary.name}
                showScreenShake={screenShake}
              />
            )}

            {/* Floating damage numbers */}
            {arcadeMode === 'battle' && gamePhase === 'playing' && (
              <DamageNumberContainer damageEvents={damageEvents} className="z-50" />
            )}

            <div className="flex-1 flex items-center justify-center p-4">
              <div className="w-full max-w-md h-[500px]">
                {gamePhase !== 'result' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExitGame}
                    className="mb-4 text-muted-foreground"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Exit Game
                  </Button>
                )}
                
                <AnimatePresence mode="wait">
                  {gamePhase === 'instructions' && (
                    <motion.div
                      key="instructions"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="h-full flex items-center justify-center"
                    >
                      <GameInstructionsOverlay 
                        gameType={activeGame} 
                        onReady={handleInstructionsReady} 
                      />
                    </motion.div>
                  )}
                  
                  {gamePhase === 'practice' && (
                    <motion.div
                      key="practice"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <PracticeRoundWrapper
                        gameType={activeGame}
                        companionStats={companionStats}
                        onPracticeComplete={handlePracticeComplete}
                        onSkipPractice={handleSkipPractice}
                      />
                    </motion.div>
                  )}

                  {gamePhase === 'vs_screen' && adversary && (
                    <motion.div
                      key="vs_screen"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-full"
                    >
                      <BattleVSScreen
                        companionName={currentCard?.creature_name || companion?.spirit_animal || 'Companion'}
                        companionStage={companion?.current_stage || 0}
                        companionImageUrl={companion?.current_image_url || undefined}
                        adversary={adversary}
                        adversaryImageUrl={adversaryImageUrl || undefined}
                        isLoadingImage={isLoadingImage}
                        onReady={handleVSScreenReady}
                      />
                    </motion.div>
                  )}
                  
                  {gamePhase === 'playing' && (
                    <motion.div
                      key="playing"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-[500px]"
                    >
                      {renderGame()}
                    </motion.div>
                  )}

                  {gamePhase === 'result' && (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="h-[500px]"
                    >
                      {renderBattleResult()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <motion.div 
          className="relative z-10 p-4 max-w-lg mx-auto space-y-6 pb-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Header */}
          <motion.div className="text-center pt-4" variants={headerVariants}>
            <div className="inline-flex items-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-purple-400" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">
                Astral Arcade
              </h1>
              <Sparkles className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-sm text-muted-foreground">
              {arcadeMode === 'practice' 
                ? 'Practice mini-games and sharpen your skills'
                : 'Battle astral adversaries and prove your might!'
              }
            </p>
          </motion.div>

          {/* Mode Toggle */}
          <motion.div variants={cardVariants}>
            <Card className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setArcadeMode('practice')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    arcadeMode === 'practice'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/30'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  <Gamepad2 className="w-4 h-4" />
                  Practice
                </button>
                <button
                  onClick={() => setArcadeMode('battle')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    arcadeMode === 'battle'
                      ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/30'
                      : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                  }`}
                >
                  <Swords className="w-4 h-4" />
                  Battle
                </button>
              </div>
              {arcadeMode === 'battle' && (
                <motion.p 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="text-xs text-center text-muted-foreground mt-2"
                >
                  Face {difficulty === 'easy' ? 'Common' : difficulty === 'hard' ? 'Uncommon' : 'Common/Uncommon'} adversaries!
                </motion.p>
              )}
            </Card>
          </motion.div>

          {/* High Scores Card - only show in practice mode */}
          {arcadeMode === 'practice' && (
            <motion.div variants={cardVariants}>
              <Card className="p-4 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-cyan-400">
                    <Trophy className="w-5 h-5" />
                    <span className="text-sm font-semibold uppercase tracking-wide">High Scores</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-2xl font-bold text-cyan-400">{getTotalGamesWithHighScores()}/8</p>
                  <p className="text-xs text-muted-foreground">Games with high scores</p>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Battle Mode Info Card */}
          {arcadeMode === 'battle' && (
            <motion.div variants={cardVariants}>
              <Card className="p-4 bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-red-400">
                    <Swords className="w-5 h-5" />
                    <span className="text-sm font-semibold uppercase tracking-wide">Battle Mode</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select any game to face a randomly generated adversary. 
                  Deal damage with good performance, take hits from mistakes!
                </p>
              </Card>
            </motion.div>
          )}

          {/* Difficulty Selector */}
          <motion.div className="flex items-center justify-center gap-2" variants={cardVariants}>
            {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  difficulty === d
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </motion.div>

          {/* Game Grid */}
          <motion.div 
            className="grid grid-cols-2 gap-3"
            variants={containerVariants}
          >
            {GAMES.map((game, index) => (
              <motion.div 
                key={game.type} 
                variants={gameCardVariants}
                custom={index}
              >
                <ArcadeGameCard
                  gameType={game.type}
                  label={game.label}
                  icon={game.icon}
                  stat={game.stat}
                  highScoreDisplay={arcadeMode === 'practice' ? getFormattedHighScore(game.type) : null}
                  onSelect={handleSelectGame}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Return Button */}
          <motion.div variants={cardVariants}>
            <Button
              variant="outline"
              onClick={() => navigate('/tasks')}
              className="w-full border-white/10 hover:bg-white/5"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Quests
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </PageTransition>
  );
}
