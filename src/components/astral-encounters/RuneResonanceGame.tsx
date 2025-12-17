import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useGameLoop, useParticleSystem, useGameTimer } from './gameUtils';

interface RuneResonanceGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number; // Override timer for practice mode
  isPractice?: boolean;
}

interface Rune {
  id: number;
  symbol: string;
  rhythm: number;
  phase: number;
  activated: boolean;
  x: number;
  y: number;
  isDecoy: boolean;
  createdAt: number;
}

const RUNE_SYMBOLS = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ'];
const DECOY_SYMBOLS = ['☠', '✕', '⚠', '☢'];

// Static positions for runes
const RUNE_POSITIONS = [
  { x: 25, y: 25 }, { x: 75, y: 25 },
  { x: 15, y: 55 }, { x: 50, y: 45 }, { x: 85, y: 55 },
  { x: 30, y: 80 }, { x: 70, y: 80 },
];

// Enhanced difficulty configuration
const DIFFICULTY_CONFIG = {
  easy: {
    runes: 4,
    maxMistakes: 5,
    rhythms: [55, 70],
    chainLength: 2,
    phaseShifts: false,
    phaseShiftIntensity: 0,
    directionReversals: false,
    decoyCount: 0,
    tempoIncrease: 0,
    windowShrinkRate: 0,
    fadeAfterSeconds: null as number | null,
    roundTimer: 45,
  },
  medium: {
    runes: 5,
    maxMistakes: 4,
    rhythms: [60, 80, 100],
    chainLength: 3,
    phaseShifts: true,
    phaseShiftIntensity: 0.3,
    directionReversals: false,
    decoyCount: 1,
    tempoIncrease: 0.10,
    windowShrinkRate: 0.05,
    fadeAfterSeconds: 20,
    roundTimer: 38,
  },
  hard: {
    runes: 6,
    maxMistakes: 3,
    rhythms: [70, 90, 110, 130],
    chainLength: 4,
    phaseShifts: true,
    phaseShiftIntensity: 0.5,
    directionReversals: true,
    decoyCount: 2,
    tempoIncrease: 0.25,
    windowShrinkRate: 0.10,
    fadeAfterSeconds: 12,
    roundTimer: 30,
  },
};

// Memoized particle renderer
const ParticleRenderer = memo(({ particles }: { particles: { id: number; x: number; y: number; color: string; life: number; maxLife: number }[] }) => (
  <>
    {particles.map(particle => (
      <div
        key={particle.id}
        className="absolute w-2 h-2 rounded-full pointer-events-none z-20 gpu-accelerated"
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

// Timer bar component
const TimerBar = memo(({ timeRemaining, maxTime }: { timeRemaining: number; maxTime: number }) => {
  const percentage = (timeRemaining / maxTime) * 100;
  const isLow = percentage < 25;
  
  return (
    <div className="w-full h-2 bg-slate-800/80 rounded-full overflow-hidden mb-2">
      <motion.div
        className={`h-full ${isLow ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
        style={{ width: `${percentage}%` }}
        animate={isLow ? { opacity: [1, 0.6, 1] } : {}}
        transition={isLow ? { duration: 0.5, repeat: Infinity } : {}}
      />
    </div>
  );
});
TimerBar.displayName = 'TimerBar';

// Chain indicator component
const ChainIndicator = memo(({ 
  currentChain, 
  chainPosition, 
  runes,
  chainsCompleted 
}: { 
  currentChain: number[]; 
  chainPosition: number; 
  runes: Rune[];
  chainsCompleted: number;
}) => (
  <div className="flex items-center gap-2 mb-2">
    <span className="text-xs text-muted-foreground">Chain:</span>
    <div className="flex gap-1">
      {currentChain.map((runeId, idx) => {
        const rune = runes.find(r => r.id === runeId);
        const isCompleted = idx < chainPosition;
        const isCurrent = idx === chainPosition;
        
        return (
          <div
            key={idx}
            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
              isCompleted 
                ? 'bg-green-500 border-green-400 text-white' 
                : isCurrent
                  ? 'bg-purple-500/50 border-purple-400 text-white animate-pulse'
                  : 'bg-slate-800/50 border-slate-600 text-slate-400'
            }`}
          >
            {rune?.symbol || idx + 1}
          </div>
        );
      })}
    </div>
    {chainsCompleted > 0 && (
      <span className="text-xs text-green-400 ml-2">×{chainsCompleted}</span>
    )}
  </div>
));
ChainIndicator.displayName = 'ChainIndicator';

// Phase shift warning component
const PhaseShiftWarning = memo(({ active, speedMultiplier, isReversed }: { active: boolean; speedMultiplier: number; isReversed: boolean }) => {
  if (!active) return null;
  
  return (
    <motion.div
      className="absolute top-2 right-2 z-30 px-2 py-1 rounded-lg bg-purple-900/80 border border-purple-500/50"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
    >
      <div className="flex items-center gap-1 text-xs">
        {isReversed && <span className="text-yellow-400">↻</span>}
        <span className={speedMultiplier < 1 ? 'text-blue-400' : 'text-orange-400'}>
          {speedMultiplier < 1 ? '🐢' : '⚡'} {Math.round(speedMultiplier * 100)}%
        </span>
      </div>
    </motion.div>
  );
});
PhaseShiftWarning.displayName = 'PhaseShiftWarning';

// Stunned overlay
const StunnedOverlay = memo(({ stunned }: { stunned: boolean }) => {
  if (!stunned) return null;
  
  return (
    <motion.div
      className="absolute inset-0 z-40 bg-red-900/30 flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="text-4xl"
        animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 0.3, repeat: 3 }}
      >
        💫
      </motion.div>
    </motion.div>
  );
});
StunnedOverlay.displayName = 'StunnedOverlay';

