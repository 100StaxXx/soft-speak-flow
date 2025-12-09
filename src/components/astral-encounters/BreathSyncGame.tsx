import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';

interface BreathSyncGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export const BreathSyncGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium' 
}: BreathSyncGameProps) => {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [ringScale, setRingScale] = useState(1);
  const [isExpanding, setIsExpanding] = useState(true);
  const [syncScore, setSyncScore] = useState(0);
  const [totalTaps, setTotalTaps] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [gameComplete, setGameComplete] = useState(false);
  const [showFeedback, setShowFeedback] = useState<'perfect' | 'good' | 'miss' | null>(null);
  
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const completedRef = useRef(false); // Guard against double completion
  
  const totalCycles = 3;
  const tapsPerCycle = 3; // One tap per phase transition
  
  // Soul stat affects sync window (more forgiving timing)
  const soulBonus = Math.min(companionStats.soul / 100, 1);
  const syncWindow = difficulty === 'easy' ? 0.3 : difficulty === 'medium' ? 0.2 : 0.15;
  const adjustedSyncWindow = syncWindow + (soulBonus * 0.1);
  
  // Cycle timing
  const cycleDuration = 6000; // 6 seconds per full cycle
  const inhaleTime = cycleDuration * 0.4;
  const holdTime = cycleDuration * 0.2;
  const exhaleTime = cycleDuration * 0.4;

  // Ring animation
  useEffect(() => {
    if (gameComplete) return;

    const startTime = Date.now();
    lastTimeRef.current = startTime;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const cycleTime = elapsed % cycleDuration;
      
      let newPhase: 'inhale' | 'hold' | 'exhale';
      let newScale: number;
      
      if (cycleTime < inhaleTime) {
        newPhase = 'inhale';
        const progress = cycleTime / inhaleTime;
        newScale = 1 + (progress * 0.5); // 1 to 1.5
        setIsExpanding(true);
      } else if (cycleTime < inhaleTime + holdTime) {
        newPhase = 'hold';
        newScale = 1.5;
        setIsExpanding(false);
      } else {
        newPhase = 'exhale';
        const progress = (cycleTime - inhaleTime - holdTime) / exhaleTime;
        newScale = 1.5 - (progress * 0.5); // 1.5 to 1
        setIsExpanding(false);
      }
      
      setPhase(newPhase);
      setRingScale(newScale);
      
      // Check for cycle completion
      const currentCycleNumber = Math.floor(elapsed / cycleDuration) + 1;
      if (currentCycleNumber > currentCycle && currentCycleNumber <= totalCycles) {
        setCurrentCycle(currentCycleNumber);
      } else if (currentCycleNumber > totalCycles && !gameComplete && !completedRef.current) {
        completedRef.current = true;
        setGameComplete(true);
        // Round syncScore to handle decimal values (0.7 for 'good' hits)
        const roundedScore = Math.round(syncScore);
        const maxScore = totalCycles * tapsPerCycle;
        const accuracy = maxScore > 0 ? Math.min(100, Math.round((roundedScore / maxScore) * 100)) : 0;
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail'
        });
        return;
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [cycleDuration, inhaleTime, holdTime, exhaleTime, currentCycle, gameComplete, syncScore, totalTaps, onComplete]);

  const handleTap = useCallback(() => {
    if (gameComplete) return;
    
    setTotalTaps(prev => prev + 1);
    
    // Check if tap is at transition point (scale near 1.0 or 1.5)
    const nearInhaleStart = Math.abs(ringScale - 1) < adjustedSyncWindow;
    const nearHoldPoint = Math.abs(ringScale - 1.5) < adjustedSyncWindow;
    const isAtTransition = nearInhaleStart || nearHoldPoint;
    
    if (isAtTransition) {
      const distance = nearInhaleStart ? Math.abs(ringScale - 1) : Math.abs(ringScale - 1.5);
      const perfectThreshold = adjustedSyncWindow * 0.5;
      
      if (distance < perfectThreshold) {
        setSyncScore(prev => prev + 1);
        setShowFeedback('perfect');
      } else {
        setSyncScore(prev => prev + 0.7);
        setShowFeedback('good');
      }
    } else {
      setShowFeedback('miss');
    }
    
    setTimeout(() => setShowFeedback(null), 300);
  }, [gameComplete, ringScale, adjustedSyncWindow]);

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-foreground mb-2">Breath Sync Battle</h3>
        <p className="text-sm text-muted-foreground">
          Tap when the ring reaches its peak or valley
        </p>
      </div>

      {/* Cycle counter */}
      <div className="flex gap-2">
        {Array.from({ length: totalCycles }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full ${
              i < currentCycle - 1 
                ? 'bg-primary' 
                : i === currentCycle - 1
                  ? 'bg-primary animate-pulse'
                  : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Breathing ring */}
      <div 
        className="relative w-64 h-64 flex items-center justify-center cursor-pointer"
        onClick={handleTap}
      >
        {/* Outer guide ring */}
        <div className="absolute w-48 h-48 rounded-full border-2 border-dashed border-muted-foreground/30" />
        <div className="absolute w-64 h-64 rounded-full border-2 border-dashed border-muted-foreground/30" />
        
        {/* Animated breathing ring */}
        <motion.div
          className={`absolute rounded-full ${
            phase === 'inhale' 
              ? 'bg-gradient-to-br from-primary/40 to-accent/40 border-primary' 
              : phase === 'hold'
                ? 'bg-gradient-to-br from-primary/60 to-accent/60 border-primary'
                : 'bg-gradient-to-br from-accent/40 to-primary/40 border-accent'
          } border-4`}
          style={{
            width: `${ringScale * 160}px`,
            height: `${ringScale * 160}px`,
          }}
          animate={{
            boxShadow: phase === 'hold' 
              ? '0 0 40px hsl(var(--primary) / 0.5)' 
              : '0 0 20px hsl(var(--primary) / 0.3)',
          }}
        />
        
        {/* Center indicator */}
        <div className="absolute w-4 h-4 rounded-full bg-foreground/80" />
        
        {/* Phase text */}
        <div className="absolute -bottom-2 text-sm font-medium text-muted-foreground capitalize">
          {phase}
        </div>

        {/* Feedback */}
        {showFeedback && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className={`absolute text-2xl font-bold ${
              showFeedback === 'perfect' 
                ? 'text-green-500' 
                : showFeedback === 'good'
                  ? 'text-primary'
                  : 'text-red-500'
            }`}
          >
            {showFeedback === 'perfect' ? '✨' : showFeedback === 'good' ? '👍' : '💨'}
          </motion.div>
        )}
      </div>

      {/* Score */}
      <div className="text-center">
        <p className="text-lg font-bold text-primary">
          Sync: {Math.round(syncScore)}/{totalCycles * tapsPerCycle}
        </p>
      </div>

      <p className="text-xs text-muted-foreground">
        Soul stat bonus: +{Math.round(soulBonus * 10)}% sync window
      </p>
    </div>
  );
};
