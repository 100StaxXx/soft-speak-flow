import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useStaticStars, getGridPositions } from './gameUtils';

interface TapSequenceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number; // Override timer for practice mode
  isPractice?: boolean;
}

interface Orb {
  id: number;
  x: number;
  y: number;
  order: number;
  tapped: boolean;
  isDecoy?: boolean;
}

// Difficulty configurations
const DIFFICULTY_CONFIG = {
  easy: {
    baseOrbs: 5,
    rounds: 3,
    displayTime: 550,
    timeLimit: 15,
    hideNumbersAfter: null, // never hide
    decoyCount: 0,
    shrinkRate: 0.02, // slow
    progressiveOrbIncrease: 0, // no increase
    displayTimeDecrease: 30, // ms per round
  },
  medium: {
    baseOrbs: 6,
    rounds: 4,
    displayTime: 450,
    timeLimit: 12,
    hideNumbersAfter: 2000, // hide after 2 seconds
    decoyCount: 0,
    shrinkRate: 0.03, // medium
    progressiveOrbIncrease: 1, // +1 from round 3
    displayTimeDecrease: 40,
  },
  hard: {
    baseOrbs: 8,
    rounds: 5,
    displayTime: 350,
    timeLimit: 10,
    hideNumbersAfter: 0, // hide immediately
    decoyCount: 3,
    shrinkRate: 0.04, // fast
    progressiveOrbIncrease: 1, // +1 from round 3
    displayTimeDecrease: 50,
  },
};

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
  shrinkScale: number;
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
  disabled,
  shrinkScale = 1
}: OrbComponentProps) => {
  const getOrbStyle = useMemo(() => {
    if (orb.isDecoy) return {
      bg: 'linear-gradient(135deg, rgba(100,100,100,0.3), rgba(60,60,60,0.2))',
      border: 'rgba(150,150,150,0.3)',
      shadow: '0 4px 12px rgba(0,0,0,0.3)',
    };
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
  }, [orb.tapped, orb.isDecoy, isHighlighted, isPast, isNext]);

  const baseSize = 56; // 14 * 4 = 56px (w-14 h-14)
  const actualSize = baseSize * shrinkScale;

  return (
    <motion.button
      className="absolute rounded-full flex items-center justify-center font-bold gpu-accelerated touch-target"
      style={{
        left: `${orb.x}%`,
        top: `${orb.y}%`,
        transform: 'translate(-50%, -50%)',
        width: actualSize,
        height: actualSize,
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
        className={`text-lg ${isHighlighted || orb.tapped ? 'text-white' : orb.isDecoy ? 'text-white/40' : 'text-white/70'}`}
        style={{ 
          textShadow: isHighlighted ? '0 0 10px white' : 'none',
          fontWeight: isHighlighted ? 800 : 600,
          fontSize: `${Math.max(12, 18 * shrinkScale)}px`,
        }}
      >
        {orb.isDecoy ? '?' : showNumber ? orb.order : '?'}
      </span>

      {/* Pulse ring for next orb */}
      {isNext && !orb.isDecoy && (
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
  
  // Filter out decoys for connection lines
  const sequenceOrbs = orbs.filter(o => !o.isDecoy);
  
  return (
    <svg className="absolute inset-0 pointer-events-none z-0" width="100%" height="100%">
      {sequenceOrbs.slice(0, highlightIndex).map((orb, i) => {
        if (i === 0) return null;
        const prevOrb = sequenceOrbs[i - 1];
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

// Timer bar component
const TimerBar = memo(({ timeRemaining, totalTime }: { timeRemaining: number; totalTime: number }) => {
  const percentage = (timeRemaining / totalTime) * 100;
  const isLow = percentage < 30;
  const isCritical = percentage < 15;
  
  return (
    <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden mb-2">
      <motion.div
        className={`h-full rounded-full ${
          isCritical ? 'bg-red-500' : isLow ? 'bg-yellow-500' : 'bg-primary'
        }`}
        initial={{ width: '100%' }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.1 }}
      />
    </div>
  );
});
TimerBar.displayName = 'TimerBar';

export const TapSequenceGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
  maxTimer,
  isPractice = false,
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
  const [showNumbers, setShowNumbers] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [shrinkScale, setShrinkScale] = useState(1);
  const [perfectRounds, setPerfectRounds] = useState(0);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const shrinkRef = useRef<NodeJS.Timeout | null>(null);
  const playStartTimeRef = useRef<number>(0);

  const config = DIFFICULTY_CONFIG[difficulty];
  // For practice mode, limit to 1 round and use maxTimer if provided
  const effectiveRounds = isPractice ? 1 : config.rounds;
  const effectiveTimeLimit = maxTimer ?? config.timeLimit;
  
  // Calculate orbs for current round with progressive increase
  const getOrbsForRound = useCallback((roundNum: number) => {
    const baseOrbs = config.baseOrbs;
    const extraOrbs = roundNum >= 3 ? config.progressiveOrbIncrease : 0;
    return Math.round((baseOrbs + extraOrbs) * (1 + questIntervalScale * 0.2));
  }, [config.baseOrbs, config.progressiveOrbIncrease, questIntervalScale]);
  
  const orbsPerRound = getOrbsForRound(round);
  const maxRounds = config.rounds;
  
  // Calculate display time with progressive decrease
  const getDisplayTimeForRound = useCallback((roundNum: number) => {
    const mindBonus = Math.min(companionStats.mind / 100, 1);
    const baseTime = config.displayTime + (mindBonus * 200);
    const decrease = (roundNum - 1) * config.displayTimeDecrease;
    return Math.max(200, baseTime - decrease) * (1 - questIntervalScale * 0.2);
  }, [config.displayTime, config.displayTimeDecrease, companionStats.mind, questIntervalScale]);
  
  const displayTime = getDisplayTimeForRound(round);
  const timeLimit = config.timeLimit;

  // Static stars - memoized
  const stars = useStaticStars(10);

  // Generate orbs with decoys for hard mode
  const generateOrbs = useCallback(() => {
    const totalOrbs = orbsPerRound + config.decoyCount;
    const positions = getGridPositions(totalOrbs, 12, 75);
    
    const newOrbs: Orb[] = positions.map((pos, i) => ({
      id: i,
      x: pos.x,
      y: pos.y,
      order: i < orbsPerRound ? i + 1 : 0,
      tapped: false,
      isDecoy: i >= orbsPerRound,
    }));
    
    // Shuffle positions so decoys aren't always at the end
    const shuffled = [...newOrbs].sort(() => Math.random() - 0.5);
    setOrbs(shuffled);
  }, [orbsPerRound, config.decoyCount]);

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

    // Only highlight non-decoy orbs
    const sequenceOrbs = orbs.filter(o => !o.isDecoy);
    
    const timer = setTimeout(() => {
      if (highlightIndex < sequenceOrbs.length) {
        triggerHaptic('light');
        setHighlightIndex(prev => prev + 1);
      } else {
        // Start play phase
        setGameState('playing');
        setHighlightIndex(0);
        setTimeRemaining(timeLimit);
        setShrinkScale(1);
        playStartTimeRef.current = Date.now();
        
        // Handle number hiding for medium/hard
        if (config.hideNumbersAfter !== null) {
          if (config.hideNumbersAfter === 0) {
            setShowNumbers(false);
          } else {
            setTimeout(() => setShowNumbers(false), config.hideNumbersAfter);
          }
        } else {
          setShowNumbers(true);
        }
      }
    }, displayTime);

    return () => clearTimeout(timer);
  }, [gameState, highlightIndex, orbs, displayTime, timeLimit, config.hideNumbersAfter]);

  const finishGame = useCallback(() => {
    const totalSequenceOrbs = Array.from({ length: effectiveRounds }, (_, i) => getOrbsForRound(i + 1))
      .reduce((sum, count) => sum + count, 0);
    
    // Base accuracy from correct taps
    const baseAccuracy = Math.round((score / totalSequenceOrbs) * 100);
    
    // Combo bonus (up to 20%)
    const comboBonus = Math.min(maxCombo * 2, 20);
    
    // Perfect round bonus (5% per perfect round)
    const perfectBonus = perfectRounds * 5;
    
    // Time bonus (average time remaining across rounds)
    const timeBonus = Math.round((timeRemaining / timeLimit) * 10);
    
    // Mistake penalty
    const mistakePenalty = Math.min(mistakes * 3, 30);
    
    const finalAccuracy = Math.min(100, Math.max(0, baseAccuracy + comboBonus + perfectBonus + timeBonus - mistakePenalty));
    
    onComplete({
      success: finalAccuracy >= 50,
      accuracy: finalAccuracy,
      result: finalAccuracy >= 90 ? 'perfect' : finalAccuracy >= 70 ? 'good' : finalAccuracy >= 50 ? 'partial' : 'fail'
    });
  }, [score, effectiveRounds, getOrbsForRound, maxCombo, perfectRounds, timeRemaining, timeLimit, mistakes, onComplete]);

  // Timer countdown during play phase
  useEffect(() => {
    if (gameState !== 'playing') {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 0.1) {
          // Time's up! Round failed
          triggerHaptic('error');
          setMistakes(m => m + orbsPerRound - currentOrder + 1);
          
          const newRound = round + 1;
          if (newRound > effectiveRounds) {
            setGameState('complete');
            finishGame();
          } else {
            setTimeout(() => {
              setRound(newRound);
              setCurrentOrder(1);
              setGameState('showing');
              setHighlightIndex(0);
              setShowNumbers(true);
              generateOrbs();
            }, 800);
          }
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState, round, effectiveRounds, orbsPerRound, currentOrder, generateOrbs, finishGame]);

  // Shrinking orbs during play phase
  useEffect(() => {
    if (gameState !== 'playing') {
      if (shrinkRef.current) clearInterval(shrinkRef.current);
      setShrinkScale(1);
      return;
    }

    shrinkRef.current = setInterval(() => {
      setShrinkScale(prev => Math.max(0.65, prev - config.shrinkRate));
    }, 500);

    return () => {
      if (shrinkRef.current) clearInterval(shrinkRef.current);
    };
  }, [gameState, config.shrinkRate]);

  const handleOrbTap = useCallback((orb: Orb) => {
    if (gameState !== 'playing' || orb.tapped) return;

    // Tapping a decoy is a mistake
    if (orb.isDecoy) {
      triggerHaptic('error');
      setMistakes(prev => prev + 1);
      setCombo(0);
      setPerfectStreak(0);
      setShake(true);
      setLastTapResult({ id: orb.id, success: false });
      // Penalize time for decoy tap
      setTimeRemaining(prev => Math.max(0, prev - 1));
      
      setTimeout(() => {
        setShake(false);
        setLastTapResult(null);
      }, 400);
      return;
    }

    if (orb.order === currentOrder) {
      // Correct tap!
      triggerHaptic('success');
      setOrbs(prev => prev.map(o => 
        o.id === orb.id ? { ...o, tapped: true } : o
      ));
      setCurrentOrder(prev => prev + 1);
      
      // Score with time bonus
      const timeBonus = Math.ceil(timeRemaining);
      setScore(prev => prev + 10 + timeBonus);
      
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
        // Check if this was a perfect round (no mistakes this round)
        const roundMistakes = mistakes;
        if (roundMistakes === 0) {
          setPerfectRounds(p => p + 1);
        }
        
        const newRound = round + 1;
        
        if (newRound > effectiveRounds) {
          // Game complete
          setGameState('complete');
          const totalSequenceOrbs = Array.from({ length: effectiveRounds }, (_, i) => getOrbsForRound(i + 1))
            .reduce((sum, count) => sum + count, 0);
          
          const baseAccuracy = Math.round(((score + 10 + Math.ceil(timeRemaining)) / (totalSequenceOrbs * 20)) * 100);
          const comboBonus = Math.min(maxCombo * 2, 20);
          const perfectBonus = (roundMistakes === 0 ? perfectRounds + 1 : perfectRounds) * 5;
          const mistakePenalty = Math.min(mistakes * 3, 30);
          const finalAccuracy = Math.min(100, Math.max(0, baseAccuracy + comboBonus + perfectBonus - mistakePenalty));
          
          onComplete({
            success: finalAccuracy >= 50,
            accuracy: finalAccuracy,
            result: finalAccuracy >= 90 ? 'perfect' : finalAccuracy >= 70 ? 'good' : finalAccuracy >= 50 ? 'partial' : 'fail'
          });
        } else {
          // Next round
          setTimeout(() => {
            setRound(newRound);
            setCurrentOrder(1);
            setGameState('showing');
            setHighlightIndex(0);
            setShowNumbers(true);
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
      // Time penalty for wrong tap
      setTimeRemaining(prev => Math.max(0, prev - 0.5));
      
      setTimeout(() => {
        setShake(false);
        setLastTapResult(null);
      }, 400);
    }
  }, [gameState, currentOrder, orbsPerRound, round, score, maxCombo, mistakes, perfectRounds, effectiveRounds, timeRemaining, generateOrbs, onComplete, getOrbsForRound]);

  const getRoundProgressText = useCallback(() => {
    if (gameState === 'showing') return `Watch the sequence...`;
    if (gameState === 'playing') return `Tap orb ${currentOrder} of ${orbsPerRound}`;
    return '';
  }, [gameState, currentOrder, orbsPerRound]);

  // Determine which orb is highlighted during showing phase
  const getHighlightedOrbOrder = useCallback(() => {
    const sequenceOrbs = orbs.filter(o => !o.isDecoy);
    if (highlightIndex > 0 && highlightIndex <= sequenceOrbs.length) {
      return highlightIndex;
    }
    return 0;
  }, [orbs, highlightIndex]);

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
        maxScore={maxRounds * 200}
        combo={combo}
        showCombo={true}
        phase={round - 1}
        totalPhases={maxRounds}
        primaryStat={{ value: mistakes, label: 'Mistakes', color: 'hsl(0, 84%, 60%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Timer bar during play phase */}
      {gameState === 'playing' && (
        <div className="w-full max-w-xs mb-2">
          <TimerBar timeRemaining={timeRemaining} totalTime={timeLimit} />
        </div>
      )}

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

      {/* Difficulty indicator */}
      <div className="mb-2 flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
          difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {difficulty.toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground">Round {round}/{effectiveRounds}</span>
      </div>

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
            const highlightedOrder = getHighlightedOrbOrder();
            const isHighlighted = gameState === 'showing' && !orb.isDecoy && orb.order === highlightedOrder;
            const isPast = gameState === 'showing' && !orb.isDecoy && orb.order < highlightedOrder;
            const isNext = gameState === 'playing' && orb.order === currentOrder && !orb.tapped && !orb.isDecoy;
            const tapResult = lastTapResult?.id === orb.id ? lastTapResult : null;
            
            // Show numbers logic
            const shouldShowNumber = orb.isDecoy ? false : (gameState === 'showing' || orb.tapped || showNumbers);
            
            return (
              <OrbComponent
                key={orb.id}
                orb={orb}
                isHighlighted={isHighlighted}
                isPast={isPast}
                isNext={isNext}
                showNumber={shouldShowNumber}
                tapResult={tapResult}
                onClick={() => handleOrbTap(orb)}
                disabled={gameState === 'showing' || orb.tapped}
                shrinkScale={gameState === 'playing' ? shrinkScale : 1}
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

        {/* Time's up overlay */}
        <AnimatePresence>
          {gameState === 'playing' && timeRemaining <= 0 && (
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
                <span className="text-5xl">⏰</span>
                <p className="text-lg font-bold text-red-400 mt-3">Time's Up!</p>
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
            ? config.decoyCount > 0 
              ? '👆 Tap in order! Avoid the decoys (?)' 
              : '👆 Tap the orbs in order!' 
            : ''}
      </motion.p>

      {/* Game info */}
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span>Mind bonus: +{Math.round((Math.min(companionStats.mind / 100, 1)) * 200)}ms</span>
        {config.hideNumbersAfter !== null && (
          <span className="text-yellow-400">
            {config.hideNumbersAfter === 0 ? 'Numbers hidden!' : `Numbers hide after ${config.hideNumbersAfter / 1000}s`}
          </span>
        )}
      </div>

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
