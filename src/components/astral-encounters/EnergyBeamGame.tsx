import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Shield, Skull, Target, Crosshair } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';

interface EnergyBeamGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

// Difficulty configuration
const DIFFICULTY_CONFIG = {
  easy: {
    targetCount: 3,
    targetSpeed: 0,
    targetSize: 55,
    chargeDecayRate: 0,
    overloadThreshold: 110,
    shieldCount: 0,
    decoyCount: 0,
    multiTargetBonus: false,
    roundTimer: 45,
    waves: 2,
    targetFading: false,
  },
  medium: {
    targetCount: 4,
    targetSpeed: 0.4,
    targetSize: 48,
    chargeDecayRate: 2,
    overloadThreshold: 105,
    shieldCount: 1,
    decoyCount: 1,
    multiTargetBonus: true,
    roundTimer: 40,
    waves: 2,
    targetFading: false,
  },
  hard: {
    targetCount: 5,
    targetSpeed: 0.7,
    targetSize: 40,
    chargeDecayRate: 4,
    overloadThreshold: 100,
    shieldCount: 2,
    decoyCount: 2,
    multiTargetBonus: true,
    roundTimer: 35,
    waves: 3,
    targetFading: true,
  },
};

interface GameTarget {
  id: string;
  x: number;
  y: number;
  size: number;
  type: 'normal' | 'bonus' | 'decoy';
  health: number;
  points: number;
  velocityX: number;
  velocityY: number;
  opacity: number;
  isHit: boolean;
}

interface GameShield {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  rotation: number;
}

interface BeamShot {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  power: number;
  hits: { x: number; y: number; type: string }[];
}

// Timer bar component
const TimerBar = memo(({ timeLeft, maxTime }: { timeLeft: number; maxTime: number }) => {
  const percentage = (timeLeft / maxTime) * 100;
  
  return (
    <div className="w-full max-w-xs h-3 bg-slate-800/80 rounded-full overflow-hidden mb-3">
      <motion.div
        className="h-full rounded-full"
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.1 }}
        style={{
          background: percentage > 30
            ? 'linear-gradient(90deg, #22c55e, #4ade80)'
            : percentage > 15
              ? 'linear-gradient(90deg, #eab308, #facc15)'
              : 'linear-gradient(90deg, #ef4444, #f87171)',
          boxShadow: percentage <= 15 ? '0 0 10px #ef4444' : 'none',
        }}
      />
    </div>
  );
});
TimerBar.displayName = 'TimerBar';

// Wave indicator component
const WaveIndicator = memo(({ wave, totalWaves }: { wave: number; totalWaves: number }) => (
  <div className="flex items-center gap-2 mb-2">
    <span className="text-xs text-muted-foreground">Wave</span>
    <div className="flex gap-1">
      {Array.from({ length: totalWaves }).map((_, i) => (
        <div
          key={i}
          className={`w-6 h-1.5 rounded-full transition-all ${
            i < wave 
              ? 'bg-primary' 
              : i === wave 
                ? 'bg-primary/50 animate-pulse' 
                : 'bg-muted/30'
          }`}
        />
      ))}
    </div>
  </div>
));
WaveIndicator.displayName = 'WaveIndicator';

