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
  maxTimer?: number; // Override timer for practice mode (limits cycles)
  isPractice?: boolean;
}

interface Asteroid {
  id: number;
  angle: number;
  size: number;
  speed: number;
  active: boolean;
}

// Difficulty configurations
const DIFFICULTY_CONFIG = {
  easy: {
    cycles: 5,
    baseWindow: 32,
    speed: 1.4,
    windowShrinkRate: 0.08, // 8% shrink per cycle
    asteroidCount: 1,
    asteroidDuration: 2000,
    solarFlareChance: 0.15,
    solarFlareDuration: 1200,
  },
  medium: {
    cycles: 7,
    baseWindow: 24,
    speed: 1.8,
    windowShrinkRate: 0.12, // 12% shrink per cycle
    asteroidCount: 2,
    asteroidDuration: 2500,
    solarFlareChance: 0.25,
    solarFlareDuration: 1500,
  },
  hard: {
    cycles: 9,
    baseWindow: 18,
    speed: 2.2,
    windowShrinkRate: 0.15, // 15% shrink per cycle
    asteroidCount: 3,
    asteroidDuration: 3000,
    solarFlareChance: 0.35,
    solarFlareDuration: 1800,
  },
};

// Precision zone thresholds (as fraction of window)
const PRECISION_ZONES = {
  perfect: 0.15,   // Inner 15% of window
  excellent: 0.35, // 15-35%
  good: 0.6,       // 35-60%
  ok: 1.0,         // 60-100%
  // Outside window = miss
};

type FeedbackType = 'perfect' | 'excellent' | 'good' | 'ok' | 'miss';

const FEEDBACK_CONFIG: Record<FeedbackType, { emoji: string; label: string; color: string; bgColor: string; points: number }> = {
  perfect: { emoji: '🌟', label: 'PERFECT!', color: 'text-yellow-300', bgColor: 'bg-yellow-500/30 border-yellow-400', points: 100 },
  excellent: { emoji: '✨', label: 'EXCELLENT!', color: 'text-purple-300', bgColor: 'bg-purple-500/30 border-purple-400', points: 75 },
  good: { emoji: '👍', label: 'GOOD!', color: 'text-green-400', bgColor: 'bg-green-500/30 border-green-400', points: 50 },
  ok: { emoji: '👌', label: 'OK', color: 'text-blue-400', bgColor: 'bg-blue-500/30 border-blue-400', points: 25 },
  miss: { emoji: '❌', label: 'MISS', color: 'text-red-400', bgColor: 'bg-red-500/30 border-red-400', points: 0 },
};

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

// Asteroid component
const AsteroidComponent = memo(({ asteroid, centerX, centerY, orbitRadius }: { 
  asteroid: Asteroid; 
  centerX: number; 
  centerY: number;
  orbitRadius: number;
}) => {
  const x = centerX + Math.cos((asteroid.angle * Math.PI) / 180) * orbitRadius;
  const y = centerY + Math.sin((asteroid.angle * Math.PI) / 180) * orbitRadius;
  
  return (
    <motion.div
      className="absolute pointer-events-none"
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      style={{
        left: x - asteroid.size / 2,
        top: y - asteroid.size / 2,
        width: asteroid.size,
        height: asteroid.size,
      }}
    >
      <div 
        className="w-full h-full rounded-full"
        style={{
          background: 'radial-gradient(circle at 30% 30%, #8B7355 0%, #5D4E37 50%, #3D3225 100%)',
          boxShadow: '0 0 10px rgba(0,0,0,0.5), inset -2px -2px 4px rgba(0,0,0,0.4)',
        }}
      />
      {/* Asteroid craters */}
      <div className="absolute top-1/4 left-1/3 w-2 h-2 rounded-full bg-black/30" />
      <div className="absolute bottom-1/3 right-1/4 w-1.5 h-1.5 rounded-full bg-black/20" />
    </motion.div>
  );
});
AsteroidComponent.displayName = 'AsteroidComponent';

// Solar flare overlay
const SolarFlareOverlay = memo(({ intensity }: { intensity: number }) => (
  <motion.div
    className="absolute inset-0 pointer-events-none rounded-full z-10"
    initial={{ opacity: 0 }}
    animate={{ opacity: intensity }}
    exit={{ opacity: 0 }}
    style={{
      background: `radial-gradient(circle at 50% 50%, 
        rgba(255, 200, 50, ${intensity * 0.8}) 0%, 
        rgba(255, 150, 0, ${intensity * 0.5}) 30%, 
        rgba(255, 100, 0, ${intensity * 0.3}) 50%, 
        transparent 70%)`,
      boxShadow: `inset 0 0 60px rgba(255, 200, 50, ${intensity * 0.5})`,
    }}
  />
));
SolarFlareOverlay.displayName = 'SolarFlareOverlay';

