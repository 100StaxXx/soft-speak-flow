import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useGameLoop, useStaticStars, useParticleSystem } from './gameUtils';

interface StarfallDodgeGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
  maxTimer?: number; // Override timer for practice mode
  isPractice?: boolean;
}

interface FallingObject {
  id: number;
  x: number;
  y: number;
  type: 'debris' | 'crystal' | 'powerup_magnet' | 'powerup_slowmo' | 'powerup_shield' | 'powerup_multiplier';
  speed: number;
  size: number;
  horizontalSpeed?: number; // For diagonal debris
  warningShown?: boolean;
}

interface ActivePowerUp {
  type: 'magnet' | 'slowmo' | 'shield' | 'multiplier';
  endTime: number;
}

// Memoized static star background
const StarBackground = memo(({ stars }: { stars: ReturnType<typeof useStaticStars> }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {stars.map(star => (
      <div
        key={star.id}
        className="absolute rounded-full bg-white gpu-accelerated"
        style={{
          width: star.size,
          height: star.size,
          left: `${star.x}%`,
          top: `${star.y}%`,
          opacity: star.opacity,
          animation: `twinkle ${star.animationDuration}s ease-in-out infinite`,
          animationDelay: `${star.animationDelay}s`,
        }}
      />
    ))}
  </div>
));
StarBackground.displayName = 'StarBackground';

// Memoized falling object component with power-up variety
const FallingObjectComponent = memo(({ obj, hasWarning }: { obj: FallingObject; hasWarning?: boolean }) => {
  if (obj.type === 'crystal') {
    return (
      <div 
        className="w-7 h-7 flex items-center justify-center will-animate gpu-accelerated"
        style={{ 
          filter: 'drop-shadow(0 0 8px #22d3ee)',
          animation: 'spin 3s linear infinite',
        }}
      >
        <span className="text-2xl">💎</span>
      </div>
    );
  } else if (obj.type === 'powerup_magnet') {
    return (
      <div className="w-8 h-8 flex items-center justify-center will-animate gpu-accelerated"
        style={{ filter: 'drop-shadow(0 0 12px #ec4899)', animation: 'pulse-spin 1.5s ease-in-out infinite' }}>
        <span className="text-2xl">🧲</span>
      </div>
    );
  } else if (obj.type === 'powerup_slowmo') {
    return (
      <div className="w-8 h-8 flex items-center justify-center will-animate gpu-accelerated"
        style={{ filter: 'drop-shadow(0 0 12px #3b82f6)', animation: 'pulse-spin 1.5s ease-in-out infinite' }}>
        <span className="text-2xl">⏱️</span>
      </div>
    );
  } else if (obj.type === 'powerup_shield') {
    return (
      <div className="w-8 h-8 flex items-center justify-center will-animate gpu-accelerated"
        style={{ filter: 'drop-shadow(0 0 12px #10b981)', animation: 'pulse-spin 1.5s ease-in-out infinite' }}>
        <span className="text-2xl">🛡️</span>
      </div>
    );
  } else if (obj.type === 'powerup_multiplier') {
    return (
      <div className="w-8 h-8 flex items-center justify-center will-animate gpu-accelerated"
        style={{ filter: 'drop-shadow(0 0 12px #fbbf24)', animation: 'pulse-spin 1.5s ease-in-out infinite' }}>
        <span className="text-2xl">✨</span>
      </div>
    );
  } else {
    // Debris with optional warning glow
    return (
      <div className="relative">
        {hasWarning && (
          <div className="absolute inset-0 rounded-full bg-red-500/40 blur-md scale-150 animate-pulse" />
        )}
        <div
          className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 via-orange-500 to-red-600 will-animate gpu-accelerated"
          style={{ 
            boxShadow: '0 0 12px rgba(239, 68, 68, 0.6), inset 0 0 8px rgba(255,255,255,0.3)',
            animation: 'spin 0.8s linear infinite',
          }}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-4 bg-gradient-to-t from-orange-500/80 to-transparent rounded-full blur-sm" />
        </div>
      </div>
    );
  }
});
FallingObjectComponent.displayName = 'FallingObjectComponent';

