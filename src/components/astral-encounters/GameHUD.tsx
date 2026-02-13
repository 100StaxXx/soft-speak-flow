import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Zap, Star, Pause, Play } from 'lucide-react';
import { useEffect, useState, memo } from 'react';

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
  compact?: boolean;
}

// Memoized stat badge for performance
const StatBadge = memo(({ 
  icon, 
  label, 
  value, 
  maxValue, 
  color,
  animate = false,
  compact = false
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  maxValue?: number;
  color: string;
  animate?: boolean;
  compact?: boolean;
}) => (
  <motion.div 
    className={`flex items-center gap-1.5 rounded-xl stat-pill ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}
    animate={animate ? { scale: [1, 1.08, 1] } : {}}
    transition={{ duration: 0.25 }}
  >
    <div 
      className={compact ? "p-1 rounded-md" : "p-1.5 rounded-lg"}
      style={{ backgroundColor: `${color}20` }}
    >
      {icon}
    </div>
    <div className="flex flex-col">
      {!compact && <span className="text-[10px] uppercase tracking-wider text-white/50 font-medium">{label}</span>}
      <span className={`font-bold ${compact ? 'text-xs' : 'text-sm'}`} style={{ color }}>
        {value}
        {maxValue !== undefined && (
          <span className="text-white/40 font-normal">/{maxValue}</span>
        )}
      </span>
    </div>
  </motion.div>
));
StatBadge.displayName = 'StatBadge';

export const GameHUD = memo(({
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
  compact = false,
}: GameHUDProps) => {
  const [prevScore, setPrevScore] = useState(score);
  const [scoreAnimation, setScoreAnimation] = useState(false);

  useEffect(() => {
    if (score !== prevScore && score !== undefined && score > (prevScore || 0)) {
      setScoreAnimation(true);
      setTimeout(() => setScoreAnimation(false), 250);
    }
    setPrevScore(score);
  }, [score, prevScore]);

  const timeProgress = totalTime && timeLeft !== undefined ? (timeLeft / totalTime) * 100 : 100;
  const isTimeLow = timeLeft !== undefined && timeLeft <= 3;

  return (
    <div className={`w-full ${compact ? 'px-2 py-1 mb-1' : 'px-3 py-2 mb-2'}`}>
      {/* Title row - hidden in compact mode */}
      {!compact && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex-1">
            <h3 className="text-base font-bold text-white tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-[10px] text-white/60 font-medium tracking-wide">{subtitle}</p>
            )}
          </div>
          
          {onPauseToggle && (
            <motion.button
              onClick={onPauseToggle}
              className="p-2.5 rounded-full transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 4px 15px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
            >
              {isPaused ? (
                <Play className="w-4 h-4 text-white" />
              ) : (
                <Pause className="w-4 h-4 text-white" />
              )}
            </motion.button>
          )}
        </div>
      )}

      {/* Stats row with badges */}
      <div className={`flex items-center justify-between gap-1.5 overflow-x-auto scrollbar-hide ${compact ? 'mb-1' : 'mb-2'}`}>
        {score !== undefined && (
          <StatBadge
            icon={<Star className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-purple-400`} />}
            label="Score"
            value={score}
            maxValue={maxScore}
            color="#a855f7"
            animate={scoreAnimation}
            compact={compact}
          />
        )}

        <AnimatePresence>
          {showCombo && combo > 1 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <StatBadge
                icon={<Zap className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-yellow-400`} />}
                label="Combo"
                value={`×${combo}`}
                color="#fbbf24"
                animate={true}
                compact={compact}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {primaryStat && (
          <StatBadge
            icon={<div className={`${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full`} style={{ backgroundColor: primaryStat.color }} />}
            label={primaryStat.label}
            value={primaryStat.value}
            color={primaryStat.color}
            compact={compact}
          />
        )}

        {secondaryStat && (
          <StatBadge
            icon={<div className={`${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full`} style={{ backgroundColor: secondaryStat.color }} />}
            label={secondaryStat.label}
            value={secondaryStat.value}
            color={secondaryStat.color}
            compact={compact}
          />
        )}

        {timeLeft !== undefined && (
          <motion.div
            animate={isTimeLow ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 0.4, repeat: isTimeLow ? Infinity : 0 }}
          >
            <StatBadge
              icon={<Timer className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} ${isTimeLow ? 'text-red-400' : 'text-white/60'}`} />}
              label="Time"
              value={`${timeLeft}s`}
              color={isTimeLow ? '#ef4444' : '#94a3b8'}
              compact={compact}
            />
          </motion.div>
        )}

        {/* Pause button in compact mode - moved to stats row */}
        {compact && onPauseToggle && (
          <motion.button
            onClick={onPauseToggle}
            className="p-1.5 rounded-full transition-all flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
          >
            {isPaused ? (
              <Play className="w-3 h-3 text-white" />
            ) : (
              <Pause className="w-3 h-3 text-white" />
            )}
          </motion.button>
        )}
      </div>

      {/* Premium timer progress bar with animated glow */}
      {totalTime !== undefined && timeLeft !== undefined && (
        <div 
          className={`${compact ? 'h-1.5' : 'h-2.5'} rounded-full overflow-hidden`}
          style={{
            background: 'linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06))',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
          }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isTimeLow 
                ? 'linear-gradient(90deg, #ef4444, #f97316, #ef4444)' 
                : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))',
              backgroundSize: '200% 100%',
              boxShadow: isTimeLow 
                ? '0 0 20px rgba(239, 68, 68, 0.6), inset 0 1px 0 rgba(255,255,255,0.3)' 
                : '0 0 20px hsl(var(--primary) / 0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
            }}
            animate={{ 
              width: `${timeProgress}%`,
              backgroundPosition: ['0% center', '200% center'],
            }}
            transition={{
              width: { duration: 0.3 },
              backgroundPosition: { duration: 2.5, repeat: Infinity, ease: 'linear' },
            }}
          />
        </div>
      )}

      {/* Phase dots - hidden in compact mode */}
      {!compact && phase !== undefined && totalPhases !== undefined && totalPhases > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: totalPhases }).map((_, i) => (
            <motion.div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i < phase 
                  ? 'bg-green-400 w-3 h-2' 
                  : i === phase
                    ? 'bg-gradient-to-r from-primary to-accent w-5 h-2'
                    : 'bg-white/10 w-2 h-2'
              }`}
              style={{
                boxShadow: i === phase ? '0 0 10px hsl(var(--primary))' : 'none',
              }}
              animate={i === phase ? { opacity: [1, 0.7, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            />
          ))}
        </div>
      )}

    </div>
  );
});
GameHUD.displayName = 'GameHUD';

// Premium countdown overlay
interface CountdownOverlayProps {
  count: number;
  onComplete: () => void;
}

export const CountdownOverlay = memo(({ count, onComplete }: CountdownOverlayProps) => {
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
          className="absolute inset-0 z-50 flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at center, rgba(0,0,0,0.92) 0%, rgba(5,5,15,0.97) 100%)',
            backdropFilter: 'blur(12px) saturate(120%)',
          }}
        >
          <motion.div
            key={current}
            initial={{ scale: 2.5, opacity: 0, rotate: -15 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.5, opacity: 0, rotate: 15 }}
            transition={{ type: "spring", stiffness: 350, damping: 22 }}
            className="relative"
          >
            {/* Multiple expanding rings */}
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full"
                style={{
                  border: '2px solid',
                  borderColor: `hsl(var(--primary) / ${0.6 - i * 0.2})`,
                }}
                initial={{ scale: 1, opacity: 0.8 }}
                animate={{ scale: 2 + i * 0.5, opacity: 0 }}
                transition={{ duration: 1, delay: i * 0.15 }}
              />
            ))}
            
            {/* Main number circle with cosmic glow */}
            <div 
              className="w-36 h-36 rounded-full flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)',
                boxShadow: '0 0 60px hsl(var(--primary) / 0.6), 0 0 120px hsl(var(--primary) / 0.3), inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -2px 0 rgba(0,0,0,0.15)',
              }}
            >
              {/* Inner highlight */}
              <div className="absolute inset-2 rounded-full bg-gradient-to-br from-white/25 to-transparent" />
              
              <span 
                className="text-7xl font-black text-white relative z-10"
                style={{ textShadow: '0 4px 20px rgba(0,0,0,0.4), 0 0 40px rgba(255,255,255,0.2)' }}
              >
                {current}
              </span>
            </div>
          </motion.div>
          
          <motion.p
            className="absolute bottom-[30%] text-lg font-semibold text-white/70 tracking-wide"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Get Ready
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
CountdownOverlay.displayName = 'CountdownOverlay';

// Premium floating score popup
interface ScorePopupProps {
  value: number;
  x: number;
  y: number;
  type: 'perfect' | 'good' | 'miss' | 'combo';
}

export const ScorePopup = memo(({ value, x, y, type }: ScorePopupProps) => {
  const styles = {
    perfect: { color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)', emoji: '✨' },
    good: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', emoji: '👍' },
    miss: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', emoji: '❌' },
    combo: { color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', emoji: '🔥' },
  };

  const style = styles[type];

  return (
    <motion.div
      className="absolute pointer-events-none flex items-center gap-1.5 px-3 py-1.5 rounded-full font-bold text-base"
      style={{ 
        left: x, 
        top: y,
        color: style.color,
        backgroundColor: style.bg,
        border: `1px solid ${style.color}40`,
        boxShadow: `0 4px 20px ${style.color}40`,
      }}
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -50, scale: 1.2 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: "easeOut" }}
    >
      <span>{style.emoji}</span>
      <span>{value > 0 ? `+${value}` : value}</span>
    </motion.div>
  );
});
ScorePopup.displayName = 'ScorePopup';

// Premium pause overlay
interface PauseOverlayProps {
  onResume: () => void;
}

export const PauseOverlay = memo(({ onResume }: PauseOverlayProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex flex-col items-center justify-center"
      style={{
        background: 'radial-gradient(circle at center, rgba(0,0,0,0.94) 0%, rgba(5,5,15,0.98) 100%)',
        backdropFilter: 'blur(16px) saturate(120%)',
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="text-center"
      >
        {/* Pause icon with cosmic glow */}
        <div 
          className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)',
            border: '1px solid rgba(255,255,255,0.15)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.4), 0 0 60px hsl(var(--primary) / 0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <Pause className="w-12 h-12 text-white/85" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-1.5 tracking-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
          Paused
        </h3>
        <p className="text-white/50 mb-8 text-sm font-medium">Take your time</p>
        
        <motion.button
          onClick={onResume}
          className="px-8 py-3.5 rounded-full font-bold flex items-center gap-2.5 mx-auto text-white"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)',
            boxShadow: '0 8px 30px hsl(var(--primary) / 0.5), 0 0 60px hsl(var(--primary) / 0.2), inset 0 1px 0 rgba(255,255,255,0.25)',
          }}
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
        >
          <Play className="w-5 h-5" />
          Resume
        </motion.button>
      </motion.div>
    </motion.div>
  );
});
PauseOverlay.displayName = 'PauseOverlay';

// Premium feedback overlay for game results
interface FeedbackOverlayProps {
  type: 'perfect' | 'good' | 'miss';
  onDismiss?: () => void;
}

export const FeedbackOverlay = memo(({ type }: FeedbackOverlayProps) => {
  const config = {
    perfect: { 
      text: 'PERFECT!', 
      emoji: '🌟', 
      color: '#fbbf24',
      gradient: 'from-yellow-500/20 to-amber-500/10',
      border: 'border-yellow-400/50',
      glow: 'rgba(251, 191, 36, 0.4)',
    },
    good: { 
      text: 'GOOD!', 
      emoji: '👍', 
      color: '#22c55e',
      gradient: 'from-green-500/20 to-emerald-500/10',
      border: 'border-green-400/50',
      glow: 'rgba(34, 197, 94, 0.4)',
    },
    miss: { 
      text: 'MISS', 
      emoji: '❌', 
      color: '#ef4444',
      gradient: 'from-red-500/20 to-orange-500/10',
      border: 'border-red-400/50',
      glow: 'rgba(239, 68, 68, 0.4)',
    },
  };

  const c = config[type];

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 1.2, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`px-8 py-4 rounded-2xl bg-gradient-to-br ${c.gradient} border-2 ${c.border}`}
      style={{ boxShadow: `0 0 40px ${c.glow}` }}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{c.emoji}</span>
        <span 
          className="text-3xl font-black tracking-tight"
          style={{ color: c.color, textShadow: `0 0 20px ${c.glow}` }}
        >
          {c.text}
        </span>
      </div>
    </motion.div>
  );
});
FeedbackOverlay.displayName = 'FeedbackOverlay';
