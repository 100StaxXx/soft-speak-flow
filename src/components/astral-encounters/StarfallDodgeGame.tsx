import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';

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

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  velocity: { x: number; y: number };
}

export const StarfallDodgeGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: StarfallDodgeGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [playerX, setPlayerX] = useState(50);
  const [objects, setObjects] = useState<FallingObject[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [crystalsCollected, setCrystalsCollected] = useState(0);
  const [hits, setHits] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(12);
  const [totalCrystals, setTotalCrystals] = useState(0);
  const [shake, setShake] = useState(false);
  const [playerGlow, setPlayerGlow] = useState(false);
  const [showCollectFeedback, setShowCollectFeedback] = useState<{ x: number; type: 'crystal' | 'hit' } | null>(null);
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const objectIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const animationRef = useRef<number>();
  const lastSpawnRef = useRef(0);

  // Mind + Body hybrid bonus
  const statBonus = Math.round((companionStats.mind + companionStats.body) / 2);
  const playerSize = 32 + Math.floor(statBonus / 35);

  // Difficulty settings
  const settings = {
    easy: { spawnRate: 550, debrisRatio: 0.45, baseSpeed: 2, time: 12 },
    medium: { spawnRate: 400, debrisRatio: 0.55, baseSpeed: 3, time: 12 },
    hard: { spawnRate: 280, debrisRatio: 0.65, baseSpeed: 4, time: 12 },
  };
  const config = settings[difficulty];
  const spawnRate = config.spawnRate - questIntervalScale * 40;
  const baseSpeed = config.baseSpeed + questIntervalScale * 0.4;

  // Spawn particles effect
  const spawnParticles = useCallback((x: number, y: number, color: string, count: number = 5) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        color,
        velocity: {
          x: (Math.random() - 0.5) * 8,
          y: (Math.random() - 0.5) * 8 - 2,
        },
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)));
    }, 600);
  }, []);

  // Handle player movement
  const handleMove = useCallback((clientX: number) => {
    if (!gameAreaRef.current || gameState !== 'playing') return;
    const rect = gameAreaRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setPlayerX(Math.max(8, Math.min(92, x)));
  }, [gameState]);

  const handleMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  };

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    let lastTime = 0;
    
    const gameLoop = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      // Spawn objects
      if (time - lastSpawnRef.current > spawnRate) {
        lastSpawnRef.current = time;
        const rand = Math.random();
        const isPowerup = rand > 0.95;
        const isCrystal = !isPowerup && rand > config.debrisRatio;
        
        if (isCrystal || isPowerup) setTotalCrystals(t => t + 1);
        
        setObjects(prev => [...prev, {
          id: objectIdRef.current++,
          x: 8 + Math.random() * 84,
          y: -5,
          type: isPowerup ? 'powerup' : isCrystal ? 'crystal' : 'debris',
          speed: baseSpeed + Math.random() * 1.2,
          size: isPowerup ? 32 : isCrystal ? 28 : 24,
        }]);
      }

      // Update objects
      setObjects(prev => {
        const updated: FallingObject[] = [];
        
        prev.forEach(obj => {
          const newY = obj.y + obj.speed * (delta / 16);
          
          // Check collision with player
          const playerLeft = playerX - playerSize / 2;
          const playerRight = playerX + playerSize / 2;
          const objInRange = obj.x > playerLeft - 2 && obj.x < playerRight + 2;
          const atPlayerHeight = newY > 78 && newY < 95;
          
          if (objInRange && atPlayerHeight) {
            if (obj.type === 'crystal' || obj.type === 'powerup') {
              setCrystalsCollected(c => c + (obj.type === 'powerup' ? 2 : 1));
              setCombo(c => c + 1);
              setMaxCombo(m => Math.max(m, combo + 1));
              setPlayerGlow(true);
              spawnParticles(obj.x, 85, obj.type === 'powerup' ? '#fbbf24' : '#22d3ee', 8);
              triggerHaptic('success');
              setShowCollectFeedback({ x: obj.x, type: 'crystal' });
              setTimeout(() => {
                setPlayerGlow(false);
                setShowCollectFeedback(null);
              }, 300);
            } else {
              setHits(h => h + 1);
              setCombo(0);
              setShake(true);
              spawnParticles(obj.x, 85, '#ef4444', 6);
              triggerHaptic('error');
              setShowCollectFeedback({ x: obj.x, type: 'hit' });
              setTimeout(() => {
                setShake(false);
                setShowCollectFeedback(null);
              }, 300);
            }
            return;
          }
          
          if (newY < 110) {
            updated.push({ ...obj, y: newY });
          }
        });
        
        return updated;
      });

      // Update particles
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.velocity.x,
        y: p.y + p.velocity.y,
        velocity: { ...p.velocity, y: p.velocity.y + 0.3 },
      })));

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameState, playerX, playerSize, spawnRate, baseSpeed, config.debrisRatio, combo, spawnParticles]);

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
        {/* Starfield background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(30)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                width: Math.random() * 2 + 1,
                height: Math.random() * 2 + 1,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                opacity: [0.2, 0.8, 0.2],
              }}
              transition={{
                duration: 1 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        {/* Nebula effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl" />
        </div>

        {/* Falling objects */}
        <AnimatePresence>
          {objects.map(obj => (
            <motion.div
              key={obj.id}
              className="absolute pointer-events-none"
              style={{
                left: `${obj.x}%`,
                top: `${obj.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
            >
              {obj.type === 'crystal' ? (
                <motion.div
                  className="relative flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <div 
                    className="w-7 h-7 flex items-center justify-center"
                    style={{ filter: 'drop-shadow(0 0 8px #22d3ee)' }}
                  >
                    <span className="text-2xl">💎</span>
                  </div>
                </motion.div>
              ) : obj.type === 'powerup' ? (
                <motion.div
                  className="relative flex items-center justify-center"
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <div 
                    className="w-8 h-8 flex items-center justify-center"
                    style={{ filter: 'drop-shadow(0 0 12px #fbbf24)' }}
                  >
                    <span className="text-2xl">⭐</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500 via-orange-500 to-red-600"
                  style={{ boxShadow: '0 0 12px rgba(239, 68, 68, 0.6), inset 0 0 8px rgba(255,255,255,0.3)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                >
                  {/* Meteor tail */}
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-4 bg-gradient-to-t from-orange-500/80 to-transparent rounded-full blur-sm" />
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Particles */}
        <AnimatePresence>
          {particles.map(particle => (
            <motion.div
              key={particle.id}
              className="absolute w-2 h-2 rounded-full pointer-events-none"
              style={{
                left: `${particle.x}%`,
                top: `${particle.y}%`,
                backgroundColor: particle.color,
                boxShadow: `0 0 6px ${particle.color}`,
              }}
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.5 }}
            />
          ))}
        </AnimatePresence>

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
        <motion.div
          className="absolute bottom-6 z-20"
          style={{
            left: `${playerX}%`,
            transform: 'translateX(-50%)',
          }}
          animate={{ x: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <motion.div
            className="relative"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            {/* Shield glow */}
            <motion.div 
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
          </motion.div>
        </motion.div>

        {/* Touch/move hint */}
        <motion.div 
          className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-white/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          ← Move to dodge & collect →
        </motion.div>
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

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
          20%, 40%, 60%, 80% { transform: translateX(3px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};
