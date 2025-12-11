import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useStaticStars, getGridPositions } from './gameUtils';

interface TapSequenceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

interface Orb {
  id: number;
  x: number;
  y: number;
  order: number;
  tapped: boolean;
}

// Memoized star background component using CSS animations
const StarBackground = memo(({ stars }: { stars: ReturnType<typeof useStaticStars> }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {stars.map(star => (
      <div
        key={star.id}
        className="absolute w-1 h-1 bg-white/40 rounded-full gpu-accelerated"
        style={{
          left: `${star.x}%`,
          top: `${star.y}%`,
          animation: `twinkle ${star.animationDuration}s ease-in-out infinite`,
          animationDelay: `${star.animationDelay}s`,
        }}
      />
    ))}
  </div>
));
StarBackground.displayName = 'StarBackground';

// Memoized Orb component for better performance
interface OrbComponentProps {
  orb: Orb;
  isHighlighted: boolean;
  isPast: boolean;
  isNext: boolean;
  showNumber: boolean;
  tapResult: { id: number; success: boolean } | null;
  onClick: () => void;
  disabled: boolean;
}

const OrbComponent = memo(({ 
  orb, 
  isHighlighted, 
  isPast, 
  isNext, 
  showNumber,
  tapResult, 
  onClick, 
  disabled 
}: OrbComponentProps) => {
  const buttonClasses = useMemo(() => {
    if (orb.tapped) return 'bg-gradient-to-br from-green-500 to-green-600 border-green-400 text-white';
    if (isHighlighted) return 'bg-gradient-to-br from-primary to-accent border-primary text-primary-foreground scale-125 z-20';
    if (isPast) return 'bg-primary/40 border-primary/50 text-primary-foreground';
    if (isNext) return 'bg-primary/30 border-primary/80 text-primary-foreground';
    return 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60 hover:border-primary/50';
  }, [orb.tapped, isHighlighted, isPast, isNext]);

  const boxShadow = useMemo(() => {
    if (isHighlighted) return '0 0 30px hsl(var(--primary)), 0 0 60px hsl(var(--primary)/0.5)';
    if (orb.tapped) return '0 0 20px hsl(142, 76%, 46%)';
    if (isNext) return '0 0 15px hsl(var(--primary)/0.5)';
    return 'none';
  }, [isHighlighted, orb.tapped, isNext]);

  return (
    <motion.button
      className={`absolute w-14 h-14 rounded-full border-2 flex items-center justify-center font-bold transition-colors will-animate gpu-accelerated ${buttonClasses}`}
      style={{
        left: `${orb.x}%`,
        top: `${orb.y}%`,
        transform: 'translate(-50%, -50%)',
        boxShadow,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isHighlighted ? 1.25 : 1, 
        opacity: 1,
      }}
      exit={{ scale: 0, opacity: 0 }}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
    >
      {/* Number display */}
      <span className={`text-lg ${isHighlighted ? 'font-black' : ''}`}>
        {showNumber ? orb.order : '?'}
      </span>

      {/* Pulse ring for current orb - CSS only */}
      {isNext && (
        <div className="absolute inset-0 rounded-full border-2 border-primary pulse-ring" />
      )}

      {/* Highlight ring animation */}
      {isHighlighted && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-white"
            initial={{ scale: 1, opacity: 1 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.6, repeat: Infinity }}
          />
          <motion.div
            className="absolute inset-0 rounded-full bg-white/20"
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 0.6 }}
          />
        </>
      )}

      {/* Tap result feedback */}
      {tapResult && (
        <motion.div
          className="absolute inset-0 rounded-full flex items-center justify-center"
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="text-2xl">
            {tapResult.success ? '✨' : '❌'}
          </span>
        </motion.div>
      )}
    </motion.button>
  );
});
OrbComponent.displayName = 'OrbComponent';

