import { useState, useEffect, useCallback, useMemo, lazy, Suspense, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { ArcadeGameCard } from '@/components/astral-encounters/ArcadeGameCard';
import { GameInstructionsOverlay } from '@/components/astral-encounters/GameInstructionsOverlay';
import { BattleOverlay, DamageNumberContainer } from '@/components/astral-encounters/battle';
import { BattleVSScreen } from '@/components/astral-encounters/BattleVSScreen';
import { useCompanion } from '@/hooks/useCompanion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useArcadeHighScores } from '@/hooks/useArcadeHighScores';
import { useArcadeSkillTracker } from '@/hooks/useArcadeSkillTracker';
import { ArcadeDifficulty, DIFFICULTY_LABELS } from '@/types/arcadeDifficulty';
import { ArcadeDifficultySelector } from '@/components/astral-encounters/ArcadeDifficultySelector';
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
import { GameSummaryModal } from '@/components/astral-encounters/GameSummaryModal';
import { MiniGameSkeleton } from '@/components/skeletons';
import {
  ArrowLeft,
  Zap,
  Target,
  Radio,
  Clock,
  Shield,
  Gamepad2,
  Grid3X3,
  Trophy,
  Sparkles,
  Swords,
  Heart,
  Star,
  Crown,
  Flame,
  GitBranch,
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
const CosmiqGridGame = lazy(() => import('@/components/astral-encounters/CosmiqGridGame').then(m => ({ default: m.CosmiqGridGame })));
const StellarFlowGame = lazy(() => import('@/components/astral-encounters/StellarFlowGame').then(m => ({ default: m.StellarFlowGame })));

// Track which games user has practiced in this arcade session
const arcadePracticedGames = new Set<MiniGameType>();

// Active games (shelved games preserved in code but not displayed)
const GAMES = [
  { type: 'energy_beam' as MiniGameType, label: 'Star Defender', icon: Zap, stat: 'body' as const },
  { type: 'tap_sequence' as MiniGameType, label: 'Tap Sequence', icon: Target, stat: 'mind' as const },
  { type: 'orb_match' as MiniGameType, label: 'Starburst', icon: Grid3X3, stat: 'mind' as const },
  { type: 'galactic_match' as MiniGameType, label: 'Galactic Mind', icon: Grid3X3, stat: 'mind' as const },
];

type Difficulty = ArcadeDifficulty;
type GamePhase = 'instructions' | 'practice' | 'vs_screen' | 'playing' | 'result' | 'summary';
type ArcadeMode = 'practice' | 'battle';
type BattleResult = 'victory' | 'defeat' | null;

// Animated floating orb component
const FloatingOrb = ({ delay, size, color, x, y }: { delay: number; size: number; color: string; x: string; y: string }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{
      width: size,
      height: size,
      left: x,
      top: y,
      background: `radial-gradient(circle at 30% 30%, ${color}, transparent 70%)`,
      filter: 'blur(1px)',
    }}
    animate={{
      y: [0, -30, 0],
      x: [0, 10, -10, 0],
      scale: [1, 1.1, 1],
      opacity: [0.3, 0.6, 0.3],
    }}
    transition={{
      duration: 6 + Math.random() * 4,
      delay,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
);

// Immersive background component
const ArcadeBackground = () => {
  const stars = useMemo(() => 
    [...Array(80)].map((_, i) => ({
      id: i,
      x: `${Math.random() * 100}%`,
      y: `${Math.random() * 100}%`,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
      color: ['#fff', '#a5f3fc', '#c4b5fd', '#fcd34d'][Math.floor(Math.random() * 4)],
    })), []
  );

  const orbs = useMemo(() => [
    { delay: 0, size: 200, color: 'hsl(271, 91%, 65%)', x: '10%', y: '20%' },
    { delay: 1.5, size: 150, color: 'hsl(45, 100%, 60%)', x: '80%', y: '60%' },
    { delay: 3, size: 180, color: 'hsl(190, 95%, 50%)', x: '60%', y: '10%' },
    { delay: 2, size: 120, color: 'hsl(340, 82%, 60%)', x: '20%', y: '70%' },
  ], []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Deep space gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(260,40%,8%)] via-[hsl(250,35%,6%)] to-[hsl(240,30%,4%)]" />
      
      {/* Nebula effects */}
      <div className="absolute inset-0 opacity-40">
        <div 
          className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(271, 50%, 30%) 0%, transparent 70%)',
            filter: 'blur(60px)',
            transform: 'translate(-30%, -30%)',
          }}
        />
        <div 
          className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(200, 50%, 25%) 0%, transparent 70%)',
            filter: 'blur(50px)',
            transform: 'translate(30%, 30%)',
          }}
        />
        <div 
          className="absolute top-1/2 left-1/2 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, hsl(340, 50%, 25%) 0%, transparent 70%)',
            filter: 'blur(40px)',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Floating orbs */}
      {orbs.map((orb, i) => (
        <FloatingOrb key={i} {...orb} />
      ))}

      {/* Stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full"
          style={{
            left: star.x,
            top: star.y,
            width: star.size,
            height: star.size,
            backgroundColor: star.color,
          }}
          animate={{
            opacity: [0.2, 0.8, 0.2],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: star.duration,
            delay: star.delay,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Grid overlay for depth */}
      <div 
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(hsl(271, 50%, 50%) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(271, 50%, 50%) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,hsl(240,30%,4%)_100%)]" />
    </div>
  );
};

