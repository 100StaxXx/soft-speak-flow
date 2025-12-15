import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Timer } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useGameLoop, useParticleSystem } from './gameUtils';

interface AstralFrequencyGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

// Round timer component
const RoundTimer = memo(({ timeLeft, maxTime, isUrgent }: { timeLeft: number; maxTime: number; isUrgent: boolean }) => (
  <div className="w-full max-w-xs mb-2">
    <div className="flex items-center justify-between text-xs mb-1">
      <div className="flex items-center gap-1">
        <Timer className={`w-3 h-3 ${isUrgent ? 'text-red-400 animate-pulse' : 'text-muted-foreground'}`} />
        <span className={isUrgent ? 'text-red-400 font-bold' : 'text-muted-foreground'}>
          {timeLeft.toFixed(1)}s
        </span>
      </div>
      {isUrgent && <span className="text-red-400 text-xs animate-pulse">⚠️ Hurry!</span>}
    </div>
    <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
      <motion.div
        className="h-full rounded-full"
        animate={{ width: `${(timeLeft / maxTime) * 100}%` }}
        transition={{ duration: 0.1 }}
        style={{
          background: isUrgent 
            ? 'linear-gradient(90deg, #ef4444, #f97316)'
            : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
          boxShadow: isUrgent ? '0 0 10px #ef4444' : 'none',
        }}
      />
    </div>
  </div>
));
RoundTimer.displayName = 'RoundTimer';

// Memoized alignment progress bar
const AlignmentProgressBar = memo(({ 
  alignmentProgress, 
  isAligned, 
  isPerfectlyAligned,
  stabilityBonus
}: { 
  alignmentProgress: number;
  isAligned: boolean;
  isPerfectlyAligned: boolean;
  stabilityBonus: number;
}) => (
  <div className="w-full max-w-xs mb-4">
    <div className="flex justify-between text-xs text-muted-foreground mb-1">
      <span>Alignment Progress</span>
      <div className="flex items-center gap-2">
        {stabilityBonus > 0 && (
          <span className="text-green-400 text-[10px]">+{stabilityBonus}% stable</span>
        )}
        <span className={isAligned ? 'text-primary font-bold' : ''}>{Math.round(alignmentProgress)}%</span>
      </div>
    </div>
    <div className="h-4 bg-muted/50 rounded-full overflow-hidden border border-border/50 relative">
      <div
        className="h-full rounded-full transition-all duration-100"
        style={{
          width: `${alignmentProgress}%`,
          background: isPerfectlyAligned 
            ? 'linear-gradient(90deg, hsl(45, 100%, 50%), hsl(38, 92%, 60%), hsl(45, 100%, 50%))' 
            : isAligned 
              ? 'linear-gradient(90deg, hsl(271, 91%, 65%), hsl(217, 91%, 60%))' 
              : 'hsl(var(--muted-foreground))',
          boxShadow: isAligned ? '0 0 15px hsl(271, 91%, 65%)' : 'none',
        }}
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
));
AlignmentProgressBar.displayName = 'AlignmentProgressBar';

// Interference warning component
const InterferenceWarning = memo(({ active, intensity }: { active: boolean; intensity: number }) => (
  <AnimatePresence>
    {active && (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/50"
      >
        <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />
        <span className="text-[10px] text-red-400 font-medium">
          Interference {Math.round(intensity * 100)}%
        </span>
      </motion.div>
    )}
  </AnimatePresence>
));
InterferenceWarning.displayName = 'InterferenceWarning';

// Memoized particle renderer
const ParticleRenderer = memo(({ particles }: { particles: { id: number; x: number; y: number; color: string; life: number; maxLife: number }[] }) => (
  <>
    {particles.map(particle => (
      <div
        key={particle.id}
        className="absolute w-2 h-2 rounded-full pointer-events-none gpu-accelerated"
        style={{
          left: `${particle.x}%`,
          top: `${particle.y}%`,
          backgroundColor: particle.color,
          boxShadow: `0 0 8px ${particle.color}`,
          opacity: particle.life / particle.maxLife,
          transform: `translate(-50%, -50%) translateY(${-30 * (1 - particle.life / particle.maxLife)}px)`,
        }}
      />
    ))}
  </>
));
ParticleRenderer.displayName = 'ParticleRenderer';

// Memoized wave SVG component with noise effect
interface WaveSVGProps {
  frequency: number;
  phase: number;
  color: string;
  isAligned: boolean;
  index: number;
  noiseAmount?: number;
}

