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

interface StarfallDodgeGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  tierAttackDamage?: number;
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
  onDamage,
  tierAttackDamage = 15,
  difficulty = 'medium',
  questIntervalScale = 0,
  isPractice = false,
}: StarfallDodgeGameProps) => {
  const [gameState, setGameState] = useState<'rotate' | 'permission' | 'countdown' | 'playing' | 'paused' | 'complete'>('rotate');
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
  
  // Smooth player movement interpolation
  const targetPlayerXRef = useRef(50);
  const smoothPlayerXRef = useRef(50);

  // Device orientation hook - use landscape function for this game
  const { available, permitted, requestPermission, getLandscapePositionFromTilt } = useDeviceOrientation();

  // Sync refs
  useEffect(() => { playerXRef.current = playerX; }, [playerX]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { hasShieldRef.current = hasShield; }, [hasShield]);

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

  // Game loop - ENDLESS with progressive difficulty
  useGameLoop((deltaTime, time) => {
    if (gameStateRef.current !== 'playing') return;

    // Smoothing factor for player movement interpolation (per frame)
    // Higher = more responsive, lower = smoother
    const LERP_SPEED = 0.12;
    
    let currentPlayerX: number;
    
    if (useTilt) {
      // Get target position from tilt
      targetPlayerXRef.current = getLandscapePositionFromTilt(6, 1.4);
      
      // Smooth interpolation (lerp) toward target
      smoothPlayerXRef.current += (targetPlayerXRef.current - smoothPlayerXRef.current) * LERP_SPEED;
      currentPlayerX = smoothPlayerXRef.current;
      
      setPlayerX(currentPlayerX);
    } else {
      currentPlayerX = playerXRef.current;
    }

    // Update survival time
    setSurvivalTime(prev => {
      const newTime = prev + deltaTime / 1000;
      
      // Practice mode: end after 15 seconds
      if (isPractice && newTime >= 15) {
        setGameState('complete');
      }
      
      return newTime;
    });

    // Progressive difficulty - increase speed and spawn rate over time
    setCurrentSpeed(prev => Math.min(config.maxSpeed, prev + config.speedIncrease * deltaTime / 1000));
    setCurrentSpawnRate(prev => Math.max(config.minSpawnRate, prev - config.spawnRateDecrease * deltaTime / 1000));

    // Spawn objects - use wider spawn zone for landscape
    if (time - lastSpawnRef.current > currentSpawnRate) {
      lastSpawnRef.current = time;
      const rand = Math.random();
      const isShield = rand > 0.96;
      const isCrystal = !isShield && rand > config.debrisRatio;

      const newObj: FallingObject = {
        id: objectIdRef.current++,
        x: 5 + Math.random() * 90, // Wider spawn zone for landscape
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
      
      // Collision detection - adjusted for landscape player position
      if (obj.y > 70 && obj.y < 92) {
        const dist = Math.abs(obj.x - currentPlayerX);
        const hitDist = (obj.size + playerSize) / 3;
        
        if (dist < hitDist) {
          if (obj.type === 'crystal') {
            setCrystalsCollected(c => c + 1);
            emitParticles(obj.x, obj.y, '#22d3ee', 6);
            triggerHaptic('light');
            
            // Deal damage to adversary for collecting crystal
            onDamage?.({ target: 'adversary', amount: GAME_DAMAGE_VALUES.starfall_dodge.collectCrystal, source: 'collect_crystal' });
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
              // Player takes damage from debris hit
              onDamage?.({ target: 'player', amount: tierAttackDamage, source: 'hit_by_projectile' });
              
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
      className={`relative overflow-hidden ${shake ? 'animate-shake' : ''}`}
      style={{ 
        background: 'linear-gradient(to bottom, #0f0a1a, #1a1033)',
        // Fill entire viewport in landscape mode
        width: '100vw',
        height: '100dvh',
        // Fallback for browsers without dvh support
        minHeight: '100vh',
        // Remove any rounding in fullscreen landscape
        borderRadius: 0,
        // Ensure it's positioned at top-left and above dialogs
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 60,
        // Safe area padding for notched devices
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
      
      {/* Game HUD - Landscape optimized */}
      {gameState !== 'rotate' && gameState !== 'permission' && (
        <div className="absolute top-2 left-0 right-0 z-20 px-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-sm font-bold text-white/80">Starfall Dodge</div>
              <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-0.5">
                <span className="text-cyan-400 text-sm">💎 {crystalsCollected}</span>
              </div>
              <div className="bg-black/40 backdrop-blur-sm rounded-lg px-2 py-0.5">
                <span className="text-yellow-400 text-sm">⏱️ {Math.floor(survivalTime)}s</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasShield && (
                <div className="bg-emerald-500/30 backdrop-blur-sm rounded-full px-2 py-0.5">
                  <span className="text-emerald-300 text-sm">🛡️</span>
                </div>
              )}
              <LivesDisplay lives={lives} />
            </div>
          </div>
        </div>
      )}
      
      {/* Tilt indicator - landscape position */}
      {useTilt && gameState === 'playing' && (
        <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-cyan-500/20 backdrop-blur-sm rounded-full px-3 py-1 text-xs text-cyan-300">
          📱 Tilt to move
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
        {gameState === 'rotate' && (
          <RotatePhoneOverlay onContinue={handleRotateContinue} />
        )}
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
