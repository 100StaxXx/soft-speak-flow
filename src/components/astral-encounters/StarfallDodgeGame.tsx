import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useGameLoop, useStaticStars, useParticleSystem } from './gameUtils';
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { lockToLandscape, lockToPortrait } from '@/utils/orientationLock';
import { Button } from '@/components/ui/button';
import { Smartphone, RotateCcw } from 'lucide-react';

import { DamageEvent, GAME_DAMAGE_VALUES } from '@/types/battleSystem';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';

interface StarfallDodgeGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  tierAttackDamage?: number;
  difficulty?: ArcadeDifficulty;
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
  compact?: boolean;
}

// Extended object types with new power-ups and obstacles
type ObjectType = 
  | 'debris' 
  | 'crystal' 
  | 'powerup_shield' 
  | 'powerup_magnet' 
  | 'powerup_slowmo' 
  | 'powerup_life' 
  | 'bomb' 
  | 'homing_debris';

interface FallingObject {
  id: number;
  x: number;
  y: number;
  type: ObjectType;
  speed: number;
  size: number;
  targetX?: number; // For homing debris
}

// ENDLESS mode config - GREATLY INCREASED SPEEDS
const DIFFICULTY_CONFIG = {
  beginner: {
    initialSpawnRate: 1000,
    debrisRatio: 0.35,
    baseSpeed: 1.5,
    speedIncrease: 0.20,     // 67% faster (was 0.12)
    spawnRateDecrease: 8,
    minSpawnRate: 350,
    maxSpeed: 7.0,
  },
  easy: { 
    initialSpawnRate: 800, 
    debrisRatio: 0.45, 
    baseSpeed: 2.0,
    speedIncrease: 0.30,     // 67% faster (was 0.18)
    spawnRateDecrease: 14,
    minSpawnRate: 250,
    maxSpeed: 9.5,
  },
  medium: { 
    initialSpawnRate: 650, 
    debrisRatio: 0.55, 
    baseSpeed: 2.8,
    speedIncrease: 0.40,     // 60% faster (was 0.25)
    spawnRateDecrease: 18,
    minSpawnRate: 200,
    maxSpeed: 11.0,
  },
  hard: { 
    initialSpawnRate: 500, 
    debrisRatio: 0.65, 
    baseSpeed: 3.5,
    speedIncrease: 0.28,     // 75% faster (was 0.16)
    spawnRateDecrease: 22,
    minSpawnRate: 150,
    maxSpeed: 12.0,
  },
  master: {
    initialSpawnRate: 400,
    debrisRatio: 0.75,
    baseSpeed: 4.5,
    speedIncrease: 0.35,     // 75% faster (was 0.20)
    spawnRateDecrease: 28,
    minSpawnRate: 120,
    maxSpeed: 14.0,
  },
};

// Power-up durations in milliseconds
const POWERUP_DURATIONS = {
  magnet: 5000,
  slowmo: 4000,
};

// Memoized star background
const StarBackground = memo(({ stars }: { stars: ReturnType<typeof useStaticStars> }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {stars.map(star => (
      <div
        key={star.id}
        className="absolute rounded-full bg-white"
        style={{
          width: star.size,
          height: star.size,
          left: `${star.x}%`,
          top: `${star.y}%`,
          opacity: star.opacity,
          animation: `twinkle ${star.animationDuration}s ease-in-out infinite`,
        }}
      />
    ))}
  </div>
));
StarBackground.displayName = 'StarBackground';