const WaveSVG = memo(({ frequency, phase, color, isAligned, index, noiseAmount = 0 }: WaveSVGProps) => {
  const points = useMemo(() => {
    const width = 280;
    const height = 50;
    const freq = frequency / 10;
    const pts: string[] = [];
    
    for (let x = 0; x <= width; x += 4) {
      const noise = noiseAmount * (Math.random() - 0.5) * 10;
      const y = height / 2 + Math.sin((x / 20) * freq + phase) * (height / 2.5) + noise;
      pts.push(`${x},${Math.max(5, Math.min(height - 5, y))}`);
    }
    
    return pts.join(' ');
  }, [frequency, phase, noiseAmount]);

  return (
    <svg width={280} height={50} className="overflow-visible">
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
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={isAligned ? 3 : 2}
        strokeLinecap="round"
        filter={isAligned ? `url(#glow-${index})` : undefined}
      />
    </svg>
  );
});
WaveSVG.displayName = 'WaveSVG';

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
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [showRoundComplete, setShowRoundComplete] = useState(false);
  const [roundTimeLeft, setRoundTimeLeft] = useState(15);
  const [interferenceActive, setInterferenceActive] = useState(false);
  const [interferenceIntensity, setInterferenceIntensity] = useState(0);
  const [stabilityBonus, setStabilityBonus] = useState(0);
  const [lastSliderValue, setLastSliderValue] = useState(50);
  
  // Use refs for animation state
  const wavePhasesRef = useRef([0, 0, 0]);
  const [wavePhases, setWavePhases] = useState([0, 0, 0]);
  const gameStateRef = useRef(gameState);
  const sliderValueRef = useRef(sliderValue);
  const targetFrequencyRef = useRef(targetFrequency);
  const alignedTimeRef = useRef(alignedTime);
  const lastAlignedRef = useRef(false);
  const roundTimeRef = useRef(roundTimeLeft);
  const interferenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const targetShiftTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep refs in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { sliderValueRef.current = sliderValue; }, [sliderValue]);
  useEffect(() => { targetFrequencyRef.current = targetFrequency; }, [targetFrequency]);
  useEffect(() => { alignedTimeRef.current = alignedTime; }, [alignedTime]);
  useEffect(() => { roundTimeRef.current = roundTimeLeft; }, [roundTimeLeft]);

  // Use particle system
  const { particles, emit: emitParticles } = useParticleSystem(20);

  // Calculate stat bonus (Mind + Soul hybrid)
  const statBonus = Math.round((companionStats.mind + companionStats.soul) / 2);
  const alignmentTolerance = 10 + Math.floor(statBonus / 20) - Math.floor(questIntervalScale * 3);

  // Memoized difficulty settings
  const settings = useMemo(() => {
    const base = {
      easy: { rounds: 2, time: 2, targetSpeed: 0.3, roundTime: 18, interferenceChance: 0.1 },
      medium: { rounds: 3, time: 2.5, targetSpeed: 0.5, roundTime: 15, interferenceChance: 0.2 },
      hard: { rounds: 4, time: 3, targetSpeed: 0.7, roundTime: 12, interferenceChance: 0.35 },
    };
    const s = base[difficulty];
    return {
      totalRounds: s.rounds + Math.floor(questIntervalScale),
      requiredTime: s.time + questIntervalScale * 0.5,
      targetSpeed: s.targetSpeed,
      roundTime: s.roundTime - questIntervalScale * 2,
      interferenceChance: s.interferenceChance + questIntervalScale * 0.1,
    };
  }, [difficulty, questIntervalScale]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    setTargetFrequency(20 + Math.random() * 60);
    setRoundTimeLeft(settings.roundTime);
  }, [settings.roundTime]);

  // Target frequency shift every 5 seconds
  useEffect(() => {
    if (gameState === 'playing') {
      targetShiftTimerRef.current = setInterval(() => {
        // Shift target to a new position
        setTargetFrequency(prev => {
          const shift = (Math.random() - 0.5) * 30;
          const newTarget = Math.max(15, Math.min(85, prev + shift));
          triggerHaptic('light');
          return newTarget;
        });
      }, 5000);
    }
    
    return () => {
      if (targetShiftTimerRef.current) {
        clearInterval(targetShiftTimerRef.current);
      }
    };
  }, [gameState]);

  // Interference waves
  useEffect(() => {
    if (gameState === 'playing') {
      interferenceTimerRef.current = setInterval(() => {
        if (Math.random() < settings.interferenceChance) {
          setInterferenceActive(true);
          setInterferenceIntensity(0.3 + Math.random() * 0.5);
          triggerHaptic('medium');
          
          // Interference lasts 2-4 seconds
          setTimeout(() => {
            setInterferenceActive(false);
            setInterferenceIntensity(0);
          }, 2000 + Math.random() * 2000);
        }
      }, 3000);
    }
    
    return () => {
      if (interferenceTimerRef.current) {
        clearInterval(interferenceTimerRef.current);
      }
    };
  }, [gameState, settings.interferenceChance]);

  // Track stability bonus
  useEffect(() => {
    const diff = Math.abs(sliderValue - lastSliderValue);
    if (diff < 2) {
      setStabilityBonus(prev => Math.min(15, prev + 0.5));
    } else {
      setStabilityBonus(prev => Math.max(0, prev - 2));
    }
    setLastSliderValue(sliderValue);
  }, [sliderValue, lastSliderValue]);

  // Optimized game loop
  useGameLoop((deltaTime, time) => {
    if (gameStateRef.current !== 'playing') return;

    // Update round timer
    setRoundTimeLeft(prev => {
      const newTime = prev - deltaTime;
      if (newTime <= 0) {
        // Round failed - time ran out
        setCombo(0);
        triggerHaptic('error');
        
        if (round >= settings.totalRounds) {
          setGameState('complete');
        } else {
          setShowRoundComplete(true);
          setTimeout(() => {
            setShowRoundComplete(false);
            setRound(r => r + 1);
            setTargetFrequency(20 + Math.random() * 60);
            setRoundTimeLeft(settings.roundTime);
            setAlignedTime(0);
          }, 800);
        }
        return 0;
      }
      return newTime;
    });

    // Update wave phases
    wavePhasesRef.current = [
      (wavePhasesRef.current[0] + deltaTime * 2) % (Math.PI * 2),
      (wavePhasesRef.current[1] + deltaTime * 2.5) % (Math.PI * 2),
      (wavePhasesRef.current[2] + deltaTime * 3) % (Math.PI * 2),
    ];
    setWavePhases([...wavePhasesRef.current]);

    // Slowly drift target frequency (less aggressive now with the 5s shifts)
    const drift = Math.sin(time / 3000) * 0.2;
    const newTarget = Math.max(10, Math.min(90, targetFrequencyRef.current + drift * deltaTime * 60));
    if (Math.abs(newTarget - targetFrequencyRef.current) > 0.1) {
      setTargetFrequency(newTarget);
    }

    // Check alignment (interference makes it harder)
    const effectiveTolerance = interferenceActive 
      ? alignmentTolerance * (1 - interferenceIntensity * 0.5)
      : alignmentTolerance;
    const diff = Math.abs(sliderValueRef.current - targetFrequencyRef.current);
    const aligned = diff <= effectiveTolerance;
    const perfectlyAligned = diff <= effectiveTolerance / 3;

    // Haptic feedback when entering alignment
    if (aligned && !lastAlignedRef.current) {
      triggerHaptic('light');
    }
    lastAlignedRef.current = aligned;

    if (aligned) {
      // Spawn particles while aligned
      if (Math.random() < 0.05) {
        emitParticles(
          20 + Math.random() * 60,
          30 + Math.random() * 40,
          perfectlyAligned ? '#fbbf24' : '#a855f7',
          2
        );
      }

      // Stability bonus speeds up alignment
      const stabilityMultiplier = 1 + (stabilityBonus / 100);
      const newAlignedTime = alignedTimeRef.current + deltaTime * stabilityMultiplier;
      setAlignedTime(newAlignedTime);
      
      if (newAlignedTime >= settings.requiredTime) {
        // Round complete!
        const roundScore = Math.round(100 - diff + stabilityBonus);
        setScore(s => s + roundScore);
        setCombo(c => {
          const newCombo = c + 1;
          setMaxCombo(m => Math.max(m, newCombo));
          return newCombo;
        });
        triggerHaptic('success');
        setShowRoundComplete(true);
        setAlignedTime(0);
        setStabilityBonus(0);
        
        setTimeout(() => {
          setShowRoundComplete(false);
          if (round >= settings.totalRounds) {
            setGameState('complete');
          } else {
            setRound(r => r + 1);
            setTargetFrequency(20 + Math.random() * 60);
            setRoundTimeLeft(settings.roundTime);
          }
        }, 800);
      }
    } else {
      const newAlignedTime = Math.max(0, alignedTimeRef.current - deltaTime * 0.3);
      setAlignedTime(newAlignedTime);
      if (newAlignedTime === 0 && combo > 0) {
        setCombo(0);
      }
    }
  }, gameState === 'playing');

  // Complete game
  useEffect(() => {
    if (gameState === 'complete') {
      const maxScore = settings.totalRounds * 115; // 100 base + 15 stability bonus
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
  }, [gameState, score, settings.totalRounds, maxCombo, onComplete]);

  // Handle slider change
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(e.target.value));
  }, []);

  // Computed alignment state
  const effectiveTolerance = interferenceActive 
    ? alignmentTolerance * (1 - interferenceIntensity * 0.5)
    : alignmentTolerance;
  const diff = Math.abs(sliderValue - targetFrequency);
  const isAligned = diff <= effectiveTolerance;
  const isPerfectlyAligned = diff <= effectiveTolerance / 3;
  const alignmentProgress = (alignedTime / settings.requiredTime) * 100;
  const isTimeUrgent = roundTimeLeft <= 5;

  // Wave colors
  const playerWaveColor = isPerfectlyAligned ? 'hsl(45, 100%, 50%)' : isAligned ? 'hsl(142, 76%, 46%)' : 'hsl(217, 91%, 60%)';

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
        subtitle={`Round ${round}/${settings.totalRounds} - Match the cosmic wave!`}
        score={Math.round(score)}
        combo={combo}
        showCombo={true}
        phase={round - 1}
        totalPhases={settings.totalRounds}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Round timer */}
      <RoundTimer timeLeft={roundTimeLeft} maxTime={settings.roundTime} isUrgent={isTimeUrgent} />

      {/* Alignment progress bar - memoized */}
      <AlignmentProgressBar 
        alignmentProgress={alignmentProgress}
        isAligned={isAligned}
        isPerfectlyAligned={isPerfectlyAligned}
        stabilityBonus={Math.round(stabilityBonus)}
      />

      {/* Wave display area */}
      <div className="relative w-full max-w-xs h-48 bg-gradient-to-br from-slate-900/80 via-background to-slate-900/80 rounded-xl border border-border/50 mb-4 flex flex-col items-center justify-center gap-3 overflow-hidden shadow-inner">
        {/* Interference warning */}
        <InterferenceWarning active={interferenceActive} intensity={interferenceIntensity} />

        {/* Background glow when aligned */}
        {isAligned && (
          <div
            className="absolute inset-0 transition-opacity duration-300"
            style={{
              background: isPerfectlyAligned
                ? 'radial-gradient(ellipse at center, hsl(45, 100%, 50%, 0.15) 0%, transparent 70%)'
                : 'radial-gradient(ellipse at center, hsl(271, 91%, 65%, 0.1) 0%, transparent 70%)',
              opacity: isAligned ? 1 : 0,
            }}
          />
        )}

        {/* Interference visual noise */}
        {interferenceActive && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(239, 68, 68, ${interferenceIntensity * 0.1}) 2px,
                rgba(239, 68, 68, ${interferenceIntensity * 0.1}) 4px
              )`,
              animation: 'scanline 0.1s linear infinite',
            }}
          />
        )}

        {/* Particles - memoized */}
        <ParticleRenderer particles={particles} />
        
        {/* Target wave (top) */}
        <div className="relative z-10">
          <div className="absolute -left-10 top-1/2 -translate-y-1/2 text-xs text-purple-400 font-medium">Target</div>
          <WaveSVG
            frequency={targetFrequency}
            phase={wavePhases[0]}
            color="hsl(271, 91%, 65%)"
            isAligned={false}
            index={0}
            noiseAmount={interferenceActive ? interferenceIntensity * 0.3 : 0}
          />
        </div>
        
        {/* Player wave (bottom) */}
        <div className="relative z-10">
          <div className="absolute -left-10 top-1/2 -translate-y-1/2 text-xs text-blue-400 font-medium">You</div>
          <WaveSVG
            frequency={sliderValue}
            phase={wavePhases[1]}
            color={playerWaveColor}
            isAligned={isAligned}
            index={1}
            noiseAmount={interferenceActive ? interferenceIntensity * 0.5 : 0}
          />
        </div>

        {/* Merged effect when aligned */}
        <AnimatePresence>
          {isAligned && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
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
          <input
            type="range"
            min="0"
            max="100"
            value={sliderValue}
            onChange={handleSliderChange}
            className="w-full h-4 rounded-full appearance-none cursor-pointer frequency-slider"
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
      <div className={`mt-4 text-center ${isPerfectlyAligned ? 'text-yellow-400' : isAligned ? 'text-green-400' : 'text-muted-foreground'}`}>
        <p className={`text-sm font-medium ${isAligned ? 'scale-pulse' : ''}`}>
          {interferenceActive 
            ? '⚡ INTERFERENCE! Hold steady!'
            : isPerfectlyAligned 
              ? '⚡ PERFECT SYNC! Maximum power!' 
              : isAligned 
                ? '🌟 Frequencies aligned! Hold steady...' 
                : '🎚️ Adjust slider to match the target'}
        </p>
      </div>

      {/* Stat bonus */}
      <p className="mt-2 text-xs text-muted-foreground">
        Mind + Soul bonus: ±{alignmentTolerance} tolerance
      </p>

      {/* CSS animations */}
      <style>{`
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .scale-pulse {
          animation: scale-pulse 0.5s ease-in-out infinite;
        }
        @keyframes scale-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes scanline {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }
        .frequency-slider::-webkit-slider-thumb {
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
        .frequency-slider::-moz-range-thumb {
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