// Target component
const TargetComponent = memo(({ target, isAiming }: { target: GameTarget; isAiming: boolean }) => {
  if (target.isHit) return null;
  
  const isDecoy = target.type === 'decoy';
  const isBonus = target.type === 'bonus';
  
  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${target.x}%`,
        top: `${target.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      animate={{
        opacity: target.opacity,
        scale: isAiming ? 1.1 : 1,
      }}
      transition={{ duration: 0.2 }}
    >
      {/* Outer ring */}
      <div
        className="rounded-full flex items-center justify-center"
        style={{
          width: target.size,
          height: target.size,
          background: isDecoy
            ? 'radial-gradient(circle, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.4) 100%)'
            : isBonus
              ? 'radial-gradient(circle, rgba(250,204,21,0.2) 0%, rgba(250,204,21,0.4) 100%)'
              : 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, rgba(168,85,247,0.4) 100%)',
          border: `2px solid ${isDecoy ? 'rgba(239,68,68,0.6)' : isBonus ? 'rgba(250,204,21,0.6)' : 'rgba(168,85,247,0.6)'}`,
          boxShadow: `0 0 20px ${isDecoy ? 'rgba(239,68,68,0.4)' : isBonus ? 'rgba(250,204,21,0.4)' : 'rgba(168,85,247,0.3)'}`,
        }}
      >
        {/* Middle ring */}
        <div
          className="rounded-full flex items-center justify-center"
          style={{
            width: target.size * 0.65,
            height: target.size * 0.65,
            background: isDecoy
              ? 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.5) 100%)'
              : isBonus
                ? 'radial-gradient(circle, rgba(250,204,21,0.3) 0%, rgba(250,204,21,0.5) 100%)'
                : 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, rgba(168,85,247,0.5) 100%)',
            border: `1px solid ${isDecoy ? 'rgba(239,68,68,0.5)' : isBonus ? 'rgba(250,204,21,0.5)' : 'rgba(168,85,247,0.5)'}`,
          }}
        >
          {/* Bullseye center */}
          <div
            className="rounded-full flex items-center justify-center"
            style={{
              width: target.size * 0.3,
              height: target.size * 0.3,
              background: isDecoy
                ? 'radial-gradient(circle, #ef4444 0%, #dc2626 100%)'
                : isBonus
                  ? 'radial-gradient(circle, #fbbf24 0%, #f59e0b 100%)'
                  : 'radial-gradient(circle, #a855f7 0%, #9333ea 100%)',
              boxShadow: `0 0 10px ${isDecoy ? '#ef4444' : isBonus ? '#fbbf24' : '#a855f7'}`,
            }}
          >
            {isDecoy && <Skull className="w-3 h-3 text-white" />}
            {isBonus && <span className="text-[8px] font-bold text-white">★</span>}
          </div>
        </div>
      </div>
      
      {/* Points indicator */}
      <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[10px] font-bold ${
        isDecoy ? 'text-red-400' : isBonus ? 'text-yellow-400' : 'text-purple-400'
      }`}>
        {isDecoy ? '-50' : `+${target.points}`}
      </div>
    </motion.div>
  );
});
TargetComponent.displayName = 'TargetComponent';

// Shield component
const ShieldComponent = memo(({ shield }: { shield: GameShield }) => (
  <motion.div
    className="absolute pointer-events-none"
    style={{
      left: `${shield.x}%`,
      top: `${shield.y}%`,
      transform: `translate(-50%, -50%) rotate(${shield.rotation}deg)`,
    }}
    animate={{
      rotate: [shield.rotation, shield.rotation + 5, shield.rotation - 5, shield.rotation],
    }}
    transition={{ duration: 3, repeat: Infinity }}
  >
    <div
      className="flex items-center justify-center"
      style={{
        width: shield.width,
        height: shield.height,
        background: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.6) 50%, rgba(59,130,246,0.3) 100%)',
        border: '2px solid rgba(59,130,246,0.8)',
        borderRadius: 8,
        boxShadow: '0 0 20px rgba(59,130,246,0.5), inset 0 0 15px rgba(59,130,246,0.3)',
        clipPath: 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)',
      }}
    >
      <Shield className="w-5 h-5 text-blue-300" />
    </div>
    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-blue-400 font-bold">
      HP: {shield.hp}
    </div>
  </motion.div>
));
ShieldComponent.displayName = 'ShieldComponent';

// Beam projectile component
const BeamProjectile = memo(({ beam, onComplete }: { beam: BeamShot; onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 400);
    return () => clearTimeout(timer);
  }, [onComplete]);
  
  const powerColor = beam.power >= 90
    ? '#fbbf24'
    : beam.power >= 70
      ? '#a855f7'
      : '#6366f1';
  
  const beamWidth = Math.max(2, beam.power / 20);
  
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`beam-${beam.id}`} x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor={powerColor} stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0.8" />
        </linearGradient>
        <filter id={`glow-${beam.id}`}>
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      
      <motion.line
        x1={`${beam.startX}%`}
        y1={`${beam.startY}%`}
        x2={`${beam.startX}%`}
        y2={`${beam.startY}%`}
        stroke={`url(#beam-${beam.id})`}
        strokeWidth={beamWidth}
        strokeLinecap="round"
        filter={`url(#glow-${beam.id})`}
        animate={{
          x2: `${beam.endX}%`,
          y2: `${beam.endY}%`,
        }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
      />
      
      {/* Impact effects */}
      {beam.hits.map((hit, i) => (
        <motion.circle
          key={i}
          cx={`${hit.x}%`}
          cy={`${hit.y}%`}
          r="0"
          fill="none"
          stroke={hit.type === 'decoy' ? '#ef4444' : hit.type === 'bonus' ? '#fbbf24' : powerColor}
          strokeWidth="2"
          initial={{ r: 0, opacity: 1 }}
          animate={{ r: 30, opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        />
      ))}
    </svg>
  );
});
BeamProjectile.displayName = 'BeamProjectile';

// Charge bar component
const ChargeBar = memo(({ 
  chargeLevel, 
  isCharging,
  isOverheating,
  overloadThreshold,
}: { 
  chargeLevel: number;
  isCharging: boolean;
  isOverheating: boolean;
  overloadThreshold: number;
}) => {
  return (
    <div className="relative w-full max-w-xs h-8 mb-4">
      <div 
        className="absolute inset-0 rounded-xl overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(10,10,30,0.4) 100%)',
          border: isOverheating ? '2px solid rgba(239,68,68,0.8)' : '1px solid rgba(255,255,255,0.1)',
          boxShadow: isOverheating ? '0 0 20px rgba(239,68,68,0.5)' : 'inset 0 3px 8px rgba(0,0,0,0.5)',
        }}
      >
        {/* Overload zone indicator */}
        <div
          className="absolute top-0 bottom-0 right-0"
          style={{
            width: `${110 - overloadThreshold}%`,
            background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.3))',
          }}
        />
        
        {/* Charge fill */}
        <motion.div 
          className="absolute top-1 bottom-1 left-1 rounded-lg"
          animate={{ width: `calc(${Math.min(chargeLevel, 100)}% - 4px)` }}
          transition={{ duration: 0.05 }}
          style={{ 
            background: isOverheating
              ? 'linear-gradient(90deg, #ef4444, #f87171, #ef4444)'
              : chargeLevel >= 80
                ? 'linear-gradient(90deg, #fbbf24, #fcd34d, #fbbf24)'
                : chargeLevel >= 50
                  ? 'linear-gradient(90deg, #a855f7, #c084fc, #a855f7)'
                  : 'linear-gradient(90deg, #6366f1, #818cf8, #6366f1)',
            backgroundSize: isCharging ? '200% 100%' : '100% 100%',
            animation: isCharging ? 'shimmer 1s linear infinite' : 'none',
            boxShadow: isOverheating
              ? '0 0 20px rgba(239,68,68,0.6)'
              : '0 0 15px rgba(168,85,247,0.4)',
          }}
        />
        
        {/* Charge indicator line */}
        <motion.div
          className="absolute top-1 bottom-1 w-1 rounded-full bg-white"
          animate={{ left: `${Math.min(chargeLevel, 100)}%` }}
          transition={{ duration: 0.05 }}
          style={{ 
            boxShadow: '0 0 10px white',
          }}
        />
      </div>
      
      {/* Labels */}
      <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[10px]">
        <span className="text-muted-foreground">0%</span>
        <span className={`font-bold ${chargeLevel >= 80 ? 'text-yellow-400' : 'text-primary'}`}>
          {Math.round(chargeLevel)}%
        </span>
        <span className="text-red-400">{overloadThreshold}%</span>
      </div>
      
      {/* Overheat warning */}
      <AnimatePresence>
        {isOverheating && (
          <motion.div
            className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-bold text-red-400"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: [1, 0.5, 1], y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, repeat: Infinity }}
          >
            ⚠️ OVERHEATING!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
ChargeBar.displayName = 'ChargeBar';

// Combo display
const ComboDisplay = memo(({ combo, chainHits }: { combo: number; chainHits: number }) => (
  <AnimatePresence>
    {(combo > 1 || chainHits > 1) && (
      <motion.div
        className="absolute top-4 right-4 text-right z-30"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
      >
        {combo > 1 && (
          <div className="text-2xl font-black text-orange-400" style={{ textShadow: '0 0 10px rgba(249,115,22,0.5)' }}>
            {combo}x COMBO
          </div>
        )}
        {chainHits > 1 && (
          <motion.div
            className="text-lg font-bold text-yellow-400"
            initial={{ scale: 1.5 }}
            animate={{ scale: 1 }}
          >
            ⚡ {chainHits}-HIT CHAIN!
          </motion.div>
        )}
      </motion.div>
    )}
  </AnimatePresence>
));
ComboDisplay.displayName = 'ComboDisplay';

// Score popup
const ScorePopup = memo(({ score, x, y, type }: { score: number; x: number; y: number; type: string }) => (
  <motion.div
    className={`absolute pointer-events-none font-bold text-lg z-30 ${
      score < 0 ? 'text-red-400' : type === 'bonus' ? 'text-yellow-400' : 'text-green-400'
    }`}
    style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
    initial={{ opacity: 1, y: 0, scale: 1.5 }}
    animate={{ opacity: 0, y: -30, scale: 1 }}
    transition={{ duration: 0.8 }}
  >
    {score > 0 ? `+${score}` : score}
  </motion.div>
));
ScorePopup.displayName = 'ScorePopup';

// Wave transition overlay
const WaveTransition = memo(({ wave }: { wave: number }) => (
  <motion.div
    className="absolute inset-0 z-40 flex items-center justify-center bg-background/90 backdrop-blur-sm"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      className="text-center"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      exit={{ scale: 0, rotate: 180 }}
      transition={{ type: 'spring', stiffness: 200 }}
    >
      <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5, repeat: 2 }}>
        <Target className="w-16 h-16 text-primary mx-auto mb-2" />
      </motion.div>
      <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
        WAVE {wave + 1}
      </p>
      <p className="text-sm text-muted-foreground mt-1">New targets incoming!</p>
    </motion.div>
  </motion.div>
));
WaveTransition.displayName = 'WaveTransition';

