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

// Premium Orb component with refined visuals
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
  const getOrbStyle = useMemo(() => {
    if (orb.tapped) return {
      bg: 'linear-gradient(135deg, #22c55e, #16a34a)',
      border: 'rgba(34,197,94,0.6)',
      shadow: '0 0 25px rgba(34,197,94,0.5), inset 0 2px 4px rgba(255,255,255,0.2)',
    };
    if (isHighlighted) return {
      bg: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
      border: 'rgba(255,255,255,0.4)',
      shadow: '0 0 35px hsl(var(--primary)), 0 0 60px hsl(var(--primary)/0.4), inset 0 2px 4px rgba(255,255,255,0.3)',
    };
    if (isPast) return {
      bg: 'linear-gradient(135deg, hsl(var(--primary)/0.5), hsl(var(--accent)/0.5))',
      border: 'rgba(255,255,255,0.2)',
      shadow: '0 4px 15px rgba(0,0,0,0.3)',
    };
    if (isNext) return {
      bg: 'linear-gradient(135deg, hsl(var(--primary)/0.4), hsl(var(--accent)/0.4))',
      border: 'hsl(var(--primary)/0.6)',
      shadow: '0 0 20px hsl(var(--primary)/0.4), inset 0 2px 4px rgba(255,255,255,0.15)',
    };
    return {
      bg: 'linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
      border: 'rgba(255,255,255,0.1)',
      shadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)',
    };
  }, [orb.tapped, isHighlighted, isPast, isNext]);

  return (
    <motion.button
      className="absolute w-14 h-14 rounded-full flex items-center justify-center font-bold gpu-accelerated touch-target"
      style={{
        left: `${orb.x}%`,
        top: `${orb.y}%`,
        transform: 'translate(-50%, -50%)',
        background: getOrbStyle.bg,
        border: `2px solid ${getOrbStyle.border}`,
        boxShadow: getOrbStyle.shadow,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isHighlighted ? 1.25 : 1, 
        opacity: 1,
      }}
      exit={{ scale: 0, opacity: 0 }}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Number with glow */}
      <span 
        className={`text-lg ${isHighlighted || orb.tapped ? 'text-white' : 'text-white/70'}`}
        style={{ 
          textShadow: isHighlighted ? '0 0 10px white' : 'none',
          fontWeight: isHighlighted ? 800 : 600,
        }}
      >
        {showNumber ? orb.order : '?'}
      </span>

      {/* Pulse ring for next orb */}
      {isNext && (
        <motion.div 
          className="absolute inset-[-3px] rounded-full"
          style={{ border: '2px solid hsl(var(--primary))' }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        />
      )}

      {/* Expanding rings for highlighted orb */}
      {isHighlighted && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-white"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 2, opacity: 0 }}
            transition={{ duration: 0.8, repeat: Infinity }}
          />
        </>
      )}

      {/* Tap result feedback */}
      {tapResult && (
        <motion.div
          className="absolute inset-0 rounded-full flex items-center justify-center"
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 2.5, opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-2xl">{tapResult.success ? '✨' : '❌'}</span>
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

      // Check if round complete
      if (currentOrder === orbsPerRound) {
        const newRound = round + 1;
        
        if (newRound > maxRounds) {
          // Game complete
          setGameState('complete');
          const totalOrbs = maxRounds * orbsPerRound;
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

      {/* Premium game area */}
      <div 
        className="relative w-full aspect-square max-w-xs rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(0,0,0,0.85) 0%, rgba(15,15,35,0.95) 50%, rgba(25,15,45,0.9) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Nebula background effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/6 rounded-full blur-3xl" />
        </div>
        
        {/* Star particles */}
        <StarBackground stars={stars} />

        {/* Connection lines */}
        {gameState === 'showing' && <ConnectionLines orbs={orbs} highlightIndex={highlightIndex} />}
        
        {/* Orbs */}
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
              className="absolute inset-0 flex items-center justify-center z-30"
              style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <span className="text-5xl">🎉</span>
                <p className="text-lg font-bold text-white mt-3">Round Complete!</p>
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
          10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
          20%, 40%, 60%, 80% { transform: translateX(3px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.6); }
          50% { opacity: 0.7; transform: scale(1); }
        }
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
          will-change: transform, opacity;
        }
        .touch-target {
          min-height: 44px;
          min-width: 44px;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
};