// Mode toggle component
const ModeToggle = ({ mode, onModeChange }: { mode: ArcadeMode; onModeChange: (mode: ArcadeMode) => void }) => (
  <div className="relative p-1 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10">
    {/* Sliding background */}
    <motion.div
      className="absolute inset-y-1 rounded-xl"
      style={{ width: 'calc(50% - 4px)' }}
      animate={{
        x: mode === 'practice' ? 4 : 'calc(100% + 4px)',
        background: mode === 'practice'
          ? 'linear-gradient(135deg, hsl(190, 95%, 45%) 0%, hsl(220, 90%, 55%) 100%)'
          : 'linear-gradient(135deg, hsl(350, 85%, 55%) 0%, hsl(25, 90%, 55%) 100%)',
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    />
    
    <div className="relative flex">
      <button
        onClick={() => onModeChange('practice')}
        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors z-10 ${
          mode === 'practice' ? 'text-white' : 'text-muted-foreground hover:text-white/70'
        }`}
      >
        <Gamepad2 className="w-5 h-5" />
        Practice
      </button>
      <button
        onClick={() => onModeChange('battle')}
        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-colors z-10 ${
          mode === 'battle' ? 'text-white' : 'text-muted-foreground hover:text-white/70'
        }`}
      >
        <Swords className="w-5 h-5" />
        Battle
      </button>
    </div>
  </div>
);

// Stats display component
const CompanionStatsDisplay = ({ stats, companionName }: { stats: { mind: number; body: number; soul: number }; companionName?: string }) => (
  <motion.div 
    className="flex items-center justify-center gap-6 p-4 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.3 }}
  >
    {companionName && (
      <div className="text-xs text-muted-foreground font-medium pr-4 border-r border-white/10">
        {companionName}
      </div>
    )}
    <div className="flex items-center gap-1.5">
      <span className="text-cyan-400">🧠</span>
      <span className="text-sm font-bold text-cyan-300">{stats.mind}</span>
    </div>
    <div className="flex items-center gap-1.5">
      <span className="text-red-400">💪</span>
      <span className="text-sm font-bold text-red-300">{stats.body}</span>
    </div>
    <div className="flex items-center gap-1.5">
      <span className="text-purple-400">✨</span>
      <span className="text-sm font-bold text-purple-300">{stats.soul}</span>
    </div>
  </motion.div>
);

// High scores card component
const HighScoresCard = ({ games, getBestHighScore }: { games: typeof GAMES; getBestHighScore: (type: MiniGameType) => { displayValue: string } | null }) => {
  const scoresWithData = games.filter(game => getBestHighScore(game.type));
  if (scoresWithData.length === 0) return null;

  return (
    <motion.div 
      className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent backdrop-blur-xl border border-amber-500/20"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 rounded-lg bg-amber-500/20">
          <Trophy className="w-5 h-5 text-amber-400" />
        </div>
        <span className="text-sm font-bold text-amber-300 uppercase tracking-wider">High Scores</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {scoresWithData.map((game) => {
          const score = getBestHighScore(game.type);
          return (
            <div 
              key={game.type} 
              className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/5"
            >
              <game.icon className="w-4 h-4 text-amber-400/70" />
              <span className="text-xs text-muted-foreground truncate flex-1">{game.label}</span>
              <span className="text-xs font-bold text-amber-300">{score?.displayValue}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

// Battle info card
const BattleInfoCard = ({ difficulty }: { difficulty: Difficulty }) => (
  <motion.div 
    className="p-4 rounded-2xl bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent backdrop-blur-xl border border-red-500/20"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.4 }}
  >
    <div className="flex items-center gap-2 mb-3">
      <div className="p-2 rounded-lg bg-red-500/20">
        <Flame className="w-5 h-5 text-red-400" />
      </div>
      <span className="text-sm font-bold text-red-300 uppercase tracking-wider">Battle Mode</span>
    </div>
    <p className="text-sm text-muted-foreground leading-relaxed">
      Face randomly generated adversaries! Deal damage with good performance, take hits from mistakes. 
      <span className="text-red-400 font-medium"> Survive to claim victory!</span>
    </p>
  </motion.div>
);

export default function AstralArcade() {
  const navigate = useNavigate();
  const { companion } = useCompanion();
  const { getHighScore, setHighScore, getTotalGamesWithHighScores, getFormattedHighScore, getBestHighScore } = useArcadeHighScores();
  const { recordGameResult, getRecommendedDifficulty } = useArcadeSkillTracker();
  const { checkArcadeDiscovery } = useAchievements();

  const [activeGame, setActiveGame] = useState<MiniGameType | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('instructions');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [arcadeMode, setArcadeMode] = useState<ArcadeMode>('practice');
  const [adversary, setAdversary] = useState<Adversary | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [practiceResult, setPracticeResult] = useState<MiniGameResult | null>(null);
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  const { imageUrl: adversaryImageUrl, isLoading: isLoadingImage } = useAdversaryImage({
    theme: adversary?.theme || '',
    tier: adversary?.tier || '',
    name: adversary?.name || '',
    enabled: !!adversary && arcadeMode === 'battle',
  });

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

  const handleSelectGame = useCallback((gameType: MiniGameType) => {
    setActiveGame(gameType);
    setBattleResult(null);
    
    if (arcadeMode === 'battle') {
      const newAdversary = generateArcadeAdversary(difficulty);
      setAdversary(newAdversary);
      resetBattle();
    }
    setGamePhase('instructions');
  }, [arcadeMode, difficulty, resetBattle]);

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

  const handleDamage = useCallback((event: DamageEvent) => {
    if (arcadeMode === 'battle') {
      dealDamage(event);
    }
  }, [arcadeMode, dealDamage]);

  const handleGameComplete = useCallback((result: MiniGameResult) => {
    if (arcadeMode === 'practice') {
      let newHighScore = false;
      if (activeGame && result.highScoreValue !== undefined) {
        newHighScore = setHighScore(activeGame, difficulty, result.highScoreValue);
        recordGameResult(activeGame, difficulty, result.accuracy, result.success);
        if (newHighScore) {
          playArcadeHighScore();
        }
      }
      setPracticeResult(result);
      setIsNewHighScore(newHighScore);
      setGamePhase('summary');
    } else {
      if (!battleState.isPlayerDefeated && !battleState.isAdversaryDefeated) {
        if (result.accuracy >= 50) {
          const damage = Math.round(result.accuracy * 0.5);
          dealDamage({ target: 'adversary', amount: damage, source: 'game_complete' });
        } else {
          dealDamage({ target: 'player', amount: tierAttackDamage, source: 'game_fail' });
        }
        
        setTimeout(() => {
          setBattleResult(prev => {
            if (prev === null) {
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
  }, [activeGame, arcadeMode, battleState, dealDamage, setHighScore, tierAttackDamage, difficulty, recordGameResult]);

  const handleExitGame = useCallback(() => {
    setActiveGame(null);
    setAdversary(null);
    setBattleResult(null);
    setPracticeResult(null);
    setIsNewHighScore(false);
    setGamePhase('instructions');
  }, []);

  const handlePlayAgain = useCallback(() => {
    if (activeGame) {
      setPracticeResult(null);
      setIsNewHighScore(false);
      setGamePhase('playing');
    }
  }, [activeGame]);

  const handleRetryBattle = useCallback(() => {
    if (adversary) {
      resetBattle();
      setBattleResult(null);
      setGamePhase('playing');
    }
  }, [adversary, resetBattle]);

  // Track if discovery achievement has been triggered this mount
  const hasTriggeredDiscovery = useRef(false);

  useEffect(() => {
    // Only call discovery once per component mount
    if (!hasTriggeredDiscovery.current) {
      hasTriggeredDiscovery.current = true;
      checkArcadeDiscovery();
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderGame = () => {
    if (!activeGame) return null;

    const isBattleMode = arcadeMode === 'battle';
    const gameProps = {
      companionStats,
      difficulty,
      onComplete: handleGameComplete,
      compact: isBattleMode,
      ...(isBattleMode && {
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
        case 'cosmiq_grid': return CosmiqGridGame;
        case 'stellar_flow': return StellarFlowGame;
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
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', delay: 0.2 }}
          className={`w-28 h-28 rounded-full flex items-center justify-center mb-6 ${
            isVictory 
              ? 'bg-gradient-to-br from-emerald-500/30 to-emerald-600/10 border-2 border-emerald-500/50' 
              : 'bg-gradient-to-br from-red-500/30 to-red-600/10 border-2 border-red-500/50'
          }`}
          style={{
            boxShadow: isVictory 
              ? '0 0 60px rgba(52, 211, 153, 0.4), inset 0 0 30px rgba(52, 211, 153, 0.2)'
              : '0 0 60px rgba(239, 68, 68, 0.4), inset 0 0 30px rgba(239, 68, 68, 0.2)',
          }}
        >
          {isVictory ? (
            <Crown className="w-14 h-14 text-emerald-400" />
          ) : (
            <Heart className="w-14 h-14 text-red-400" />
          )}
        </motion.div>

        <motion.h2
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`text-4xl font-black mb-2 ${
            isVictory ? 'text-emerald-400' : 'text-red-400'
          }`}
          style={{
            textShadow: isVictory 
              ? '0 0 30px rgba(52, 211, 153, 0.5)'
              : '0 0 30px rgba(239, 68, 68, 0.5)',
          }}
        >
          {isVictory ? 'Victory!' : 'Defeated'}
        </motion.h2>

        {adversary && (
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-muted-foreground mb-6 text-lg"
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
          className="flex items-center gap-6 mb-8 p-4 rounded-xl bg-white/5 border border-white/10"
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {battleState.playerHP}/{battleState.playerMaxHP}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">HP Left</div>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div className="text-center">
            <div className="text-2xl font-bold text-primary capitalize">
              {resultText}
            </div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Result</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex gap-4"
        >
          <Button 
            variant="outline" 
            onClick={handleExitGame}
            className="px-6 border-white/20 hover:bg-white/10"
          >
            Exit
          </Button>
          <Button 
            onClick={handleRetryBattle}
            className={`px-6 ${isVictory 
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700' 
              : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
            }`}
          >
            {isVictory ? 'Battle Again' : 'Retry'}
          </Button>
        </motion.div>
      </motion.div>
    );
  };

  return (
    <PageTransition>
      <div className="min-h-screen relative overflow-hidden">
        <ArcadeBackground />

        {/* Active game overlay */}
        {activeGame && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
            {arcadeMode === 'battle' && gamePhase === 'playing' && adversary && (
              <BattleOverlay
                battleState={battleState}
                adversaryImageUrl={adversaryImageUrl || undefined}
                adversaryName={adversary.name}
                showScreenShake={screenShake}
              />
            )}

            {arcadeMode === 'battle' && gamePhase === 'playing' && (
              <DamageNumberContainer damageEvents={damageEvents} className="z-50" />
            )}

            <div className={`flex-1 flex ${arcadeMode === 'battle' && gamePhase === 'playing' ? 'items-start pt-2' : 'items-center justify-center'} p-4 overflow-y-auto`}>
              <div className={`w-full max-w-md ${arcadeMode === 'battle' && gamePhase === 'playing' ? 'min-h-0 max-h-[calc(100dvh-180px)]' : 'min-h-0 max-h-[calc(100dvh-120px)]'}`}>
                {gamePhase !== 'result' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleExitGame}
                    className={`${arcadeMode === 'battle' && gamePhase === 'playing' ? 'mb-1 p-2' : 'mb-4'} text-muted-foreground hover:text-white`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {!(arcadeMode === 'battle' && gamePhase === 'playing') && <span className="ml-2">Exit Game</span>}
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
                      className="h-full overflow-hidden"
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

                  {gamePhase === 'summary' && practiceResult && (
                    <GameSummaryModal
                      isOpen={true}
                      gameType={activeGame!}
                      gameLabel={GAMES.find(g => g.type === activeGame)?.label || 'Game'}
                      result={practiceResult}
                      isNewHighScore={isNewHighScore}
                      isPracticeMode={arcadeMode === 'practice'}
                      onPlayAgain={handlePlayAgain}
                      onExit={handleExitGame}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Main content */}
        <div className="relative z-10 p-4 max-w-lg mx-auto space-y-5 pb-8">
          {/* Header */}
          <motion.div 
            className="text-center pt-6 pb-2"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <motion.div 
              className="inline-flex items-center gap-3 mb-3"
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Star className="w-7 h-7 text-amber-400 fill-amber-400/50" />
              </motion.div>
              <h1 className="text-3xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                  Astral
                </span>
                {' '}
                <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  Arcade
                </span>
              </h1>
              <motion.div
                animate={{ rotate: [0, -15, 15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              >
                <Sparkles className="w-7 h-7 text-cyan-400" />
              </motion.div>
            </motion.div>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              {arcadeMode === 'practice' 
                ? 'Master your skills and climb the leaderboards'
                : 'Face cosmic adversaries in epic battles!'
              }
            </p>
          </motion.div>

          {/* Companion Stats */}
          <CompanionStatsDisplay 
            stats={companionStats} 
            companionName={currentCard?.creature_name || companion?.spirit_animal}
          />

          {/* Mode Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <ModeToggle mode={arcadeMode} onModeChange={setArcadeMode} />
          </motion.div>

          {/* High Scores or Battle Info */}
          <AnimatePresence mode="wait">
            {arcadeMode === 'practice' ? (
              <HighScoresCard key="scores" games={GAMES} getBestHighScore={getBestHighScore} />
            ) : (
              <BattleInfoCard key="battle" difficulty={difficulty} />
            )}
          </AnimatePresence>

          {/* Difficulty Selector */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <ArcadeDifficultySelector
              selected={difficulty}
              onSelect={setDifficulty}
              recommended={activeGame ? getRecommendedDifficulty(activeGame) : null}
            />
          </motion.div>

          {/* Game Grid */}
          <motion.div 
            className="grid grid-cols-2 gap-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.08, delayChildren: 0.6 }
              }
            }}
          >
            {GAMES.map((game, index) => (
              <motion.div 
                key={game.type}
                variants={{
                  hidden: { opacity: 0, y: 30, scale: 0.9 },
                  visible: { 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                    transition: { type: 'spring', stiffness: 400, damping: 25 }
                  }
                }}
              >
                <ArcadeGameCard
                  gameType={game.type}
                  label={game.label}
                  icon={game.icon}
                  stat={game.stat}
                  highScoreDisplay={arcadeMode === 'practice' ? getFormattedHighScore(game.type, difficulty) : null}
                  onSelect={handleSelectGame}
                  index={index}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Return Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
          >
            <Button
              variant="ghost"
              onClick={() => navigate('/journeys')}
              className="w-full py-6 border border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white transition-all"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Quests
            </Button>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
