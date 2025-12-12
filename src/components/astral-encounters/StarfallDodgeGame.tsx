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
}

interface FallingObject {
  id: number;
  x: number;
  y: number;
  type: 'debris' | 'crystal' | 'powerup';
  speed: number;
  size: number;
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

// Memoized falling object component
const FallingObjectComponent = memo(({ obj }: { obj: FallingObject }) => {
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
  } else if (obj.type === 'powerup') {
    return (
      <div 
        className="w-8 h-8 flex items-center justify-center will-animate gpu-accelerated"
        style={{ 
          filter: 'drop-shadow(0 0 12px #fbbf24)',
          animation: 'pulse-spin 1.5s ease-in-out infinite',
        }}
      >
        <span className="text-2xl">⭐</span>
      </div>
    );
  } else {
    return (
      <div
        className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 via-orange-500 to-red-600 will-animate gpu-accelerated"
        style={{ 
          boxShadow: '0 0 12px rgba(239, 68, 68, 0.6), inset 0 0 8px rgba(255,255,255,0.3)',
          animation: 'spin 0.8s linear infinite',
        }}
      >
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-4 bg-gradient-to-t from-orange-500/80 to-transparent rounded-full blur-sm" />
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

export const StarfallDodgeGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: StarfallDodgeGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [playerX, setPlayerX] = useState(50);
  const [crystalsCollected, setCrystalsCollected] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(12);
  const [totalCrystals, setTotalCrystals] = useState(0);
  const [shake, setShake] = useState(false);
  const [playerGlow, setPlayerGlow] = useState(false);
  const [showCollectFeedback, setShowCollectFeedback] = useState<{ x: number; type: 'crystal' | 'hit' } | null>(null);
  
  // Refs for mutable state to avoid re-renders in game loop
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const objectsRef = useRef<FallingObject[]>([]);
  const [objects, setObjects] = useState<FallingObject[]>([]);
  const objectIdRef = useRef(0);
  const lastSpawnRef = useRef(0);
  const playerXRef = useRef(playerX);
  const gameStateRef = useRef(gameState);
  const statsRef = useRef({ crystalsCollected, hits, combo, maxCombo, totalCrystals });

  // Keep refs in sync
  useEffect(() => { playerXRef.current = playerX; }, [playerX]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => {
    statsRef.current = { crystalsCollected, hits, combo, maxCombo, totalCrystals };
  }, [crystalsCollected, hits, combo, maxCombo, totalCrystals]);

  // Use particle system from shared utilities
  const { particles, emit: emitParticles } = useParticleSystem(30);

  // Static stars - only calculated once
  const stars = useStaticStars(20);

  // Mind + Body hybrid bonus
  const statBonus = Math.round((companionStats.mind + companionStats.body) / 2);
  const playerSize = 32 + Math.floor(statBonus / 35);

  // Memoized difficulty settings
  const config = useMemo(() => {
    const settings = {
      easy: { spawnRate: 550, debrisRatio: 0.45, baseSpeed: 2, time: 12 },
      medium: { spawnRate: 400, debrisRatio: 0.55, baseSpeed: 3, time: 12 },
      hard: { spawnRate: 280, debrisRatio: 0.65, baseSpeed: 4, time: 12 },
    };
    const s = settings[difficulty];
    return {
      ...s,
      spawnRate: s.spawnRate - questIntervalScale * 40,
      baseSpeed: s.baseSpeed + questIntervalScale * 0.4,
    };
  }, [difficulty, questIntervalScale]);

  // Handle player movement
  const handleMove = useCallback((clientX: number) => {
    if (!gameAreaRef.current || gameStateRef.current !== 'playing') return;
    const rect = gameAreaRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setPlayerX(Math.max(8, Math.min(92, x)));
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => handleMove(e.clientX), [handleMove]);
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  }, [handleMove]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  // Optimized game loop using shared hook
  useGameLoop((deltaTime, time) => {
    if (gameStateRef.current !== 'playing') return;

    const currentPlayerX = playerXRef.current;
    const currentPlayerSize = playerSize;

    // Spawn objects with rate limiting
    if (time - lastSpawnRef.current > config.spawnRate) {
      lastSpawnRef.current = time;
      const rand = Math.random();
      const isPowerup = rand > 0.95;
      const isCrystal = !isPowerup && rand > config.debrisRatio;
      
      if (isCrystal || isPowerup) {
        setTotalCrystals(t => t + 1);
      }
      
      const newObj: FallingObject = {
        id: objectIdRef.current++,
        x: 8 + Math.random() * 84,
        y: -5,
        type: isPowerup ? 'powerup' : isCrystal ? 'crystal' : 'debris',
        speed: config.baseSpeed + Math.random() * 1.2,
        size: isPowerup ? 32 : isCrystal ? 28 : 24,
      };
      
      objectsRef.current = [...objectsRef.current, newObj];
    }

    // Update and filter objects - batch processing
    const collisions: { type: 'crystal' | 'powerup' | 'debris'; x: number }[] = [];
    const updated: FallingObject[] = [];
    
    const playerLeft = currentPlayerX - currentPlayerSize / 2;
    const playerRight = currentPlayerX + currentPlayerSize / 2;

    for (const obj of objectsRef.current) {
      const newY = obj.y + obj.speed * deltaTime * 60;
      
      // Check collision with player
      const objInRange = obj.x > playerLeft - 2 && obj.x < playerRight + 2;
      const atPlayerHeight = newY > 78 && newY < 95;
      
      if (objInRange && atPlayerHeight) {
        collisions.push({ type: obj.type, x: obj.x });
      } else if (newY < 110) {
        updated.push({ ...obj, y: newY });
      }
    }

    // Process collisions outside the loop
    if (collisions.length > 0) {
      for (const collision of collisions) {
        if (collision.type === 'crystal' || collision.type === 'powerup') {
          setCrystalsCollected(c => c + (collision.type === 'powerup' ? 2 : 1));
          setCombo(c => {
            const newCombo = c + 1;
            setMaxCombo(m => Math.max(m, newCombo));
            return newCombo;
          });
          setPlayerGlow(true);
          emitParticles(collision.x, 85, collision.type === 'powerup' ? '#fbbf24' : '#22d3ee', 6);
          triggerHaptic('success');
          setShowCollectFeedback({ x: collision.x, type: 'crystal' });
          setTimeout(() => {
            setPlayerGlow(false);
            setShowCollectFeedback(null);
          }, 300);
        } else {
          setHits(h => h + 1);
          setCombo(0);
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
      const crystalScore = totalCrystals > 0 ? (crystalsCollected / totalCrystals) * 100 : 50;
      const hitPenalty = hits * 8;
      const comboBonus = Math.min(maxCombo * 2, 15);
      const accuracy = Math.max(0, Math.min(100, Math.round(crystalScore - hitPenalty + comboBonus)));
      const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result,
        });
      }, 500);
    }
  }, [gameState, timeLeft, crystalsCollected, totalCrystals, hits, maxCombo, onComplete]);

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
        totalTime={12}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: crystalsCollected, label: 'Crystals', color: '#22d3ee' }}
        secondaryStat={{ value: hits, label: 'Hits', color: '#ef4444' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Game area */}
      <div
        ref={gameAreaRef}
        className="relative w-full max-w-xs h-80 bg-gradient-to-b from-slate-900 via-slate-900/95 to-primary/20 rounded-xl border border-border/50 overflow-hidden cursor-none touch-none shadow-2xl"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
      >
        {/* Starfield background - memoized */}
        <StarBackground stars={stars} />

        {/* Nebula effect - static CSS */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

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
            <FallingObjectComponent obj={obj} />
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

        {/* Player avatar */}
        <div
          className="absolute bottom-6 z-20 will-animate gpu-accelerated"
          style={{
            left: `${playerX}%`,
            transform: 'translateX(-50%)',
            transition: 'left 0.05s ease-out',
          }}
        >
          <div className="relative" style={{ animation: 'float 0.8s ease-in-out infinite' }}>
            {/* Shield glow */}
            <div 
              className={`absolute inset-0 rounded-full blur-lg transition-all duration-200 ${
                playerGlow ? 'bg-cyan-400/60 scale-150' : 'bg-primary/30'
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
                  : '0 0 20px hsl(var(--primary))',
              }}
            >
              <span className="text-xl">🛡️</span>
            </div>

            {/* Combo indicator above player */}
            <AnimatePresence>
              {combo >= 3 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-yellow-500/90 rounded-full text-xs font-bold text-black whitespace-nowrap"
                >
                  🔥 x{combo}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Touch/move hint */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white/40">
          ← Move to dodge & collect →
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-6 mt-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-lg">💎</span>
          <span className="text-cyan-400">Collect</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-lg">⭐</span>
          <span className="text-yellow-400">Bonus x2</span>
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
          50% { transform: scale(1.2) rotate(180deg); }
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