// Memoized cycle progress dots with precision colors
const CycleProgressDots = memo(({ 
  totalCycles, 
  cycle, 
  results 
}: { 
  totalCycles: number; 
  cycle: number; 
  results: FeedbackType[];
}) => (
  <div className="flex gap-2 mb-4 flex-wrap justify-center">
    {Array.from({ length: totalCycles }).map((_, i) => {
      const result = results[i];
      const isCurrent = i === cycle - 1;
      const isCompleted = i < cycle - 1;
      
      let bgColor = 'bg-muted';
      if (isCompleted && result) {
        bgColor = result === 'perfect' ? 'bg-yellow-400' :
                  result === 'excellent' ? 'bg-purple-400' :
                  result === 'good' ? 'bg-green-500' :
                  result === 'ok' ? 'bg-blue-400' : 'bg-red-500';
      }
      
      return (
        <div
          key={i}
          className={`w-3 h-3 rounded-full transition-all ${bgColor} ${
            isCurrent ? 'ring-2 ring-primary ring-offset-1 ring-offset-background scale-125' : ''
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
  maxTimer,
  isPractice = false,
}: EclipseTimingGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [cycle, setCycle] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [canTap, setCanTap] = useState(true);
  const [showFeedback, setShowFeedback] = useState<FeedbackType | null>(null);
  const [showEclipseEffect, setShowEclipseEffect] = useState(false);
  const [pulseRing, setPulseRing] = useState(false);
  const [cycleResults, setCycleResults] = useState<FeedbackType[]>([]);
  
  // Interference mechanics
  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [solarFlareActive, setSolarFlareActive] = useState(false);
  const [solarFlareIntensity, setSolarFlareIntensity] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  // Use refs for animation state to avoid re-renders
  const sunAngleRef = useRef(0);
  const moonAngleRef = useRef(180);
  const [angles, setAngles] = useState({ sun: 0, moon: 180 });
  
  // Refs for game state in callbacks
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // Static stars - memoized
  const stars = useStaticStars(15);

  const config = DIFFICULTY_CONFIG[difficulty];
  
  // Body stat bonus
  const statBonus = companionStats.body;
  const windowBonus = Math.floor(statBonus / 25);

  // Calculate current eclipse window with shrinking
  const getCurrentWindow = useCallback((currentCycle: number) => {
    const baseWindow = config.baseWindow + windowBonus - Math.floor(questIntervalScale * 3);
    const shrinkFactor = 1 - (config.windowShrinkRate * (currentCycle - 1));
    return Math.max(8, baseWindow * shrinkFactor); // Minimum 8 degrees
  }, [config.baseWindow, config.windowShrinkRate, windowBonus, questIntervalScale]);

  const settings = useMemo(() => ({
    totalCycles: config.cycles + Math.floor(questIntervalScale),
    speed: config.speed + questIntervalScale * 0.3,
  }), [config.cycles, config.speed, questIntervalScale]);

  // Spawn asteroids
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const spawnAsteroid = () => {
      if (asteroids.length >= config.asteroidCount) return;
      
      const newAsteroid: Asteroid = {
        id: Date.now() + Math.random(),
        angle: Math.random() * 360,
        size: 20 + Math.random() * 15,
        speed: 0.3 + Math.random() * 0.4,
        active: true,
      };
      
      setAsteroids(prev => [...prev, newAsteroid]);
      
      // Remove asteroid after duration
      setTimeout(() => {
        setAsteroids(prev => prev.filter(a => a.id !== newAsteroid.id));
      }, config.asteroidDuration);
    };
    
    // Spawn asteroids periodically
    const interval = setInterval(spawnAsteroid, 3000 + Math.random() * 2000);
    spawnAsteroid(); // Initial spawn
    
    return () => clearInterval(interval);
  }, [gameState, config.asteroidCount, config.asteroidDuration, asteroids.length]);

  // Solar flare mechanic
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const triggerFlare = () => {
      if (Math.random() < config.solarFlareChance && !solarFlareActive) {
        setSolarFlareActive(true);
        
        // Animate flare intensity
        let intensity = 0;
        const rampUp = setInterval(() => {
          intensity += 0.1;
          setSolarFlareIntensity(Math.min(1, intensity));
          if (intensity >= 1) clearInterval(rampUp);
        }, 50);
        
        // Fade out after duration
        setTimeout(() => {
          const rampDown = setInterval(() => {
            intensity -= 0.1;
            setSolarFlareIntensity(Math.max(0, intensity));
            if (intensity <= 0) {
              clearInterval(rampDown);
              setSolarFlareActive(false);
            }
          }, 50);
        }, config.solarFlareDuration);
      }
    };
    
    const interval = setInterval(triggerFlare, 4000 + Math.random() * 3000);
    
    return () => clearInterval(interval);
  }, [gameState, config.solarFlareChance, config.solarFlareDuration, solarFlareActive]);

  // Check if eclipse zone is blocked by asteroid
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const checkBlocked = () => {
      const eclipseAngle = (angles.sun + angles.moon) / 2;
      const blocked = asteroids.some(asteroid => {
        let angleDiff = Math.abs(asteroid.angle - eclipseAngle);
        if (angleDiff > 180) angleDiff = 360 - angleDiff;
        return angleDiff < 25; // Asteroid blocks ~25 degree zone
      });
      setIsBlocked(blocked);
    };
    
    checkBlocked();
  }, [gameState, angles, asteroids]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  // Optimized animation loop
  useGameLoop((deltaTime) => {
    if (gameStateRef.current !== 'playing') return;
    
    sunAngleRef.current = (sunAngleRef.current + deltaTime * 60 * settings.speed) % 360;
    moonAngleRef.current = (moonAngleRef.current - deltaTime * 45 * settings.speed + 360) % 360;
    
    // Update asteroid positions
    setAsteroids(prev => prev.map(asteroid => ({
      ...asteroid,
      angle: (asteroid.angle + deltaTime * 30 * asteroid.speed) % 360,
    })));
    
    setAngles({
      sun: sunAngleRef.current,
      moon: moonAngleRef.current,
    });
  }, gameState === 'playing');

  // Calculate eclipse proximity with precision zones
  const eclipseState = useMemo(() => {
    let diff = Math.abs(angles.sun - angles.moon);
    if (diff > 180) diff = 360 - diff;
    
    const currentWindow = getCurrentWindow(cycle);
    const isNear = diff <= currentWindow * 1.5;
    const isInWindow = diff <= currentWindow;
    
    // Calculate precision zone
    let precisionZone: FeedbackType = 'miss';
    if (isInWindow) {
      const normalizedDiff = diff / currentWindow;
      if (normalizedDiff <= PRECISION_ZONES.perfect) precisionZone = 'perfect';
      else if (normalizedDiff <= PRECISION_ZONES.excellent) precisionZone = 'excellent';
      else if (normalizedDiff <= PRECISION_ZONES.good) precisionZone = 'good';
      else precisionZone = 'ok';
    }
    
    return { proximity: diff, isNear, isInWindow, precisionZone, currentWindow };
  }, [angles.sun, angles.moon, cycle, getCurrentWindow]);

  // Handle tap
  const handleTap = useCallback(() => {
    if (!canTap || gameState !== 'playing') return;
    
    setCanTap(false);
    
    let feedback: FeedbackType;
    
    // Check if blocked by asteroid or solar flare
    if (isBlocked) {
      feedback = 'miss';
      setCombo(0);
      triggerHaptic('error');
    } else if (solarFlareIntensity > 0.7) {
      // Heavy solar flare obscures view - random chance of miss
      if (Math.random() < solarFlareIntensity * 0.5) {
        feedback = 'miss';
        setCombo(0);
        triggerHaptic('error');
      } else {
        feedback = eclipseState.precisionZone;
      }
    } else {
      feedback = eclipseState.precisionZone;
    }
    
    // Apply feedback results
    const feedbackConfig = FEEDBACK_CONFIG[feedback];
    setScore(s => s + feedbackConfig.points);
    setCycleResults(prev => [...prev, feedback]);
    
    if (feedback !== 'miss') {
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      
      if (feedback === 'perfect' || feedback === 'excellent') {
        setShowEclipseEffect(true);
        setPulseRing(true);
      }
      
      triggerHaptic(feedback === 'perfect' ? 'success' : 'medium');
    } else {
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
  }, [canTap, gameState, eclipseState, cycle, settings.totalCycles, isBlocked, solarFlareIntensity]);

  // Complete game
  useEffect(() => {
    if (gameState === 'complete') {
      const maxScore = settings.totalCycles * 100;
      const baseAccuracy = Math.round((score / maxScore) * 100);
      const comboBonus = Math.min(maxCombo * 2, 15);
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
  }, [gameState, score, settings.totalCycles, maxCombo, onComplete]);

  // Sun and Moon positions
  const sunPos = useMemo(() => ({
    x: Math.cos((angles.sun * Math.PI) / 180) * 95 - 28,
    y: Math.sin((angles.sun * Math.PI) / 180) * 95 - 28,
  }), [angles.sun]);

  const moonPos = useMemo(() => ({
    x: Math.cos((angles.moon * Math.PI) / 180) * 95 - 24,
    y: Math.sin((angles.moon * Math.PI) / 180) * 95 - 24,
  }), [angles.moon]);

  const currentWindow = getCurrentWindow(cycle);
  const missCount = cycleResults.filter(r => r === 'miss').length;

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
        subtitle={`Cycle ${cycle}/${settings.totalCycles} • Window: ${Math.round(currentWindow)}°`}
        score={score}
        maxScore={settings.totalCycles * 100}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: missCount, label: 'Misses', color: 'hsl(0, 84%, 60%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Difficulty & shrinking window indicator */}
      <div className="mb-2 flex items-center gap-3">
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
          difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {difficulty.toUpperCase()}
        </span>
        <span className="text-xs text-muted-foreground">
          Window shrinks {Math.round(config.windowShrinkRate * 100)}%/cycle
        </span>
      </div>

      {/* Cycle progress dots with precision colors */}
      <CycleProgressDots totalCycles={settings.totalCycles} cycle={cycle} results={cycleResults} />

      {/* Orbital arena */}
      <div 
        className="relative w-72 h-72 rounded-full border-2 border-border/50 mb-4 cursor-pointer overflow-hidden gpu-accelerated"
        onClick={handleTap}
        style={{
          background: eclipseState.isNear && !isBlocked
            ? `radial-gradient(circle, ${
                eclipseState.precisionZone === 'perfect' ? 'hsl(45, 100%, 50%, 0.4)' :
                eclipseState.precisionZone === 'excellent' ? 'hsl(280, 70%, 50%, 0.3)' :
                'hsl(var(--primary)/0.2)'
              } 0%, transparent 70%)` 
            : 'radial-gradient(circle, hsl(var(--muted)/0.1) 0%, transparent 70%)',
        }}
      >
        {/* Background stars */}
        <StarBackground stars={stars} />

        {/* Solar flare overlay */}
        <AnimatePresence>
          {solarFlareActive && (
            <SolarFlareOverlay intensity={solarFlareIntensity} />
          )}
        </AnimatePresence>

        {/* Orbital paths */}
        <div className="absolute inset-6 rounded-full border border-yellow-500/20" />
        <div className="absolute inset-12 rounded-full border border-slate-400/20" />
        
        {/* Eclipse window visualization */}
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed transition-all"
          style={{
            width: currentWindow * 3,
            height: currentWindow * 3,
            borderColor: isBlocked ? 'rgba(239, 68, 68, 0.5)' : 'rgba(234, 179, 8, 0.3)',
            opacity: eclipseState.isNear ? 1 : 0.3,
          }}
        />
        
        {/* Center point */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border border-slate-500/50" />

        {/* Asteroids */}
        <AnimatePresence>
          {asteroids.map(asteroid => (
            <AsteroidComponent
              key={asteroid.id}
              asteroid={asteroid}
              centerX={144}
              centerY={144}
              orbitRadius={80}
            />
          ))}
        </AnimatePresence>

        {/* Sun */}
        <div
          className="absolute w-14 h-14 rounded-full flex items-center justify-center will-animate gpu-accelerated sun-glow"
          style={{
            top: '50%',
            left: '50%',
            transform: `translate(${sunPos.x}px, ${sunPos.y}px)`,
          }}
        >
          <span className="text-2xl sun-rotate">☀️</span>
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

        {/* Blocked indicator */}
        <AnimatePresence>
          {isBlocked && canTap && (
            <motion.div
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <span className="text-xs bg-red-500/80 text-white px-2 py-1 rounded-full">
                🪨 BLOCKED!
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Eclipse alignment effect */}
        <AnimatePresence>
          {eclipseState.isInWindow && !isBlocked && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: eclipseState.precisionZone === 'perfect' ? [1, 1.8, 1] : 
                       eclipseState.precisionZone === 'excellent' ? [1, 1.5, 1] : [1, 1.3, 1], 
                opacity: eclipseState.precisionZone === 'perfect' ? [0.8, 0.4, 0.8] : [0.5, 0.2, 0.5]
              }}
              transition={{ duration: 0.6, repeat: Infinity }}
              style={{
                width: 80,
                height: 80,
                background: eclipseState.precisionZone === 'perfect' 
                  ? 'radial-gradient(circle, white 0%, hsl(45, 100%, 50%, 0.5) 30%, transparent 70%)'
                  : eclipseState.precisionZone === 'excellent'
                    ? 'radial-gradient(circle, white 0%, hsl(280, 70%, 50%, 0.4) 30%, transparent 70%)'
                    : 'radial-gradient(circle, white 0%, transparent 70%)',
                boxShadow: eclipseState.precisionZone === 'perfect' 
                  ? '0 0 60px white, 0 0 100px hsl(45, 100%, 50%)' 
                  : '0 0 40px white',
              }}
            />
          )}
        </AnimatePresence>

        {/* Eclipse burst effect */}
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

        {/* Pulse ring */}
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
              <div className={`px-5 py-2.5 rounded-xl font-black text-2xl ${FEEDBACK_CONFIG[showFeedback].bgColor} ${FEEDBACK_CONFIG[showFeedback].color} border-2`}>
                {FEEDBACK_CONFIG[showFeedback].emoji} {FEEDBACK_CONFIG[showFeedback].label}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tap instruction */}
      <div className={`text-center mb-3 ${eclipseState.isNear && !isBlocked ? 'text-primary' : 'text-muted-foreground'}`}>
        <p className={`text-lg font-medium ${eclipseState.isNear && canTap && !isBlocked ? 'scale-pulse' : ''}`}>
          {!canTap 
            ? '⏳ Wait...'
            : isBlocked
              ? '🪨 Asteroid blocking!'
              : solarFlareIntensity > 0.7
                ? '☀️ Solar flare!'
                : eclipseState.precisionZone === 'perfect'
                  ? '🌟 PERFECT ZONE!'
                  : eclipseState.precisionZone === 'excellent'
                    ? '✨ EXCELLENT ZONE!'
                    : eclipseState.isInWindow
                      ? '🌑 TAP NOW!'
                      : eclipseState.isNear
                        ? '👀 Get ready...'
                        : 'Wait for alignment...'}
        </p>
      </div>

      {/* Precision zone legend */}
      <div className="flex gap-2 mb-2 text-xs">
        <span className="text-yellow-300">●Perfect</span>
        <span className="text-purple-300">●Excellent</span>
        <span className="text-green-400">●Good</span>
        <span className="text-blue-400">●OK</span>
      </div>

      {/* Proximity indicator */}
      <div className="w-full max-w-xs">
        <div className="h-3 bg-muted/50 rounded-full overflow-hidden border border-border/50 relative">
          {/* Zone markers */}
          <div className="absolute inset-0 flex">
            <div className="h-full bg-yellow-400/20" style={{ width: `${PRECISION_ZONES.perfect * 100}%` }} />
            <div className="h-full bg-purple-400/20" style={{ width: `${(PRECISION_ZONES.excellent - PRECISION_ZONES.perfect) * 100}%` }} />
            <div className="h-full bg-green-400/20" style={{ width: `${(PRECISION_ZONES.good - PRECISION_ZONES.excellent) * 100}%` }} />
            <div className="h-full bg-blue-400/20" style={{ width: `${(PRECISION_ZONES.ok - PRECISION_ZONES.good) * 100}%` }} />
          </div>
          <div
            className="h-full rounded-full transition-all duration-100 relative z-10"
            style={{
              width: `${Math.max(0, 100 - eclipseState.proximity)}%`,
              background: isBlocked 
                ? 'hsl(0, 84%, 50%)'
                : eclipseState.precisionZone === 'perfect' 
                  ? 'linear-gradient(90deg, hsl(45, 100%, 50%), white, hsl(45, 100%, 50%))' 
                  : eclipseState.precisionZone === 'excellent'
                    ? 'linear-gradient(90deg, hsl(280, 70%, 50%), hsl(280, 70%, 70%))'
                    : eclipseState.isInWindow 
                      ? 'linear-gradient(90deg, hsl(38, 92%, 50%), hsl(45, 100%, 60%))' 
                      : 'hsl(var(--muted-foreground))',
              boxShadow: eclipseState.isInWindow && !isBlocked ? '0 0 10px hsl(45, 100%, 50%)' : 'none',
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Far</span>
          <span className={eclipseState.precisionZone === 'perfect' ? 'text-yellow-400 font-bold' : ''}>
            Eclipse Proximity
          </span>
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
