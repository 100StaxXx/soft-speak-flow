import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult, MiniGameType } from '@/types/astralEncounters';
import { Button } from '@/components/ui/button';
import { 
  Trophy, Star, X, Target, Zap, Clock, 
  Flame, Heart, RotateCcw, ArrowLeft, 
  Sparkles, Award, TrendingUp
} from 'lucide-react';

interface GameSummaryModalProps {
  isOpen: boolean;
  gameType: MiniGameType;
  gameLabel: string;
  result: MiniGameResult;
  isNewHighScore?: boolean;
  previousHighScore?: number;
  isPracticeMode?: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
}

// Game-specific stat configurations
const GAME_STAT_CONFIG: Record<MiniGameType, { 
  primaryStat: string; 
  statLabels: Record<string, { label: string; icon: typeof Trophy; format?: (v: number) => string }>;
}> = {
  starfall_dodge: {
    primaryStat: 'time',
    statLabels: {
      time: { label: 'Survival Time', icon: Clock, format: (v) => `${v}s` },
      itemsCollected: { label: 'Crystals', icon: Sparkles },
      livesRemaining: { label: 'Lives Left', icon: Heart },
    },
  },
  galactic_match: {
    primaryStat: 'level',
    statLabels: {
      level: { label: 'Level Reached', icon: TrendingUp },
      score: { label: 'Score', icon: Star },
      maxCombo: { label: 'Best Combo', icon: Flame },
    },
  },
  eclipse_timing: {
    primaryStat: 'score',
    statLabels: {
      score: { label: 'Score', icon: Star },
      maxCombo: { label: 'Max Combo', icon: Flame },
      notesHit: { label: 'Notes Hit', icon: Target },
      misses: { label: 'Misses', icon: X },
    },
  },
  soul_serpent: {
    primaryStat: 'score',
    statLabels: {
      score: { label: 'Stardust', icon: Sparkles },
    },
  },
  energy_beam: {
    primaryStat: 'wavesCleared',
    statLabels: {
      wavesCleared: { label: 'Waves Cleared', icon: Zap },
      score: { label: 'Score', icon: Star },
    },
  },
  tap_sequence: {
    primaryStat: 'level',
    statLabels: {
      level: { label: 'Level Reached', icon: TrendingUp },
      score: { label: 'Score', icon: Star },
    },
  },
  orb_match: {
    primaryStat: 'score',
    statLabels: {
      score: { label: 'Total Score', icon: Star },
      levelsCompleted: { label: 'Levels Cleared', icon: TrendingUp },
      maxCombo: { label: 'Max Combo', icon: Flame },
      timeBonus: { label: 'Time Bonus', icon: Clock, format: (v) => `+${v}` },
    },
  },
  astral_frequency: {
    primaryStat: 'distance',
    statLabels: {
      distance: { label: 'Distance', icon: TrendingUp, format: (v) => `${Math.floor(v)}m` },
      score: { label: 'Score', icon: Star },
      maxCombo: { label: 'Best Combo', icon: Flame },
      livesRemaining: { label: 'Lives Left', icon: Heart },
    },
  },
  cosmiq_grid: {
    primaryStat: 'time',
    statLabels: {
      time: { label: 'Solve Time', icon: Clock, format: (v) => `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, '0')}` },
      puzzlesSolved: { label: 'Solved', icon: Trophy },
      hintsUsed: { label: 'Hints Used', icon: Sparkles },
    },
  },
  stellar_flow: {
    primaryStat: 'time',
    statLabels: {
      time: { label: 'Solve Time', icon: Clock, format: (v) => `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, '0')}` },
      pathsConnected: { label: 'Paths', icon: TrendingUp },
      cellsFilled: { label: 'Cells Filled', icon: Target },
    },
  },
};

const RESULT_CONFIG = {
  perfect: {
    icon: Trophy,
    title: 'Perfect!',
    color: 'text-yellow-400',
    bgColor: 'from-yellow-500/20 to-amber-500/20',
    borderColor: 'border-yellow-500/50',
    glowColor: 'shadow-yellow-500/30',
  },
  good: {
    icon: Star,
    title: 'Good!',
    color: 'text-purple-400',
    bgColor: 'from-purple-500/20 to-pink-500/20',
    borderColor: 'border-purple-500/50',
    glowColor: 'shadow-purple-500/30',
  },
  fail: {
    icon: X,
    title: 'Try Again',
    color: 'text-red-400',
    bgColor: 'from-red-500/20 to-orange-500/20',
    borderColor: 'border-red-500/50',
    glowColor: 'shadow-red-500/30',
  },
  practice: {
    icon: Target,
    title: 'Practice Complete!',
    color: 'text-cyan-400',
    bgColor: 'from-cyan-500/20 to-blue-500/20',
    borderColor: 'border-cyan-500/50',
    glowColor: 'shadow-cyan-500/30',
  },
};