// Falling object component with new types
const FallingObjectComponent = memo(({ obj }: { obj: FallingObject }) => {
  switch (obj.type) {
    case 'crystal':
      return (
        <div 
          className="w-7 h-7 flex items-center justify-center"
          style={{ filter: 'drop-shadow(0 0 8px #22d3ee)', animation: 'spin 3s linear infinite' }}
        >
          <span className="text-2xl">💎</span>
        </div>
      );
    case 'powerup_shield':
      return (
        <div 
          className="w-8 h-8 flex items-center justify-center"
          style={{ filter: 'drop-shadow(0 0 12px #10b981)', animation: 'pulse 1.5s ease-in-out infinite' }}
        >
          <span className="text-2xl">🛡️</span>
        </div>
      );
    case 'powerup_magnet':
      return (
        <div 
          className="w-8 h-8 flex items-center justify-center"
          style={{ filter: 'drop-shadow(0 0 12px #f59e0b)', animation: 'pulse 1.2s ease-in-out infinite' }}
        >
          <span className="text-2xl">🧲</span>
        </div>
      );
    case 'powerup_slowmo':
      return (
        <div 
          className="w-8 h-8 flex items-center justify-center"
          style={{ filter: 'drop-shadow(0 0 12px #8b5cf6)', animation: 'pulse 1.8s ease-in-out infinite' }}
        >
          <span className="text-2xl">⏳</span>
        </div>
      );
    case 'powerup_life':
      return (
        <div 
          className="w-9 h-9 flex items-center justify-center"
          style={{ filter: 'drop-shadow(0 0 15px #ec4899)', animation: 'pulse 0.8s ease-in-out infinite' }}
        >
          <span className="text-2xl">💖</span>
        </div>
      );
    case 'bomb':
      return (
        <div 
          className="w-10 h-10 flex items-center justify-center"
          style={{ filter: 'drop-shadow(0 0 15px #ef4444)', animation: 'pulse 0.5s ease-in-out infinite' }}
        >
          <span className="text-3xl">💣</span>
        </div>
      );
    case 'homing_debris':
      return (
        <div
          className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 via-red-600 to-orange-500"
          style={{ 
            boxShadow: '0 0 16px rgba(249, 115, 22, 0.8), 0 0 8px rgba(255, 255, 255, 0.4)',
            animation: 'spin 0.4s linear infinite',
          }}
        >
          <div className="absolute inset-1 rounded-full bg-yellow-400/50" />
        </div>
      );
    default: // debris
      return (
        <div
          className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 via-orange-500 to-red-600"
          style={{ 
            boxShadow: '0 0 12px rgba(239, 68, 68, 0.6)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
      );
  }
});
FallingObjectComponent.displayName = 'FallingObjectComponent';

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
          boxShadow: `0 0 6px ${particle.color}`,
          opacity: particle.life / particle.maxLife,
          transform: 'translate(-50%, -50%)',
        }}
      />
    ))}
  </>
));
ParticleRenderer.displayName = 'ParticleRenderer';

// Rotate phone prompt overlay
const RotatePhoneOverlay = memo(({ onContinue }: { onContinue: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="fixed inset-0 bg-black/95 backdrop-blur-sm flex flex-col items-center justify-center p-6"
    style={{ zIndex: 100 }}
  >
    <motion.div
      animate={{ rotate: [0, -90, -90, 0] }}
      transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
      className="mb-6"
    >
      <Smartphone className="w-20 h-20 text-cyan-400" />
    </motion.div>
    <div className="flex items-center gap-2 mb-4">
      <RotateCcw className="w-6 h-6 text-cyan-400" />
      <h3 className="text-xl font-bold text-white">Rotate Your Phone</h3>
    </div>
    <p className="text-muted-foreground text-center text-sm mb-6 max-w-xs">
      Turn your phone sideways (landscape mode) for the best gameplay experience!
    </p>
    <Button 
      onClick={onContinue} 
      className="bg-cyan-500 hover:bg-cyan-600 text-white font-bold px-8 py-3"
      style={{ zIndex: 101 }}
    >
      Continue
    </Button>
  </motion.div>
));
RotatePhoneOverlay.displayName = 'RotatePhoneOverlay';

// Tilt permission request overlay
const TiltPermissionOverlay = memo(({ onRequest, onSkip }: { onRequest: () => void; onSkip: () => void }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-6"
  >
    <Smartphone className="w-16 h-16 text-cyan-400 mb-4 animate-bounce" />
    <h3 className="text-xl font-bold text-white mb-2">Enable Tilt Controls?</h3>
    <p className="text-muted-foreground text-center text-sm mb-6 max-w-xs">
      Tilt your device left and right to dodge! This requires motion sensor permission.
    </p>
    <div className="flex gap-3">
      <Button onClick={onRequest} className="bg-cyan-500 hover:bg-cyan-600">
        Enable Tilt
      </Button>
      <Button variant="ghost" onClick={onSkip}>
        Use Touch
      </Button>
    </div>
  </motion.div>
));
TiltPermissionOverlay.displayName = 'TiltPermissionOverlay';

// Lives display - compact
const LivesDisplay = memo(({ lives, maxLives = 3 }: { lives: number; maxLives?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: maxLives }).map((_, i) => (
      <span key={i} className={`text-lg ${i < lives ? 'opacity-100' : 'opacity-30'}`}>
        ❤️
      </span>
    ))}
  </div>
));
LivesDisplay.displayName = 'LivesDisplay';

