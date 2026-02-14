import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useStaticStars, getGridPositions } from './gameUtils';

import { DamageEvent, GAME_DAMAGE_VALUES } from '@/types/battleSystem';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';

interface TapSequenceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  tierAttackDamage?: number;
  difficulty?: ArcadeDifficulty;
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
  compact?: boolean;
}

// Difficulty config for orb adjustment and show time
const DIFFICULTY_CONFIG: Record<ArcadeDifficulty, { orbModifier: number; showTimeBonus: number; startLives: number }> = {
  beginner: { orbModifier: -2, showTimeBonus: 200, startLives: 5 },
  easy: { orbModifier: -1, showTimeBonus: 100, startLives: 4 },
  medium: { orbModifier: 0, showTimeBonus: 0, startLives: 3 },
  hard: { orbModifier: 1, showTimeBonus: -50, startLives: 3 },
  master: { orbModifier: 2, showTimeBonus: -100, startLives: 2 },
};

interface Orb {
  id: number;
  x: number;
  y: number;
  order: number;
  tapped: boolean;
}

// Progressive difficulty by level - no limit on orbs
const getLevelConfig = (level: number) => {
  if (level <= 2) return { orbs: 4, showTimePerOrb: 600 };
  if (level <= 4) return { orbs: 5, showTimePerOrb: 500 };
  if (level <= 6) return { orbs: 6, showTimePerOrb: 450 };
  if (level <= 8) return { orbs: 7, showTimePerOrb: 400 };
  // Beyond level 8: +1 orb every 2 levels, minimum 300ms show time
  const extraOrbs = Math.floor((level - 8) / 2);
  const orbs = 8 + extraOrbs;
  const showTimePerOrb = Math.max(300, 350 - (extraOrbs * 10));
  return { orbs, showTimePerOrb };
};

// Memoized star background component
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

// Memoized Orb component
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
  disabled,
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
      className="absolute rounded-full flex items-center justify-center font-bold gpu-accelerated touch-target w-14 h-14"
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
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-white"
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
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

// Connection lines during showing phase
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

// Lives display component - compact sizing
const LivesDisplay = memo(({ lives, maxLives = 3 }: { lives: number; maxLives?: number }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: maxLives }).map((_, i) => (
      <motion.div
        key={i}
        initial={false}
        animate={{ 
          scale: i < lives ? 1 : 0.8,
          opacity: i < lives ? 1 : 0.3 
        }}
        transition={{ type: 'spring', stiffness: 400 }}
      >
        <Heart 
          className={`w-4 h-4 ${i < lives ? 'fill-red-500 text-red-500' : 'fill-gray-600 text-gray-600'}`}
        />
      </motion.div>
    ))}
  </div>
));
LivesDisplay.displayName = 'LivesDisplay';

