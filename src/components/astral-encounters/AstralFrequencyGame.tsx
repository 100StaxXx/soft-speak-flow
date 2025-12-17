import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Timer, Lock, Zap, Target } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useGameLoop, useParticleSystem } from './gameUtils';

interface AstralFrequencyGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number; // Override timer for practice mode
  isPractice?: boolean;
}

// Difficulty configuration with all features
const DIFFICULTY_CONFIG = {
  easy: {
    rounds: 2,
    lockOnTime: 2.0,
    roundTime: 40,
    dualAxis: false,
    pulseMode: false,
    decoyCount: 0,
    corruptionChance: 0,
    powerSurgeEnabled: false,
    harmonicBonus: false,
    targetDriftSpeed: 0.3,
    interferenceChance: 0.1,
  },
  medium: {
    rounds: 3,
    lockOnTime: 2.5,
    roundTime: 35,
    dualAxis: true,
    pulseMode: false,
    decoyCount: 1,
    corruptionChance: 0.15,
    powerSurgeEnabled: true,
    harmonicBonus: true,
    targetDriftSpeed: 0.5,
    interferenceChance: 0.2,
  },
  hard: {
    rounds: 4,
    lockOnTime: 3.0,
    roundTime: 30,
    dualAxis: true,
    pulseMode: true,
    decoyCount: 2,
    corruptionChance: 0.25,
    powerSurgeEnabled: true,
    harmonicBonus: true,
    targetDriftSpeed: 0.7,
    interferenceChance: 0.35,
    pulsePeriod: 3,
  },
};

const HARMONIC_FREQUENCIES = [25, 50, 75];

interface FrequencyTarget {
  x: number;
  y: number;
  isDecoy: boolean;
  isLocked: boolean;
  pulsePhase: number;
  id: string;
}

interface CorruptionZone {
  startX: number;
  width: number;
  intensity: number;
}

interface ScorePopup {
  id: number;
  value: number;
  x: number;
  y: number;
  text: string;
  color: string;
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
  size = 60,
  isDecoy = false
}: { 
  progress: number;
  isLocking: boolean;
  isLocked: boolean;
  size?: number;
  isDecoy?: boolean;
}) => {
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
      {/* Background ring */}
      <circle
        cx={(size + 16) / 2}
        cy={(size + 16) / 2}
        r={radius + 8}
        fill="none"
        stroke={isDecoy ? 'rgba(239, 68, 68, 0.2)' : 'rgba(168, 85, 247, 0.2)'}
        strokeWidth={3}
      />
      {/* Progress ring */}
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
      {/* Lock icon when complete */}
      {isLocked && (
        <g transform={`translate(${(size + 16) / 2 - 6}, ${(size + 16) / 2 - 6}) rotate(90 6 6)`}>
          <Lock className="w-3 h-3 text-green-400" />
        </g>
      )}
    </svg>
  );
});
LockOnRing.displayName = 'LockOnRing';

