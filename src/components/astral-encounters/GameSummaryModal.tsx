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
    iconBg: 'bg-gradient-to-br from-yellow-400/30 via-amber-500/20 to-orange-500/30',
    iconColor: 'text-yellow-300',
    titleColor: 'text-yellow-300',
    accentColor: 'from-yellow-400 to-amber-500',
    cardBorder: 'border-yellow-500/40',
    cardGlow: 'shadow-[0_0_60px_-12px_rgba(250,204,21,0.4)]',
    statBg: 'bg-yellow-500/10 border-yellow-500/20',
    buttonGradient: 'from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400',
  },
  good: {
    icon: Star,
    title: 'Good!',
    iconBg: 'bg-gradient-to-br from-purple-400/30 via-violet-500/20 to-pink-500/30',
    iconColor: 'text-purple-300',
    titleColor: 'text-purple-300',
    accentColor: 'from-purple-400 to-pink-500',
    cardBorder: 'border-purple-500/40',
    cardGlow: 'shadow-[0_0_60px_-12px_rgba(168,85,247,0.4)]',
    statBg: 'bg-purple-500/10 border-purple-500/20',
    buttonGradient: 'from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400',
  },
  fail: {
    icon: X,
    title: 'Try Again',
    iconBg: 'bg-gradient-to-br from-slate-400/30 via-slate-500/20 to-slate-600/30',
    iconColor: 'text-slate-300',
    titleColor: 'text-slate-300',
    accentColor: 'from-slate-400 to-slate-500',
    cardBorder: 'border-slate-500/40',
    cardGlow: 'shadow-[0_0_40px_-12px_rgba(100,116,139,0.3)]',
    statBg: 'bg-slate-500/10 border-slate-500/20',
    buttonGradient: 'from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400',
  },
  practice: {
    icon: Target,
    title: 'Practice Complete!',
    iconBg: 'bg-gradient-to-br from-cyan-400/30 via-blue-500/20 to-indigo-500/30',
    iconColor: 'text-cyan-300',
    titleColor: 'text-cyan-300',
    accentColor: 'from-cyan-400 to-blue-500',
    cardBorder: 'border-cyan-500/40',
    cardGlow: 'shadow-[0_0_60px_-12px_rgba(34,211,238,0.4)]',
    statBg: 'bg-cyan-500/10 border-cyan-500/20',
    buttonGradient: 'from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400',
  },
};

// Game-specific title overrides for different result types
const GAME_TITLE_OVERRIDES: Partial<Record<MiniGameType, Partial<Record<'perfect' | 'good' | 'fail' | 'practice', string>>>> = {
  cosmiq_grid: { perfect: 'Cleared!', good: 'Cleared!' },
  stellar_flow: { perfect: 'Cleared!', good: 'Cleared!' },
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
  isPracticeMode = false,
  onPlayAgain,
  onExit,
}: GameSummaryModalProps) {
  const effectiveResult = isPracticeMode && result.result === 'fail' ? 'practice' : result.result;
  const config = RESULT_CONFIG[effectiveResult];
  const gameConfig = GAME_STAT_CONFIG[gameType];
  const ResultIcon = config.icon;
  const displayTitle = GAME_TITLE_OVERRIDES[gameType]?.[effectiveResult] || config.title;

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
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Premium backdrop with layered blur */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />

          {/* Main card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className={`relative w-full max-w-sm overflow-hidden rounded-3xl border ${config.cardBorder} ${config.cardGlow}`}
          >
            {/* Glass card background */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-2xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/[0.05] via-transparent to-transparent" />
            
            {/* Top accent line */}
            <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-32 h-[2px] bg-gradient-to-r ${config.accentColor} rounded-full opacity-80`} />

            {/* Content */}
            <div className="relative p-8">
              {/* Icon with premium ring */}
              <div className="flex justify-center mb-6">
                <div className={`relative w-24 h-24 rounded-full ${config.iconBg} border border-white/10 flex items-center justify-center`}>
                  <div className="absolute inset-1 rounded-full border border-white/5" />
                  <ResultIcon className={`w-11 h-11 ${config.iconColor} drop-shadow-lg`} strokeWidth={1.5} />
                </div>
              </div>

              {/* Title */}
              <h2 className={`text-3xl font-bold text-center ${config.titleColor} tracking-tight mb-1`}>
                {displayTitle}
              </h2>

              {/* Game label */}
              <p className="text-center text-white/50 text-sm font-medium tracking-wide uppercase mb-6">
                {gameLabel}
              </p>

              {/* High score badge */}
              {isNewHighScore && (
                <div className="flex justify-center mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/15 border border-yellow-500/30">
                    <Award className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-semibold text-yellow-400 tracking-wide">New High Score!</span>
                  </div>
                </div>
              )}

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {statsToShow.map(([key, statConfig]) => {
                  const value = result.gameStats?.[key as keyof typeof result.gameStats];
                  if (value === undefined) return null;
                  const Icon = statConfig.icon;
                  const displayValue = statConfig.format ? statConfig.format(value as number) : value;
                  
                  return (
                    <div 
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-xl ${config.statBg} border`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-white/60" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-white/40 font-medium uppercase tracking-wider truncate">{statConfig.label}</p>
                        <p className="text-base font-bold text-white/90 tabular-nums">{displayValue}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Accuracy section */}
              <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/40 font-medium uppercase tracking-wider">Accuracy</span>
                  <span className={`text-lg font-bold ${config.titleColor} tabular-nums`}>{result.accuracy}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/5 border border-white/10 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.accuracy}%` }}
                    transition={{ delay: 0.2, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className={`h-full rounded-full bg-gradient-to-r ${config.accentColor}`}
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onExit}
                  className="flex-1 h-12 border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white font-medium rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  Exit
                </Button>
                <Button
                  onClick={onPlayAgain}
                  className={`flex-1 h-12 bg-gradient-to-r ${config.buttonGradient} text-white font-semibold rounded-xl shadow-lg transition-all`}
                >
                  <RotateCcw className="w-4 h-4 mr-2" strokeWidth={1.5} />
                  Play Again
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GameSummaryModal;