// Generate targets for a wave
const generateTargets = (
  config: typeof DIFFICULTY_CONFIG['easy'],
  waveIndex: number
): GameTarget[] => {
  const targets: GameTarget[] = [];
  const usedPositions: { x: number; y: number }[] = [];
  
  const isValidPosition = (x: number, y: number) => {
    return usedPositions.every(pos => 
      Math.sqrt(Math.pow(pos.x - x, 2) + Math.pow(pos.y - y, 2)) > 20
    );
  };
  
  // Normal targets
  for (let i = 0; i < config.targetCount - config.decoyCount; i++) {
    let x, y;
    let attempts = 0;
    do {
      x = 15 + Math.random() * 70;
      y = 10 + Math.random() * 50;
      attempts++;
    } while (!isValidPosition(x, y) && attempts < 20);
    
    usedPositions.push({ x, y });
    
    const isBonus = i === 0 && waveIndex > 0;
    targets.push({
      id: `target-${waveIndex}-${i}`,
      x,
      y,
      size: config.targetSize,
      type: isBonus ? 'bonus' : 'normal',
      health: 1,
      points: isBonus ? 200 : Math.random() > 0.5 ? 150 : 100,
      velocityX: (Math.random() - 0.5) * config.targetSpeed,
      velocityY: (Math.random() - 0.5) * config.targetSpeed,
      opacity: 1,
      isHit: false,
    });
  }
  
  // Decoy targets
  for (let i = 0; i < config.decoyCount; i++) {
    let x, y;
    let attempts = 0;
    do {
      x = 15 + Math.random() * 70;
      y = 10 + Math.random() * 50;
      attempts++;
    } while (!isValidPosition(x, y) && attempts < 20);
    
    usedPositions.push({ x, y });
    
    targets.push({
      id: `decoy-${waveIndex}-${i}`,
      x,
      y,
      size: config.targetSize * 0.9,
      type: 'decoy',
      health: 1,
      points: -50,
      velocityX: (Math.random() - 0.5) * config.targetSpeed * 1.2,
      velocityY: (Math.random() - 0.5) * config.targetSpeed * 1.2,
      opacity: 1,
      isHit: false,
    });
  }
  
  return targets;
};