// Game-specific title overrides for different result types
const GAME_TITLE_OVERRIDES: Partial<Record<MiniGameType, Partial<Record<'perfect' | 'good' | 'fail' | 'practice', string>>>> = {
  // Puzzle completion games - "Cleared!" instead of "Perfect!"
  cosmiq_grid: { perfect: 'Cleared!', good: 'Cleared!' },
  stellar_flow: { perfect: 'Cleared!', good: 'Cleared!' },
  
  // Endless/survival games - "Good Run!" instead of "Perfect!"
  starfall_dodge: { perfect: 'Good Run!', good: 'Nice Try!' },
  astral_frequency: { perfect: 'Good Run!', good: 'Nice Try!' },
  soul_serpent: { perfect: 'Good Run!', good: 'Nice Try!' },
  energy_beam: { perfect: 'Good Run!', good: 'Nice Try!' },
};

export function GameSummaryModal({
  isOpen,
  gameType,
  gameLabel,
  result,
  isNewHighScore = false,
  previousHighScore,
  isPracticeMode = false,
  onPlayAgain,
  onExit,
}: GameSummaryModalProps) {
  // In practice mode, use encouraging "practice" config instead of "fail"
  const effectiveResult = isPracticeMode && result.result === 'fail' ? 'practice' : result.result;
  const resultConfig = RESULT_CONFIG[effectiveResult];
  const gameConfig = GAME_STAT_CONFIG[gameType];
  const ResultIcon = resultConfig.icon;
  const showCelebration = effectiveResult !== 'fail';
  
  // Get game-specific title override if it exists
  const displayTitle = GAME_TITLE_OVERRIDES[gameType]?.[effectiveResult] || resultConfig.title;

  // Get stats to display
  const statsToShow = Object.entries(gameConfig?.statLabels || {}).filter(
    ([key]) => result.gameStats?.[key as keyof typeof result.gameStats] !== undefined
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-sm"
        >
          {/* Celebration particles for success */}
          {showCelebration && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    backgroundColor: effectiveResult === 'perfect' 
                      ? `hsl(${45 + Math.random() * 20}, 100%, ${50 + Math.random() * 30}%)` 
                      : effectiveResult === 'practice'
                      ? `hsl(${190 + Math.random() * 20}, 80%, ${50 + Math.random() * 30}%)`
                      : `hsl(${270 + Math.random() * 30}, 70%, ${50 + Math.random() * 30}%)`,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                    y: [0, -100 - Math.random() * 100],
                  }}
                  transition={{ 
                    duration: 2 + Math.random(), 
                    delay: Math.random() * 0.5,
                    repeat: Infinity,
                    repeatDelay: Math.random() * 2,
                  }}
                />
              ))}
            </div>
          )}

          <motion.div
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className={`relative w-full max-w-sm rounded-2xl border-2 ${resultConfig.borderColor} bg-gradient-to-br ${resultConfig.bgColor} p-6 shadow-xl ${resultConfig.glowColor}`}
          >
            {/* Result Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
              className="flex justify-center mb-4"
            >
              <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${resultConfig.bgColor} border-2 ${resultConfig.borderColor} flex items-center justify-center`}>
                <ResultIcon className={`w-10 h-10 ${resultConfig.color}`} />
              </div>
            </motion.div>

            {/* Result Title */}
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className={`text-3xl font-bold text-center ${resultConfig.color} mb-1`}
            >
              {displayTitle}
            </motion.h2>

            {/* Game Name */}
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-center text-muted-foreground text-sm mb-4"
            >
              {gameLabel}
            </motion.p>

            {/* New High Score Badge */}
            {isNewHighScore && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.25 }}
                className="flex justify-center mb-4"
              >
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 border border-yellow-500/50">
                  <Award className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-bold text-yellow-400">New High Score!</span>
                </div>
              </motion.div>
            )}

            {/* Stats Grid */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-2 gap-3 mb-4"
            >
              {statsToShow.map(([key, config]) => {
                const value = result.gameStats?.[key as keyof typeof result.gameStats];
                if (value === undefined) return null;
                const Icon = config.icon;
                const displayValue = config.format ? config.format(value as number) : value;
                
                return (
                  <div 
                    key={key}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{config.label}</p>
                      <p className="text-sm font-bold text-foreground">{displayValue}</p>
                    </div>
                  </div>
                );
              })}
            </motion.div>

            {/* Accuracy Bar */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="mb-6"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Accuracy</span>
                <span className={`text-sm font-bold ${resultConfig.color}`}>{result.accuracy}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${result.accuracy}%` }}
                  transition={{ delay: 0.4, duration: 0.5, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    effectiveResult === 'perfect' ? 'bg-gradient-to-r from-yellow-400 to-amber-500' :
                    effectiveResult === 'good' ? 'bg-gradient-to-r from-purple-400 to-pink-500' :
                    effectiveResult === 'practice' ? 'bg-gradient-to-r from-cyan-400 to-blue-500' :
                    'bg-gradient-to-r from-red-400 to-orange-500'
                  }`}
                />
              </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.45 }}
              className="flex gap-3"
            >
              <Button
                variant="outline"
                onClick={onExit}
                className="flex-1 border-white/20 hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exit
              </Button>
              <Button
                onClick={onPlayAgain}
                className={`flex-1 ${
                  effectiveResult === 'perfect' 
                    ? 'bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600' 
                    : effectiveResult === 'good'
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
                    : effectiveResult === 'practice'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600'
                }`}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Play Again
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GameSummaryModal;