// Memoized rune component
interface RuneComponentProps {
  rune: Rune;
  intensity: number;
  isAtPeak: boolean;
  isPerfectPeak: boolean;
  showFeedback: { id: number; success: boolean; perfect?: boolean; points?: number } | null;
  onClick: () => void;
  disabled: boolean;
  isNextInChain: boolean;
  chainNumber: number | null;
  symbolOpacity: number;
  isReversed: boolean;
}

const RuneComponent = memo(({ 
  rune, 
  intensity, 
  isAtPeak, 
  isPerfectPeak, 
  showFeedback,
  onClick, 
  disabled,
  isNextInChain,
  chainNumber,
  symbolOpacity,
  isReversed,
}: RuneComponentProps) => {
  const buttonStyle = useMemo(() => {
    if (rune.isDecoy) {
      return {
        left: `${rune.x}%`,
        top: `${rune.y}%`,
        background: `radial-gradient(circle, rgba(239, 68, 68, ${0.15 + intensity * 0.4}) 0%, rgba(127, 29, 29, ${0.2 + intensity * 0.3}) 100%)`,
        boxShadow: `0 0 ${10 + intensity * 25}px rgba(239, 68, 68, ${intensity * 0.6})`,
        border: `2px solid rgba(239, 68, 68, ${0.3 + intensity * 0.5})`,
        transform: `translate(-50%, -50%) scale(${0.85 + intensity * 0.2})`,
      };
    }
    
    return {
      left: `${rune.x}%`,
      top: `${rune.y}%`,
      background: rune.activated 
        ? 'linear-gradient(135deg, hsl(142, 76%, 46%), hsl(142, 76%, 36%))'
        : `radial-gradient(circle, rgba(168, 85, 247, ${0.15 + intensity * 0.5}) 0%, rgba(168, 85, 247, ${0.05 + intensity * 0.2}) 100%)`,
      boxShadow: rune.activated
        ? '0 0 25px hsl(142, 76%, 46%), 0 0 50px hsl(142, 76%, 46%, 0.5)'
        : isPerfectPeak && !rune.activated
          ? `0 0 ${20 + intensity * 40}px rgba(251, 191, 36, ${intensity}), 0 0 ${10 + intensity * 20}px rgba(168, 85, 247, ${intensity})`
          : isNextInChain
            ? `0 0 ${15 + intensity * 35}px rgba(59, 130, 246, ${0.5 + intensity * 0.5}), 0 0 ${10 + intensity * 20}px rgba(168, 85, 247, ${intensity})`
            : `0 0 ${10 + intensity * 30}px rgba(168, 85, 247, ${intensity * 0.8})`,
      border: rune.activated 
        ? '3px solid hsl(142, 76%, 56%)'
        : isPerfectPeak 
          ? `3px solid rgba(251, 191, 36, ${0.5 + intensity * 0.5})`
          : isNextInChain
            ? `3px solid rgba(59, 130, 246, ${0.5 + intensity * 0.5})`
            : `2px solid rgba(168, 85, 247, ${0.3 + intensity * 0.5})`,
      transform: `translate(-50%, -50%) scale(${0.85 + intensity * 0.25})`,
    };
  }, [rune.activated, rune.x, rune.y, rune.isDecoy, intensity, isPerfectPeak, isNextInChain]);

  const textStyle = useMemo(() => ({
    color: rune.isDecoy 
      ? `rgba(239, 68, 68, ${0.6 + intensity * 0.4})`
      : rune.activated 
        ? 'white' 
        : `rgba(255, 255, 255, ${(0.4 + intensity * 0.6) * symbolOpacity})`,
    textShadow: rune.isDecoy
      ? `0 0 ${intensity * 15}px rgba(239, 68, 68, ${intensity})`
      : rune.activated 
        ? '0 0 15px white' 
        : isPerfectPeak
          ? `0 0 ${intensity * 20}px rgba(251, 191, 36, ${intensity})`
          : `0 0 ${intensity * 15}px rgba(168, 85, 247, ${intensity})`,
    filter: isPerfectPeak && !rune.activated ? 'brightness(1.3)' : 'none',
    opacity: symbolOpacity,
  }), [rune.activated, rune.isDecoy, intensity, isPerfectPeak, symbolOpacity]);

  return (
    <motion.button
      className="absolute w-16 h-16 rounded-full flex items-center justify-center will-animate gpu-accelerated"
      style={buttonStyle}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ scale: 0.9 }}
    >
      <span className="text-3xl font-bold select-none transition-opacity duration-500" style={textStyle}>
        {rune.symbol}
      </span>

      {/* Chain number indicator */}
      {chainNumber !== null && !rune.activated && !rune.isDecoy && (
        <motion.div
          className="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-blue-300"
          animate={{ scale: isNextInChain ? [1, 1.2, 1] : 1 }}
          transition={{ duration: 0.5, repeat: isNextInChain ? Infinity : 0 }}
        >
          {chainNumber}
        </motion.div>
      )}

      {/* Reverse indicator */}
      {isReversed && !rune.activated && (
        <motion.div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-yellow-400 text-xs"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          ↻
        </motion.div>
      )}

      {/* Peak indicator ring */}
      {isAtPeak && !rune.activated && !rune.isDecoy && (
        <div className={`absolute inset-0 rounded-full border-2 peak-ring ${isPerfectPeak ? 'border-yellow-400' : 'border-white/60'}`} />
      )}

      {/* Decoy warning pulse */}
      {rune.isDecoy && isAtPeak && (
        <div className="absolute inset-0 rounded-full border-2 border-red-500 peak-ring" />
      )}

      {/* Activated checkmark */}
      {rune.activated && (
        <motion.div
          className="absolute -top-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300 }}
        >
          <span className="text-xs">✓</span>
        </motion.div>
      )}

      {/* Feedback */}
      {showFeedback?.id === rune.id && (
        <motion.div
          className="absolute inset-0 rounded-full flex flex-col items-center justify-center pointer-events-none"
          initial={{ scale: 0.5, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span className="text-3xl">
            {showFeedback.success 
              ? showFeedback.perfect ? '🌟' : '✨' 
              : '❌'}
          </span>
          {showFeedback.points && (
            <span className={`text-sm font-bold ${showFeedback.points > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {showFeedback.points > 0 ? '+' : ''}{showFeedback.points}
            </span>
          )}
        </motion.div>
      )}
    </motion.button>
  );
});
RuneComponent.displayName = 'RuneComponent';

// Memoized connection lines
const ConnectionLines = memo(({ runes }: { runes: Rune[] }) => {
  const activatedRunes = runes.filter(r => r.activated && !r.isDecoy);
  if (activatedRunes.length < 2) return null;

  return (
    <svg className="absolute inset-0 pointer-events-none z-0 w-full h-full">
      {activatedRunes.map((rune, i) => {
        const nextActivated = activatedRunes[i + 1];
        if (!nextActivated) return null;
        return (
          <motion.line
            key={`line-${rune.id}-${nextActivated.id}`}
            x1={`${rune.x}%`}
            y1={`${rune.y}%`}
            x2={`${nextActivated.x}%`}
            y2={`${nextActivated.y}%`}
            stroke="hsl(142, 76%, 46%)"
            strokeWidth="2"
            strokeOpacity="0.4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3 }}
          />
        );
      })}
    </svg>
  );
});
ConnectionLines.displayName = 'ConnectionLines';

// Memoized timing legend
const TimingLegend = memo(() => (
  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-full bg-purple-500/50 border border-purple-500" />
      <span>Wait</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-full bg-blue-500/50 border border-blue-400" />
      <span>Next</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-full bg-yellow-500 border border-yellow-400" style={{ boxShadow: '0 0 8px #fbbf24' }} />
      <span>Perfect!</span>
    </div>
    <div className="flex items-center gap-1">
      <div className="w-3 h-3 rounded-full bg-red-500/50 border border-red-500" />
      <span>Avoid</span>
    </div>
  </div>
));
TimingLegend.displayName = 'TimingLegend';

export const RuneResonanceGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
  maxTimer,
  isPractice = false,
}: RuneResonanceGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [runes, setRunes] = useState<Rune[]>([]);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [showFeedback, setShowFeedback] = useState<{ id: number; success: boolean; perfect?: boolean; points?: number } | null>(null);
  
  // New enhanced states
  const [currentChain, setCurrentChain] = useState<number[]>([]);
  const [chainPosition, setChainPosition] = useState(0);
  const [chainsCompleted, setChainsCompleted] = useState(0);
  const [phaseShiftActive, setPhaseShiftActive] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isReversed, setIsReversed] = useState(false);
  const [windowShrinkFactor, setWindowShrinkFactor] = useState(1);
  const [stunned, setStunned] = useState(false);
  
  // Use refs for animation state
  const runesRef = useRef<Rune[]>([]);
  const gameStateRef = useRef(gameState);
  const gameStartTimeRef = useRef(0);
  
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { runesRef.current = runes; }, [runes]);

  // Use particle system from shared utilities
  const { particles, emit: emitParticles } = useParticleSystem(30);

  // Soul stat bonus
  const statBonus = companionStats.soul;
  const baseTimingTolerance = 0.72 + (statBonus / 100) * 0.08;

  // Memoized difficulty settings
  const settings = useMemo(() => {
    const base = DIFFICULTY_CONFIG[difficulty];
    return {
      ...base,
      requiredRunes: base.runes + Math.floor(questIntervalScale),
      maxMistakes: base.maxMistakes - Math.floor(questIntervalScale),
    };
  }, [difficulty, questIntervalScale]);

  // Effective timer (use maxTimer override or default)
  const effectiveTimer = maxTimer ?? settings.roundTimer;

  // Game timer
  const { timeLeft: timeRemaining } = useGameTimer(
    effectiveTimer,
    gameState === 'playing',
    () => {
      if (gameState === 'playing') {
        setGameState('complete');
      }
    }
  );

  // Calculate effective timing tolerance with shrink
  const timingTolerance = useMemo(() => {
    return baseTimingTolerance * windowShrinkFactor;
  }, [baseTimingTolerance, windowShrinkFactor]);

  // Calculate tempo multiplier based on elapsed time
  const getTempoMultiplier = useCallback(() => {
    if (settings.tempoIncrease === 0) return 1;
    const elapsed = (Date.now() - gameStartTimeRef.current) / 1000;
    const progress = Math.min(elapsed / settings.roundTimer, 1);
    return 1 + (settings.tempoIncrease * progress);
  }, [settings.tempoIncrease, settings.roundTimer]);

  // Calculate symbol opacity for fading
  const getSymbolOpacity = useCallback((rune: Rune) => {
    if (!settings.fadeAfterSeconds) return 1;
    const elapsed = (Date.now() - rune.createdAt) / 1000;
    if (elapsed < settings.fadeAfterSeconds) return 1;
    const fadeProgress = Math.min((elapsed - settings.fadeAfterSeconds) / 5, 1);
    return Math.max(0.1, 1 - fadeProgress);
  }, [settings.fadeAfterSeconds]);

  // Generate a new chain
  const generateChain = useCallback((runesList: Rune[]) => {
    const availableRunes = runesList.filter(r => !r.activated && !r.isDecoy);
    if (availableRunes.length < settings.chainLength) {
      // Not enough runes left, use what we have
      return availableRunes.map(r => r.id);
    }
    
    // Shuffle and pick chainLength runes
    const shuffled = [...availableRunes].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, settings.chainLength).map(r => r.id);
  }, [settings.chainLength]);

  // Initialize runes
  useEffect(() => {
    const newRunes: Rune[] = [];
    const now = Date.now();
    
    // Create regular runes
    for (let i = 0; i < settings.requiredRunes; i++) {
      newRunes.push({
        id: i,
        symbol: RUNE_SYMBOLS[i % RUNE_SYMBOLS.length],
        rhythm: settings.rhythms[i % settings.rhythms.length],
        phase: Math.random() * Math.PI * 2,
        activated: false,
        x: RUNE_POSITIONS[i % RUNE_POSITIONS.length].x,
        y: RUNE_POSITIONS[i % RUNE_POSITIONS.length].y,
        isDecoy: false,
        createdAt: now,
      });
    }
    
    // Add decoy runes
    for (let i = 0; i < settings.decoyCount; i++) {
      const decoyId = settings.requiredRunes + i;
      const posIndex = (settings.requiredRunes + i) % RUNE_POSITIONS.length;
      // Offset decoy positions slightly
      const offsetX = RUNE_POSITIONS[posIndex].x + (Math.random() - 0.5) * 20;
      const offsetY = RUNE_POSITIONS[posIndex].y + (Math.random() - 0.5) * 15;
      
      newRunes.push({
        id: decoyId,
        symbol: DECOY_SYMBOLS[i % DECOY_SYMBOLS.length],
        rhythm: settings.rhythms[0] * 0.8, // Slightly different rhythm
        phase: Math.random() * Math.PI * 2,
        activated: false,
        x: Math.max(10, Math.min(90, offsetX)),
        y: Math.max(15, Math.min(85, offsetY)),
        isDecoy: true,
        createdAt: now,
      });
    }
    
    setRunes(newRunes);
    
    // Generate initial chain after runes are set
    const regularRunes = newRunes.filter(r => !r.isDecoy);
    setCurrentChain(generateChain(regularRunes));
    setChainPosition(0);
  }, [settings.requiredRunes, settings.rhythms, settings.decoyCount, generateChain]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    gameStartTimeRef.current = Date.now();
  }, []);

  // Phase shift logic
  useEffect(() => {
    if (gameState !== 'playing' || !settings.phaseShifts) return;
    
    const triggerPhaseShift = () => {
      if (gameStateRef.current !== 'playing') return;
      
      setPhaseShiftActive(true);
      
      // Calculate new speed multiplier
      const intensity = settings.phaseShiftIntensity;
      const newMultiplier = 1 + (Math.random() - 0.5) * 2 * intensity;
      setSpeedMultiplier(Math.max(0.5, Math.min(1.5, newMultiplier)));
      
      // Direction reversal on hard
      if (settings.directionReversals && Math.random() < 0.3) {
        setIsReversed(prev => !prev);
      }
      
      // End phase shift after 2-3 seconds
      setTimeout(() => {
        setPhaseShiftActive(false);
        setSpeedMultiplier(1);
      }, 2000 + Math.random() * 1000);
    };
    
    // Trigger phase shifts every 5-10 seconds
    const interval = setInterval(() => {
      if (Math.random() < 0.4) {
        triggerPhaseShift();
      }
    }, 5000 + Math.random() * 5000);
    
    return () => clearInterval(interval);
  }, [gameState, settings.phaseShifts, settings.phaseShiftIntensity, settings.directionReversals]);

  // Optimized animation loop for pulsing runes
  useGameLoop(() => {
    if (gameStateRef.current !== 'playing') return;

    const tempoMult = getTempoMultiplier();
    const direction = isReversed ? -1 : 1;
    const effectiveSpeed = speedMultiplier * tempoMult;

    setRunes(prev => prev.map(rune => ({
      ...rune,
      phase: (rune.phase + direction * 0.016 * (rune.rhythm / 60) * Math.PI * 2 * effectiveSpeed + Math.PI * 2) % (Math.PI * 2),
    })));
  }, gameState === 'playing');

  // Get rune pulse intensity (0-1)
  const getPulseIntensity = useCallback((rune: Rune) => {
    return (Math.sin(rune.phase) + 1) / 2;
  }, []);

  // Check if tap is on rhythm
  const isOnRhythm = useCallback((rune: Rune) => {
    return getPulseIntensity(rune) > timingTolerance;
  }, [getPulseIntensity, timingTolerance]);

  const isPerfectRhythm = useCallback((rune: Rune) => {
    return getPulseIntensity(rune) > 0.92;
  }, [getPulseIntensity]);

  // Handle rune tap
  const handleRuneTap = useCallback((runeId: number) => {
    if (gameState !== 'playing' || stunned) return;
    
    const rune = runes.find(r => r.id === runeId);
    if (!rune || rune.activated) return;

    // Handle decoy tap
    if (rune.isDecoy) {
      setMistakes(m => m + 1);
      setCombo(0);
      setScore(s => Math.max(0, s - 50));
      setShowFeedback({ id: runeId, success: false, points: -50 });
      emitParticles(rune.x, rune.y, '#ef4444', 8);
      triggerHaptic('error');
      
      // Stun for 2 seconds
      setStunned(true);
      setTimeout(() => setStunned(false), 2000);
      
      setTimeout(() => setShowFeedback(null), 400);
      return;
    }

    // Check if this is the next rune in chain
    const expectedRuneId = currentChain[chainPosition];
    if (runeId !== expectedRuneId) {
      // Wrong order - mistake
      setMistakes(m => m + 1);
      setCombo(0);
      setScore(s => Math.max(0, s - 25));
      setShowFeedback({ id: runeId, success: false, points: -25 });
      emitParticles(rune.x, rune.y, '#ef4444', 3);
      triggerHaptic('error');
      
      // Reset window shrink on miss (mercy mechanic)
      setWindowShrinkFactor(1);
      
      setTimeout(() => setShowFeedback(null), 400);
      return;
    }

    const onRhythm = isOnRhythm(rune);
    const isPerfect = isPerfectRhythm(rune);
    
    if (onRhythm) {
      // Calculate points
      let points = isPerfect ? 150 : 100;
      points += combo * 10; // Combo bonus
      
      setRunes(prev => prev.map(r => 
        r.id === runeId ? { ...r, activated: true } : r
      ));
      setScore(s => s + points);
      setCombo(c => {
        const newCombo = c + 1;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      setShowFeedback({ id: runeId, success: true, perfect: isPerfect, points });
      emitParticles(rune.x, rune.y, isPerfect ? '#fbbf24' : '#a855f7', isPerfect ? 8 : 5);
      triggerHaptic(isPerfect ? 'success' : 'medium');
      
      // Shrink timing window
      if (settings.windowShrinkRate > 0) {
        setWindowShrinkFactor(prev => Math.max(0.5, prev * (1 - settings.windowShrinkRate)));
      }
      
      // Advance chain position
      const newChainPosition = chainPosition + 1;
      
      if (newChainPosition >= currentChain.length) {
        // Chain complete!
        const chainBonus = 50 * currentChain.length;
        setScore(s => s + chainBonus);
        setChainsCompleted(c => c + 1);
        
        // Generate new chain
        const updatedRunes = runes.map(r => r.id === runeId ? { ...r, activated: true } : r);
        const newChain = generateChain(updatedRunes);
        setCurrentChain(newChain);
        setChainPosition(0);
      } else {
        setChainPosition(newChainPosition);
      }
    } else {
      setMistakes(m => m + 1);
      setCombo(0);
      setScore(s => Math.max(0, s - 25));
      setShowFeedback({ id: runeId, success: false, points: -25 });
      emitParticles(rune.x, rune.y, '#ef4444', 3);
      triggerHaptic('error');
      
      // Reset window shrink on miss
      setWindowShrinkFactor(1);
    }

    setTimeout(() => setShowFeedback(null), 400);
  }, [runes, gameState, stunned, currentChain, chainPosition, combo, emitParticles, isOnRhythm, isPerfectRhythm, settings.windowShrinkRate, generateChain]);

  // Check game end
  const activatedCount = runes.filter(r => r.activated && !r.isDecoy).length;
  
  useEffect(() => {
    if (activatedCount >= settings.requiredRunes || mistakes >= settings.maxMistakes) {
      setGameState('complete');
    }
  }, [activatedCount, settings.requiredRunes, mistakes, settings.maxMistakes]);

  // Complete game
  useEffect(() => {
    if (gameState === 'complete') {
      // Calculate final score with time bonus
      const timeBonus = Math.round(timeRemaining * 5);
      const finalScore = score + timeBonus;
      
      // Calculate accuracy based on score potential
      const maxPossibleScore = settings.requiredRunes * 150 + settings.chainLength * 50 * Math.ceil(settings.requiredRunes / settings.chainLength);
      const accuracy = Math.max(0, Math.min(100, Math.round((finalScore / maxPossibleScore) * 100)));
      
      const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result,
        });
      }, 500);
    }
  }, [gameState, score, timeRemaining, settings.requiredRunes, settings.chainLength, onComplete]);

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

      {/* Timer Bar */}
      {gameState === 'playing' && (
        <div className="w-full max-w-xs mb-1">
          <TimerBar timeRemaining={timeRemaining} maxTime={settings.roundTimer} />
          <div className="flex justify-between text-xs text-muted-foreground px-1">
            <span>⏱️ {Math.ceil(timeRemaining)}s</span>
            <span>🎯 Score: {score}</span>
          </div>
        </div>
      )}

      {/* Chain Indicator */}
      {gameState === 'playing' && currentChain.length > 0 && (
        <ChainIndicator 
          currentChain={currentChain} 
          chainPosition={chainPosition} 
          runes={runes}
          chainsCompleted={chainsCompleted}
        />
      )}

      {/* Game HUD */}
      <GameHUD
        title="Rune Resonance"
        subtitle="Tap runes in sequence at peak glow!"
        score={activatedCount}
        maxScore={settings.requiredRunes}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: mistakes, label: 'Mistakes', color: 'hsl(0, 84%, 60%)' }}
        secondaryStat={{ value: settings.maxMistakes - mistakes, label: 'Lives', color: 'hsl(142, 76%, 46%)' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Rune arena */}
      <div className="relative w-full max-w-xs h-72 bg-gradient-to-b from-purple-950/40 via-slate-900/60 to-background rounded-xl border border-purple-500/30 overflow-hidden shadow-2xl">
        {/* Mystical background */}
        <div className="absolute inset-0 pointer-events-none mystical-bg" />

        {/* Phase shift edge glow */}
        <AnimatePresence>
          {phaseShiftActive && (
            <motion.div
              className="absolute inset-0 pointer-events-none z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                boxShadow: speedMultiplier < 1 
                  ? 'inset 0 0 40px rgba(59, 130, 246, 0.4)' 
                  : 'inset 0 0 40px rgba(249, 115, 22, 0.4)',
              }}
            />
          )}
        </AnimatePresence>

        {/* Window shrink indicator ring */}
        {settings.windowShrinkRate > 0 && (
          <div 
            className="absolute inset-4 rounded-full border border-purple-500/20 pointer-events-none transition-all duration-300"
            style={{
              transform: `scale(${windowShrinkFactor})`,
              opacity: 0.3 + (1 - windowShrinkFactor) * 0.7,
            }}
          />
        )}

        {/* Ancient pattern overlay */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <svg width="100%" height="100%" className="text-purple-500">
            <pattern id="runePattern" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1" fill="currentColor" />
              <line x1="0" y1="20" x2="40" y2="20" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              <line x1="20" y1="0" x2="20" y2="40" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#runePattern)" />
          </svg>
        </div>

        {/* Phase shift warning */}
        <AnimatePresence>
          <PhaseShiftWarning active={phaseShiftActive} speedMultiplier={speedMultiplier} isReversed={isReversed} />
        </AnimatePresence>

        {/* Stunned overlay */}
        <AnimatePresence>
          <StunnedOverlay stunned={stunned} />
        </AnimatePresence>

        {/* Particles */}
        <ParticleRenderer particles={particles} />

        {/* Runes */}
        <AnimatePresence>
          {runes.map(rune => {
            const intensity = getPulseIntensity(rune);
            const isAtPeak = intensity > timingTolerance;
            const isPerfectPeak = intensity > 0.92;
            const isNextInChain = currentChain[chainPosition] === rune.id;
            const chainIndex = currentChain.indexOf(rune.id);
            const chainNumber = chainIndex >= 0 && chainIndex >= chainPosition ? chainIndex - chainPosition + 1 : null;
            const symbolOpacity = getSymbolOpacity(rune);
            
            return (
              <RuneComponent
                key={rune.id}
                rune={rune}
                intensity={intensity}
                isAtPeak={isAtPeak}
                isPerfectPeak={isPerfectPeak}
                showFeedback={showFeedback}
                onClick={() => handleRuneTap(rune.id)}
                disabled={rune.activated || gameState !== 'playing' || stunned}
                isNextInChain={isNextInChain}
                chainNumber={chainNumber}
                symbolOpacity={symbolOpacity}
                isReversed={isReversed}
              />
            );
          })}
        </AnimatePresence>

        {/* Central energy nexus */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full pointer-events-none nexus-pulse" />

        {/* Connection lines when runes are activated */}
        <ConnectionLines runes={runes} />
      </div>

      {/* Instruction */}
      <motion.p 
        className="mt-4 text-sm text-muted-foreground text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        🎵 Follow the chain sequence • Tap at peak glow • Avoid ☠ runes!
      </motion.p>

      {/* Timing indicator legend */}
      <TimingLegend />

      {/* Soul stat bonus & window shrink indicator */}
      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
        <span>Soul bonus: +{Math.round((statBonus / 100) * 8)}% window</span>
        {settings.windowShrinkRate > 0 && (
          <span>Window: {Math.round(windowShrinkFactor * 100)}%</span>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        .will-animate {
          will-change: transform, opacity;
        }
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
        .mystical-bg {
          background: 
            radial-gradient(circle at 50% 30%, hsl(271, 91%, 65%, 0.15), transparent 60%),
            radial-gradient(circle at 30% 70%, hsl(271, 91%, 65%, 0.1), transparent 50%),
            radial-gradient(circle at 70% 70%, hsl(271, 91%, 65%, 0.1), transparent 50%);
        }
        .nexus-pulse {
          background: radial-gradient(circle, hsl(271, 91%, 65%, 0.4) 0%, transparent 70%);
          animation: nexus-pulse 2.5s ease-in-out infinite;
        }
        @keyframes nexus-pulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.3; }
          50% { transform: translate(-50%, -50%) scale(1.6); opacity: 0.6; }
        }
        .peak-ring {
          animation: peak-expand 0.4s ease-out infinite;
        }
        @keyframes peak-expand {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
};
