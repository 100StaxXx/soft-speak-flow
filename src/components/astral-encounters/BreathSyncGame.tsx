import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Activity, Sparkles } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { MiniGameHud } from './MiniGameHud';

interface BreathSyncGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number; // -0.15 to +0.15
}

export const BreathSyncGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0
}: BreathSyncGameProps) => {
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [ringScale, setRingScale] = useState(1);
  const [syncScore, setSyncScore] = useState(0);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [gameComplete, setGameComplete] = useState(false);
  const [showFeedback, setShowFeedback] = useState<'perfect' | 'good' | 'miss' | null>(null);
  const [phaseProgress, setPhaseProgress] = useState(0);
  const [tapPulseKey, setTapPulseKey] = useState(0);
  
  const animationRef = useRef<number | null>(null);
  const completedRef = useRef(false); // Guard against double completion
  const syncScoreRef = useRef(0);
  const currentCycleRef = useRef(1);
  const gameCompleteRef = useRef(false);
  
  const totalCycles = 3;
  const tapsPerCycle = 3; // One tap per phase transition
  
  // Soul stat affects sync window (more forgiving timing)
  const soulBonus = Math.min(companionStats.soul / 100, 1);
  const baseSyncWindow = difficulty === 'easy' ? 0.22 : difficulty === 'medium' ? 0.15 : 0.10;
  // Quest interval scaling: more quests waited = tighter sync window
  const syncWindow = baseSyncWindow * (1 - questIntervalScale * 0.5);
  const adjustedSyncWindow = syncWindow + (soulBonus * 0.06);
  const difficultyLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  const questDriftPercent = Math.round(questIntervalScale * 100);
  const questDriftLabel = questDriftPercent === 0 
    ? 'Balanced rhythm'
    : `${questDriftPercent > 0 ? '+' : ''}${questDriftPercent}% tempo`;
  const questDriftTone = questDriftPercent > 0 ? 'warning' : questDriftPercent < 0 ? 'positive' : 'default';
  const soulBonusPercent = Math.round(soulBonus * 10);
  const infoChips = [
    { label: 'Difficulty', value: difficultyLabel, tone: 'accent' as const, icon: <Wind className="w-3.5 h-3.5" /> },
    { 
      label: 'Quest drift', 
      value: questDriftLabel, 
      tone: questDriftTone,
      helperText: questDriftPercent === 0 ? 'Standard cadence' : questDriftPercent > 0 ? 'Faster breath cycles' : 'Slower breath cycles',
      icon: <Activity className="w-3.5 h-3.5" />,
    },
    { 
      label: 'Soul focus', 
      value: `+${soulBonusPercent}% window`, 
      tone: 'positive' as const,
      helperText: 'Sync tolerance',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
  ];
  
  // Cycle timing
  const cycleDuration = 6000; // 6 seconds per full cycle
  const inhaleTime = cycleDuration * 0.4;
  const holdTime = cycleDuration * 0.2;
  const exhaleTime = cycleDuration * 0.4;

  // Ring animation
  useEffect(() => {
    if (gameComplete) return;

    const startTime = performance.now();

    const animate = () => {
      if (completedRef.current || gameCompleteRef.current) return;

      const elapsed = performance.now() - startTime;
      const cycleTime = elapsed % cycleDuration;
      
      let newPhase: 'inhale' | 'hold' | 'exhale';
      let newScale: number;
      
      let phaseProgressValue = 0;
      if (cycleTime < inhaleTime) {
        newPhase = 'inhale';
        phaseProgressValue = cycleTime / inhaleTime;
        newScale = 1 + (phaseProgressValue * 0.5); // 1 to 1.5
      } else if (cycleTime < inhaleTime + holdTime) {
        newPhase = 'hold';
        phaseProgressValue = (cycleTime - inhaleTime) / holdTime;
        newScale = 1.5;
      } else {
        newPhase = 'exhale';
        phaseProgressValue = (cycleTime - inhaleTime - holdTime) / exhaleTime;
        newScale = 1.5 - (phaseProgressValue * 0.5); // 1.5 to 1
      }
      
      setPhase(newPhase);
      setRingScale(newScale);
      setPhaseProgress(phaseProgressValue);
      
      // Check for cycle completion
      const cycleNumber = Math.floor(elapsed / cycleDuration) + 1;
      if (cycleNumber > currentCycleRef.current && cycleNumber <= totalCycles) {
        currentCycleRef.current = cycleNumber;
        setCurrentCycle(cycleNumber);
      } else if (cycleNumber > totalCycles && !completedRef.current) {
        completedRef.current = true;
        gameCompleteRef.current = true;
        setGameComplete(true);
        const maxScore = totalCycles * tapsPerCycle;
        const accuracy = maxScore > 0 ? Math.min(100, Math.round((syncScoreRef.current / maxScore) * 100)) : 0;
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
  }, [cycleDuration, inhaleTime, holdTime, exhaleTime, gameComplete, onComplete, totalCycles, tapsPerCycle]);

  const handleTap = useCallback(() => {
    if (gameComplete || completedRef.current) return;
    
    // Check if tap is at transition point (scale near 1.0 or 1.5)
    const nearInhaleStart = Math.abs(ringScale - 1) < adjustedSyncWindow;
    const nearHoldPoint = Math.abs(ringScale - 1.5) < adjustedSyncWindow;
    const isAtTransition = nearInhaleStart || nearHoldPoint;
    
    if (isAtTransition) {
      const distance = nearInhaleStart ? Math.abs(ringScale - 1) : Math.abs(ringScale - 1.5);
      const perfectThreshold = adjustedSyncWindow * 0.5;
      
      if (distance < perfectThreshold) {
        syncScoreRef.current += 1;
        setSyncScore(prev => prev + 1);
        setShowFeedback('perfect');
      } else {
        syncScoreRef.current += 0.7;
        setSyncScore(prev => prev + 0.7);
        setShowFeedback('good');
      }
    } else {
      setShowFeedback('miss');
    }
    
    setTapPulseKey((key) => key + 1);
    setTimeout(() => setShowFeedback(null), 300);
  }, [gameComplete, ringScale, adjustedSyncWindow]);

  const phaseOrder: Array<'inhale' | 'hold' | 'exhale'> = ['inhale', 'hold', 'exhale'];
  const phaseIndex = phaseOrder.indexOf(phase);
  const statusBarContent = (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Cycle</p>
          <p className="font-semibold">{currentCycle}/{totalCycles}</p>
        </div>
        <div className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary capitalize">
          {phase}
        </div>
        <div className="text-xs text-muted-foreground">
          Sync {Math.round(syncScore)}/{totalCycles * tapsPerCycle}
        </div>
      </div>
      <div className="flex gap-1 text-[10px] uppercase tracking-widest text-muted-foreground/80">
        {phaseOrder.map((entry, idx) => {
          const isActive = phaseIndex === idx;
          const isComplete = phaseIndex > idx;
          const fillPercent = isComplete ? 100 : isActive ? Math.min(phaseProgress * 100, 100) : 0;
          return (
            <div key={entry} className="flex-1">
              <div className="mb-1 text-center">{entry.slice(0, 3)}</div>
              <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                <motion.div
                  className={`h-full ${isComplete ? 'bg-primary' : 'bg-primary/70'}`}
                  style={{ width: `${fillPercent}%` }}
                  animate={{ width: `${fillPercent}%` }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 justify-center">
        {Array.from({ length: totalCycles }).map((_, i) => (
          <div
            key={i}
            className={`h-2 w-10 rounded-full ${
              i < currentCycle - 1 
                ? 'bg-primary' 
                : i === currentCycle - 1
                  ? 'bg-primary animate-pulse'
                  : 'bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  );

  return (
    <MiniGameHud
      title="Breath Sync Battle"
      subtitle="Tap when the ring hits the peak (inhale/hold) or valley (exhale)."
      eyebrow="Breath Alignment"
      chips={infoChips}
      statusBar={statusBarContent}
      footerNote={`Soul stat bonus: +${soulBonusPercent}% sync window`}
    >
      <div 
        className="relative w-64 h-64 flex items-center justify-center cursor-pointer mx-auto"
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
        <AnimatePresence mode="wait">
          <motion.div
            key={tapPulseKey}
            className="absolute rounded-full border-2 border-primary/30"
            initial={{ width: 60, height: 60, opacity: 0.5 }}
            animate={{ width: 180, height: 180, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </AnimatePresence>
        
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
    </MiniGameHud>
  );
};
