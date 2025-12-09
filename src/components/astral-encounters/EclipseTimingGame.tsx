import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';

interface EclipseTimingGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

export const EclipseTimingGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: EclipseTimingGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [sunAngle, setSunAngle] = useState(0);
  const [moonAngle, setMoonAngle] = useState(180);
  const [cycle, setCycle] = useState(1);
  const [totalCycles, setTotalCycles] = useState(6);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [misses, setMisses] = useState(0);
  const [canTap, setCanTap] = useState(true);
  const [showFeedback, setShowFeedback] = useState<'perfect' | 'good' | 'miss' | null>(null);
  const [eclipseWindow, setEclipseWindow] = useState(25);
  const [showEclipseEffect, setShowEclipseEffect] = useState(false);
  const [pulseRing, setPulseRing] = useState(false);
  
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Body stat bonus
  const statBonus = companionStats.body;
  const windowBonus = Math.floor(statBonus / 25);

  // Difficulty settings
  useEffect(() => {
    const settings = {
      easy: { cycles: 5, baseWindow: 30, speed: 1.5 },
      medium: { cycles: 7, baseWindow: 22, speed: 2 },
      hard: { cycles: 9, baseWindow: 15, speed: 2.5 },
    };
    const s = settings[difficulty];
    setTotalCycles(s.cycles + Math.floor(questIntervalScale));
    setEclipseWindow(s.baseWindow - Math.floor(questIntervalScale * 3) + windowBonus);
  }, [difficulty, questIntervalScale, windowBonus]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  // Animation loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const speed = difficulty === 'hard' ? 2.5 : difficulty === 'medium' ? 2 : 1.5;
    const adjustedSpeed = speed + questIntervalScale * 0.3;

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      setSunAngle(prev => (prev + delta * 60 * adjustedSpeed) % 360);
      setMoonAngle(prev => (prev - delta * 45 * adjustedSpeed + 360) % 360);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [difficulty, questIntervalScale, gameState]);

  // Calculate eclipse proximity
  const getEclipseProximity = useCallback(() => {
    let diff = Math.abs(sunAngle - moonAngle);
    if (diff > 180) diff = 360 - diff;
    return diff;
  }, [sunAngle, moonAngle]);

  // Handle tap
  const handleTap = useCallback(() => {
    if (!canTap || gameState !== 'playing') return;
    
    setCanTap(false);
    const proximity = getEclipseProximity();
    
    const currentWindow = eclipseWindow * (1 - (cycle / totalCycles) * 0.25);
    
    let feedback: 'perfect' | 'good' | 'miss';
    
    if (proximity <= currentWindow / 3) {
      feedback = 'perfect';
      setHits(h => h + 1);
      setCombo(c => c + 1);
      setMaxCombo(m => Math.max(m, combo + 1));
      setShowEclipseEffect(true);
      setPulseRing(true);
      triggerHaptic('success');
    } else if (proximity <= currentWindow) {
      feedback = 'good';
      setHits(h => h + 1);
      setCombo(c => c + 1);
      setMaxCombo(m => Math.max(m, combo + 1));
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
      
      if (cycle >= totalCycles) {
        setGameState('complete');
      } else {
        setCycle(c => c + 1);
        setCanTap(true);
      }
    }, 700);
  }, [canTap, gameState, getEclipseProximity, eclipseWindow, cycle, totalCycles, combo]);

  // Complete game
  useEffect(() => {
    if (gameState === 'complete') {
      const baseAccuracy = Math.round((hits / totalCycles) * 100);
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
  }, [gameState, hits, totalCycles, maxCombo, onComplete]);

  const proximity = getEclipseProximity();
  const isNearEclipse = proximity <= eclipseWindow * 1.5;
  const isInWindow = proximity <= eclipseWindow;
  const isPerfectZone = proximity <= eclipseWindow / 3;

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
        subtitle={`Cycle ${cycle}/${totalCycles} - Tap when aligned!`}
        score={hits}
        maxScore={totalCycles}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: misses, label: 'Misses', color: 'hsl(0, 84%, 60%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Cycle progress dots */}
      <div className="flex gap-2 mb-4">
        {Array.from({ length: totalCycles }).map((_, i) => (
          <motion.div
            key={i}
            className={`w-3 h-3 rounded-full transition-all ${
              i < cycle - 1 + (hits > i ? 1 : 0) && i < hits
                ? 'bg-green-500'
                : i < cycle - 1
                  ? 'bg-red-500'
                  : i === cycle - 1
                    ? 'bg-primary'
                    : 'bg-muted'
            }`}
            animate={i === cycle - 1 ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        ))}
      </div>

      {/* Orbital arena */}
      <div 
        className="relative w-72 h-72 rounded-full border-2 border-border/50 mb-4 cursor-pointer overflow-hidden"
        onClick={handleTap}
        style={{
          background: isNearEclipse 
            ? `radial-gradient(circle, ${isPerfectZone ? 'hsl(38, 92%, 50%, 0.3)' : 'hsl(var(--primary)/0.2)'} 0%, transparent 70%)` 
            : 'radial-gradient(circle, hsl(var(--muted)/0.1) 0%, transparent 70%)',
        }}
      >
        {/* Background stars */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(25)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>

        {/* Orbital paths */}
        <div className="absolute inset-6 rounded-full border border-yellow-500/20" />
        <div className="absolute inset-12 rounded-full border border-slate-400/20" />
        
        {/* Center point */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 border border-slate-500/50" />

        {/* Sun */}
        <motion.div
          className="absolute w-14 h-14 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, hsl(45, 100%, 60%) 0%, hsl(35, 100%, 50%) 50%, hsl(25, 100%, 40%) 100%)',
            boxShadow: '0 0 30px hsl(45, 100%, 50%), 0 0 60px hsl(45, 100%, 50%, 0.5)',
            top: '50%',
            left: '50%',
            x: Math.cos((sunAngle * Math.PI) / 180) * 95 - 28,
            y: Math.sin((sunAngle * Math.PI) / 180) * 95 - 28,
          }}
        >
          <motion.span 
            className="text-2xl"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          >
            ☀️
          </motion.span>
          {/* Sun corona */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-yellow-400/50"
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </motion.div>

        {/* Moon */}
        <motion.div
          className="absolute w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle at 30% 30%, hsl(220, 20%, 80%) 0%, hsl(220, 20%, 50%) 50%, hsl(220, 20%, 30%) 100%)',
            boxShadow: '0 0 20px hsl(220, 20%, 70%), 0 0 40px hsl(220, 20%, 50%, 0.4)',
            top: '50%',
            left: '50%',
            x: Math.cos((moonAngle * Math.PI) / 180) * 95 - 24,
            y: Math.sin((moonAngle * Math.PI) / 180) * 95 - 24,
          }}
        >
          <span className="text-xl">🌙</span>
        </motion.div>

        {/* Eclipse alignment effect */}
        <AnimatePresence>
          {isInWindow && (
            <motion.div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ 
                scale: isPerfectZone ? [1, 1.8, 1] : [1, 1.4, 1], 
                opacity: isPerfectZone ? [0.8, 0.4, 0.8] : [0.5, 0.2, 0.5]
              }}
              transition={{ duration: 0.6, repeat: Infinity }}
              style={{
                width: 80,
                height: 80,
                background: isPerfectZone 
                  ? 'radial-gradient(circle, white 0%, hsl(45, 100%, 50%, 0.5) 30%, transparent 70%)'
                  : 'radial-gradient(circle, white 0%, transparent 70%)',
                boxShadow: isPerfectZone ? '0 0 60px white, 0 0 100px hsl(45, 100%, 50%)' : '0 0 40px white',
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
      <motion.div
        className={`text-center mb-3 ${isNearEclipse ? 'text-primary' : 'text-muted-foreground'}`}
        animate={{ scale: isNearEclipse && canTap ? [1, 1.1, 1] : 1 }}
        transition={{ duration: 0.3, repeat: isNearEclipse ? Infinity : 0 }}
      >
        <p className="text-lg font-medium">
          {!canTap 
            ? '⏳ Wait...'
            : isPerfectZone
              ? '🌟 PERFECT ZONE!'
              : isInWindow
                ? '🌑 TAP NOW!'
                : isNearEclipse
                  ? '👀 Get ready...'
                  : 'Wait for alignment...'}
        </p>
      </motion.div>

      {/* Proximity indicator */}
      <div className="w-full max-w-xs">
        <div className="h-3 bg-muted/50 rounded-full overflow-hidden border border-border/50">
          <motion.div
            className="h-full rounded-full transition-colors duration-200"
            style={{
              width: `${Math.max(0, 100 - proximity)}%`,
              background: isPerfectZone 
                ? 'linear-gradient(90deg, hsl(45, 100%, 50%), white, hsl(45, 100%, 50%))' 
                : isInWindow 
                  ? 'linear-gradient(90deg, hsl(38, 92%, 50%), hsl(45, 100%, 60%))' 
                  : 'hsl(var(--muted-foreground))',
              boxShadow: isInWindow ? '0 0 10px hsl(45, 100%, 50%)' : 'none',
            }}
            animate={{ width: `${Math.max(0, 100 - proximity)}%` }}
            transition={{ duration: 0.05 }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Far</span>
          <span className={isPerfectZone ? 'text-yellow-400 font-bold' : ''}>Eclipse Proximity</span>
          <span>Aligned</span>
        </div>
      </div>

      {/* Stat bonus */}
      <p className="mt-3 text-xs text-muted-foreground">
        Body stat bonus: +{windowBonus}° eclipse window
      </p>
    </div>
  );
};
