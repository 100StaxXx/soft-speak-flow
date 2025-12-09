import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';

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
  const [sliderValue, setSliderValue] = useState(50);
  const [targetFrequency, setTargetFrequency] = useState(50);
  const [alignedTime, setAlignedTime] = useState(0);
  const [requiredTime, setRequiredTime] = useState(3);
  const [isAligned, setIsAligned] = useState(false);
  const [round, setRound] = useState(1);
  const [totalRounds, setTotalRounds] = useState(3);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [wavePhases, setWavePhases] = useState([0, 0, 0]);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Calculate stat bonus (Mind + Soul hybrid)
  const statBonus = Math.round((companionStats.mind + companionStats.soul) / 2);
  const alignmentTolerance = 8 + Math.floor(statBonus / 20) - Math.floor(questIntervalScale * 3);

  // Difficulty settings
  useEffect(() => {
    const settings = {
      easy: { rounds: 2, time: 2.5, targetSpeed: 0.3 },
      medium: { rounds: 3, time: 3, targetSpeed: 0.5 },
      hard: { rounds: 4, time: 4, targetSpeed: 0.7 },
    };
    const s = settings[difficulty];
    setTotalRounds(s.rounds + Math.floor(questIntervalScale));
    setRequiredTime(s.time + questIntervalScale * 0.5);
  }, [difficulty, questIntervalScale]);

  // Animate waves and check alignment
  useEffect(() => {
    if (gameComplete) return;

    const animate = (time: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = time;
      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      // Update wave phases for animation
      setWavePhases(prev => [
        (prev[0] + delta * 2) % (Math.PI * 2),
        (prev[1] + delta * 2.5) % (Math.PI * 2),
        (prev[2] + delta * 3) % (Math.PI * 2),
      ]);

      // Slowly drift target frequency
      setTargetFrequency(prev => {
        const drift = Math.sin(time / 2000) * 0.5;
        return Math.max(10, Math.min(90, prev + drift));
      });

      // Check alignment
      const aligned = Math.abs(sliderValue - targetFrequency) <= alignmentTolerance;
      setIsAligned(aligned);

      if (aligned) {
        setAlignedTime(prev => {
          const newTime = prev + delta;
          if (newTime >= requiredTime) {
            // Round complete
            const roundScore = Math.round(100 - Math.abs(sliderValue - targetFrequency));
            setScore(s => s + roundScore);
            
            if (round >= totalRounds) {
              setGameComplete(true);
              return newTime;
            } else {
              setRound(r => r + 1);
              setTargetFrequency(20 + Math.random() * 60);
              return 0;
            }
          }
          return newTime;
        });
      } else {
        setAlignedTime(prev => Math.max(0, prev - delta * 0.5));
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [sliderValue, targetFrequency, alignmentTolerance, requiredTime, round, totalRounds, gameComplete]);

  // Complete game
  useEffect(() => {
    if (gameComplete) {
      const maxScore = totalRounds * 100;
      const accuracy = Math.round((score / maxScore) * 100);
      const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result,
        });
      }, 500);
    }
  }, [gameComplete, score, totalRounds, onComplete]);

  const renderWave = (index: number, baseFreq: number, color: string, isTarget: boolean) => {
    const points: string[] = [];
    const width = 280;
    const height = 40;
    const freq = isTarget ? targetFrequency / 10 : sliderValue / 10;
    
    for (let x = 0; x <= width; x += 2) {
      const y = height / 2 + Math.sin((x / 20) * freq + wavePhases[index]) * (height / 3);
      points.push(`${x},${y}`);
    }
    
    return (
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={color}
          strokeWidth={isAligned && isTarget ? 3 : 2}
          style={{
            filter: isAligned && isTarget ? `drop-shadow(0 0 8px ${color})` : 'none',
            transition: 'filter 0.3s',
          }}
        />
      </svg>
    );
  };

  return (
    <div className="p-6 flex flex-col items-center">
      <h3 className="text-lg font-bold text-foreground mb-2">Astral Frequency Align</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Round {round}/{totalRounds} - Align your frequency with the cosmic wave
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs mb-6">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>Alignment Progress</span>
          <span>{Math.round((alignedTime / requiredTime) * 100)}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: isAligned 
                ? 'linear-gradient(90deg, hsl(271, 91%, 65%), hsl(217, 91%, 60%))' 
                : 'hsl(var(--muted-foreground))',
              boxShadow: isAligned ? '0 0 10px hsl(271, 91%, 65%)' : 'none',
            }}
            animate={{ width: `${(alignedTime / requiredTime) * 100}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      </div>

      {/* Wave display area */}
      <div className="relative w-full max-w-xs h-40 bg-background/50 rounded-lg border border-border mb-6 flex flex-col items-center justify-center gap-2 overflow-hidden">
        {/* Background glow when aligned */}
        {isAligned && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-blue-500/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
        
        {/* Target wave (top) */}
        <div className="relative z-10">
          {renderWave(0, targetFrequency, 'hsl(271, 91%, 65%)', true)}
          <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-xs text-purple-400">Target</span>
        </div>
        
        {/* Player wave (bottom) */}
        <div className="relative z-10">
          {renderWave(1, sliderValue, isAligned ? 'hsl(142, 76%, 46%)' : 'hsl(217, 91%, 60%)', false)}
          <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-xs text-blue-400">You</span>
        </div>

        {/* Merged effect when aligned */}
        {isAligned && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <span className="text-2xl">✨</span>
          </motion.div>
        )}
      </div>

      {/* Frequency slider */}
      <div className="w-full max-w-xs">
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={(e) => setSliderValue(Number(e.target.value))}
          className="w-full h-3 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(90deg, hsl(217, 91%, 60%) 0%, hsl(271, 91%, 65%) 100%)`,
          }}
        />
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>Low</span>
          <span>Frequency: {sliderValue}</span>
          <span>High</span>
        </div>
      </div>

      {/* Status */}
      <motion.p
        className={`mt-4 text-sm font-medium ${isAligned ? 'text-green-400' : 'text-muted-foreground'}`}
        animate={{ scale: isAligned ? [1, 1.05, 1] : 1 }}
        transition={{ duration: 0.5, repeat: isAligned ? Infinity : 0 }}
      >
        {isAligned ? '🌟 Frequencies Aligned! Hold steady...' : 'Adjust to match the target frequency'}
      </motion.p>
    </div>
  );
};
