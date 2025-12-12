import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Zap, Star, Pause, Play } from 'lucide-react';
import { useEffect, useState } from 'react';

interface GameHUDProps {
  score?: number;
  maxScore?: number;
  timeLeft?: number;
  totalTime?: number;
  combo?: number;
  showCombo?: boolean;
  phase?: number;
  totalPhases?: number;
  isPaused?: boolean;
  onPauseToggle?: () => void;
  title: string;
  subtitle?: string;
  primaryStat?: { value: number; label: string; color: string };
  secondaryStat?: { value: number; label: string; color: string };
}

export const GameHUD = ({
  score,
  maxScore,
  timeLeft,
  totalTime,
  combo = 0,
  showCombo = false,
  phase,
  totalPhases,
  isPaused,
  onPauseToggle,
  title,
  subtitle,
  primaryStat,
  secondaryStat,
}: GameHUDProps) => {
  const [prevScore, setPrevScore] = useState(score);
  const [scoreAnimation, setScoreAnimation] = useState(false);
  const [prevCombo, setPrevCombo] = useState(combo);

  // Trigger score animation when score changes
  useEffect(() => {
    if (score !== prevScore && score !== undefined && score > (prevScore || 0)) {
      setScoreAnimation(true);
      setTimeout(() => setScoreAnimation(false), 300);
    }
    setPrevScore(score);
  }, [score, prevScore]);

  useEffect(() => {
    setPrevCombo(combo);
  }, [combo]);

  const timeProgress = totalTime && timeLeft !== undefined ? (timeLeft / totalTime) * 100 : 100;
  const isTimeLow = timeLeft !== undefined && timeLeft <= 3;

  return (
    <div className="w-full px-4 py-3 bg-gradient-to-b from-background/90 to-transparent">
      {/* Title and Pause */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-foreground tracking-tight">{title}</h3>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        
        {onPauseToggle && (
          <motion.button
            onClick={onPauseToggle}
            className="p-2 rounded-full bg-muted/50 hover:bg-muted transition-colors"
            whileTap={{ scale: 0.9 }}
          >
            {isPaused ? (
              <Play className="w-4 h-4 text-foreground" />
            ) : (
              <Pause className="w-4 h-4 text-foreground" />
            )}
          </motion.button>
        )}
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between gap-4 mb-2">
        {/* Score Display */}
        {score !== undefined && (
          <motion.div 
            className="flex items-center gap-2"
            animate={scoreAnimation ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <div className="p-1.5 rounded-lg bg-primary/20">
              <Star className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Score</span>
              <span className="text-sm font-bold text-foreground">
                {score}
                {maxScore && <span className="text-muted-foreground">/{maxScore}</span>}
              </span>
            </div>
          </motion.div>
        )}

        {/* Combo Display */}
        <AnimatePresence>
          {showCombo && combo > 1 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="p-1.5 rounded-lg bg-yellow-500/20">
                <Zap className="w-4 h-4 text-yellow-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">Combo</span>
                <motion.span 
                  className="text-sm font-bold text-yellow-500"
                  key={combo}
                  initial={{ scale: 1.5 }}
                  animate={{ scale: 1 }}
                >
                  x{combo}
                </motion.span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Stat */}
        {primaryStat && (
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: primaryStat.color }}
            />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{primaryStat.label}</span>
              <span className="text-sm font-bold" style={{ color: primaryStat.color }}>
                {primaryStat.value}
              </span>
            </div>
          </div>
        )}

        {/* Secondary Stat */}
        {secondaryStat && (
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: secondaryStat.color }}
            />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">{secondaryStat.label}</span>
              <span className="text-sm font-bold" style={{ color: secondaryStat.color }}>
                {secondaryStat.value}
              </span>
            </div>
          </div>
        )}

        {/* Timer Display */}
        {timeLeft !== undefined && (
          <motion.div 
            className="flex items-center gap-2"
            animate={isTimeLow ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5, repeat: isTimeLow ? Infinity : 0 }}
          >
            <div className={`p-1.5 rounded-lg ${isTimeLow ? 'bg-red-500/20' : 'bg-muted/50'}`}>
              <Timer className={`w-4 h-4 ${isTimeLow ? 'text-red-500' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Time</span>
              <span className={`text-sm font-bold ${isTimeLow ? 'text-red-500' : 'text-foreground'}`}>
                {timeLeft}s
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Timer Progress Bar */}
      {totalTime !== undefined && timeLeft !== undefined && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full transition-all duration-200"
            style={{
              background: isTimeLow 
                ? 'linear-gradient(90deg, hsl(0, 84%, 60%), hsl(30, 84%, 60%))' 
                : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
            }}
            animate={{ width: `${timeProgress}%` }}
          />
        </div>
      )}

      {/* Phase Indicators */}
      {phase !== undefined && totalPhases !== undefined && totalPhases > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {Array.from({ length: totalPhases }).map((_, i) => (
            <motion.div
              key={i}
              className={`h-2 rounded-full transition-all ${
                i < phase 
                  ? 'bg-green-500 w-6' 
                  : i === phase
                    ? 'bg-primary w-8'
                    : 'bg-muted w-4'
              }`}
              animate={i === phase ? { opacity: [1, 0.6, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// Countdown overlay for pre-game countdown
interface CountdownOverlayProps {
  count: number;
  onComplete: () => void;
}

export const CountdownOverlay = ({ count, onComplete }: CountdownOverlayProps) => {
  const [current, setCurrent] = useState(count);

  useEffect(() => {
    if (current <= 0) {
      onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setCurrent(c => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [current, onComplete]);

  return (
    <AnimatePresence>
      {current > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <motion.div
            key={current}
            initial={{ scale: 2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative"
          >
            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-primary"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1 }}
            />
            
            {/* Number */}
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/50">
              <span className="text-6xl font-black text-primary-foreground">
                {current}
              </span>
            </div>
          </motion.div>
          
          <motion.p
            className="absolute bottom-1/3 text-lg font-medium text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Get Ready!
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Floating score popup component
interface ScorePopupProps {
  value: number;
  x: number;
  y: number;
  type: 'perfect' | 'good' | 'miss' | 'combo';
}

export const ScorePopup = ({ value, x, y, type }: ScorePopupProps) => {
  const colors = {
    perfect: 'text-yellow-400',
    good: 'text-green-400',
    miss: 'text-red-400',
    combo: 'text-purple-400',
  };

  const prefixes = {
    perfect: '✨ ',
    good: '👍 ',
    miss: '❌ ',
    combo: '🔥 ',
  };

  return (
    <motion.div
      className={`absolute pointer-events-none font-bold text-lg ${colors[type]}`}
      style={{ left: x, top: y }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -40, scale: 1.3 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      {prefixes[type]}{value > 0 ? `+${value}` : value}
    </motion.div>
  );
};

// Pause overlay
interface PauseOverlayProps {
  onResume: () => void;
}

export const PauseOverlay = ({ onResume }: PauseOverlayProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        className="text-center"
      >
        <Pause className="w-16 h-16 text-primary mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-foreground mb-2">Paused</h3>
        <p className="text-muted-foreground mb-6">Take your time</p>
        
        <motion.button
          onClick={onResume}
          className="px-8 py-3 bg-primary text-primary-foreground rounded-full font-bold flex items-center gap-2 mx-auto"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Play className="w-5 h-5" />
          Resume
        </motion.button>
      </motion.div>
    </motion.div>
  );
};