// Memoized particle component
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
          boxShadow: `0 0 6px ${particle.color}`,
          opacity: particle.life / particle.maxLife,
          transform: 'translate(-50%, -50%)',
        }}
      />
    ))}
  </>
));
ParticleRenderer.displayName = 'ParticleRenderer';

// Active power-ups display
const PowerUpIndicators = memo(({ powerUps, currentTime }: { powerUps: ActivePowerUp[]; currentTime: number }) => (
  <div className="absolute top-2 right-2 flex flex-col gap-1 z-30">
    {powerUps.filter(p => p.endTime > currentTime).map((p, i) => {
      const remaining = Math.ceil((p.endTime - currentTime) / 1000);
      const icon = p.type === 'magnet' ? '🧲' : p.type === 'slowmo' ? '⏱️' : p.type === 'shield' ? '🛡️' : '✨';
      const color = p.type === 'magnet' ? 'bg-pink-500/80' : p.type === 'slowmo' ? 'bg-blue-500/80' : p.type === 'shield' ? 'bg-emerald-500/80' : 'bg-yellow-500/80';
      return (
        <div key={i} className={`${color} px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1`}>
          <span>{icon}</span>
          <span>{remaining}s</span>
        </div>
      );
    })}
  </div>
));
PowerUpIndicators.displayName = 'PowerUpIndicators';

// Near-miss indicator
const NearMissIndicator = memo(({ show }: { show: boolean }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.5 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
      >
        <span className="text-cyan-400 text-xl font-black drop-shadow-lg" style={{ textShadow: '0 0 10px #22d3ee' }}>
          CLOSE!
        </span>
      </motion.div>
    )}
  </AnimatePresence>
));
NearMissIndicator.displayName = 'NearMissIndicator';

// Wave indicator
const WaveIndicator = memo(({ wave }: { wave: number }) => (
  <div className="absolute top-2 left-2 z-30 px-2 py-1 bg-purple-500/80 rounded-full text-xs font-bold">
    Wave {wave}
  </div>
));
WaveIndicator.displayName = 'WaveIndicator';