// Power surge overlay
const PowerSurgeOverlay = memo(({ active, timeLeft }: { active: boolean; timeLeft: number }) => (
  <AnimatePresence>
    {active && (
      <motion.div 
        className="absolute inset-0 pointer-events-none z-30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Golden edge glow */}
        <div className="absolute inset-0 border-4 border-yellow-400/50 rounded-xl animate-pulse" />
        
        {/* Corner flares */}
        <div className="absolute top-0 left-0 w-8 h-8">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/40 to-transparent" />
        </div>
        <div className="absolute top-0 right-0 w-8 h-8">
          <div className="absolute inset-0 bg-gradient-to-bl from-yellow-400/40 to-transparent" />
        </div>
        <div className="absolute bottom-0 left-0 w-8 h-8">
          <div className="absolute inset-0 bg-gradient-to-tr from-yellow-400/40 to-transparent" />
        </div>
        <div className="absolute bottom-0 right-0 w-8 h-8">
          <div className="absolute inset-0 bg-gradient-to-tl from-yellow-400/40 to-transparent" />
        </div>
        
        {/* Power surge text */}
        <motion.div 
          className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        >
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-yellow-400 font-bold text-sm">2X SURGE!</span>
          <Zap className="w-4 h-4 text-yellow-400" />
        </motion.div>
        
        {/* Timer */}
        <div className="absolute top-8 left-1/2 -translate-x-1/2">
          <span className="text-yellow-400/80 text-xs">{timeLeft.toFixed(1)}s</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));
PowerSurgeOverlay.displayName = 'PowerSurgeOverlay';

// Corruption zone overlay
const CorruptionZoneOverlay = memo(({ zones }: { zones: CorruptionZone[] }) => (
  <>
    {zones.map((zone, i) => (
      <div
        key={i}
        className="absolute top-0 bottom-0 pointer-events-none"
        style={{
          left: `${zone.startX}%`,
          width: `${zone.width}%`,
          background: `repeating-linear-gradient(
            90deg,
            transparent 0px,
            rgba(239, 68, 68, ${zone.intensity * 0.2}) 2px,
            transparent 4px
          )`,
          animation: 'corruption-flicker 0.1s infinite',
        }}
      />
    ))}
  </>
));
CorruptionZoneOverlay.displayName = 'CorruptionZoneOverlay';

// Harmonic markers on the oscilloscope
const HarmonicMarkers = memo(({ enabled }: { enabled: boolean }) => {
  if (!enabled) return null;
  
  return (
    <>
      {HARMONIC_FREQUENCIES.map(freq => (
        <div
          key={freq}
          className="absolute top-0 bottom-0 w-px pointer-events-none"
          style={{
            left: `${freq}%`,
            background: 'linear-gradient(180deg, rgba(251, 191, 36, 0.4) 0%, rgba(251, 191, 36, 0.1) 50%, rgba(251, 191, 36, 0.4) 100%)',
          }}
        >
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-yellow-400/60 font-mono">
            {freq === 50 ? '♪' : '♩'}
          </div>
        </div>
      ))}
    </>
  );
});
HarmonicMarkers.displayName = 'HarmonicMarkers';

// Lissajous pattern when frequencies align
const LissajousPattern = memo(({ 
  xFreq, 
  yFreq, 
  phase,
  aligned 
}: { 
  xFreq: number; 
  yFreq: number; 
  phase: number;
  aligned: boolean;
}) => {
  const points = useMemo(() => {
    if (!aligned) return '';
    const pts: string[] = [];
    const xF = xFreq / 25;
    const yF = yFreq / 25;
    for (let t = 0; t < Math.PI * 4; t += 0.08) {
      const x = 50 + Math.sin(xF * t + phase) * 35;
      const y = 50 + Math.sin(yF * t) * 35;
      pts.push(`${x},${y}`);
    }
    return pts.join(' ');
  }, [xFreq, yFreq, phase, aligned]);
  
  if (!aligned) return null;
  
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="rgba(168, 85, 247, 0.3)"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
});
LissajousPattern.displayName = 'LissajousPattern';

// Oscilloscope display with grid
const OscilloscopeDisplay = memo(({ 
  children,
  showGrid = true 
}: { 
  children: React.ReactNode;
  showGrid?: boolean;
}) => (
  <div className="relative w-full h-full bg-slate-950 rounded-lg border-2 border-emerald-500/30 overflow-hidden">
    {/* CRT glow effect */}
    <div className="absolute inset-0 bg-gradient-radial from-emerald-500/5 via-transparent to-transparent" />
    
    {/* Grid lines */}
    {showGrid && (
      <svg className="absolute inset-0 w-full h-full opacity-15 pointer-events-none">
        {/* Vertical lines */}
        {Array.from({ length: 11 }).map((_, i) => (
          <line 
            key={`v-${i}`}
            x1={`${i * 10}%`} 
            y1="0" 
            x2={`${i * 10}%`} 
            y2="100%" 
            stroke="#22c55e" 
            strokeWidth="0.5"
          />
        ))}
        {/* Horizontal lines */}
        {Array.from({ length: 11 }).map((_, i) => (
          <line 
            key={`h-${i}`}
            x1="0" 
            y1={`${i * 10}%`} 
            x2="100%" 
            y2={`${i * 10}%`} 
            stroke="#22c55e" 
            strokeWidth="0.5"
          />
        ))}
        {/* Center crosshair */}
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#22c55e" strokeWidth="1" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#22c55e" strokeWidth="1" />
      </svg>
    )}
    
    {/* Scanline effect */}
    <div 
      className="absolute inset-0 pointer-events-none opacity-10"
      style={{
        background: 'repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
        animation: 'scanline-move 0.1s linear infinite',
      }}
    />
    
    {children}
  </div>
));
OscilloscopeDisplay.displayName = 'OscilloscopeDisplay';

// Enhanced wave SVG with pulse support
const WaveSVG = memo(({ 
  frequency, 
  amplitude = 50,
  phase, 
  color, 
  isAligned, 
  index, 
  noiseAmount = 0,
  pulseOpacity = 1,
  isDashed = false
}: {
  frequency: number;
  amplitude?: number;
  phase: number;
  color: string;
  isAligned: boolean;
  index: number;
  noiseAmount?: number;
  pulseOpacity?: number;
  isDashed?: boolean;
}) => {
  const points = useMemo(() => {
    const width = 280;
    const height = 50;
    const freq = frequency / 10;
    const amp = (amplitude / 100) * (height / 2.5);
    const pts: string[] = [];
    
    for (let x = 0; x <= width; x += 4) {
      const noise = noiseAmount * (Math.random() - 0.5) * 10;
      const y = height / 2 + Math.sin((x / 20) * freq + phase) * amp + noise;
      pts.push(`${x},${Math.max(5, Math.min(height - 5, y))}`);
    }
    
    return pts.join(' ');
  }, [frequency, amplitude, phase, noiseAmount]);

  return (
    <svg width={280} height={50} className="overflow-visible" style={{ opacity: pulseOpacity }}>
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
        strokeDasharray={isDashed ? '8,4' : undefined}
        filter={isAligned ? `url(#glow-${index})` : undefined}
      />
    </svg>
  );
});
WaveSVG.displayName = 'WaveSVG';

// 2D Frequency Joystick for dual-axis control
const FrequencyJoystick = memo(({ 
  value, 
  onChange, 
  disabled = false,
  showHarmonics = false
}: { 
  value: { x: number; y: number };
  onChange: (value: { x: number; y: number }) => void;
  disabled?: boolean;
  showHarmonics?: boolean;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    isDragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerMove(e);
  }, [disabled]);
  
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || !containerRef.current || disabled) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    
    onChange({ x, y: 100 - y }); // Invert Y so up = higher
    triggerHaptic('light');
  }, [onChange, disabled]);
  
  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);
  
  return (
    <div 
      ref={containerRef}
      className={`relative w-32 h-32 rounded-lg border-2 border-primary/30 bg-slate-900/80 ${disabled ? 'opacity-50' : 'cursor-crosshair'}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-primary" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-primary" />
      </div>
      
      {/* Harmonic markers */}
      {showHarmonics && HARMONIC_FREQUENCIES.map(freq => (
        <div
          key={freq}
          className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400/40"
          style={{
            left: `${freq}%`,
            top: `${100 - freq}%`,
            transform: 'translate(-50%, 50%)',
          }}
        />
      ))}
      
      {/* Knob */}
      <motion.div
        className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary to-accent border-2 border-white shadow-lg"
        style={{
          left: `${value.x}%`,
          top: `${100 - value.y}%`,
          boxShadow: '0 0 15px hsl(271, 91%, 65%)',
        }}
        animate={!disabled ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Labels */}
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground">
        Freq: {Math.round(value.x)}
      </div>
      <div className="absolute top-1/2 -right-8 -translate-y-1/2 text-[9px] text-muted-foreground rotate-90">
        Amp: {Math.round(value.y)}
      </div>
    </div>
  );
});
FrequencyJoystick.displayName = 'FrequencyJoystick';

// Score popup component
const ScorePopups = memo(({ popups }: { popups: ScorePopup[] }) => (
  <>
    {popups.map(popup => (
      <motion.div
        key={popup.id}
        className="absolute pointer-events-none font-bold text-sm"
        style={{ left: `${popup.x}%`, top: `${popup.y}%`, color: popup.color }}
        initial={{ opacity: 1, y: 0, scale: 1 }}
        animate={{ opacity: 0, y: -30, scale: 1.2 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.8 }}
      >
        {popup.text}
      </motion.div>
    ))}
  </>
));
ScorePopups.displayName = 'ScorePopups';

// Decoy target indicator
const DecoyIndicator = memo(({ active }: { active: boolean }) => (
  <AnimatePresence>
    {active && (
      <motion.div
        className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-500/50"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
      >
        <Target className="w-3 h-3 text-red-400" />
        <span className="text-[10px] text-red-400 font-medium">DECOY!</span>
      </motion.div>
    )}
  </AnimatePresence>
));
DecoyIndicator.displayName = 'DecoyIndicator';

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

export const AstralFrequencyGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
  maxTimer,
  isPractice = false,
}: AstralFrequencyGameProps) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  const effectiveTimer = maxTimer ?? config.roundTime;
  const effectiveRounds = isPractice ? 1 : config.rounds;
  
  // Game state
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [round, setRound] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [roundTimeLeft, setRoundTimeLeft] = useState(effectiveTimer);
  
  // Player position
  const [playerFreq, setPlayerFreq] = useState({ x: 50, y: 50 });
  
  // Targets
  const [targets, setTargets] = useState<FrequencyTarget[]>([]);
  const [currentTargetIndex, setCurrentTargetIndex] = useState(0);
  
  // Lock-on state
  const [lockProgress, setLockProgress] = useState(0);
  const [isLocking, setIsLocking] = useState(false);
  
  // Power surge
  const [powerSurgeActive, setPowerSurgeActive] = useState(false);
  const [powerSurgeTimeLeft, setPowerSurgeTimeLeft] = useState(0);
  
  // Corruption zones
  const [corruptionZones, setCorruptionZones] = useState<CorruptionZone[]>([]);
  
  // Pulse mode
  const [pulsePhase, setPulsePhase] = useState(0);
  
  // Stun state
  const [isStunned, setIsStunned] = useState(false);
  const [stunTimeLeft, setStunTimeLeft] = useState(0);
  
  // UI state
  const [showRoundComplete, setShowRoundComplete] = useState(false);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [wavePhases, setWavePhases] = useState([0, 0, 0]);
  const [interferenceActive, setInterferenceActive] = useState(false);
  const [interferenceIntensity, setInterferenceIntensity] = useState(0);
  
  // Refs
  const gameStateRef = useRef(gameState);
  const playerFreqRef = useRef(playerFreq);
  const lockProgressRef = useRef(lockProgress);
  const roundTimeRef = useRef(roundTimeLeft);
  const powerSurgeRef = useRef(powerSurgeActive);
  const stunRef = useRef(isStunned);
  const popupIdRef = useRef(0);
  const wavePhasesRef = useRef([0, 0, 0]);
  
  // Keep refs in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { playerFreqRef.current = playerFreq; }, [playerFreq]);
  useEffect(() => { lockProgressRef.current = lockProgress; }, [lockProgress]);
  useEffect(() => { roundTimeRef.current = roundTimeLeft; }, [roundTimeLeft]);
  useEffect(() => { powerSurgeRef.current = powerSurgeActive; }, [powerSurgeActive]);
  useEffect(() => { stunRef.current = isStunned; }, [isStunned]);
  
  // Particle system
  const { particles, emit: emitParticles } = useParticleSystem(30);
  
  // Calculate stat bonus
  const statBonus = Math.round((companionStats.mind + companionStats.soul) / 2);
  const alignmentTolerance = 12 + Math.floor(statBonus / 20) - Math.floor(questIntervalScale * 2);
  
  // Generate targets for a round
  const generateTargets = useCallback(() => {
    const newTargets: FrequencyTarget[] = [];
    
    // Main target
    newTargets.push({
      x: 15 + Math.random() * 70,
      y: config.dualAxis ? 15 + Math.random() * 70 : 50,
      isDecoy: false,
      isLocked: false,
      pulsePhase: 0,
      id: `target-${Date.now()}`,
    });
    
    // Decoys
    for (let i = 0; i < config.decoyCount; i++) {
      newTargets.push({
        x: 15 + Math.random() * 70,
        y: config.dualAxis ? 15 + Math.random() * 70 : 50,
        isDecoy: true,
        isLocked: false,
        pulsePhase: Math.random() * Math.PI * 2,
        id: `decoy-${Date.now()}-${i}`,
      });
    }
    
    return newTargets;
  }, [config.dualAxis, config.decoyCount]);
  
  // Generate corruption zones
  const generateCorruptionZones = useCallback(() => {
    if (config.corruptionChance <= 0) return [];
    
    const zones: CorruptionZone[] = [];
    const numZones = Math.floor(Math.random() * 3) + 1;
    
    for (let i = 0; i < numZones; i++) {
      if (Math.random() < config.corruptionChance) {
        zones.push({
          startX: Math.random() * 70 + 10,
          width: 10 + Math.random() * 15,
          intensity: 0.3 + Math.random() * 0.4,
        });
      }
    }
    
    return zones;
  }, [config.corruptionChance]);
  
  // Add score popup
  const addScorePopup = useCallback((value: number, text: string, color: string) => {
    const id = ++popupIdRef.current;
    setScorePopups(prev => [...prev, {
      id,
      value,
      x: 30 + Math.random() * 40,
      y: 30 + Math.random() * 40,
      text,
      color,
    }]);
    
    setTimeout(() => {
      setScorePopups(prev => prev.filter(p => p.id !== id));
    }, 1000);
  }, []);
  
  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    setTargets(generateTargets());
    setCorruptionZones(generateCorruptionZones());
    setRoundTimeLeft(config.roundTime);
  }, [config.roundTime, generateTargets, generateCorruptionZones]);
  
  // Handle slider change (single axis mode)
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isStunned) return;
    setPlayerFreq(prev => ({ ...prev, x: Number(e.target.value) }));
  }, [isStunned]);
  
  // Handle joystick change (dual axis mode)
  const handleJoystickChange = useCallback((value: { x: number; y: number }) => {
    if (isStunned) return;
    setPlayerFreq(value);
  }, [isStunned]);
  
  // Start power surge
  const startPowerSurge = useCallback(() => {
    if (!config.powerSurgeEnabled || powerSurgeActive) return;
    
    setPowerSurgeActive(true);
    setPowerSurgeTimeLeft(4);
    triggerHaptic('medium');
    addScorePopup(0, '⚡ 2X POWER! ⚡', '#fbbf24');
    
    setTimeout(() => {
      setPowerSurgeActive(false);
      setPowerSurgeTimeLeft(0);
    }, 4000);
  }, [config.powerSurgeEnabled, powerSurgeActive, addScorePopup]);
  
  // Power surge timer
  useEffect(() => {
    if (gameState !== 'playing' || !config.powerSurgeEnabled) return;
    
    const surgeInterval = setInterval(() => {
      if (Math.random() < 0.15 && !powerSurgeActive) {
        startPowerSurge();
      }
    }, 5000);
    
    return () => clearInterval(surgeInterval);
  }, [gameState, config.powerSurgeEnabled, powerSurgeActive, startPowerSurge]);
  
  // Interference effect
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const interferenceInterval = setInterval(() => {
      if (Math.random() < config.interferenceChance) {
        setInterferenceActive(true);
        setInterferenceIntensity(0.3 + Math.random() * 0.4);
        triggerHaptic('medium');
        
        setTimeout(() => {
          setInterferenceActive(false);
          setInterferenceIntensity(0);
        }, 2000 + Math.random() * 2000);
      }
    }, 4000);
    
    return () => clearInterval(interferenceInterval);
  }, [gameState, config.interferenceChance]);
  
  // Main game loop
  useGameLoop((deltaTime, time) => {
    if (gameStateRef.current !== 'playing') return;
    
    // Update wave phases
    wavePhasesRef.current = [
      (wavePhasesRef.current[0] + deltaTime * 2) % (Math.PI * 2),
      (wavePhasesRef.current[1] + deltaTime * 2.5) % (Math.PI * 2),
      (wavePhasesRef.current[2] + deltaTime * 3) % (Math.PI * 2),
    ];
    setWavePhases([...wavePhasesRef.current]);
    
    // Update pulse phase
    if (config.pulseMode) {
      setPulsePhase(prev => (prev + deltaTime) % ((config as any).pulsePeriod || 3));
    }
    
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
      return; // Skip other updates while stunned
    }
    
    // Update power surge timer
    if (powerSurgeRef.current) {
      setPowerSurgeTimeLeft(prev => Math.max(0, prev - deltaTime));
    }
    
    // Update round timer
    setRoundTimeLeft(prev => {
      const newTime = prev - deltaTime;
      if (newTime <= 0) {
        // Round failed
        setCombo(0);
        triggerHaptic('error');
        
        if (round >= config.rounds) {
          setGameState('complete');
        } else {
          setShowRoundComplete(true);
          setTimeout(() => {
            setShowRoundComplete(false);
            setRound(r => r + 1);
            setTargets(generateTargets());
            setCorruptionZones(generateCorruptionZones());
            setRoundTimeLeft(config.roundTime);
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
    
    const distX = Math.abs(playerFreqRef.current.x - currentTarget.x);
    const distY = config.dualAxis ? Math.abs(playerFreqRef.current.y - currentTarget.y) : 0;
    const totalDist = config.dualAxis ? Math.sqrt(distX * distX + distY * distY) : distX;
    
    const effectiveTolerance = interferenceActive 
      ? alignmentTolerance * (1 - interferenceIntensity * 0.4)
      : alignmentTolerance;
    
    const isAligned = totalDist <= effectiveTolerance;
    const isPerfectlyAligned = totalDist <= effectiveTolerance / 3;
    
    if (isAligned) {
      setIsLocking(true);
      
      // Spawn particles
      if (Math.random() < 0.08) {
        emitParticles(
          20 + Math.random() * 60,
          30 + Math.random() * 40,
          isPerfectlyAligned ? '#fbbf24' : currentTarget.isDecoy ? '#ef4444' : '#a855f7',
          2
        );
      }
      
      // Update lock progress
      const progressSpeed = isPerfectlyAligned ? 1.5 : 1;
      const newProgress = Math.min(1, lockProgressRef.current + (deltaTime / config.lockOnTime) * progressSpeed);
      setLockProgress(newProgress);
      
      // Check if locked
      if (newProgress >= 1) {
        if (currentTarget.isDecoy) {
          // Hit a decoy! Penalty
          setScore(s => Math.max(0, s - 100));
          setCombo(0);
          setIsStunned(true);
          setStunTimeLeft(2);
          triggerHaptic('error');
          addScorePopup(-100, '💀 DECOY!', '#ef4444');
          
          // Reset for next attempt
          setLockProgress(0);
          setCurrentTargetIndex(prev => prev + 1);
        } else {
          // Successfully locked real target!
          let pointsEarned = isPerfectlyAligned ? 150 : 100;
          let bonusText = '';
          
          // Check harmonic bonus
          if (config.harmonicBonus) {
            const isHarmonic = HARMONIC_FREQUENCIES.some(h => 
              Math.abs(currentTarget.x - h) < 3
            );
            if (isHarmonic) {
              const harmonicBonus = currentTarget.x === 50 ? 50 : 25;
              pointsEarned += harmonicBonus;
              bonusText = ' ♪';
              addScorePopup(harmonicBonus, '♪ HARMONIC!', '#fbbf24');
            }
          }
          
          // Check dual-axis bonus
          if (config.dualAxis && isPerfectlyAligned) {
            pointsEarned += 50;
            addScorePopup(50, '2D PERFECT!', '#22c55e');
          }
          
          // Apply power surge multiplier
          if (powerSurgeRef.current) {
            pointsEarned *= 2;
            bonusText += ' ⚡2X';
          }
          
          setScore(s => s + pointsEarned);
          setCombo(c => {
            const newCombo = c + 1;
            setMaxCombo(m => Math.max(m, newCombo));
            return newCombo;
          });
          
          triggerHaptic('success');
          addScorePopup(pointsEarned, `+${pointsEarned}${bonusText}`, isPerfectlyAligned ? '#fbbf24' : '#22c55e');
          
          // Mark as locked
          setTargets(prev => prev.map((t, i) => 
            i === currentTargetIndex ? { ...t, isLocked: true } : t
          ));
          
          setShowRoundComplete(true);
          setLockProgress(0);
          
          setTimeout(() => {
            setShowRoundComplete(false);
            if (round >= config.rounds) {
              setGameState('complete');
            } else {
              setRound(r => r + 1);
              setTargets(generateTargets());
              setCorruptionZones(generateCorruptionZones());
              setRoundTimeLeft(config.roundTime);
              setCurrentTargetIndex(0);
            }
          }, 800);
        }
      }
    } else {
      setIsLocking(false);
      // Decay lock progress when not aligned
      const newProgress = Math.max(0, lockProgressRef.current - deltaTime * 0.3);
      setLockProgress(newProgress);
      if (newProgress === 0 && combo > 0) {
        setCombo(0);
      }
    }
  }, gameState === 'playing');
  
  // Complete game
  useEffect(() => {
    if (gameState === 'complete') {
      const maxPossibleScore = config.rounds * 200;
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
  }, [gameState, score, config.rounds, maxCombo, onComplete]);
  
  // Computed values
  const currentTarget = targets[currentTargetIndex];
  const distX = currentTarget ? Math.abs(playerFreq.x - currentTarget.x) : 100;
  const distY = currentTarget && config.dualAxis ? Math.abs(playerFreq.y - currentTarget.y) : 0;
  const totalDist = config.dualAxis ? Math.sqrt(distX * distX + distY * distY) : distX;
  const effectiveTolerance = interferenceActive ? alignmentTolerance * 0.6 : alignmentTolerance;
  const isAligned = totalDist <= effectiveTolerance;
  const isPerfectlyAligned = totalDist <= effectiveTolerance / 3;
  const isTimeUrgent = roundTimeLeft <= 5;
  
  // Calculate pulse opacity for target
  const pulseOpacity = config.pulseMode 
    ? 0.3 + 0.7 * Math.abs(Math.sin((pulsePhase / ((config as any).pulsePeriod || 3)) * Math.PI))
    : 1;
  
  const playerWaveColor = isPerfectlyAligned ? 'hsl(45, 100%, 50%)' : isAligned ? 'hsl(142, 76%, 46%)' : 'hsl(217, 91%, 60%)';
  
  return (
    <div className="flex flex-col items-center relative">
      {/* Countdown */}
      {gameState === 'countdown' && (
        <CountdownOverlay count={3} onComplete={handleCountdownComplete} />
      )}

      {/* Pause */}
      <AnimatePresence>
        {gameState === 'paused' && (
          <PauseOverlay onResume={() => setGameState('playing')} />
        )}
      </AnimatePresence>

      {/* HUD */}
      <GameHUD
        title="Astral Frequency"
        subtitle={`Round ${round}/${config.rounds} - Lock onto the cosmic signal!`}
        score={Math.round(score)}
        combo={combo}
        showCombo={true}
        phase={round - 1}
        totalPhases={config.rounds}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Round timer */}
      <RoundTimer timeLeft={roundTimeLeft} maxTime={config.roundTime} isUrgent={isTimeUrgent} />

      {/* Lock-on progress */}
      <div className="w-full max-w-xs mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Lock-On Progress
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

      {/* Oscilloscope display */}
      <div className="relative w-full max-w-xs h-48 mb-4">
        <OscilloscopeDisplay showGrid={true}>
          {/* Power surge overlay */}
          <PowerSurgeOverlay active={powerSurgeActive} timeLeft={powerSurgeTimeLeft} />
          
          {/* Stun overlay */}
          <StunOverlay active={isStunned} timeLeft={stunTimeLeft} />
          
          {/* Decoy indicator */}
          <DecoyIndicator active={!!currentTarget?.isDecoy && lockProgress > 0.5} />
          
          {/* Corruption zones */}
          <CorruptionZoneOverlay zones={corruptionZones} />
          
          {/* Harmonic markers */}
          <HarmonicMarkers enabled={config.harmonicBonus} />
          
          {/* Lissajous pattern when aligned */}
          <LissajousPattern 
            xFreq={playerFreq.x} 
            yFreq={currentTarget?.x || 50} 
            phase={wavePhases[0]}
            aligned={isAligned && !currentTarget?.isDecoy}
          />
          
          {/* Particles */}
          <ParticleRenderer particles={particles} />
          
          {/* Score popups */}
          <ScorePopups popups={scorePopups} />
          
          {/* Interference noise */}
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
              }}
            />
          )}
          
          {/* Waves container */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4">
            {/* Target wave */}
            {currentTarget && (
              <div className="relative">
                <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-xs text-purple-400 font-medium">
                  {currentTarget.isDecoy ? '???' : 'Target'}
                </div>
                <WaveSVG
                  frequency={currentTarget.x}
                  amplitude={config.dualAxis ? currentTarget.y : 50}
                  phase={wavePhases[0]}
                  color={currentTarget.isDecoy ? 'hsl(0, 70%, 55%)' : 'hsl(271, 91%, 65%)'}
                  isAligned={false}
                  index={0}
                  noiseAmount={interferenceActive ? interferenceIntensity * 0.3 : 0}
                  pulseOpacity={pulseOpacity}
                  isDashed={currentTarget.isDecoy}
                />
                {/* Lock-on ring */}
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
            
            {/* Player wave */}
            <div className="relative">
              <div className="absolute -left-8 top-1/2 -translate-y-1/2 text-xs text-blue-400 font-medium">You</div>
              <WaveSVG
                frequency={playerFreq.x}
                amplitude={config.dualAxis ? playerFreq.y : 50}
                phase={wavePhases[1]}
                color={playerWaveColor}
                isAligned={isAligned && !currentTarget?.isDecoy}
                index={1}
                noiseAmount={interferenceActive ? interferenceIntensity * 0.4 : 0}
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
                  animate={{ 
                    scale: isPerfectlyAligned ? [1, 1.3, 1] : [1, 1.15, 1],
                    opacity: [0.6, 1, 0.6]
                  }}
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

      {/* Controls */}
      {config.dualAxis ? (
        <div className="flex flex-col items-center gap-2">
          <FrequencyJoystick
            value={playerFreq}
            onChange={handleJoystickChange}
            disabled={isStunned || gameState !== 'playing'}
            showHarmonics={config.harmonicBonus}
          />
          <p className="text-xs text-muted-foreground">Drag to tune X (Freq) & Y (Amp)</p>
        </div>
      ) : (
        <div className="w-full max-w-xs">
          <input
            type="range"
            min="0"
            max="100"
            value={playerFreq.x}
            onChange={handleSliderChange}
            disabled={isStunned || gameState !== 'playing'}
            className="w-full h-4 rounded-full appearance-none cursor-pointer frequency-slider"
            style={{
              background: `linear-gradient(90deg, 
                hsl(217, 91%, 60%) 0%, 
                hsl(271, 91%, 65%) ${playerFreq.x}%, 
                hsl(var(--muted)) ${playerFreq.x}%, 
                hsl(var(--muted)) 100%)`,
              opacity: isStunned ? 0.5 : 1,
            }}
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Low</span>
            <span className={`font-medium ${isAligned ? 'text-primary' : ''}`}>
              Frequency: {Math.round(playerFreq.x)} {isPerfectlyAligned && '🎯'}
            </span>
            <span>High</span>
          </div>
        </div>
      )}

      {/* Status */}
      <div className={`mt-4 text-center ${isPerfectlyAligned ? 'text-yellow-400' : isAligned ? 'text-green-400' : 'text-muted-foreground'}`}>
        <p className="text-sm font-medium">
          {isStunned 
            ? '💫 STUNNED! Controls disabled...'
            : interferenceActive 
              ? '⚡ INTERFERENCE! Hold steady!'
              : isPerfectlyAligned 
                ? '🔐 PERFECT LOCK! Hold steady!' 
                : isAligned 
                  ? '🎯 Signal acquired! Locking on...' 
                  : `🎚️ ${config.dualAxis ? 'Use joystick to' : 'Adjust slider to'} match the signal`}
        </p>
      </div>

      {/* Feature indicators */}
      <div className="mt-2 flex flex-wrap justify-center gap-2 text-[10px] text-muted-foreground">
        {config.dualAxis && <span className="px-2 py-0.5 rounded bg-primary/10">2D Control</span>}
        {config.pulseMode && <span className="px-2 py-0.5 rounded bg-purple-500/10">Pulse Mode</span>}
        {config.harmonicBonus && <span className="px-2 py-0.5 rounded bg-yellow-500/10">Harmonics</span>}
        {config.powerSurgeEnabled && <span className="px-2 py-0.5 rounded bg-orange-500/10">Power Surge</span>}
        {config.decoyCount > 0 && <span className="px-2 py-0.5 rounded bg-red-500/10">{config.decoyCount} Decoy{config.decoyCount > 1 ? 's' : ''}</span>}
      </div>

      {/* Stat bonus */}
      <p className="mt-2 text-xs text-muted-foreground">
        Mind + Soul bonus: ±{alignmentTolerance} tolerance
      </p>

      {/* CSS */}
      <style>{`
        @keyframes scanline-move {
          0% { transform: translateY(0); }
          100% { transform: translateY(4px); }
        }
        @keyframes corruption-flicker {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.4; }
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
        .frequency-slider:disabled::-webkit-slider-thumb {
          cursor: not-allowed;
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
};
