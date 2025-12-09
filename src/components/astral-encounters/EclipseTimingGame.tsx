import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useGameLoop, useStaticStars } from './gameUtils';

interface EclipseTimingGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

// Memoized static background stars
const StarBackground = memo(({ stars }: { stars: ReturnType<typeof useStaticStars> }) => (
  <div className="absolute inset-0 overflow-hidden">
    {stars.map(star => (
      <div
        key={star.id}
        className="absolute w-1 h-1 bg-white/30 rounded-full"
        style={{
          left: `${star.x}%`,
          top: `${star.y}%`,
        }}
      />
    ))}
  </div>
));
StarBackground.displayName = 'StarBackground';

// Memoized cycle progress dots
const CycleProgressDots = memo(({ 
  totalCycles, 
  cycle, 
  hits 
}: { 
  totalCycles: number; 
  cycle: number; 
  hits: number;
}) => (
  <div className="flex gap-2 mb-4">
    {Array.from({ length: totalCycles }).map((_, i) => {
      const isCompleted = i < cycle - 1;
      const isSuccess = i < hits;
      const isCurrent = i === cycle - 1;
      
      return (
        <div
          key={i}
          className={`w-3 h-3 rounded-full transition-all ${
            isCompleted && isSuccess
              ? 'bg-green-500'
              : isCompleted
                ? 'bg-red-500'
                : isCurrent
                  ? 'bg-primary scale-pulse'
                  : 'bg-muted'
          }`}
        />
      );
    })}
  </div>
));
CycleProgressDots.displayName = 'CycleProgressDots';

