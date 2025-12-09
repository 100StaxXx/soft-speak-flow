import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';

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
  const [sunAngle, setSunAngle] = useState(0);
  const [moonAngle, setMoonAngle] = useState(180);
  const [cycle, setCycle] = useState(1);
  const [totalCycles, setTotalCycles] = useState(6);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [canTap, setCanTap] = useState(true);
  const [showFeedback, setShowFeedback] = useState<'perfect' | 'good' | 'miss' | null>(null);
  const [gameComplete, setGameComplete] = useState(false);
  const [eclipseWindow, setEclipseWindow] = useState(25);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Body stat bonus
  const statBonus = companionStats.body;
  const windowBonus = Math.floor(statBonus / 25); // Extra degrees of tolerance

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

  // Animation loop
  useEffect(() => {
    if (gameComplete) return;

    const speed = difficulty === 'hard' ? 2.5 : difficulty === 'medium' ? 2 : 1.5;
    const adjustedSpeed = speed + questIntervalScale * 0.3;

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Sun moves clockwise, moon moves counter-clockwise
      setSunAngle(prev => (prev + delta * 60 * adjustedSpeed) % 360);
      setMoonAngle(prev => (prev - delta * 45 * adjustedSpeed + 360) % 360);

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [difficulty, questIntervalScale, gameComplete]);

  // Calculate eclipse proximity
  const getEclipseProximity = useCallback(() => {
    let diff = Math.abs(sunAngle - moonAngle);
    if (diff > 180) diff = 360 - diff;
    return diff;
  }, [sunAngle, moonAngle]);

  // Handle tap
  const handleTap = useCallback(() => {
    if (!canTap || gameComplete) return;
    
    setCanTap(false);
    const proximity = getEclipseProximity();
    
    // Shrinking window as cycles progress
    const currentWindow = eclipseWindow * (1 - (cycle / totalCycles) * 0.3);
    
    let feedback: 'perfect' | 'good' | 'miss';
    let points = 0;
    
    if (proximity <= currentWindow / 3) {
      feedback = 'perfect';
      points = 100;
      setHits(h => h + 1);
    } else if (proximity <= currentWindow) {
      feedback = 'good';
      points = 60;
      setHits(h => h + 1);
    } else {
      feedback = 'miss';
      setMisses(m => m + 1);
    }
    
    setShowFeedback(feedback);
    
    setTimeout(() => {
      setShowFeedback(null);
      
      if (cycle >= totalCycles) {
        setGameComplete(true);
      } else {
        setCycle(c => c + 1);
        setCanTap(true);
      }
    }, 600);
  }, [canTap, gameComplete, getEclipseProximity, eclipseWindow, cycle, totalCycles]);

  // Complete game
  useEffect(() => {
    if (gameComplete) {
      const accuracy = Math.round((hits / totalCycles) * 100);
      const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result,
        });
      }, 500);
    }
  }, [gameComplete, hits, totalCycles, onComplete]);

  const proximity = getEclipseProximity();
  const isNearEclipse = proximity <= eclipseWindow * 1.5;

  return (
    <div className="p-6 flex flex-col items-center">
      <h3 className="text-lg font-bold text-foreground mb-2">Eclipse Timing Duel</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Cycle {cycle}/{totalCycles} - Tap when sun and moon align!
      </p>

      {/* Score display */}
      <div className="flex gap-4 mb-4 text-sm">
        <span className="text-green-400">Hits: {hits}</span>
        <span className="text-red-400">Misses: {misses}</span>
      </div>

      {/* Orbital arena */}
      <div 
        className="relative w-64 h-64 rounded-full border-2 border-border mb-6 cursor-pointer"
        onClick={handleTap}
        style={{
          background: isNearEclipse 
            ? 'radial-gradient(circle, hsl(var(--primary)/0.2) 0%, transparent 70%)' 
            : 'transparent',
        }}
      >
        {/* Orbital path */}
        <div className="absolute inset-4 rounded-full border border-border/50" />
        
        {/* Center point */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-muted" />

        {/* Sun */}
        <motion.div
          className="absolute w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, hsl(38, 92%, 50%) 0%, hsl(38, 92%, 40%) 100%)',
            boxShadow: '0 0 20px hsl(38, 92%, 50%)',
            top: '50%',
            left: '50%',
            x: Math.cos((sunAngle * Math.PI) / 180) * 90 - 24,
            y: Math.sin((sunAngle * Math.PI) / 180) * 90 - 24,
          }}
        >
          <span className="text-lg">☀️</span>
        </motion.div>

        {/* Moon */}
        <motion.div
          className="absolute w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: 'radial-gradient(circle, hsl(220, 20%, 70%) 0%, hsl(220, 20%, 40%) 100%)',
            boxShadow: '0 0 15px hsl(220, 20%, 60%)',
            top: '50%',
            left: '50%',
            x: Math.cos((moonAngle * Math.PI) / 180) * 90 - 20,
            y: Math.sin((moonAngle * Math.PI) / 180) * 90 - 20,
          }}
        >
          <span className="text-lg">🌙</span>
        </motion.div>

        {/* Eclipse effect when aligned */}
        {proximity <= eclipseWindow && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0.4, 0.8] }}
            style={{
              background: 'radial-gradient(circle, white 0%, transparent 70%)',
              boxShadow: '0 0 40px white',
            }}
          />
        )}

        {/* Feedback overlay */}
        {showFeedback && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center rounded-full"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <span className={`text-4xl font-black ${
              showFeedback === 'perfect' ? 'text-yellow-400' :
              showFeedback === 'good' ? 'text-green-400' : 'text-red-400'
            }`}>
              {showFeedback === 'perfect' ? '✨ PERFECT!' :
               showFeedback === 'good' ? '👍 GOOD!' : '❌ MISS'}
            </span>
          </motion.div>
        )}
      </div>

      {/* Tap instruction */}
      <motion.p
        className={`text-sm font-medium ${isNearEclipse ? 'text-primary' : 'text-muted-foreground'}`}
        animate={{ scale: isNearEclipse ? [1, 1.1, 1] : 1 }}
        transition={{ duration: 0.3, repeat: isNearEclipse ? Infinity : 0 }}
      >
        {canTap 
          ? (isNearEclipse ? '🌑 TAP NOW!' : 'Wait for alignment...')
          : 'Wait...'}
      </motion.p>

      {/* Proximity indicator */}
      <div className="mt-4 w-full max-w-xs">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full transition-all duration-100"
            style={{
              width: `${Math.max(0, 100 - proximity)}%`,
              background: proximity <= eclipseWindow 
                ? 'linear-gradient(90deg, hsl(38, 92%, 50%), white)' 
                : 'hsl(var(--muted-foreground))',
            }}
          />
        </div>
        <p className="text-xs text-center text-muted-foreground mt-1">Eclipse Proximity</p>
      </div>
    </div>
  );
};