// Active power-ups display - compact
const ActivePowerupsDisplay = memo(({ 
  hasShield, 
  hasMagnet, 
  hasSlowMo,
  magnetTimeLeft,
  slowMoTimeLeft 
}: { 
  hasShield: boolean; 
  hasMagnet: boolean; 
  hasSlowMo: boolean;
  magnetTimeLeft: number;
  slowMoTimeLeft: number;
}) => (
  <div className="flex gap-1">
    {hasShield && (
      <div className="bg-emerald-500/30 backdrop-blur-sm rounded-full px-1.5 py-0.5">
        <span className="text-emerald-300 text-xs">🛡️</span>
      </div>
    )}
    {hasMagnet && (
      <div className="bg-amber-500/30 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
        <span className="text-amber-300 text-xs">🧲</span>
        <span className="text-amber-300 text-[10px]">{Math.ceil(magnetTimeLeft / 1000)}s</span>
      </div>
    )}
    {hasSlowMo && (
      <div className="bg-purple-500/30 backdrop-blur-sm rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
        <span className="text-purple-300 text-xs">⏳</span>
        <span className="text-purple-300 text-[10px]">{Math.ceil(slowMoTimeLeft / 1000)}s</span>
      </div>
    )}
  </div>
));
ActivePowerupsDisplay.displayName = 'ActivePowerupsDisplay';