export const TapSequenceGame = ({ 
  companionStats, 
  onComplete,
  onDamage,
  tierAttackDamage = 15,
  difficulty = 'medium',
  isPractice = false,
  compact = false,
}: TapSequenceGameProps) => {
  const diffConfig = DIFFICULTY_CONFIG[difficulty];
  const [gameState, setGameState] = useState<'countdown' | 'showing' | 'playing' | 'paused' | 'complete' | 'reshowing'>('countdown');
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [currentOrder, setCurrentOrder] = useState(1);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [level, setLevel] = useState(1);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(diffConfig.startLives);
  const [shake, setShake] = useState(false);
  const [lastTapResult, setLastTapResult] = useState<{ id: number; success: boolean } | null>(null);
  const [attemptsThisLevel, setAttemptsThisLevel] = useState(0);
  const [totalCorrectTaps, setTotalCorrectTaps] = useState(0);
  const [totalTaps, setTotalTaps] = useState(0);
  const [levelMessage, setLevelMessage] = useState<string | null>(null);
  const [mistakesThisLevel, setMistakesThisLevel] = useState(0);

  // Get config based on current level and difficulty
  const levelConfig = getLevelConfig(level);
  const orbCount = Math.max(3, levelConfig.orbs + diffConfig.orbModifier);
  const showTimePerOrb = levelConfig.showTimePerOrb + diffConfig.showTimeBonus + (companionStats.mind / 100 * 150);

  const stars = useStaticStars(10);

  // Generate orbs for current level
  const generateOrbs = useCallback(() => {
    const positions = getGridPositions(orbCount, 12, 75);
    const shuffledPositions = [...positions].sort(() => Math.random() - 0.5);
    
    const newOrbs: Orb[] = shuffledPositions.map((pos, i) => ({
      id: i,
      x: pos.x,
      y: pos.y,
      order: i + 1,
      tapped: false,
    }));
    
    // Shuffle order assignment for unpredictability
    const orders = Array.from({ length: orbCount }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    newOrbs.forEach((orb, i) => {
      orb.order = orders[i];
    });
    
    setOrbs(newOrbs);
  }, [orbCount]);

  // Initialize game
  useEffect(() => {
    generateOrbs();
  }, [generateOrbs]);

  const handleCountdownComplete = useCallback(() => {
    setGameState('showing');
    setHighlightIndex(0);
  }, []);

  // Show sequence animation
  useEffect(() => {
    if (gameState !== 'showing' && gameState !== 'reshowing') return;
    if (orbs.length === 0) return;

    const sortedOrbs = [...orbs].sort((a, b) => a.order - b.order);
    
    const timer = setTimeout(() => {
      if (highlightIndex < sortedOrbs.length) {
        triggerHaptic('light');
        setHighlightIndex(prev => prev + 1);
      } else {
        // Start play phase
        setGameState('playing');
        setHighlightIndex(0);
      }
    }, showTimePerOrb);

    return () => clearTimeout(timer);
  }, [gameState, highlightIndex, orbs, showTimePerOrb]);

  // Complete game with XP cap
  const finishGame = useCallback((won: boolean) => {
    setGameState('complete');
    
    const accuracy = totalTaps > 0 ? Math.round((totalCorrectTaps / totalTaps) * 100) : 0;
    const levelBonus = Math.min(level * 5, 50);
    // Cap accuracy to prevent XP exploit from endless levels
    const finalAccuracy = Math.min(100, accuracy + levelBonus);
    
    onComplete({
      success: won,
      accuracy: Math.min(finalAccuracy, 100),
      result: won ? (finalAccuracy >= 90 ? 'perfect' : 'good') : 'fail',
      highScoreValue: level,
      gameStats: {
        level,
        score,
      },
    });
  }, [level, totalCorrectTaps, totalTaps, onComplete, score]);

  // Handle orb tap
  const handleOrbTap = useCallback((orb: Orb) => {
    if (gameState !== 'playing' || orb.tapped) return;

    setTotalTaps(prev => prev + 1);

    if (orb.order === currentOrder) {
      // Correct tap!
      triggerHaptic('success');
      setOrbs(prev => prev.map(o => 
        o.id === orb.id ? { ...o, tapped: true } : o
      ));
      setCurrentOrder(prev => prev + 1);
      setTotalCorrectTaps(prev => prev + 1);
      
      // Score based on level and attempts (no per-tap damage anymore)
      const attemptMultiplier = attemptsThisLevel === 0 ? 2 : 1;
      setScore(prev => prev + (10 * level) * attemptMultiplier);
      
      setLastTapResult({ id: orb.id, success: true });
      setTimeout(() => setLastTapResult(null), 400);

      // Check if level complete
      if (currentOrder === orbCount) {
        const perfectLevel = mistakesThisLevel === 0;
        setLevelMessage(perfectLevel ? '⭐ Perfect!' : '✓ Level Complete!');
        
        // MILESTONE DAMAGE: Deal damage only on level complete
        const damageAmount = perfectLevel 
          ? (GAME_DAMAGE_VALUES.tap_sequence.perfectLevel as number)
          : (GAME_DAMAGE_VALUES.tap_sequence.levelComplete as number);
        onDamage?.({ target: 'adversary', amount: damageAmount, source: perfectLevel ? 'perfect_level' : 'level_complete' });
        
        // Next level after brief delay
        setTimeout(() => {
          setLevelMessage(null);
          
          // In practice mode, end after completing 2 levels
          if (isPractice && level >= 2) {
            finishGame(true);
            return;
          }
          
          setLevel(prev => prev + 1);
          setCurrentOrder(1);
          setAttemptsThisLevel(0);
          setMistakesThisLevel(0);
          setGameState('showing');
          setHighlightIndex(0);
          generateOrbs();
        }, 1000);
      }
    } else {
      // Wrong tap!
      triggerHaptic('error');
      setMistakesThisLevel(prev => prev + 1);
      
      // Player takes damage from adversary attack
      onDamage?.({ target: 'player', amount: tierAttackDamage, source: 'wrong_tap' });
      
      setLives(prev => {
        const newLives = prev - 1;
        if (newLives <= 0) {
          // Game over
          setTimeout(() => finishGame(false), 500);
        } else {
          // Re-show sequence
          setAttemptsThisLevel(prev => prev + 1);
          setCurrentOrder(1);
          setOrbs(prev => prev.map(o => ({ ...o, tapped: false })));
          setLevelMessage('❌ Wrong! Watch again...');
          
          setTimeout(() => {
            setLevelMessage(null);
            setGameState('reshowing');
            setHighlightIndex(0);
          }, 1000);
        }
        return newLives;
      });
      
      setShake(true);
      setLastTapResult({ id: orb.id, success: false });
      setTimeout(() => {
        setShake(false);
        setLastTapResult(null);
      }, 400);
    }
  }, [gameState, currentOrder, orbCount, level, attemptsThisLevel, mistakesThisLevel, generateOrbs, finishGame, onDamage, tierAttackDamage, isPractice]);

  const getHighlightedOrbOrder = useCallback(() => {
    const sortedOrbs = [...orbs].sort((a, b) => a.order - b.order);
    if (highlightIndex > 0 && highlightIndex <= sortedOrbs.length) {
      return sortedOrbs[highlightIndex - 1].order;
    }
    return 0;
  }, [orbs, highlightIndex]);

  const getProgressText = useCallback(() => {
    if (gameState === 'showing' || gameState === 'reshowing') return 'Watch the sequence...';
    if (gameState === 'playing') return `Tap orb ${currentOrder} of ${orbCount}`;
    return '';
  }, [gameState, currentOrder, orbCount]);

  return (
    <div className={`flex flex-col items-center relative flex-1 min-h-0 ${shake ? 'animate-shake' : ''}`}>
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
        title="Memory Sequence"
        subtitle={getProgressText()}
        score={score}
        maxScore={level * 200}
        showCombo={false}
        phase={level - 1}
        totalPhases={10}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
        compact={compact}
      />

      {/* Lives and Level display - compact */}
      {!compact && (
        <div className="w-full max-w-[280px] mb-1 flex items-center justify-between">
          <LivesDisplay lives={lives} />
          <motion.div 
            key={level}
            initial={{ scale: 1.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="px-2 py-0.5 bg-primary/20 rounded-full border border-primary/40"
          >
            <span className="text-xs font-bold text-primary">Level {level}</span>
          </motion.div>
        </div>
      )}
      {compact && (
        <div className="w-full max-w-[280px] mb-0.5 flex items-center justify-between text-xs">
          <LivesDisplay lives={lives} />
          <span className="font-bold text-primary text-[10px]">Lv{level}</span>
          <span className="text-muted-foreground text-[10px]">{orbCount} orbs</span>
        </div>
      )}

      {/* Difficulty indicator - hidden in compact */}
      {!compact && (
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            difficulty === 'beginner' ? 'bg-blue-500/20 text-blue-400' :
            difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
            difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
            difficulty === 'hard' ? 'bg-orange-500/20 text-orange-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            {difficulty.toUpperCase()}
          </span>
          <span className="text-[10px] text-muted-foreground">{orbCount} orbs</span>
        </div>
      )}

      {/* Game area */}
      <div 
        className="relative w-full aspect-square max-w-[280px] rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(0,0,0,0.85) 0%, rgba(15,15,35,0.95) 50%, rgba(25,15,45,0.9) 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/6 rounded-full blur-3xl" />
        </div>
        
        <StarBackground stars={stars} />

        {/* Connection lines during showing */}
        {(gameState === 'showing' || gameState === 'reshowing') && (
          <ConnectionLines orbs={[...orbs].sort((a, b) => a.order - b.order)} highlightIndex={highlightIndex} />
        )}
        
        {/* Orbs */}
        <AnimatePresence>
          {orbs.map((orb) => {
            const highlightedOrder = getHighlightedOrbOrder();
            const isHighlighted = (gameState === 'showing' || gameState === 'reshowing') && orb.order === highlightedOrder;
            const isPast = (gameState === 'showing' || gameState === 'reshowing') && orb.order < highlightedOrder;
            // Don't show indicator during playing - it's a memory game!
            const isNext = false;
            const tapResult = lastTapResult?.id === orb.id ? lastTapResult : null;
            
            // Show numbers during sequence display, hide during input
            const shouldShowNumber = gameState === 'showing' || gameState === 'reshowing' || orb.tapped;
            
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
                disabled={gameState !== 'playing' || orb.tapped}
              />
            );
          })}
        </AnimatePresence>

        {/* Level message overlay */}
        <AnimatePresence>
          {levelMessage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center z-30"
              style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <p className="text-2xl font-bold text-white">{levelMessage}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game over overlay */}
        <AnimatePresence>
          {lives <= 0 && gameState !== 'complete' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex items-center justify-center z-30"
              style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-center"
              >
                <span className="text-5xl">💔</span>
                <p className="text-xl font-bold text-white mt-3">Game Over!</p>
                <p className="text-lg text-primary mt-1">Reached Level {level}</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Instructions - hidden in compact mode */}
      {!compact && (
        <motion.p 
          className="mt-2 text-xs text-muted-foreground text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {gameState === 'showing' || gameState === 'reshowing'
            ? '👀 Memorize the sequence...' 
            : gameState === 'playing' 
              ? '👆 Tap the orbs in order!' 
              : ''}
        </motion.p>
      )}

      {/* Game info - hidden in compact mode */}
      {!compact && (
        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span>{diffConfig.startLives} lives • Endless</span>
          <span className="text-primary">No time limit</span>
        </div>
      )}

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