// Memoized connection lines - only renders when sequence is being shown
const ConnectionLines = memo(({ orbs, highlightIndex }: { orbs: Orb[]; highlightIndex: number }) => {
  if (highlightIndex <= 0) return null;
  
  return (
    <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height="100%">
      {orbs.slice(0, highlightIndex).map((orb, i) => {
        if (i === 0) return null;
        const prevOrb = orbs[i - 1];
        return (
          <motion.line
            key={`line-${i}`}
            x1={`${prevOrb.x}%`}
            y1={`${prevOrb.y}%`}
            x2={`${orb.x}%`}
            y2={`${orb.y}%`}
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeOpacity="0.4"
            strokeDasharray="5,5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3 }}
          />
        );
      })}
    </svg>
  );
});
ConnectionLines.displayName = 'ConnectionLines';

export const TapSequenceGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0
}: TapSequenceGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'showing' | 'playing' | 'paused' | 'complete'>('countdown');
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [currentOrder, setCurrentOrder] = useState(1);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [shake, setShake] = useState(false);
  const [lastTapResult, setLastTapResult] = useState<{ id: number; success: boolean } | null>(null);
  const [perfectStreak, setPerfectStreak] = useState(0);

  const maxRounds = 3;
  const baseOrbsPerRound = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 5 : 6;
  const orbsPerRound = Math.round(baseOrbsPerRound * (1 + questIntervalScale));
  
  // Mind stat affects timing forgiveness
  const mindBonus = Math.min(companionStats.mind / 100, 1);
  const baseDisplayTime = 600 + (mindBonus * 300);
  const displayTime = baseDisplayTime * (1 - questIntervalScale * 0.3);

  // Static stars - memoized
  const stars = useStaticStars(10);

  // Generate orbs with better distribution using utility function
  const generateOrbs = useCallback(() => {
    const positions = getGridPositions(orbsPerRound, 15, 70);
    const newOrbs: Orb[] = positions.map((pos, i) => ({
      id: i,
      x: pos.x,
      y: pos.y,
      order: i + 1,
      tapped: false,
    }));
    setOrbs(newOrbs);
  }, [orbsPerRound]);

  // Initialize game
  useEffect(() => {
    generateOrbs();
  }, [generateOrbs]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('showing');
    setHighlightIndex(0);
  }, []);

  // Show sequence animation
  useEffect(() => {
    if (gameState !== 'showing' || orbs.length === 0) return;

    const timer = setTimeout(() => {
      if (highlightIndex < orbs.length) {
        triggerHaptic('light');
        setHighlightIndex(prev => prev + 1);
      } else {
        setGameState('playing');
        setHighlightIndex(0);
      }
    }, displayTime);

    return () => clearTimeout(timer);
  }, [gameState, highlightIndex, orbs.length, displayTime]);

  const handleOrbTap = useCallback((orb: Orb) => {
    if (gameState !== 'playing' || orb.tapped) return;

    if (orb.order === currentOrder) {
      // Correct tap!
      triggerHaptic('success');
      setOrbs(prev => prev.map(o => 
        o.id === orb.id ? { ...o, tapped: true } : o
      ));
      setCurrentOrder(prev => prev + 1);
      setScore(prev => prev + 1);
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      setPerfectStreak(s => s + 1);
      setLastTapResult({ id: orb.id, success: true });

      setTimeout(() => setLastTapResult(null), 400);

      // Check if round complete (currentOrder was just incremented, so check new value)
      if (currentOrder + 1 === orbsPerRound) {
        const newRound = round + 1;
        
        if (newRound > maxRounds) {
          // Game complete
          setGameState('complete');
          const totalOrbs = maxRounds * orbsPerRound;
          // score was already incremented above, so use score + 1 (the new value)
          const baseAccuracy = Math.round((score + 1) / totalOrbs * 100);
          const comboBonus = Math.min(maxCombo * 3, 15);
          const accuracy = Math.min(100, baseAccuracy + comboBonus);
          
          onComplete({
            success: accuracy >= 50,
            accuracy,
            result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail'
          });
        } else {
          // Next round
          setTimeout(() => {
            setRound(newRound);
            setCurrentOrder(1);
            setGameState('showing');
            setHighlightIndex(0);
            generateOrbs();
          }, 600);
        }
      }
    } else {
      // Wrong tap!
      triggerHaptic('error');
      setMistakes(prev => prev + 1);
      setCombo(0);
      setPerfectStreak(0);
      setShake(true);
      setLastTapResult({ id: orb.id, success: false });
      
      setTimeout(() => {
        setShake(false);
        setLastTapResult(null);
      }, 400);
    }
  }, [gameState, currentOrder, orbsPerRound, round, score, combo, maxCombo, generateOrbs, onComplete]);

  const getRoundProgressText = useCallback(() => {
    if (gameState === 'showing') return `Watch the sequence...`;
    if (gameState === 'playing') return `Tap orb ${currentOrder} of ${orbsPerRound}`;
    return '';
  }, [gameState, currentOrder, orbsPerRound]);

  return (
    <div className={`flex flex-col items-center relative ${shake ? 'animate-shake' : ''}`}>
      {/* Countdown Overlay */}
      {gameState === 'countdown' && (
        <CountdownOverlay count={3} onComplete={handleCountdownComplete} />
      )}

      {/* Pause Overlay */}
      <AnimatePresence>
        {gameState === 'paused' && (
          <PauseOverlay onResume={() => setGameState('playing')} />
        )}
      </AnimatePresence>

      {/* Game HUD */}
      <GameHUD
        title="Cosmic Tap Sequence"
        subtitle={getRoundProgressText()}
        score={score}
        maxScore={maxRounds * orbsPerRound}
        combo={combo}
        showCombo={true}
        phase={round - 1}
        totalPhases={maxRounds}
        primaryStat={{ value: mistakes, label: 'Mistakes', color: 'hsl(0, 84%, 60%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Perfect streak indicator */}
      <AnimatePresence>
        {perfectStreak >= 3 && gameState === 'playing' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-2 px-4 py-1 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-full border border-yellow-500/50"
          >
            <span className="text-sm font-bold text-yellow-400">🔥 {perfectStreak} Perfect Streak!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game area */}
      <div className="relative w-full aspect-square max-w-xs bg-gradient-to-br from-muted/20 to-background rounded-2xl border border-border/50 overflow-hidden shadow-inner">
        {/* Cosmic background effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        
        {/* Animated star particles - memoized with CSS */}
        <StarBackground stars={stars} />

        {/* Connection lines between orbs during sequence show */}
        {gameState === 'showing' && <ConnectionLines orbs={orbs} highlightIndex={highlightIndex} />}
        
        {/* Orbs - using memoized component */}
        <AnimatePresence>
          {orbs.map((orb) => {
            const isHighlighted = gameState === 'showing' && highlightIndex === orb.order;
            const isPast = gameState === 'showing' && highlightIndex > orb.order;
            const isNext = gameState === 'playing' && orb.order === currentOrder && !orb.tapped;
            const tapResult = lastTapResult?.id === orb.id ? lastTapResult : null;
            
            return (
              <OrbComponent
                key={orb.id}
                orb={orb}
                isHighlighted={isHighlighted}
                isPast={isPast}
                isNext={isNext}
                showNumber={gameState === 'showing' || orb.tapped}
                tapResult={tapResult}
                onClick={() => handleOrbTap(orb)}
                disabled={gameState === 'showing' || orb.tapped}
              />
            );
          })}
        </AnimatePresence>

        {/* Round complete overlay */}
        <AnimatePresence>
          {gameState === 'playing' && currentOrder > orbsPerRound && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 flex items-center justify-center z-30"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <span className="text-4xl">🎉</span>
                <p className="text-lg font-bold text-foreground mt-2">Round Complete!</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Instructions */}
      <motion.p 
        className="mt-4 text-sm text-muted-foreground text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {gameState === 'showing' 
          ? '👀 Watch carefully...' 
          : gameState === 'playing' 
            ? '👆 Tap the orbs in order!' 
            : ''}
      </motion.p>

      {/* Mind stat bonus */}
      <p className="mt-2 text-xs text-muted-foreground">
        Mind stat bonus: +{Math.round(mindBonus * 400)}ms display time
      </p>

      {/* CSS animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.5); }
          50% { opacity: 0.8; transform: scale(1); }
        }
        .pulse-ring {
          animation: pulse-expand 1s ease-out infinite;
        }
        @keyframes pulse-expand {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .will-animate {
          will-change: transform, opacity;
        }
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
};
