import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';

interface AstralFrequencyGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

export const AstralFrequencyGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: AstralFrequencyGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [sliderValue, setSliderValue] = useState(50);
  const [targetFrequency, setTargetFrequency] = useState(50);
  const [alignedTime, setAlignedTime] = useState(0);
  const [requiredTime, setRequiredTime] = useState(3);
  const [isAligned, setIsAligned] = useState(false);
  const [isPerfectlyAligned, setIsPerfectlyAligned] = useState(false);
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [wavePhases, setWavePhases] = useState([0, 0, 0]);
  const [showRoundComplete, setShowRoundComplete] = useState(false);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number }[]>([]);
  
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const particleIdRef = useRef(0);
  const lastAlignedRef = useRef(false);

  // Calculate stat bonus (Mind + Soul hybrid)
  const statBonus = Math.round((companionStats.mind + companionStats.soul) / 2);
  const alignmentTolerance = 10 + Math.floor(statBonus / 20) - Math.floor(questIntervalScale * 3);

  // Difficulty settings
  useEffect(() => {
    const settings = {
      easy: { rounds: 2, time: 2, targetSpeed: 0.3 },
      medium: { rounds: 3, time: 2.5, targetSpeed: 0.5 },
      hard: { rounds: 4, time: 3, targetSpeed: 0.7 },
    };
    const s = settings[difficulty];
    setTotalRounds(s.rounds + Math.floor(questIntervalScale));
    setRequiredTime(s.time + questIntervalScale * 0.5);
  }, [difficulty, questIntervalScale]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    setTargetFrequency(20 + Math.random() * 60);
  }, []);

  // Spawn alignment particles
  const spawnAlignmentParticles = useCallback(() => {
    const newParticles = [];
    for (let i = 0; i < 3; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x: 20 + Math.random() * 60,
        y: 30 + Math.random() * 40,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)));
    }, 800);
  }, []);

  // Animate waves and check alignment
  useEffect(() => {
    if (gameState !== 'playing') return;

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Update wave phases
      setWavePhases(prev => [
        (prev[0] + delta * 2) % (Math.PI * 2),
        (prev[1] + delta * 2.5) % (Math.PI * 2),
        (prev[2] + delta * 3) % (Math.PI * 2),
      ]);

      // Slowly drift target frequency
      setTargetFrequency(prev => {
        const drift = Math.sin(time / 2500) * 0.4;
        return Math.max(10, Math.min(90, prev + drift));
      });

      // Check alignment
      const diff = Math.abs(sliderValue - targetFrequency);
      const aligned = diff <= alignmentTolerance;
      const perfectlyAligned = diff <= alignmentTolerance / 3;
      
      setIsAligned(aligned);
      setIsPerfectlyAligned(perfectlyAligned);

      // Haptic feedback when entering/exiting alignment
      if (aligned && !lastAlignedRef.current) {
        triggerHaptic('light');
      }
      lastAlignedRef.current = aligned;

      if (aligned) {
        // Spawn particles while aligned
        if (Math.random() < 0.1) {
          spawnAlignmentParticles();
        }

        setAlignedTime(prev => {
          const newTime = prev + delta;
          if (newTime >= requiredTime) {
            // Round complete!
            const roundScore = Math.round(100 - diff);
            setScore(s => s + roundScore);
            setCombo(c => c + 1);
            setMaxCombo(m => Math.max(m, combo + 1));
            triggerHaptic('success');
            setShowRoundComplete(true);
            
            setTimeout(() => {
              setShowRoundComplete(false);
              if (round >= totalRounds) {
                setGameState('complete');
              } else {
                setRound(r => r + 1);
                setTargetFrequency(20 + Math.random() * 60);
                setAlignedTime(0);
              }
            }, 800);
            
            return 0;
          }
          return newTime;
        });
      } else {
        setAlignedTime(prev => {
          const newTime = Math.max(0, prev - delta * 0.3);
          if (newTime === 0 && combo > 0) {
            setCombo(0);
          }
          return newTime;
        });
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [sliderValue, targetFrequency, alignmentTolerance, requiredTime, round, totalRounds, gameState, combo, spawnAlignmentParticles]);

  // Complete game
  useEffect(() => {
    if (gameState === 'complete') {
      const maxScore = totalRounds * 100;
      const baseAccuracy = Math.round((score / maxScore) * 100);
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
  }, [gameState, score, totalRounds, maxCombo, onComplete]);

  // Handle slider change
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(e.target.value));
  };

  // Render wave SVG
  const renderWave = (index: number, freq: number, color: string, isTarget: boolean) => {
    const points: string[] = [];
    const width = 280;
    const height = 50;
    const frequency = freq / 10;
    
    for (let x = 0; x <= width; x += 2) {
      const y = height / 2 + Math.sin((x / 20) * frequency + wavePhases[index]) * (height / 2.5);
      points.push(`${x},${y}`);
    }
    
    return (
      <svg width={width} height={height} className="overflow-visible">
        {/* Glow effect */}
        <defs>
          <filter id={`glow-${index}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={isAligned && !isTarget ? 3 : 2}
          strokeLinecap="round"
          filter={isAligned ? `url(#glow-${index})` : undefined}
          style={{
            transition: 'stroke-width 0.2s',
          }}
        />
      </svg>
    );
  };

  const alignmentProgress = (alignedTime / requiredTime) * 100;

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
        title="Astral Frequency"
        subtitle={`Round ${round}/${totalRounds} - Match the cosmic wave!`}
        score={Math.round(score)}
        combo={combo}
        showCombo={true}
        phase={round - 1}
        totalPhases={totalRounds}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Alignment progress bar */}
      <div className="w-full max-w-xs mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Alignment Progress</span>
          <span className={isAligned ? 'text-primary font-bold' : ''}>{Math.round(alignmentProgress)}%</span>
        </div>
        <div className="h-4 bg-muted/50 rounded-full overflow-hidden border border-border/50 relative">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isPerfectlyAligned 
                ? 'linear-gradient(90deg, hsl(45, 100%, 50%), hsl(38, 92%, 60%), hsl(45, 100%, 50%))' 
                : isAligned 
                  ? 'linear-gradient(90deg, hsl(271, 91%, 65%), hsl(217, 91%, 60%))' 
                  : 'hsl(var(--muted-foreground))',
              boxShadow: isAligned ? '0 0 15px hsl(271, 91%, 65%)' : 'none',
            }}
            animate={{ width: `${alignmentProgress}%` }}
            transition={{ duration: 0.1 }}
          />
          
          {/* Progress markers */}
          <div className="absolute inset-0 flex items-center justify-around pointer-events-none">
            {[25, 50, 75].map(marker => (
              <div 
                key={marker}
                className={`w-0.5 h-2 ${alignmentProgress >= marker ? 'bg-white/50' : 'bg-white/20'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Wave display area */}
      <div className="relative w-full max-w-xs h-48 bg-gradient-to-br from-slate-900/80 via-background to-slate-900/80 rounded-xl border border-border/50 mb-4 flex flex-col items-center justify-center gap-3 overflow-hidden shadow-inner">
        {/* Background glow when aligned */}
        <AnimatePresence>
          {isAligned && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                background: isPerfectlyAligned
                  ? 'radial-gradient(ellipse at center, hsl(45, 100%, 50%, 0.15) 0%, transparent 70%)'
                  : 'radial-gradient(ellipse at center, hsl(271, 91%, 65%, 0.1) 0%, transparent 70%)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Floating particles when aligned */}
        <AnimatePresence>
          {particles.map(particle => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full bg-purple-400 pointer-events-none"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                boxShadow: '0 0 8px hsl(271, 91%, 65%)',
              }}
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: 0, y: -30 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            />
          ))}
        </AnimatePresence>
        
        {/* Target wave (top) */}
        <div className="relative z-10">
          <div className="absolute -left-10 top-1/2 -translate-y-1/2 text-xs text-purple-400 font-medium">Target</div>
          {renderWave(0, targetFrequency, 'hsl(271, 91%, 65%)', true)}
        </div>
        
        {/* Player wave (bottom) */}
        <div className="relative z-10">
          <div className="absolute -left-10 top-1/2 -translate-y-1/2 text-xs text-blue-400 font-medium">You</div>
          {renderWave(1, sliderValue, isPerfectlyAligned ? 'hsl(45, 100%, 50%)' : isAligned ? 'hsl(142, 76%, 46%)' : 'hsl(217, 91%, 60%)', false)}
        </div>

        {/* Merged effect when aligned */}
        <AnimatePresence>
          {isAligned && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                animate={{ 
                  scale: isPerfectlyAligned ? [1, 1.3, 1] : [1, 1.15, 1],
                  opacity: [0.6, 1, 0.6]
                }}
                transition={{ duration: 0.8, repeat: Infinity }}
              >
                <span className="text-4xl">{isPerfectlyAligned ? '🌟' : '✨'}</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Round complete overlay */}
        <AnimatePresence>
          {showRoundComplete && (
            <motion.div
              className="absolute inset-0 bg-background/80 flex items-center justify-center z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="text-center"
              >
                <span className="text-5xl">🎉</span>
                <p className="text-xl font-bold text-foreground mt-2">Synchronized!</p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Frequency slider */}
      <div className="w-full max-w-xs">
        <div className="relative">
          {/* Target indicator on slider */}
          <motion.div
            className="absolute -top-2 w-1 h-6 bg-purple-500 rounded-full z-10 pointer-events-none"
            style={{ left: `${targetFrequency}%` }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          
          <input
            type="range"
            min="0"
            max="100"
            value={sliderValue}
            onChange={handleSliderChange}
            className="w-full h-4 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(90deg, 
                hsl(217, 91%, 60%) 0%, 
                hsl(271, 91%, 65%) ${sliderValue}%, 
                hsl(var(--muted)) ${sliderValue}%, 
                hsl(var(--muted)) 100%)`,
            }}
          />
        </div>
        
        <div className="flex justify-between text-xs text-muted-foreground mt-2">
          <span>Low</span>
          <span className={`font-medium ${isAligned ? 'text-primary' : ''}`}>
            Frequency: {sliderValue} {isPerfectlyAligned && '🎯'}
          </span>
          <span>High</span>
        </div>
      </div>

      {/* Status */}
      <motion.div
        className={`mt-4 text-center ${isPerfectlyAligned ? 'text-yellow-400' : isAligned ? 'text-green-400' : 'text-muted-foreground'}`}
        animate={{ scale: isAligned ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 0.5, repeat: isAligned ? Infinity : 0 }}
      >
        <p className="text-sm font-medium">
          {isPerfectlyAligned 
            ? '⚡ PERFECT SYNC! Maximum power!' 
            : isAligned 
              ? '🌟 Frequencies aligned! Hold steady...' 
              : '🎚️ Adjust slider to match the target'}
        </p>
      </motion.div>

      {/* Stat bonus */}
      <p className="mt-2 text-xs text-muted-foreground">
        Mind + Soul bonus: ±{alignmentTolerance} tolerance
      </p>

      {/* Custom slider thumb styles */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, hsl(271, 91%, 65%), hsl(217, 91%, 60%));
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 0 15px hsl(271, 91%, 65%);
        }
        
        input[type="range"]::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, hsl(271, 91%, 65%), hsl(217, 91%, 60%));
          cursor: pointer;
          border: 3px solid white;
          box-shadow: 0 0 15px hsl(271, 91%, 65%);
        }
      `}</style>
    </div>
  );
};
