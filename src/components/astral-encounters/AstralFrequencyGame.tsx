import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Lock } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useGameLoop, useParticleSystem } from './gameUtils';

interface AstralFrequencyGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
}

// Simplified difficulty configuration
const DIFFICULTY_CONFIG = {
  easy: {
    rounds: 2,
    lockOnTime: 1.5,
    roundTime: 40,
    decoyCount: 0,
    alignmentTolerance: 12,
    interferenceChance: 0,
  },
  medium: {
    rounds: 3,
    lockOnTime: 1.5,
    roundTime: 35,
    decoyCount: 1,
    alignmentTolerance: 10,
    interferenceChance: 0,
  },
  hard: {
    rounds: 4,
    lockOnTime: 1.5,
    roundTime: 30,
    decoyCount: 2,
    alignmentTolerance: 8,
    interferenceChance: 0.2,
  },
};

interface FrequencyTarget {
  x: number;
  isDecoy: boolean;
  isLocked: boolean;
  id: string;
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

// Lock-on ring component
const LockOnRing = memo(({ 
  progress, 
  isLocking, 
  isLocked,
  isDecoy = false
}: { 
  progress: number;
  isLocking: boolean;
  isLocked: boolean;
  isDecoy?: boolean;
}) => {
  const size = 76;
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress * circumference);
  
  return (
    <svg 
      className="absolute -inset-2 pointer-events-none" 
      width={size + 16} 
      height={size + 16}
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle
        cx={(size + 16) / 2}
        cy={(size + 16) / 2}
        r={radius + 8}
        fill="none"
        stroke={isDecoy ? 'rgba(239, 68, 68, 0.2)' : 'rgba(168, 85, 247, 0.2)'}
        strokeWidth={3}
      />
      <circle
        cx={(size + 16) / 2}
        cy={(size + 16) / 2}
        r={radius + 8}
        fill="none"
        stroke={isLocked ? '#22c55e' : isDecoy ? '#ef4444' : '#a855f7'}
        strokeWidth={3}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        style={{
          transition: 'stroke-dashoffset 0.1s ease-out',
          filter: isLocking ? `drop-shadow(0 0 6px ${isDecoy ? '#ef4444' : '#a855f7'})` : 'none'
        }}
      />
      {isLocked && (
        <g transform={`translate(${(size + 16) / 2 - 6}, ${(size + 16) / 2 - 6}) rotate(90 6 6)`}>
          <Lock className="w-3 h-3 text-green-400" />
        </g>
      )}
    </svg>
  );
});
LockOnRing.displayName = 'LockOnRing';