export const EclipseTimingGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: EclipseTimingGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [cycle, setCycle] = useState(1);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [misses, setMisses] = useState(0);
  const [canTap, setCanTap] = useState(true);
  const [showFeedback, setShowFeedback] = useState<'perfect' | 'good' | 'miss' | null>(null);
  const [showEclipseEffect, setShowEclipseEffect] = useState(false);
  const [pulseRing, setPulseRing] = useState(false);

  // Use refs for animation state to avoid re-renders
  const sunAngleRef = useRef(0);
  const moonAngleRef = useRef(180);
  const [angles, setAngles] = useState({ sun: 0, moon: 180 });
  
  // Refs for game state in callbacks
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Static stars - memoized
  const stars = useStaticStars(15);

  // Body stat bonus
  const statBonus = companionStats.body;
  const windowBonus = Math.floor(statBonus / 25);

  // Memoized difficulty settings
  const settings = useMemo(() => {
    const base = {
      easy: { cycles: 5, baseWindow: 30, speed: 1.5 },
      medium: { cycles: 7, baseWindow: 22, speed: 2 },
      hard: { cycles: 9, baseWindow: 15, speed: 2.5 },
    };
    const s = base[difficulty];
    return {
      totalCycles: s.cycles + Math.floor(questIntervalScale),
      eclipseWindow: s.baseWindow - Math.floor(questIntervalScale * 3) + windowBonus,
      speed: s.speed + questIntervalScale * 0.3,
    };
  }, [difficulty, questIntervalScale, windowBonus]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  // Optimized animation loop
  useGameLoop((deltaTime) => {
    if (gameStateRef.current !== 'playing') return;
    
    sunAngleRef.current = (sunAngleRef.current + deltaTime * 60 * settings.speed) % 360;
    moonAngleRef.current = (moonAngleRef.current - deltaTime * 45 * settings.speed + 360) % 360;
    
    // Batch angle updates - only update state every few frames for performance
    setAngles({
      sun: sunAngleRef.current,
      moon: moonAngleRef.current,
    });
  }, gameState === 'playing');

  // Calculate eclipse proximity
  const eclipseState = useMemo(() => {
    let diff = Math.abs(angles.sun - angles.moon);
    if (diff > 180) diff = 360 - diff;
    
    const currentWindow = settings.eclipseWindow * (1 - (cycle / settings.totalCycles) * 0.25);
    const isNear = diff <= currentWindow * 1.5;
    const isInWindow = diff <= currentWindow;
    const isPerfect = diff <= currentWindow / 3;
    
    return { proximity: diff, isNear, isInWindow, isPerfect, currentWindow };
  }, [angles.sun, angles.moon, settings.eclipseWindow, cycle, settings.totalCycles]);

  // Handle tap
  const handleTap = useCallback(() => {
    if (!canTap || gameState !== 'playing') return;
    
    setCanTap(false);
    
    let feedback: 'perfect' | 'good' | 'miss';
    
    if (eclipseState.isPerfect) {
      feedback = 'perfect';
      setHits(h => h + 1);
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      setShowEclipseEffect(true);
      setPulseRing(true);
      triggerHaptic('success');
    } else if (eclipseState.isInWindow) {
      feedback = 'good';
      setHits(h => h + 1);
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      triggerHaptic('medium');
    } else {
      feedback = 'miss';
      setMisses(m => m + 1);
      setCombo(0);
      triggerHaptic('error');
    }
    
    setShowFeedback(feedback);
    
    setTimeout(() => {
      setShowFeedback(null);
      setShowEclipseEffect(false);
      setPulseRing(false);
      
      if (cycle >= settings.totalCycles) {
        setGameState('complete');
      } else {
        setCycle(c => c + 1);
        setCanTap(true);
      }
    }, 700);
  }, [canTap, gameState, eclipseState, cycle, settings.totalCycles]);

  // Complete game
  useEffect(() => {
    if (gameState === 'complete') {
      const baseAccuracy = Math.round((hits / settings.totalCycles) * 100);
      const comboBonus = Math.min(maxCombo * 3, 15);
      const accuracy = Math.min(100, baseAccuracy + comboBonus);
      const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result,
        });
      }, 500);
    }
  }, [gameState, hits, settings.totalCycles, maxCombo, onComplete]);

  // Sun and Moon positions
  const sunPos = useMemo(() => ({
    x: Math.cos((angles.sun * Math.PI) / 180) * 95 - 28,
    y: Math.sin((angles.sun * Math.PI) / 180) * 95 - 28,
  }), [angles.sun]);

  const moonPos = useMemo(() => ({
    x: Math.cos((angles.moon * Math.PI) / 180) * 95 - 24,
    y: Math.sin((angles.moon * Math.PI) / 180) * 95 - 24,
  }), [angles.moon]);

  return (
    <div className="flex flex-col items-center relative">
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
        title="Eclipse Timing"
        subtitle={`Cycle ${cycle}/${settings.totalCycles} - Tap when aligned!`}
        score={hits}
        maxScore={settings.totalCycles}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: misses, label: 'Misses', color: 'hsl(0, 84%, 60%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Cycle progress dots - memoized */}
      <CycleProgressDots totalCycles={settings.totalCycles} cycle={cycle} hits={hits} />

      {/* Orbital arena */}
      <div 
        className="relative w-72 h-72 rounded-full border-2 border-border/50 mb-4 cursor-pointer overflow-hidden gpu-accelerated"
        onClick={handleTap}
        style={{
          background: eclipseState.isNear 
            ? `radial-gradient(circle, ${eclipseState.isPerfect ? 'hsl(38, 92%, 50%, 0.3)' : 'hsl(var(--primary)/0.2)'} 0%, transparent 70%)` 
            : 'radial-gradient(circle, hsl(var(--muted)/0.1) 0%, transparent 70%)',
        }}
      >
        {/* Background stars - memoized */}
        <StarBackground stars={stars} />

        {/* Orbital paths */}
        <div className="absolute inset-6 rounded-full border border-yellow-500/20" />
        <div className="absolute inset-12 rounded-full border border-slate-400/20" />
        
        {/* Center point */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border border-slate-500/50" />

        {/* Sun - using CSS transform for GPU acceleration */}
        <div
          className="absolute w-14 h-14 rounded-full flex items-center justify-center will-animate gpu-accelerated sun-glow"
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(${sunPos.x}px, ${sunPos.y}px)`,
          }}
        >
          <span className="text-2xl sun-rotate">☀️</span>
          {/* Sun corona */}
          <div className="absolute inset-0 rounded-full border-2 border-yellow-400/50 corona-pulse" />
        </div>

        {/* Moon */}
        <div
          className="absolute w-12 h-12 rounded-full flex items-center justify-center will-animate gpu-accelerated moon-glow"
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(${moonPos.x}px, ${moonPos.y}px)`,
          }}
        >
          <span className="text-xl">🌙</span>
        </div>

        {/* Eclipse alignment effect */}
        <AnimatePresence>
          {eclipseState.isInWindow && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: eclipseState.isPerfect ? [1, 1.8, 1] : [1, 1.4, 1], 
                opacity: eclipseState.isPerfect ? [0.8, 0.4, 0.8] : [0.5, 0.2, 0.5]
              }}
              transition={{ duration: 0.6, repeat: Infinity }}
              style={{
                width: 80,
                height: 80,
                background: eclipseState.isPerfect 
                  ? 'radial-gradient(circle, white 0%, hsl(45, 100%, 50%, 0.5) 30%, transparent 70%)'
                  : 'radial-gradient(circle, white 0%, transparent 70%)',
                boxShadow: eclipseState.isPerfect ? '0 0 60px white, 0 0 100px hsl(45, 100%, 50%)' : '0 0 40px white',
              }}
            />
          )}
        </AnimatePresence>

        {/* Eclipse burst effect on perfect */}
        <AnimatePresence>
          {showEclipseEffect && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 3, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="w-20 h-20 rounded-full bg-gradient-radial from-white via-yellow-400 to-transparent" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pulse ring on successful tap */}
        <AnimatePresence>
          {pulseRing && (
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-yellow-400"
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: 1.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
            />
          )}
        </AnimatePresence>

        {/* Feedback overlay */}
        <AnimatePresence>
          {showFeedback && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center rounded-full z-20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.2 }}
            >
              <div className={`px-6 py-3 rounded-xl font-black text-3xl ${
                showFeedback === 'perfect' ? 'bg-yellow-500/30 text-yellow-400 border-2 border-yellow-400' :
                showFeedback === 'good' ? 'bg-green-500/30 text-green-400 border-2 border-green-400' : 
                'bg-red-500/30 text-red-400 border-2 border-red-400'
              }`}>
                {showFeedback === 'perfect' ? '🌟 PERFECT!' :
                 showFeedback === 'good' ? '👍 GOOD!' : '❌ MISS'}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tap instruction */}
      <div className={`text-center mb-3 ${eclipseState.isNear ? 'text-primary' : 'text-muted-foreground'}`}>
        <p className={`text-lg font-medium ${eclipseState.isNear && canTap ? 'scale-pulse' : ''}`}>
          {!canTap 
            ? '⏳ Wait...'
            : eclipseState.isPerfect
              ? '🌟 PERFECT ZONE!'
              : eclipseState.isInWindow
                ? '🌑 TAP NOW!'
                : eclipseState.isNear
                  ? '👀 Get ready...'
                  : 'Wait for alignment...'}
        </p>
      </div>

      {/* Proximity indicator */}
      <div className="w-full max-w-xs">
        <div className="h-3 bg-muted/50 rounded-full overflow-hidden border border-border/50">
          <div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${Math.max(0, 100 - eclipseState.proximity)}%`,
              background: eclipseState.isPerfect 
                ? 'linear-gradient(90deg, hsl(45, 100%, 50%), white, hsl(45, 100%, 50%))' 
                : eclipseState.isInWindow 
                  ? 'linear-gradient(90deg, hsl(38, 92%, 50%), hsl(45, 100%, 60%))' 
                  : 'hsl(var(--muted-foreground))',
              boxShadow: eclipseState.isInWindow ? '0 0 10px hsl(45, 100%, 50%)' : 'none',
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Far</span>
          <span className={eclipseState.isPerfect ? 'text-yellow-400 font-bold' : ''}>Eclipse Proximity</span>
          <span>Aligned</span>
        </div>
      </div>

      {/* Stat bonus */}
      <p className="mt-3 text-xs text-muted-foreground">
        Body stat bonus: +{windowBonus}° eclipse window
      </p>

      {/* CSS animations */}
      <style>{`
        .will-animate {
          will-change: transform;
        }
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .sun-glow {
          background: radial-gradient(circle, hsl(45, 100%, 60%) 0%, hsl(35, 100%, 50%) 50%, hsl(25, 100%, 40%) 100%);
          box-shadow: 0 0 30px hsl(45, 100%, 50%), 0 0 60px hsl(45, 100%, 50%, 0.5);
        }
        .moon-glow {
          background: radial-gradient(circle at 30% 30%, hsl(220, 20%, 80%) 0%, hsl(220, 20%, 50%) 50%, hsl(220, 20%, 30%) 100%);
          box-shadow: 0 0 20px hsl(220, 20%, 70%), 0 0 40px hsl(220, 20%, 50%, 0.4);
        }
        .sun-rotate {
          animation: rotate 10s linear infinite;
        }
        @keyframes rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .corona-pulse {
          animation: corona 1.5s ease-in-out infinite;
        }
        @keyframes corona {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.3); opacity: 0.2; }
        }
        .scale-pulse {
          animation: scale-pulse 0.3s ease-in-out infinite;
        }
        @keyframes scale-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
};