// Generate shields for a wave
const generateShields = (config: typeof DIFFICULTY_CONFIG['easy'], waveIndex: number): GameShield[] => {
  const shields: GameShield[] = [];
  
  for (let i = 0; i < config.shieldCount; i++) {
    shields.push({
      id: `shield-${waveIndex}-${i}`,
      x: 20 + Math.random() * 60,
      y: 35 + Math.random() * 25,
      width: 50,
      height: 30,
      hp: waveIndex > 0 ? 2 : 1,
      rotation: Math.random() * 30 - 15,
    });
  }
  
  return shields;
};

export const EnergyBeamGame = ({ 
  companionStats, 
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0
}: EnergyBeamGameProps) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete' | 'wave-transition'>('countdown');
  const [isCharging, setIsCharging] = useState(false);
  const [chargeLevel, setChargeLevel] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [chainHits, setChainHits] = useState(0);
  const [currentWave, setCurrentWave] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.roundTimer);
  const [isStunned, setIsStunned] = useState(false);
  const [shake, setShake] = useState(false);
  
  const [targets, setTargets] = useState<GameTarget[]>([]);
  const [shields, setShields] = useState<GameShield[]>([]);
  const [activeBeams, setActiveBeams] = useState<BeamShot[]>([]);
  const [scorePopups, setScorePopups] = useState<{ id: string; score: number; x: number; y: number; type: string }[]>([]);
  
  const [aimPosition, setAimPosition] = useState({ x: 50, y: 50 });
  const arenaRef = useRef<HTMLDivElement>(null);
  const chargeRef = useRef<NodeJS.Timeout | null>(null);
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  
  const bodyBonus = Math.min(companionStats.body / 100, 1);
  const mindBonus = Math.min(companionStats.mind / 100, 1);
  
  const isOverheating = chargeLevel >= config.overloadThreshold - 10;
  
  // Initialize wave
  const initializeWave = useCallback((waveIndex: number) => {
    setTargets(generateTargets(config, waveIndex));
    setShields(generateShields(config, waveIndex));
    setChainHits(0);
  }, [config]);
  
  // Start game
  useEffect(() => {
    if (gameState === 'playing' && targets.length === 0) {
      initializeWave(0);
    }
  }, [gameState, targets.length, initializeWave]);
  
  // Game timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setGameState('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [gameState]);
  
  // Game loop for target movement and fading
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    gameLoopRef.current = setInterval(() => {
      setTargets(prev => prev.map(target => {
        if (target.isHit) return target;
        
        let newX = target.x + target.velocityX;
        let newY = target.y + target.velocityY;
        let newVelocityX = target.velocityX;
        let newVelocityY = target.velocityY;
        
        // Bounce off walls
        if (newX < 10 || newX > 90) newVelocityX *= -1;
        if (newY < 5 || newY > 60) newVelocityY *= -1;
        
        // Fading effect for hard mode
        let newOpacity = target.opacity;
        if (config.targetFading) {
          newOpacity = 0.4 + Math.sin(Date.now() / 1000 + parseInt(target.id.split('-')[2])) * 0.6;
        }
        
        return {
          ...target,
          x: Math.max(10, Math.min(90, newX)),
          y: Math.max(5, Math.min(60, newY)),
          velocityX: newVelocityX,
          velocityY: newVelocityY,
          opacity: newOpacity,
        };
      }));
    }, 50);
    
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [gameState, config.targetFading]);
  
  // Charge decay
  useEffect(() => {
    if (gameState !== 'playing' || isCharging || chargeLevel <= 0 || config.chargeDecayRate === 0) return;
    
    const decayInterval = setInterval(() => {
      setChargeLevel(prev => Math.max(0, prev - config.chargeDecayRate / 10));
    }, 100);
    
    return () => clearInterval(decayInterval);
  }, [gameState, isCharging, chargeLevel, config.chargeDecayRate]);
  
  // Check for overload
  useEffect(() => {
    if (chargeLevel >= config.overloadThreshold && isCharging) {
      fireBeam(true);
    }
  }, [chargeLevel, config.overloadThreshold, isCharging]);
  
  // Check wave completion
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const remainingTargets = targets.filter(t => !t.isHit && t.type !== 'decoy');
    if (remainingTargets.length === 0 && targets.length > 0) {
      // Wave clear bonus
      const waveBonus = 100;
      setScore(prev => prev + waveBonus);
      addScorePopup(waveBonus, 50, 40, 'bonus');
      
      if (currentWave < config.waves - 1) {
        setGameState('wave-transition');
        setTimeout(() => {
          setCurrentWave(w => w + 1);
          initializeWave(currentWave + 1);
          setGameState('playing');
        }, 1500);
      } else {
        // Time bonus
        const timeBonus = timeLeft * 5;
        setScore(prev => prev + timeBonus);
        setGameState('complete');
      }
    }
  }, [targets, gameState, currentWave, config.waves, timeLeft, initializeWave]);
  
  // Calculate final result on game complete
  useEffect(() => {
    if (gameState !== 'complete') return;
    
    const maxPossibleScore = config.targetCount * config.waves * 150 + config.waves * 100 + config.roundTimer * 5;
    const accuracy = Math.min(100, Math.round((score / maxPossibleScore) * 150 + mindBonus * 10));
    
    setTimeout(() => {
      onComplete({
        success: accuracy >= 50,
        accuracy,
        result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail'
      });
    }, 500);
  }, [gameState, score, config, mindBonus, onComplete]);
  
  const addScorePopup = (points: number, x: number, y: number, type: string) => {
    const id = `popup-${Date.now()}-${Math.random()}`;
    setScorePopups(prev => [...prev, { id, score: points, x, y, type }]);
    setTimeout(() => {
      setScorePopups(prev => prev.filter(p => p.id !== id));
    }, 800);
  };
  
  const startCharging = useCallback(() => {
    if (gameState !== 'playing' || isStunned) return;
    setIsCharging(true);
    triggerHaptic('light');
    
    chargeRef.current = setInterval(() => {
      setChargeLevel(prev => {
        const newLevel = prev + (2.5 + bodyBonus);
        if (newLevel >= 100 && Math.floor(prev / 20) < Math.floor(newLevel / 20)) {
          triggerHaptic('light');
        }
        return Math.min(newLevel, config.overloadThreshold + 5);
      });
    }, 25);
  }, [gameState, isStunned, bodyBonus, config.overloadThreshold]);
  
  const fireBeam = useCallback((isOverload = false) => {
    if (!isCharging && !isOverload) return;
    
    setIsCharging(false);
    if (chargeRef.current) clearInterval(chargeRef.current);
    
    const power = isOverload ? chargeLevel * 0.8 : chargeLevel; // Overload penalty
    const beamId = `beam-${Date.now()}`;
    
    // Find targets in line of fire
    const hitTargets: { target: GameTarget; distance: number }[] = [];
    const hitShields: GameShield[] = [];
    
    // Check shields first
    shields.forEach(shield => {
      const dx = Math.abs(shield.x - aimPosition.x);
      const dy = Math.abs(shield.y - aimPosition.y);
      if (dx < 15 && dy < 15) {
        hitShields.push(shield);
      }
    });
    
    // If no shields blocking, check targets
    if (hitShields.length === 0) {
      targets.forEach(target => {
        if (target.isHit) return;
        const distance = Math.sqrt(
          Math.pow(target.x - aimPosition.x, 2) + 
          Math.pow(target.y - aimPosition.y, 2)
        );
        const hitRadius = (target.size / 2) / 4; // Convert px to %
        if (distance < hitRadius + 8) { // Some tolerance
          hitTargets.push({ target, distance });
        }
      });
    }
    
    // Sort by distance for multi-target
    hitTargets.sort((a, b) => a.distance - b.distance);
    
    // Determine pierce count based on power
    const maxPierce = config.multiTargetBonus 
      ? (power >= 90 ? 3 : power >= 70 ? 2 : 1)
      : 1;
    
    const targetsToHit = hitTargets.slice(0, maxPierce);
    const hits: { x: number; y: number; type: string }[] = [];
    
    // Process shield hits
    if (hitShields.length > 0) {
      const shield = hitShields[0];
      hits.push({ x: shield.x, y: shield.y, type: 'shield' });
      
      setShields(prev => prev.map(s => {
        if (s.id === shield.id) {
          const newHp = s.hp - 1;
          if (newHp <= 0) {
            addScorePopup(25, s.x, s.y, 'normal');
            setScore(p => p + 25);
            return { ...s, hp: 0 };
          }
          return { ...s, hp: newHp };
        }
        return s;
      }).filter(s => s.hp > 0));
      
      triggerHaptic('medium');
    } else if (targetsToHit.length > 0) {
      // Process target hits
      let chainBonus = 0;
      
      targetsToHit.forEach((hit, index) => {
        const { target } = hit;
        hits.push({ x: target.x, y: target.y, type: target.type });
        
        if (target.type === 'decoy') {
          // Hit a decoy - penalty
          setScore(p => Math.max(0, p + target.points));
          addScorePopup(target.points, target.x, target.y, 'decoy');
          setCombo(0);
          setShake(true);
          setIsStunned(true);
          triggerHaptic('error');
          setTimeout(() => {
            setShake(false);
            setIsStunned(false);
          }, 1500);
        } else {
          // Calculate points based on accuracy
          const distance = hit.distance;
          const basePoints = target.points;
          const accuracyMultiplier = distance < 3 ? 1.5 : distance < 6 ? 1 : 0.7;
          const points = Math.round(basePoints * accuracyMultiplier);
          
          chainBonus += index > 0 ? (index === 1 ? 100 : 200) : 0;
          
          setScore(p => p + points);
          addScorePopup(points, target.x, target.y, target.type);
          setCombo(c => {
            const newCombo = c + 1;
            setMaxCombo(m => Math.max(m, newCombo));
            return newCombo;
          });
          triggerHaptic(distance < 3 ? 'success' : 'medium');
        }
        
        setTargets(prev => prev.map(t => 
          t.id === target.id ? { ...t, isHit: true } : t
        ));
      });
      
      if (chainBonus > 0) {
        setChainHits(targetsToHit.filter(h => h.target.type !== 'decoy').length);
        setScore(p => p + chainBonus);
        addScorePopup(chainBonus, aimPosition.x, aimPosition.y - 10, 'chain');
        setTimeout(() => setChainHits(0), 1000);
      }
    } else {
      // Missed everything
      setCombo(0);
      triggerHaptic('light');
    }
    
    // Create beam visual
    const beam: BeamShot = {
      id: beamId,
      startX: 50,
      startY: 95,
      endX: aimPosition.x,
      endY: aimPosition.y,
      power,
      hits,
    };
    
    setActiveBeams(prev => [...prev, beam]);
    setChargeLevel(0);
    
    if (isOverload) {
      setShake(true);
      setTimeout(() => setShake(false), 300);
    }
  }, [isCharging, chargeLevel, aimPosition, targets, shields, config.multiTargetBonus]);
  
  const releaseBeam = useCallback(() => {
    if (!isCharging || gameState !== 'playing') return;
    fireBeam(false);
  }, [isCharging, gameState, fireBeam]);
  
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!arenaRef.current || gameState !== 'playing') return;
    
    const rect = arenaRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setAimPosition({
      x: Math.max(5, Math.min(95, x)),
      y: Math.max(5, Math.min(70, y)),
    });
  }, [gameState]);
  
  const removeBeam = useCallback((beamId: string) => {
    setActiveBeams(prev => prev.filter(b => b.id !== beamId));
  }, []);
  
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);
  
  // Cleanup
  useEffect(() => {
    return () => {
      if (chargeRef.current) clearInterval(chargeRef.current);
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, []);

  return (
    <div className={`flex flex-col items-center relative ${shake ? 'animate-shake' : ''}`}>
      {/* Countdown Overlay */}
      {gameState === 'countdown' && (
        <CountdownOverlay count={3} onComplete={handleCountdownComplete} />
      )}

      {/* Wave Transition Overlay */}
      <AnimatePresence>
        {gameState === 'wave-transition' && <WaveTransition wave={currentWave} />}
      </AnimatePresence>

      {/* Pause Overlay */}
      <AnimatePresence>
        {gameState === 'paused' && (
          <PauseOverlay onResume={() => setGameState('playing')} />
        )}
      </AnimatePresence>

      {/* Game HUD */}
      <GameHUD
        title="Energy Beam"
        subtitle="Aim and fire at targets!"
        score={score}
        maxScore={config.targetCount * config.waves * 150}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: timeLeft, label: 'Time', color: timeLeft <= 10 ? '#ef4444' : '#22c55e' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Timer bar */}
      <TimerBar timeLeft={timeLeft} maxTime={config.roundTimer} />

      {/* Wave indicator */}
      <WaveIndicator wave={currentWave} totalWaves={config.waves} />

      {/* Combo display */}
      <ComboDisplay combo={combo} chainHits={chainHits} />

      {/* Target Arena */}
      <div
        ref={arenaRef}
        className="relative w-full max-w-sm h-64 rounded-xl overflow-hidden mb-4 touch-none"
        style={{
          background: 'linear-gradient(180deg, rgba(10,10,30,0.9) 0%, rgba(30,20,50,0.8) 100%)',
          border: '1px solid rgba(168,85,247,0.3)',
          boxShadow: '0 0 30px rgba(168,85,247,0.15), inset 0 0 50px rgba(0,0,0,0.5)',
        }}
        onPointerMove={handlePointerMove}
      >
        {/* Star background */}
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.3 + Math.random() * 0.4,
              animation: `twinkle ${2 + Math.random() * 2}s ease-in-out infinite`,
            }}
          />
        ))}
        
        {/* Shields */}
        {shields.map(shield => (
          <ShieldComponent key={shield.id} shield={shield} />
        ))}
        
        {/* Targets */}
        {targets.map(target => (
          <TargetComponent 
            key={target.id} 
            target={target} 
            isAiming={
              Math.abs(target.x - aimPosition.x) < 15 && 
              Math.abs(target.y - aimPosition.y) < 15
            }
          />
        ))}
        
        {/* Crosshair */}
        {gameState === 'playing' && (
          <motion.div
            className="absolute pointer-events-none z-10"
            style={{
              left: `${aimPosition.x}%`,
              top: `${aimPosition.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <Crosshair 
              className={`w-10 h-10 ${isStunned ? 'text-red-400' : 'text-white/80'}`}
              style={{
                filter: isCharging ? 'drop-shadow(0 0 10px white)' : 'none',
              }}
            />
          </motion.div>
        )}
        
        {/* Active beams */}
        {activeBeams.map(beam => (
          <BeamProjectile 
            key={beam.id} 
            beam={beam} 
            onComplete={() => removeBeam(beam.id)} 
          />
        ))}
        
        {/* Score popups */}
        {scorePopups.map(popup => (
          <ScorePopup 
            key={popup.id} 
            score={popup.score} 
            x={popup.x} 
            y={popup.y}
            type={popup.type}
          />
        ))}
      </div>

      {/* Charge bar */}
      <ChargeBar
        chargeLevel={chargeLevel}
        isCharging={isCharging}
        isOverheating={isOverheating}
        overloadThreshold={config.overloadThreshold}
      />

      {/* Fire button */}
      {(gameState === 'playing' || gameState === 'wave-transition') && (
        <motion.button
          className={`relative w-28 h-28 rounded-full flex items-center justify-center overflow-hidden touch-none ${
            isStunned ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{
            background: isCharging 
              ? 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))'
              : 'linear-gradient(135deg, hsl(var(--primary)/0.9), hsl(var(--accent)/0.9))',
            backgroundSize: isCharging ? '200% 200%' : '100% 100%',
            animation: isCharging ? 'shimmer 1.5s linear infinite' : 'none',
            border: isOverheating ? '3px solid rgba(239,68,68,0.8)' : '3px solid rgba(255,255,255,0.25)',
            boxShadow: isCharging 
              ? '0 0 40px hsl(var(--primary)), 0 0 80px hsl(var(--primary)/0.5)'
              : '0 8px 30px rgba(0,0,0,0.3), 0 0 20px hsl(var(--primary)/0.3)',
            opacity: gameState === 'wave-transition' ? 0.5 : 1,
            pointerEvents: gameState === 'wave-transition' || isStunned ? 'none' : 'auto',
          }}
          onPointerDown={startCharging}
          onPointerUp={releaseBeam}
          onPointerLeave={releaseBeam}
          onPointerCancel={releaseBeam}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className={`absolute inset-3 rounded-full border border-white/25 ${isCharging ? 'animate-ping' : ''}`} />
          
          <Zap 
            className="w-12 h-12 text-white relative z-10"
            style={{ 
              filter: isCharging ? 'drop-shadow(0 0 15px white)' : 'drop-shadow(0 0 8px rgba(255,255,255,0.5))',
            }}
          />
          
          <div 
            className="absolute bottom-0 left-0 right-0 transition-all duration-75"
            style={{ 
              height: `${chargeLevel}%`,
              background: 'linear-gradient(to top, rgba(255,255,255,0.3), rgba(255,255,255,0.1))',
              borderRadius: '0 0 50% 50%',
            }}
          />
        </motion.button>
      )}

      {/* Instructions */}
      <motion.p 
        className="mt-3 text-sm text-muted-foreground text-center"
        animate={{ opacity: gameState === 'playing' ? 1 : 0.5 }}
      >
        {isStunned ? (
          <span className="text-red-400">⚠️ Stunned! Wait...</span>
        ) : isCharging ? (
          <span className={chargeLevel >= 80 ? 'text-yellow-400 font-bold' : ''}>
            {chargeLevel >= 80 ? '⚡ Maximum power!' : 'Charging...'}
          </span>
        ) : (
          'Hold to charge • Move to aim • Release to fire!'
        )}
      </motion.p>

      {/* Difficulty indicator */}
      <p className="mt-1 text-xs text-muted-foreground">
        {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} • Body +{Math.round(bodyBonus * 10)}% charge
      </p>

      {/* CSS animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.3s ease-in-out; }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};