// Stun overlay
const StunOverlay = memo(({ active, timeLeft }: { active: boolean; timeLeft: number }) => (
  <AnimatePresence>
    {active && (
      <motion.div
        className="absolute inset-0 bg-red-500/20 z-40 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.2, repeat: Infinity }}
          className="text-center"
        >
          <span className="text-4xl">💫</span>
          <p className="text-red-400 font-bold text-sm mt-2">STUNNED!</p>
          <p className="text-red-400/80 text-xs">{timeLeft.toFixed(1)}s</p>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
));
StunOverlay.displayName = 'StunOverlay';

// Particle renderer
const ParticleRenderer = memo(({ particles }: { particles: { id: number; x: number; y: number; color: string; life: number; maxLife: number }[] }) => (
  <>
    {particles.map(particle => (
      <div
        key={particle.id}
        className="absolute w-2 h-2 rounded-full pointer-events-none"
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

// Simplified oscilloscope display
const OscilloscopeDisplay = memo(({ children }: { children: React.ReactNode }) => (
  <div className="relative w-full h-full bg-slate-950 rounded-lg border-2 border-emerald-500/30 overflow-hidden">
    <div className="absolute inset-0 bg-gradient-radial from-emerald-500/5 via-transparent to-transparent" />
    <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none">
      {Array.from({ length: 11 }).map((_, i) => (
        <line key={`v-${i}`} x1={`${i * 10}%`} y1="0" x2={`${i * 10}%`} y2="100%" stroke="#22c55e" strokeWidth="0.5" />
      ))}
      {Array.from({ length: 11 }).map((_, i) => (
        <line key={`h-${i}`} x1="0" y1={`${i * 10}%`} x2="100%" y2={`${i * 10}%`} stroke="#22c55e" strokeWidth="0.5" />
      ))}
      <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#22c55e" strokeWidth="1" />
      <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#22c55e" strokeWidth="1" />
    </svg>
    <div 
      className="absolute inset-0 pointer-events-none opacity-10"
      style={{
        background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
      }}
    />
    {children}
  </div>
));
OscilloscopeDisplay.displayName = 'OscilloscopeDisplay';

// Wave SVG
const WaveSVG = memo(({ 
  frequency, 
  phase, 
  color, 
  isAligned, 
  index, 
  noiseAmount = 0,
}: {
  frequency: number;
  phase: number;
  color: string;
  isAligned: boolean;
  index: number;
  noiseAmount?: number;
}) => {
  const points = useMemo(() => {
    const width = 280;
    const height = 50;
    const freq = frequency / 10;
    const amp = height / 2.5;
    const pts: string[] = [];
    
    for (let x = 0; x <= width; x += 4) {
      const noise = noiseAmount * (Math.random() - 0.5) * 10;
      const y = height / 2 + Math.sin((x / 20) * freq + phase) * amp + noise;
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

// Target marker on frequency bar
const TargetMarker = memo(({ 
  x, 
  isDecoy, 
  isLocked,
  isActive 
}: { 
  x: number; 
  isDecoy: boolean; 
  isLocked: boolean;
  isActive: boolean;
}) => (
  <motion.div
    className="absolute top-0 bottom-0 w-1 -translate-x-1/2"
    style={{ left: `${x}%` }}
    animate={isActive ? { opacity: [0.5, 1, 0.5] } : {}}
    transition={{ duration: 1, repeat: Infinity }}
  >
    <div 
      className={`w-full h-full rounded-full ${
        isLocked 
          ? 'bg-green-500' 
          : isDecoy 
            ? 'bg-red-500/70' 
            : 'bg-purple-500'
      }`}
      style={{
        boxShadow: isLocked 
          ? '0 0 10px #22c55e' 
          : isDecoy 
            ? '0 0 10px #ef4444' 
            : '0 0 10px #a855f7',
      }}
    />
    <div 
      className={`absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold ${
        isLocked ? 'text-green-400' : isDecoy ? 'text-red-400' : 'text-purple-400'
      }`}
    >
      {isLocked ? '✓' : isDecoy ? '?' : '🎯'}
    </div>
  </motion.div>
));
TargetMarker.displayName = 'TargetMarker';

export const AstralFrequencyGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  maxTimer,
  isPractice = false,
}: AstralFrequencyGameProps) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  const effectiveTimer = maxTimer ?? config.roundTime;
  const effectiveRounds = isPractice ? 1 : config.rounds;
  
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [roundTimeLeft, setRoundTimeLeft] = useState(effectiveTimer);
  
  const [playerFreq, setPlayerFreq] = useState(50);
  const [targets, setTargets] = useState<FrequencyTarget[]>([]);
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  
  const [lockProgress, setLockProgress] = useState(0);
  const [isLocking, setIsLocking] = useState(false);
  
  const [isStunned, setIsStunned] = useState(false);
  const [stunTimeLeft, setStunTimeLeft] = useState(0);
  
  const [showRoundComplete, setShowRoundComplete] = useState(false);
  const [wavePhases, setWavePhases] = useState([0, 0]);
  const [interferenceActive, setInterferenceActive] = useState(false);
  
  const gameStateRef = useRef(gameState);
  const playerFreqRef = useRef(playerFreq);
  const lockProgressRef = useRef(lockProgress);
  const stunRef = useRef(isStunned);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { playerFreqRef.current = playerFreq; }, [playerFreq]);
  useEffect(() => { lockProgressRef.current = lockProgress; }, [lockProgress]);
  useEffect(() => { stunRef.current = isStunned; }, [isStunned]);
  
  const { particles, emit: emitParticles } = useParticleSystem(30);
  
  const statBonus = Math.round((companionStats.mind + companionStats.soul) / 2);
  const alignmentTolerance = config.alignmentTolerance + Math.floor(statBonus / 25);
  
  const generateTargets = useCallback(() => {
    const newTargets: FrequencyTarget[] = [];
    
    newTargets.push({
      x: 15 + Math.random() * 70,
      isDecoy: false,
      isLocked: false,
      id: `target-${Date.now()}`,
    });
    
    for (let i = 0; i < config.decoyCount; i++) {
      newTargets.push({
        x: 15 + Math.random() * 70,
        isDecoy: true,
        isLocked: false,
        id: `decoy-${Date.now()}-${i}`,
      });
    }
    
    return newTargets;
  }, [config.decoyCount]);
  
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    setTargets(generateTargets());
    setRoundTimeLeft(effectiveTimer);
  }, [effectiveTimer, generateTargets]);
  
  // Handle tap on oscilloscope to tune frequency
  const handleTuneClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isStunned || gameState !== 'playing' || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    
    setPlayerFreq(x);
    triggerHaptic('light');
  }, [isStunned, gameState]);
  
  // Handle drag/touch move
  const handleTuneMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (isStunned || gameState !== 'playing' || !containerRef.current) return;
    if ('buttons' in e && e.buttons !== 1) return; // Only track when mouse is pressed
    
    const rect = containerRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    
    setPlayerFreq(x);
  }, [isStunned, gameState]);
  
  // Interference effect (hard mode only)
  useEffect(() => {
    if (gameState !== 'playing' || config.interferenceChance === 0) return;
    
    const interval = setInterval(() => {
      if (Math.random() < config.interferenceChance) {
        setInterferenceActive(true);
        setTimeout(() => setInterferenceActive(false), 2000);
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [gameState, config.interferenceChance]);
  
  // Main game loop
  useGameLoop((deltaTime) => {
    if (gameStateRef.current !== 'playing') return;
    
    // Update wave phases
    setWavePhases(prev => [
      (prev[0] + deltaTime * 2) % (Math.PI * 2),
      (prev[1] + deltaTime * 2.5) % (Math.PI * 2),
    ]);
    
    // Update stun timer
    if (stunRef.current) {
      setStunTimeLeft(prev => {
        const newTime = prev - deltaTime;
        if (newTime <= 0) {
          setIsStunned(false);
          return 0;
        }
        return newTime;
      });
      return;
    }
    
    // Update round timer
    setRoundTimeLeft(prev => {
      const newTime = prev - deltaTime;
      if (newTime <= 0) {
        setCombo(0);
        triggerHaptic('error');
        
        if (round >= effectiveRounds) {
          setGameState('complete');
        } else {
          setShowRoundComplete(true);
          setTimeout(() => {
            setShowRoundComplete(false);
            setRound(r => r + 1);
            setTargets(generateTargets());
            setRoundTimeLeft(effectiveTimer);
            setLockProgress(0);
            setCurrentTargetIndex(0);
          }, 800);
        }
        return 0;
      }
      return newTime;
    });
    
    // Check alignment with current target
    const currentTarget = targets[currentTargetIndex];
    if (!currentTarget || currentTarget.isLocked) return;
    
    const dist = Math.abs(playerFreqRef.current - currentTarget.x);
    const effectiveTolerance = interferenceActive ? alignmentTolerance * 0.6 : alignmentTolerance;
    const isAligned = dist <= effectiveTolerance;
    const isPerfectlyAligned = dist <= effectiveTolerance / 3;
    
    if (isAligned) {
      setIsLocking(true);
      
      if (Math.random() < 0.08) {
        emitParticles(
          20 + Math.random() * 60,
          30 + Math.random() * 40,
          isPerfectlyAligned ? '#fbbf24' : currentTarget.isDecoy ? '#ef4444' : '#a855f7',
          2
        );
      }
      
      const progressSpeed = isPerfectlyAligned ? 1.5 : 1;
      const newProgress = Math.min(1, lockProgressRef.current + (deltaTime / config.lockOnTime) * progressSpeed);
      setLockProgress(newProgress);
      
      if (newProgress >= 1) {
        if (currentTarget.isDecoy) {
          setScore(s => Math.max(0, s - 100));
          setCombo(0);
          setIsStunned(true);
          setStunTimeLeft(1.5);
          triggerHaptic('error');
          setLockProgress(0);
          setCurrentTargetIndex(prev => prev + 1);
        } else {
          const pointsEarned = isPerfectlyAligned ? 150 : 100;
          
          setScore(s => s + pointsEarned);
          setCombo(c => {
            const newCombo = c + 1;
            setMaxCombo(m => Math.max(m, newCombo));
            return newCombo;
          });
          
          triggerHaptic('success');
          
          setTargets(prev => prev.map((t, i) => 
            i === currentTargetIndex ? { ...t, isLocked: true } : t
          ));
          
          setShowRoundComplete(true);
          setLockProgress(0);
          
          setTimeout(() => {
            setShowRoundComplete(false);
            if (round >= effectiveRounds) {
              setGameState('complete');
            } else {
              setRound(r => r + 1);
              setTargets(generateTargets());
              setRoundTimeLeft(effectiveTimer);
              setCurrentTargetIndex(0);
            }
          }, 800);
        }
      }
    } else {
      setIsLocking(false);
      const newProgress = Math.max(0, lockProgressRef.current - deltaTime * 0.5);
      setLockProgress(newProgress);
    }
  }, gameState === 'playing');
  
  // Complete game
  useEffect(() => {
    if (gameState === 'complete') {
      const maxPossibleScore = effectiveRounds * 200;
      const baseAccuracy = Math.round((score / maxPossibleScore) * 100);
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
  }, [gameState, score, effectiveRounds, maxCombo, onComplete]);
  
  const currentTarget = targets[currentTargetIndex];
  const dist = currentTarget ? Math.abs(playerFreq - currentTarget.x) : 100;
  const effectiveTolerance = interferenceActive ? alignmentTolerance * 0.6 : alignmentTolerance;
  const isAligned = dist <= effectiveTolerance;
  const isPerfectlyAligned = dist <= effectiveTolerance / 3;
  const isTimeUrgent = roundTimeLeft <= 5;
  
  const playerWaveColor = isPerfectlyAligned ? 'hsl(45, 100%, 50%)' : isAligned ? 'hsl(142, 76%, 46%)' : 'hsl(217, 91%, 60%)';
  
  return (
    <div className="flex flex-col items-center relative">
      {gameState === 'countdown' && (
        <CountdownOverlay count={3} onComplete={handleCountdownComplete} />
      )}

      <AnimatePresence>
        {gameState === 'paused' && (
          <PauseOverlay onResume={() => setGameState('playing')} />
        )}
      </AnimatePresence>

      <GameHUD
        title="Astral Frequency"
        subtitle={`Round ${round}/${effectiveRounds} - Tap to tune the signal!`}
        score={Math.round(score)}
        combo={combo}
        showCombo={true}
        phase={round - 1}
        totalPhases={effectiveRounds}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      <RoundTimer timeLeft={roundTimeLeft} maxTime={effectiveTimer} isUrgent={isTimeUrgent} />

      {/* Lock-on progress */}
      <div className="w-full max-w-xs mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Lock-On
          </span>
          <span className={isLocking ? 'text-primary font-bold' : ''}>
            {Math.round(lockProgress * 100)}%
          </span>
        </div>
        <div className="h-3 bg-muted/50 rounded-full overflow-hidden border border-border/50">
          <motion.div
            className="h-full rounded-full"
            animate={{ width: `${lockProgress * 100}%` }}
            transition={{ duration: 0.05 }}
            style={{
              background: currentTarget?.isDecoy && lockProgress > 0.3
                ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                : isPerfectlyAligned 
                  ? 'linear-gradient(90deg, hsl(45, 100%, 50%), hsl(38, 92%, 60%))' 
                  : isAligned 
                    ? 'linear-gradient(90deg, hsl(271, 91%, 65%), hsl(217, 91%, 60%))' 
                    : 'hsl(var(--muted-foreground))',
              boxShadow: isLocking ? '0 0 15px hsl(271, 91%, 65%)' : 'none',
            }}
          />
        </div>
      </div>

      {/* Oscilloscope - tap to tune */}
      <div 
        ref={containerRef}
        className="relative w-full max-w-xs h-48 mb-4 cursor-crosshair touch-none"
        onMouseDown={handleTuneClick}
        onMouseMove={handleTuneMove}
        onTouchStart={handleTuneClick}
        onTouchMove={handleTuneMove}
      >
        <OscilloscopeDisplay>
          <StunOverlay active={isStunned} timeLeft={stunTimeLeft} />
          <ParticleRenderer particles={particles} />
          
          {/* Interference overlay */}
          {interferenceActive && (
            <div className="absolute inset-0 pointer-events-none bg-red-500/10 animate-pulse" />
          )}
          
          {/* Waves */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 pointer-events-none">
            {currentTarget && (
              <div className="relative">
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-xs text-purple-400 font-medium">
                  {currentTarget.isDecoy ? '???' : 'Target'}
                </div>
                <WaveSVG
                  frequency={currentTarget.x}
                  phase={wavePhases[0]}
                  color={currentTarget.isDecoy ? 'hsl(0, 70%, 55%)' : 'hsl(271, 91%, 65%)'}
                  isAligned={false}
                  index={0}
                />
                {isLocking && (
                  <LockOnRing 
                    progress={lockProgress} 
                    isLocking={isLocking} 
                    isLocked={currentTarget.isLocked}
                    isDecoy={currentTarget.isDecoy}
                  />
                )}
              </div>
            )}
            
            <div className="relative">
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-xs text-blue-400 font-medium">You</div>
              <WaveSVG
                frequency={playerFreq}
                phase={wavePhases[1]}
                color={playerWaveColor}
                isAligned={isAligned && !currentTarget?.isDecoy}
                index={1}
                noiseAmount={interferenceActive ? 0.3 : 0}
              />
            </div>
          </div>
          
          {/* Alignment indicator */}
          <AnimatePresence>
            {isAligned && !currentTarget?.isDecoy && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                >
                  <span className="text-3xl">{isPerfectlyAligned ? '🔐' : '🎯'}</span>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Round complete overlay */}
          <AnimatePresence>
            {showRoundComplete && (
              <motion.div
                className="absolute inset-0 bg-background/80 flex items-center justify-center z-50"
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
                  <span className="text-5xl">🔒</span>
                  <p className="text-xl font-bold text-foreground mt-2">LOCKED!</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </OscilloscopeDisplay>
      </div>

      {/* Frequency tuning bar */}
      <div className="w-full max-w-xs relative h-8 bg-slate-900/80 rounded-lg border border-primary/30 overflow-hidden mb-2">
        {/* Target markers */}
        {targets.map((target, i) => (
          <TargetMarker 
            key={target.id} 
            x={target.x} 
            isDecoy={target.isDecoy} 
            isLocked={target.isLocked}
            isActive={i === currentTargetIndex}
          />
        ))}
        
        {/* Player position */}
        <motion.div
          className="absolute top-0 bottom-0 w-2 -translate-x-1/2 bg-blue-500 rounded-full"
          style={{ left: `${playerFreq}%` }}
          animate={{ boxShadow: isAligned ? '0 0 15px #3b82f6' : '0 0 5px #3b82f6' }}
        />
      </div>

      {/* Status */}
      <div className={`mt-2 text-center ${isPerfectlyAligned ? 'text-yellow-400' : isAligned ? 'text-green-400' : 'text-muted-foreground'}`}>
        <p className="text-sm font-medium">
          {isStunned 
            ? '💫 STUNNED! Controls disabled...'
            : interferenceActive 
              ? '⚡ INTERFERENCE! Hold steady!'
              : isPerfectlyAligned 
                ? '🔐 PERFECT LOCK! Hold steady!' 
                : isAligned 
                  ? '🎯 Signal acquired! Locking on...' 
                  : '👆 Tap on the display to tune frequency'}
        </p>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Mind + Soul bonus: ±{alignmentTolerance} tolerance
      </p>
    </div>
  );
};
