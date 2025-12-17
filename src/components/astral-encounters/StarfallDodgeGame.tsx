import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useGameLoop, useStaticStars, useParticleSystem } from './gameUtils';
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { Button } from '@/components/ui/button';
import { Smartphone } from 'lucide-react';

interface StarfallDodgeGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number;
  isPractice?: boolean;
}

interface FallingObject {
  id: number;
  x: number;
  y: number;
  type: 'debris' | 'crystal' | 'powerup_shield';
  speed: number;
  size: number;
}

// ENDLESS mode config - progressive difficulty, 3 lives
const DIFFICULTY_CONFIG = {
  easy: { 
    initialSpawnRate: 900, 
    debrisRatio: 0.45, 
    baseSpeed: 1.0,
    speedIncrease: 0.02,
    spawnRateDecrease: 3,
    minSpawnRate: 400,
    maxSpeed: 3.5,
  },
  medium: { 
    initialSpawnRate: 700, 
    debrisRatio: 0.55, 
    baseSpeed: 1.4,
    speedIncrease: 0.025,
    spawnRateDecrease: 4,
    minSpawnRate: 350,
    maxSpeed: 4.5,
  },
  hard: { 
    initialSpawnRate: 550, 
    debrisRatio: 0.65, 
    baseSpeed: 1.8,
    speedIncrease: 0.03,
    spawnRateDecrease: 5,
    minSpawnRate: 300,
    maxSpeed: 5.5,
  },
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

// Falling object component
const FallingObjectComponent = memo(({ obj }: { obj: FallingObject }) => {
  if (obj.type === 'crystal') {
    return (
      <div 
        className="w-7 h-7 flex items-center justify-center"
        style={{ filter: 'drop-shadow(0 0 8px #22d3ee)', animation: 'spin 3s linear infinite' }}
      >
        <span className="text-2xl">💎</span>
      </div>
    );
  } else if (obj.type === 'powerup_shield') {
    return (
      <div 
        className="w-8 h-8 flex items-center justify-center"
        style={{ filter: 'drop-shadow(0 0 12px #10b981)', animation: 'pulse 1.5s ease-in-out infinite' }}
      >
        <span className="text-2xl">🛡️</span>
      </div>
    );
  } else {
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

// Lives display
const LivesDisplay = memo(({ lives }: { lives: number }) => (
  <div className="flex gap-1">
    {Array.from({ length: 3 }).map((_, i) => (
      <span key={i} className={`text-xl ${i < lives ? 'opacity-100' : 'opacity-30'}`}>
        ❤️
      </span>
    ))}
  </div>
));
LivesDisplay.displayName = 'LivesDisplay';

export const StarfallDodgeGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
  isPractice = false,
}: StarfallDodgeGameProps) => {
  const [gameState, setGameState] = useState<'permission' | 'countdown' | 'playing' | 'paused' | 'complete'>('permission');
  const [useTilt, setUseTilt] = useState(false);
  const [playerX, setPlayerX] = useState(50);
  const [crystalsCollected, setCrystalsCollected] = useState(0);
  const [lives, setLives] = useState(3);
  const [hasShield, setHasShield] = useState(false);
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

  // Device orientation hook
  const { available, permitted, requestPermission, getPositionFromTilt } = useDeviceOrientation();

  // Sync refs
  useEffect(() => { playerXRef.current = playerX; }, [playerX]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { hasShieldRef.current = hasShield; }, [hasShield]);

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

  // Touch controls
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
    const gameWidth = gameAreaRef.current?.getBoundingClientRect().width || 300;
    const movePercent = (deltaX / gameWidth) * 100;
    
    const newX = Math.max(8, Math.min(92, touchStartRef.current.playerX + movePercent));
    setPlayerX(newX);
  }, [useTilt]);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
  }, []);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  // Game loop - ENDLESS with progressive difficulty
  useGameLoop((deltaTime, time) => {
    if (gameStateRef.current !== 'playing') return;

    const currentPlayerX = useTilt ? getPositionFromTilt(5, 2) : playerXRef.current;
    
    // Update player position from tilt
    if (useTilt) {
      setPlayerX(currentPlayerX);
    }

    // Update survival time
    setSurvivalTime(prev => prev + deltaTime / 1000);

    // Progressive difficulty - increase speed and spawn rate over time
    setCurrentSpeed(prev => Math.min(config.maxSpeed, prev + config.speedIncrease * deltaTime / 1000));
    setCurrentSpawnRate(prev => Math.max(config.minSpawnRate, prev - config.spawnRateDecrease * deltaTime / 1000));

    // Spawn objects
    if (time - lastSpawnRef.current > currentSpawnRate) {
      lastSpawnRef.current = time;
      const rand = Math.random();
      const isShield = rand > 0.96;
      const isCrystal = !isShield && rand > config.debrisRatio;

      const newObj: FallingObject = {
        id: objectIdRef.current++,
        x: 10 + Math.random() * 80,
        y: -5,
        type: isShield ? 'powerup_shield' : isCrystal ? 'crystal' : 'debris',
        speed: currentSpeed * (0.8 + Math.random() * 0.4),
        size: isCrystal ? 28 : isShield ? 32 : 24,
      };
      objectsRef.current.push(newObj);
    }

    // Update objects
    objectsRef.current = objectsRef.current.filter(obj => {
      obj.y += obj.speed * deltaTime * 60 * 0.5;
      
      // Collision detection
      if (obj.y > 75 && obj.y < 95) {
        const dist = Math.abs(obj.x - currentPlayerX);
        const hitDist = (obj.size + playerSize) / 3;
        
        if (dist < hitDist) {
          if (obj.type === 'crystal') {
            setCrystalsCollected(c => c + 1);
            emitParticles(obj.x, obj.y, '#22d3ee', 6);
            triggerHaptic('light');
            return false;
          } else if (obj.type === 'powerup_shield') {
            setHasShield(true);
            emitParticles(obj.x, obj.y, '#10b981', 8);
            triggerHaptic('medium');
            return false;
          } else if (obj.type === 'debris') {
            if (hasShieldRef.current) {
              setHasShield(false);
              emitParticles(obj.x, obj.y, '#ef4444', 6);
              triggerHaptic('medium');
            } else {
              // Lose a life
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
    
    const survivalBonus = Math.round(survivalTime * 2);
    const score = crystalsCollected * 10 + survivalBonus;
    
    // Accuracy based on survival time
    const timeThresholds = { easy: 60, medium: 45, hard: 30 };
    const threshold = timeThresholds[difficulty];
    const accuracy = Math.min(100, Math.round((survivalTime / threshold) * 100));
    
    const result: 'perfect' | 'good' | 'partial' | 'fail' = 
      accuracy >= 90 ? 'perfect' : accuracy >= 65 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
    
    onComplete({
      success: result !== 'fail',
      accuracy: Math.min(100, Math.max(0, accuracy)),
      result,
    });
  }, [gameState, crystalsCollected, survivalTime, difficulty, onComplete]);

  return (
    <div
      ref={gameAreaRef}
      className={`relative w-full h-full min-h-[500px] rounded-lg overflow-hidden ${shake ? 'animate-shake' : ''}`}
      style={{ background: 'linear-gradient(to bottom, #0f0a1a, #1a1033)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <StarBackground stars={stars} />
      
      {/* Game HUD - No timer, show lives and survival time */}
      {gameState !== 'permission' && (
        <div className="absolute top-2 left-0 right-0 z-20 px-4">
          <div className="flex justify-between items-center">
            <div className="text-lg font-bold text-white/80">Starfall Dodge</div>
            <LivesDisplay lives={lives} />
          </div>
        </div>
      )}
      
      {/* Tilt indicator */}
      {useTilt && gameState === 'playing' && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-cyan-500/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-cyan-300">
          📱 Tilt to move
        </div>
      )}
      
      {/* Shield indicator */}
      {hasShield && (
        <div className="absolute top-16 right-4 bg-emerald-500/30 backdrop-blur-sm rounded-full px-3 py-1">
          <span className="text-emerald-300">🛡️ Shield</span>
        </div>
      )}
      
      {/* Stats */}
      <div className="absolute top-16 left-4 flex flex-col gap-2 z-20">
        <div className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1">
          <span className="text-cyan-400">💎 {crystalsCollected}</span>
        </div>
        <div className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1">
          <span className="text-yellow-400">⏱️ {Math.floor(survivalTime)}s</span>
        </div>
      </div>
      
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
      
      {/* Player */}
      <motion.div
        className="absolute"
        style={{ left: `${playerX}%`, bottom: '10%', transform: 'translateX(-50%)' }}
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
              : '0 0 20px #a855f7, 0 0 40px #a855f750',
          }}
        >
          {hasShield && (
            <div className="absolute -inset-2 rounded-full border-2 border-emerald-400 animate-pulse" />
          )}
          <div className="absolute inset-2 rounded-full bg-white/20" />
        </div>
      </motion.div>
      
      {/* Overlays */}
      <AnimatePresence>
        {gameState === 'permission' && available && (
          <TiltPermissionOverlay onRequest={handleRequestPermission} onSkip={handleSkipTilt} />
        )}
        {gameState === 'permission' && !available && (
          // Auto-skip if tilt not available
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