export const StarfallDodgeGame = ({
  companionStats,
  onComplete,
  onDamage,
  tierAttackDamage = 15,
  difficulty = 'medium',
  questIntervalScale = 0,
  isPractice = false,
  compact = false,
}: StarfallDodgeGameProps) => {
  const [gameState, setGameState] = useState<'rotate' | 'permission' | 'countdown' | 'playing' | 'paused' | 'complete'>('rotate');
  const [useTilt, setUseTilt] = useState(false);
  const [playerX, setPlayerX] = useState(50);
  const [crystalsCollected, setCrystalsCollected] = useState(0);
  const [lives, setLives] = useState(3);
  const [hasShield, setHasShield] = useState(false);
  const [hasMagnet, setHasMagnet] = useState(false);
  const [hasSlowMo, setHasSlowMo] = useState(false);
  const [magnetEndTime, setMagnetEndTime] = useState(0);
  const [slowMoEndTime, setSlowMoEndTime] = useState(0);
  const [survivalTime, setSurvivalTime] = useState(0);
  const [shake, setShake] = useState(false);
  
  // Progressive difficulty state
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [currentSpawnRate, setCurrentSpawnRate] = useState(0);
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const objectsRef = useRef<FallingObject[]>([]);
  const [objects, setObjects] = useState<FallingObject[]>([]);
  const objectIdRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const playerXRef = useRef(playerX);
  const gameStateRef = useRef(gameState);
  const touchStartRef = useRef<{ x: number; playerX: number } | null>(null);
  const livesRef = useRef(lives);
  const hasShieldRef = useRef(hasShield);
  const hasMagnetRef = useRef(hasMagnet);
  const hasSlowMoRef = useRef(hasSlowMo);
  const magnetEndTimeRef = useRef(magnetEndTime);
  const slowMoEndTimeRef = useRef(slowMoEndTime);
  
  // Smooth player movement interpolation
  const targetPlayerXRef = useRef(50);
  const smoothPlayerXRef = useRef(50);

  // Device orientation hook - use landscape function for this game
  const { available, permitted: _permitted, requestPermission, getLandscapePositionFromTilt } = useDeviceOrientation();

  // Sync refs
  useEffect(() => { playerXRef.current = playerX; }, [playerX]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { hasShieldRef.current = hasShield; }, [hasShield]);
  useEffect(() => { hasMagnetRef.current = hasMagnet; }, [hasMagnet]);
  useEffect(() => { hasSlowMoRef.current = hasSlowMo; }, [hasSlowMo]);
  useEffect(() => { magnetEndTimeRef.current = magnetEndTime; }, [magnetEndTime]);
  useEffect(() => { slowMoEndTimeRef.current = slowMoEndTime; }, [slowMoEndTime]);

  // Lock to landscape on mount, restore portrait on unmount
  useEffect(() => {
    return () => {
      // Restore portrait orientation when leaving the game
      lockToPortrait();
    };
  }, []);

  const { particles, emit: emitParticles } = useParticleSystem(40);
  const stars = useStaticStars(20);

  const statBonus = Math.round((companionStats.mind + companionStats.body) / 2);
  const playerSize = 32 + Math.floor(statBonus / 35);

  const config = useMemo(() => {
    const s = DIFFICULTY_CONFIG[difficulty];
    return {
      ...s,
      initialSpawnRate: s.initialSpawnRate - questIntervalScale * 30,
      baseSpeed: s.baseSpeed + questIntervalScale * 0.1,
    };
  }, [difficulty, questIntervalScale]);

  // Initialize progressive difficulty
  useEffect(() => {
    setCurrentSpeed(config.baseSpeed);
    setCurrentSpawnRate(config.initialSpawnRate);
  }, [config]);

  // Calculate time left for power-ups
  const now = Date.now();
  const magnetTimeLeft = Math.max(0, magnetEndTime - now);
  const slowMoTimeLeft = Math.max(0, slowMoEndTime - now);

  // Handle rotate screen continue
  const handleRotateContinue = useCallback(async () => {
    await lockToLandscape();
    setGameState('permission');
  }, []);

  // Handle permission request
  const handleRequestPermission = useCallback(async () => {
    if (available) {
      const granted = await requestPermission();
      setUseTilt(granted);
    }
    setGameState('countdown');
  }, [available, requestPermission]);

  const handleSkipTilt = useCallback(() => {
    setUseTilt(false);
    setGameState('countdown');
  }, []);

  // Touch controls - adjusted for landscape
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current !== 'playing') return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, playerX: playerXRef.current };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || gameStateRef.current !== 'playing' || useTilt) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const gameWidth = gameAreaRef.current?.getBoundingClientRect().width || 500;
    const movePercent = (deltaX / gameWidth) * 100;
    
    const newX = Math.max(5, Math.min(95, touchStartRef.current.playerX + movePercent));
    setPlayerX(newX);
  }, [useTilt]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  // Spawn object helper
  const spawnObject = useCallback((_time: number, playerX: number) => {
    const rand = Math.random();
    
    // Spawn probabilities (cumulative):
    // 1% life, 2% bomb, 3% homing, 4% shield, 4% magnet, 4% slowmo, rest split between debris/crystal
    let type: ObjectType;
    let size: number;
    
    if (rand < 0.01) {
      type = 'powerup_life';
      size = 36;
    } else if (rand < 0.03) {
      type = 'bomb';
      size = 40;
    } else if (rand < 0.06) {
      type = 'homing_debris';
      size = 28;
    } else if (rand < 0.10) {
      type = 'powerup_shield';
      size = 32;
    } else if (rand < 0.14) {
      type = 'powerup_magnet';
      size = 32;
    } else if (rand < 0.18) {
      type = 'powerup_slowmo';
      size = 32;
    } else if (rand < 0.18 + config.debrisRatio * 0.82) {
      type = 'debris';
      size = 24;
    } else {
      type = 'crystal';
      size = 28;
    }

    const newObj: FallingObject = {
      id: objectIdRef.current++,
      x: 5 + Math.random() * 90,
      y: -5,
      type,
      speed: currentSpeed * (0.8 + Math.random() * 0.4),
      size,
      targetX: type === 'homing_debris' ? playerX : undefined,
    };
    
    objectsRef.current.push(newObj);
  }, [config.debrisRatio, currentSpeed]);

  // Game loop - ENDLESS with progressive difficulty
  useGameLoop((deltaTime, time) => {

    const currentTime = Date.now();
    
    // Check power-up expirations
    if (hasMagnetRef.current && currentTime > magnetEndTimeRef.current) {
      setHasMagnet(false);
    }
    if (hasSlowMoRef.current && currentTime > slowMoEndTimeRef.current) {
      setHasSlowMo(false);
    }

    // Speed multiplier for slow-mo
    const speedMultiplier = hasSlowMoRef.current ? 0.5 : 1.0;

    // Smoothing factor for player movement interpolation (per frame)
    const LERP_SPEED = 0.12;
    
    let currentPlayerX: number;
    
    if (useTilt) {
      targetPlayerXRef.current = getLandscapePositionFromTilt(6, 1.4);
      smoothPlayerXRef.current += (targetPlayerXRef.current - smoothPlayerXRef.current) * LERP_SPEED;
      currentPlayerX = smoothPlayerXRef.current;
      setPlayerX(currentPlayerX);
    } else {
      currentPlayerX = playerXRef.current;
    }

    // Update survival time
    setSurvivalTime(prev => {
      const newTime = prev + deltaTime / 1000;
      
      // MILESTONE DAMAGE: Deal damage every 10 seconds survived
      const prevMilestones = Math.floor(prev / 10);
      const newMilestones = Math.floor(newTime / 10);
      if (newMilestones > prevMilestones) {
        onDamage?.({ target: 'adversary', amount: GAME_DAMAGE_VALUES.starfall_dodge.survivalMilestone, source: 'survival_milestone' });
      }
      
      // Practice mode: end after 15 seconds
      if (isPractice && newTime >= 15) {
        setGameState('complete');
      }
      
      return newTime;
    });

    // Progressive difficulty - increase speed and spawn rate over time
    setCurrentSpeed(prev => Math.min(config.maxSpeed, prev + config.speedIncrease * deltaTime / 1000));
    setCurrentSpawnRate(prev => Math.max(config.minSpawnRate, prev - config.spawnRateDecrease * deltaTime / 1000));

    // Spawn objects
    if (time - lastSpawnRef.current > currentSpawnRate) {
      lastSpawnRef.current = time;
      spawnObject(time, currentPlayerX);
    }

    // Update objects
    objectsRef.current = objectsRef.current.filter(obj => {
      // Apply speed with slow-mo multiplier
      const effectiveSpeed = obj.speed * speedMultiplier;
      obj.y += effectiveSpeed * deltaTime * 60 * 0.5;
      
      // Homing debris tracks player slowly
      if (obj.type === 'homing_debris' && obj.y > 0 && obj.y < 60) {
        const homingSpeed = 0.15 * speedMultiplier;
        if (obj.x < currentPlayerX) {
          obj.x = Math.min(obj.x + homingSpeed, currentPlayerX);
        } else if (obj.x > currentPlayerX) {
          obj.x = Math.max(obj.x - homingSpeed, currentPlayerX);
        }
      }
      
      // Magnet effect - crystals attracted to player
      if (obj.type === 'crystal' && hasMagnetRef.current) {
        const dist = Math.abs(obj.x - currentPlayerX);
        if (dist < 25) { // Within 25% of screen width
          const magnetPull = 0.3;
          if (obj.x < currentPlayerX) {
            obj.x += magnetPull;
          } else {
            obj.x -= magnetPull;
          }
        }
      }
      
      // Collision detection
      if (obj.y > 70 && obj.y < 92) {
        const dist = Math.abs(obj.x - currentPlayerX);
        const hitDist = obj.type === 'bomb' ? 5 : obj.type === 'debris' || obj.type === 'homing_debris' ? 3.5 : 4.5;
        
        if (dist < hitDist) {
          // Handle collision based on object type
          switch (obj.type) {
            case 'crystal':
              setCrystalsCollected(c => c + 1);
              emitParticles(obj.x, obj.y, '#22d3ee', 6);
              triggerHaptic('light');
              return false;
              
            case 'powerup_shield':
              setHasShield(true);
              emitParticles(obj.x, obj.y, '#10b981', 8);
              triggerHaptic('medium');
              return false;
              
            case 'powerup_magnet':
              setHasMagnet(true);
              setMagnetEndTime(currentTime + POWERUP_DURATIONS.magnet);
              emitParticles(obj.x, obj.y, '#f59e0b', 8);
              triggerHaptic('medium');
              return false;
              
            case 'powerup_slowmo':
              setHasSlowMo(true);
              setSlowMoEndTime(currentTime + POWERUP_DURATIONS.slowmo);
              emitParticles(obj.x, obj.y, '#8b5cf6', 8);
              triggerHaptic('medium');
              return false;
              
            case 'powerup_life':
              setLives(prev => Math.min(prev + 1, 5)); // Max 5 lives
              emitParticles(obj.x, obj.y, '#ec4899', 12);
              triggerHaptic('heavy');
              return false;
              
            case 'bomb':
              // Bomb = instant game over (lose all lives)
              emitParticles(obj.x, obj.y, '#ef4444', 15);
              emitParticles(obj.x, obj.y, '#f97316', 15);
              triggerHaptic('heavy');
              setLives(0);
              setShake(true);
              setTimeout(() => setShake(false), 400);
              setGameState('complete');
              return false;
              
            case 'debris':
            case 'homing_debris':
              if (hasShieldRef.current) {
                setHasShield(false);
                emitParticles(obj.x, obj.y, '#ef4444', 6);
                triggerHaptic('medium');
              } else {
                onDamage?.({ target: 'player', amount: tierAttackDamage, source: 'hit_by_projectile' });
                setLives(prev => {
                  const newLives = prev - 1;
                  if (newLives <= 0) {
                    setGameState('complete');
                  }
                  return newLives;
                });
                setShake(true);
                setTimeout(() => setShake(false), 200);
                emitParticles(obj.x, obj.y, '#ef4444', 8);
                triggerHaptic('heavy');
              }
              return false;
          }
        }
      }
      
      return obj.y < 110;
    });

    setObjects([...objectsRef.current]);
  }, gameState === 'playing');

  // Complete game - calculate result based on survival time and crystals
  useEffect(() => {
    if (gameState !== 'complete') return;
    
    // Accuracy based on survival time
    const timeThresholds = { beginner: 90, easy: 60, medium: 45, hard: 30, master: 20 };
    const threshold = timeThresholds[difficulty];
    const accuracy = Math.min(100, Math.round((survivalTime / threshold) * 100));
    
    const result: 'perfect' | 'good' | 'fail' = 
      accuracy >= 90 ? 'perfect' : accuracy >= 50 ? 'good' : 'fail';
    
    onComplete({
      success: result !== 'fail',
      accuracy: Math.min(100, Math.max(0, accuracy)),
      result,
      usedTiltControls: useTilt,
      highScoreValue: Math.floor(survivalTime),
      gameStats: {
        time: Math.floor(survivalTime),
        itemsCollected: crystalsCollected,
        livesRemaining: lives,
      },
    });
  }, [gameState, crystalsCollected, survivalTime, difficulty, onComplete, useTilt, lives]);

  return (
    <div
      ref={gameAreaRef}
      className={`relative overflow-hidden ${shake ? 'animate-shake' : ''}`}
      style={{ 
        background: hasSlowMo 
          ? 'linear-gradient(to bottom, #1a0a2e, #2d1052)' // Purple tint for slow-mo
          : 'linear-gradient(to bottom, #0f0a1a, #1a1033)',
        transition: 'background 0.5s ease',
        width: '100vw',
        height: '100dvh',
        minHeight: '100vh',
        borderRadius: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 60,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <StarBackground stars={stars} />
      
      {/* Game HUD - Landscape optimized, compact mode support */}
      {gameState !== 'rotate' && gameState !== 'permission' && (
        <div className={`absolute top-1 left-0 right-0 z-20 ${compact ? 'px-2' : 'px-4'}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              {!compact && <div className="text-sm font-bold text-white/80">Starfall Dodge</div>}
              <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-0.5">
                <span className={`text-cyan-400 ${compact ? 'text-xs' : 'text-sm'}`}>💎 {crystalsCollected}</span>
              </div>
              <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-0.5">
                <span className={`text-yellow-400 ${compact ? 'text-xs' : 'text-sm'}`}>⏱️ {Math.floor(survivalTime)}s</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ActivePowerupsDisplay 
                hasShield={hasShield}
                hasMagnet={hasMagnet}
                hasSlowMo={hasSlowMo}
                magnetTimeLeft={magnetTimeLeft}
                slowMoTimeLeft={slowMoTimeLeft}
              />
              <LivesDisplay lives={lives} maxLives={3} />
            </div>
          </div>
        </div>
      )}
      
      {/* Tilt indicator + Speed indicator - landscape position */}
      {gameState === 'playing' && !compact && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 flex gap-2">
          {useTilt && (
            <div className="bg-cyan-500/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-cyan-300">
              📱 Tilt +25% XP
            </div>
          )}
          <div className="bg-purple-500/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-purple-300">
            ⚡ {((currentSpeed / config.baseSpeed) * 100).toFixed(0)}% Speed
          </div>
        </div>
      )}
      
      {/* Falling objects */}
      {objects.map(obj => (
        <div
          key={obj.id}
          className="absolute"
          style={{
            left: `${obj.x}%`,
            top: `${obj.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <FallingObjectComponent obj={obj} />
        </div>
      ))}
      
      {/* Particles */}
      <ParticleRenderer particles={particles} />
      
      {/* Player - positioned for landscape */}
      <motion.div
        className="absolute"
        style={{ left: `${playerX}%`, bottom: '8%', transform: 'translateX(-50%)' }}
        animate={{ x: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <div 
          className="rounded-full bg-gradient-to-br from-purple-500 to-pink-500 relative"
          style={{ 
            width: playerSize, 
            height: playerSize,
            boxShadow: hasShield 
              ? '0 0 20px #10b981, 0 0 40px #10b98150' 
              : hasMagnet
              ? '0 0 20px #f59e0b, 0 0 40px #f59e0b50'
              : '0 0 20px #a855f7, 0 0 40px #a855f750',
          }}
        >
          {hasShield && (
            <div className="absolute -inset-2 rounded-full border-2 border-emerald-400 animate-pulse" />
          )}
          {hasMagnet && (
            <div className="absolute -inset-3 rounded-full border-2 border-amber-400 animate-spin" style={{ animationDuration: '2s' }} />
          )}
          <div className="absolute inset-2 rounded-full bg-white/20" />
        </div>
      </motion.div>
      
      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'rotate' && (
          <RotatePhoneOverlay onContinue={handleRotateContinue} />
        )}
        {gameState === 'permission' && available && (
          <TiltPermissionOverlay onRequest={handleRequestPermission} onSkip={handleSkipTilt} />
        )}
        {gameState === 'permission' && !available && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onAnimationComplete={() => setGameState('countdown')}
          />
        )}
        {gameState === 'countdown' && (
          <CountdownOverlay count={3} onComplete={handleCountdownComplete} />
        )}
        {gameState === 'paused' && (
          <PauseOverlay onResume={() => setGameState('playing')} />
        )}
      </AnimatePresence>
    </div>
  );
};