// Shield burst visual
const ShieldBurstEffect = memo(({ active, x }: { active: boolean; x: number }) => (
  <AnimatePresence>
    {active && (
      <motion.div
        className="absolute z-25 pointer-events-none"
        style={{ left: `${x}%`, bottom: '10%', transform: 'translateX(-50%)' }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 3, opacity: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="w-20 h-20 rounded-full border-4 border-cyan-400" style={{ boxShadow: '0 0 30px #22d3ee' }} />
      </motion.div>
    )}
  </AnimatePresence>
));
ShieldBurstEffect.displayName = 'ShieldBurstEffect';

// Dodge streak banner
const DodgeStreakBanner = memo(({ streak }: { streak: number }) => (
  <AnimatePresence>
    {streak >= 10 && (
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg text-black font-black text-sm"
        style={{ textShadow: '0 0 2px white' }}
      >
        🔥 UNTOUCHABLE! 🔥
      </motion.div>
    )}
  </AnimatePresence>
));
DodgeStreakBanner.displayName = 'DodgeStreakBanner';

export const StarfallDodgeGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
  maxTimer,
  isPractice = false,
}: StarfallDodgeGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [playerX, setPlayerX] = useState(50);
  const [crystalsCollected, setCrystalsCollected] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [totalCrystals, setTotalCrystals] = useState(0);
  const [shake, setShake] = useState(false);
  const [playerGlow, setPlayerGlow] = useState(false);
  const [showCollectFeedback, setShowCollectFeedback] = useState<{ x: number; type: 'crystal' | 'hit' } | null>(null);
  
  // New state for enhanced features
  const [activePowerUps, setActivePowerUps] = useState<ActivePowerUp[]>([]);
  const [nearMissCount, setNearMissCount] = useState(0);
  const [showNearMiss, setShowNearMiss] = useState(false);
  const [dodgeStreak, setDodgeStreak] = useState(0);
  const [currentWave, setCurrentWave] = useState(1);
  const [shieldBurstActive, setShieldBurstActive] = useState(false);
  const [shieldCooldown, setShieldCooldown] = useState(0);
  const [playerTrail, setPlayerTrail] = useState<{ x: number; opacity: number }[]>([]);
  
  // Refs for mutable state to avoid re-renders in game loop
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const objectsRef = useRef<FallingObject[]>([]);
  const [objects, setObjects] = useState<FallingObject[]>([]);
  const objectIdRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const playerXRef = useRef(playerX);
  const gameStateRef = useRef(gameState);
  const statsRef = useRef({ crystalsCollected, hits, combo, maxCombo, totalCrystals });
  const waveStartRef = useRef(0);
  const lastTapRef = useRef(0);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; playerX: number } | null>(null);

  // Keep refs in sync
  useEffect(() => { playerXRef.current = playerX; }, [playerX]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => {
    statsRef.current = { crystalsCollected, hits, combo, maxCombo, totalCrystals };
  }, [crystalsCollected, hits, combo, maxCombo, totalCrystals]);

  // Use particle system from shared utilities
  const { particles, emit: emitParticles } = useParticleSystem(40);

  // Static stars - only calculated once
  const stars = useStaticStars(20);

  // Mind + Body hybrid bonus
  const statBonus = Math.round((companionStats.mind + companionStats.body) / 2);
  const playerSize = 32 + Math.floor(statBonus / 35);

  // Memoized difficulty settings
  const config = useMemo(() => {
    const settings = {
      easy: { spawnRate: 550, debrisRatio: 0.45, baseSpeed: 2, time: 30 },
      medium: { spawnRate: 400, debrisRatio: 0.55, baseSpeed: 3, time: 35 },
      hard: { spawnRate: 280, debrisRatio: 0.65, baseSpeed: 4, time: 40 },
    };
    const s = settings[difficulty];
    return {
      ...s,
      spawnRate: s.spawnRate - questIntervalScale * 40,
      baseSpeed: s.baseSpeed + questIntervalScale * 0.4,
    };
  }, [difficulty, questIntervalScale]);

  // Initialize time based on difficulty or maxTimer override
  useEffect(() => {
    setTimeLeft(maxTimer ?? config.time);
  }, [config.time, maxTimer]);

  // Check active power-ups
  const hasPowerUp = useCallback((type: ActivePowerUp['type']) => {
    return activePowerUps.some(p => p.type === type && p.endTime > Date.now());
  }, [activePowerUps]);

  // Shield Burst ability
  const activateShieldBurst = useCallback(() => {
    if (shieldCooldown > Date.now()) return;
    if (crystalsCollected < 1) return; // Costs 1 crystal
    
    setCrystalsCollected(c => c - 1);
    setShieldBurstActive(true);
    setShieldCooldown(Date.now() + 3000); // 3 second cooldown
    triggerHaptic('heavy');
    
    // Destroy nearby debris
    const currentPlayerX = playerXRef.current;
    const destroyed: number[] = [];
    
    objectsRef.current = objectsRef.current.filter(obj => {
      if (obj.type === 'debris') {
        const dist = Math.sqrt(Math.pow(obj.x - currentPlayerX, 2) + Math.pow(obj.y - 85, 2));
        if (dist < 25) { // 25% radius
          destroyed.push(obj.id);
          emitParticles(obj.x, obj.y, '#ef4444', 8);
          return false;
        }
      }
      return true;
    });
    
    setTimeout(() => setShieldBurstActive(false), 400);
  }, [shieldCooldown, crystalsCollected, emitParticles]);

  // Handle double-tap for shield burst
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      activateShieldBurst();
    }
    lastTapRef.current = now;
  }, [activateShieldBurst]);

  // Relative swipe movement
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameStateRef.current !== 'playing') return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, playerX: playerXRef.current };
    
    // Long press for shield burst
    longPressTimerRef.current = setTimeout(() => {
      activateShieldBurst();
    }, 500);
    
    handleDoubleTap();
  }, [activateShieldBurst, handleDoubleTap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || gameStateRef.current !== 'playing') return;
    e.preventDefault();
    
    // Cancel long press on move
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const gameWidth = gameAreaRef.current?.getBoundingClientRect().width || 300;
    const movePercent = (deltaX / gameWidth) * 120; // Sensitivity multiplier
    
    const newX = Math.max(8, Math.min(92, touchStartRef.current.playerX + movePercent));
    setPlayerX(newX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Tap zones for quick movement
  const handleTapZone = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (gameStateRef.current !== 'playing') return;
    if (!gameAreaRef.current) return;
    
    const rect = gameAreaRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const relativeX = (clientX - rect.left) / rect.width;
    
    // Left third = move left, Right third = move right
    if (relativeX < 0.33) {
      setPlayerX(x => Math.max(8, x - 15));
    } else if (relativeX > 0.67) {
      setPlayerX(x => Math.min(92, x + 15));
    }
  }, []);

  // Mouse movement (for desktop)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!gameAreaRef.current || gameStateRef.current !== 'playing') return;
    const rect = gameAreaRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    setPlayerX(Math.max(8, Math.min(92, x)));
  }, []);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    waveStartRef.current = Date.now();
  }, []);

  // Player trail effect
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      setPlayerTrail(prev => {
        const newTrail = [{ x: playerXRef.current, opacity: 0.6 }, ...prev.slice(0, 4)];
        return newTrail.map((t, i) => ({ ...t, opacity: 0.6 - i * 0.12 }));
      });
    }, 50);
    return () => clearInterval(interval);
  }, [gameState]);

  // Optimized game loop using shared hook
  useGameLoop((deltaTime, time) => {
    if (gameStateRef.current !== 'playing') return;

    const currentPlayerX = playerXRef.current;
    const currentPlayerSize = playerSize;
    const now = Date.now();
    
    // Check for slow-mo power-up
    const hasSlowMo = activePowerUps.some(p => p.type === 'slowmo' && p.endTime > now);
    const speedMultiplier = hasSlowMo ? 0.5 : 1;
    
    // Check for magnet power-up
    const hasMagnet = activePowerUps.some(p => p.type === 'magnet' && p.endTime > now);

    // Wave system - 5 second waves with 1.5 second breaks
    const waveTime = (now - waveStartRef.current) / 1000;
    const isBreak = waveTime % 6.5 > 5;
    const newWave = Math.floor(waveTime / 6.5) + 1;
    if (newWave !== currentWave) {
      setCurrentWave(newWave);
    }

    // Spawn objects with rate limiting (not during break)
    if (!isBreak && time - lastSpawnRef.current > config.spawnRate) {
      lastSpawnRef.current = time;
      const rand = Math.random();
      
      // Power-up spawns (rare)
      const isPowerUp = rand > 0.92;
      const powerUpTypes: FallingObject['type'][] = ['powerup_magnet', 'powerup_slowmo', 'powerup_shield', 'powerup_multiplier'];
      const isCrystal = !isPowerUp && rand > config.debrisRatio;
      
      if (isCrystal) {
        setTotalCrystals(t => t + 1);
      }
      
      // 20% of debris have diagonal movement
      const isDiagonal = !isCrystal && !isPowerUp && Math.random() < 0.2;
      const isFastDebris = !isCrystal && !isPowerUp && Math.random() < 0.15;
      
      const newObj: FallingObject = {
        id: objectIdRef.current++,
        x: 8 + Math.random() * 84,
        y: -5,
        type: isPowerUp ? powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)] : isCrystal ? 'crystal' : 'debris',
        speed: (isFastDebris ? config.baseSpeed * 1.8 : config.baseSpeed + Math.random() * 1.2) * speedMultiplier,
        size: isPowerUp ? 32 : isCrystal ? 28 : 24,
        horizontalSpeed: isDiagonal ? (Math.random() > 0.5 ? 0.5 : -0.5) : 0,
        warningShown: isFastDebris,
      };
      
      objectsRef.current = [...objectsRef.current, newObj];
    }

    // Update and filter objects - batch processing
    const collisions: { type: FallingObject['type']; x: number; y: number }[] = [];
    const nearMisses: { x: number }[] = [];
    const updated: FallingObject[] = [];
    
    const playerLeft = currentPlayerX - currentPlayerSize / 2;
    const playerRight = currentPlayerX + currentPlayerSize / 2;
    
    // Check for active shield power-up
    const hasShield = activePowerUps.some(p => p.type === 'shield' && p.endTime > now);

    for (const obj of objectsRef.current) {
      let newY = obj.y + obj.speed * deltaTime * 60 * speedMultiplier;
      let newX = obj.x + (obj.horizontalSpeed || 0) * deltaTime * 60;
      
      // Magnet effect for crystals
      if (hasMagnet && obj.type === 'crystal') {
        const dx = currentPlayerX - obj.x;
        newX += dx * 0.03; // Curve toward player
      }
      
      // Keep in bounds
      newX = Math.max(5, Math.min(95, newX));
      
      // Check collision with player
      const objInRange = newX > playerLeft - 2 && newX < playerRight + 2;
      const atPlayerHeight = newY > 78 && newY < 95;
      
      // Near-miss detection (debris passing close)
      if (obj.type === 'debris' && !objInRange && newY > 75 && newY < 90) {
        const nearMissRange = 8; // 8% proximity
        if (Math.abs(newX - currentPlayerX) < nearMissRange + currentPlayerSize / 2) {
          nearMisses.push({ x: newX });
        }
      }
      
      if (objInRange && atPlayerHeight) {
        collisions.push({ type: obj.type, x: newX, y: newY });
      } else if (newY < 110) {
        updated.push({ ...obj, y: newY, x: newX });
      } else if (obj.type === 'debris') {
        // Debris passed without hitting - increment dodge streak
        setDodgeStreak(s => s + 1);
      }
    }

    // Process near-misses
    if (nearMisses.length > 0 && !showNearMiss) {
      setNearMissCount(c => c + nearMisses.length);
      setShowNearMiss(true);
      triggerHaptic('light');
      setTimeout(() => setShowNearMiss(false), 400);
    }

    // Process collisions outside the loop
    if (collisions.length > 0) {
      for (const collision of collisions) {
        if (collision.type === 'crystal') {
          const multiplier = activePowerUps.some(p => p.type === 'multiplier' && p.endTime > now) ? 3 : 1;
          setCrystalsCollected(c => c + multiplier);
          setCombo(c => {
            const newCombo = c + 1;
            setMaxCombo(m => Math.max(m, newCombo));
            return newCombo;
          });
          setPlayerGlow(true);
          emitParticles(collision.x, 85, '#22d3ee', 6);
          triggerHaptic('success');
          setShowCollectFeedback({ x: collision.x, type: 'crystal' });
          setTimeout(() => {
            setPlayerGlow(false);
            setShowCollectFeedback(null);
          }, 300);
        } else if (collision.type.startsWith('powerup_')) {
          // Activate power-up
          const powerUpType = collision.type.replace('powerup_', '') as ActivePowerUp['type'];
          const duration = powerUpType === 'magnet' ? 5000 : powerUpType === 'slowmo' ? 4000 : powerUpType === 'shield' ? 10000 : 5000;
          setActivePowerUps(prev => [...prev.filter(p => p.type !== powerUpType), { type: powerUpType, endTime: now + duration }]);
          emitParticles(collision.x, 85, '#fbbf24', 10);
          triggerHaptic('success');
        } else if (collision.type === 'debris') {
          // Check for shield power-up
          if (hasShield) {
            setActivePowerUps(prev => prev.filter(p => p.type !== 'shield'));
            emitParticles(collision.x, 85, '#10b981', 8);
            triggerHaptic('medium');
          } else {
            setHits(h => h + 1);
            setCombo(0);
            setDodgeStreak(0);
            setShake(true);
            emitParticles(collision.x, 85, '#ef4444', 4);
            triggerHaptic('error');
            setShowCollectFeedback({ x: collision.x, type: 'hit' });
            setTimeout(() => {
              setShake(false);
              setShowCollectFeedback(null);
            }, 300);
          }
        }
      }
    }

    objectsRef.current = updated;
    setObjects(updated);
  }, gameState === 'playing');

  // Timer
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameState('complete');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  // Complete game
  useEffect(() => {
    if (gameState === 'complete' && timeLeft === 0) {
      const crystalScore = totalCrystals > 0 ? (crystalsCollected / Math.max(totalCrystals, 1)) * 100 : 50;
      const hitPenalty = hits * 8;
      const comboBonus = Math.min(maxCombo * 2, 15);
      const nearMissBonus = Math.min(nearMissCount * 0.5, 10); // Near-miss bonus
      const accuracy = Math.max(0, Math.min(100, Math.round(crystalScore - hitPenalty + comboBonus + nearMissBonus)));
      const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result,
        });
      }, 500);
    }
  }, [gameState, timeLeft, crystalsCollected, totalCrystals, hits, maxCombo, nearMissCount, onComplete]);

  const isUrgent = timeLeft <= 5;

  return (
    <div className={`flex flex-col items-center relative ${shake ? 'animate-shake' : ''}`}>
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
        title="Starfall Dodge"
        subtitle="Collect crystals, dodge debris!"
        timeLeft={timeLeft}
        totalTime={config.time}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: crystalsCollected, label: 'Crystals', color: '#22d3ee' }}
        secondaryStat={{ value: hits, label: 'Hits', color: '#ef4444' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Game area - taller for better gameplay */}
      <div
        ref={gameAreaRef}
        className={`relative w-full max-w-xs h-[450px] bg-gradient-to-b from-slate-900 via-slate-900/95 to-primary/20 rounded-xl border overflow-hidden cursor-none touch-none shadow-2xl transition-all ${
          isUrgent ? 'border-red-500/80 animate-pulse' : 'border-border/50'
        }`}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleTapZone}
      >
        {/* Urgency overlay */}
        {isUrgent && (
          <div className="absolute inset-0 bg-red-500/10 pointer-events-none z-20 animate-pulse" />
        )}

        {/* Starfield background - memoized */}
        <StarBackground stars={stars} />

        {/* Nebula effect - static CSS */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        {/* Wave indicator */}
        <WaveIndicator wave={currentWave} />

        {/* Active power-ups */}
        <PowerUpIndicators powerUps={activePowerUps} currentTime={Date.now()} />

        {/* Near-miss indicator */}
        <NearMissIndicator show={showNearMiss} />

        {/* Dodge streak banner */}
        <DodgeStreakBanner streak={dodgeStreak} />

        {/* Shield burst effect */}
        <ShieldBurstEffect active={shieldBurstActive} x={playerX} />

        {/* Falling objects - optimized rendering */}
        {objects.map(obj => (
          <div
            key={obj.id}
            className="absolute pointer-events-none will-animate"
            style={{
              left: `${obj.x}%`,
              top: `${obj.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <FallingObjectComponent obj={obj} hasWarning={obj.warningShown && obj.y < 20} />
          </div>
        ))}

        {/* Particles - memoized */}
        <ParticleRenderer particles={particles} />

        {/* Collection feedback */}
        <AnimatePresence>
          {showCollectFeedback && (
            <motion.div
              className="absolute z-30 pointer-events-none"
              style={{ left: `${showCollectFeedback.x}%`, top: '70%' }}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -30, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <span className={`text-2xl font-bold ${showCollectFeedback.type === 'crystal' ? 'text-cyan-400' : 'text-red-400'}`}>
                {showCollectFeedback.type === 'crystal' ? '+1' : '-1'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player trail */}
        {playerTrail.map((trail, i) => (
          <div
            key={i}
            className="absolute bottom-6 z-10 rounded-full bg-primary/30 pointer-events-none"
            style={{
              left: `${trail.x}%`,
              transform: 'translateX(-50%)',
              width: playerSize * (1 - i * 0.15),
              height: playerSize * (1 - i * 0.15),
              opacity: trail.opacity * 0.4,
            }}
          />
        ))}

        {/* Player avatar */}
        <div
          className="absolute bottom-6 z-20 will-animate gpu-accelerated"
          style={{
            left: `${playerX}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="relative" style={{ animation: 'float 0.8s ease-in-out infinite' }}>
            {/* Shield glow */}
            <div 
              className={`absolute inset-0 rounded-full blur-lg transition-all duration-200 ${
                playerGlow ? 'bg-cyan-400/60 scale-150' : 
                hasPowerUp('shield') ? 'bg-emerald-400/60 scale-140' :
                combo >= 5 ? 'bg-orange-400/50 scale-130' : 'bg-primary/30'
              }`}
              style={{ width: playerSize + 10, height: playerSize + 10, margin: -5 }}
            />
            
            {/* Avatar */}
            <div 
              className="relative rounded-full bg-gradient-to-br from-primary via-primary to-accent flex items-center justify-center border-2 border-white/30"
              style={{ 
                width: playerSize, 
                height: playerSize,
                boxShadow: playerGlow 
                  ? '0 0 30px hsl(var(--primary)), 0 0 60px hsl(var(--primary)/0.5)'
                  : combo >= 5 
                  ? '0 0 25px #f97316, 0 0 50px #f9731640'
                  : '0 0 20px hsl(var(--primary))',
              }}
            >
              <span className="text-xl">{hasPowerUp('shield') ? '🛡️' : '⚡'}</span>
            </div>

            {/* Shield cooldown indicator */}
            {shieldCooldown > Date.now() && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 transition-all"
                  style={{ width: `${Math.max(0, 100 - ((shieldCooldown - Date.now()) / 30))}%` }}
                />
              </div>
            )}

            {/* Combo indicator above player */}
            <AnimatePresence>
              {combo >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold text-black whitespace-nowrap ${
                    combo >= 10 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 'bg-yellow-500/90'
                  }`}
                >
                  🔥 x{combo}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Touch/move hint */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white/40 text-center">
          <div>← Swipe to move • Double-tap for Shield Burst →</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">💎</span>
          <span className="text-cyan-400">Crystal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🧲</span>
          <span className="text-pink-400">Magnet</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg">⏱️</span>
          <span className="text-blue-400">Slow-Mo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg">🛡️</span>
          <span className="text-emerald-400">Shield</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg">✨</span>
          <span className="text-yellow-400">3x Crystal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-500 to-orange-500" />
          <span className="text-red-400">Avoid</span>
        </div>
      </div>

      {/* Optimized CSS animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
          20%, 40%, 60%, 80% { transform: translateX(3px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.8; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-spin {
          0%, 100% { transform: scale(1) rotate(0deg); }
          50% { transform: scale(1.15) rotate(180deg); }
        }
        .will-animate {
          will-change: transform, opacity;
        }
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
        }
      `}</style>
    </div>
  );
};
