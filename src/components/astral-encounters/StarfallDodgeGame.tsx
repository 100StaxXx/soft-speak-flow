import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';

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
  type: 'debris' | 'crystal';
  speed: number;
}

export const StarfallDodgeGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: StarfallDodgeGameProps) => {
  const [playerX, setPlayerX] = useState(50);
  const [objects, setObjects] = useState<FallingObject[]>([]);
  const [crystalsCollected, setCrystalsCollected] = useState(0);
  const [hits, setHits] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);
  const [gameComplete, setGameComplete] = useState(false);
  const [totalCrystals, setTotalCrystals] = useState(0);
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const objectIdRef = useRef(0);
  const animationRef = useRef<number>();
  const lastSpawnRef = useRef(0);

  // Mind + Body hybrid bonus
  const statBonus = Math.round((companionStats.mind + companionStats.body) / 2);
  const playerSize = 30 + Math.floor(statBonus / 30); // Slightly smaller hitbox with higher stats

  // Difficulty settings
  const settings = {
    easy: { spawnRate: 600, debrisRatio: 0.5, baseSpeed: 2 },
    medium: { spawnRate: 450, debrisRatio: 0.6, baseSpeed: 3 },
    hard: { spawnRate: 300, debrisRatio: 0.7, baseSpeed: 4 },
  };
  const config = settings[difficulty];
  const spawnRate = config.spawnRate - questIntervalScale * 50;
  const baseSpeed = config.baseSpeed + questIntervalScale * 0.5;

  // Handle player movement
  const handleMove = useCallback((clientX: number) => {
    if (!gameAreaRef.current || gameComplete) return;
    const rect = gameAreaRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setPlayerX(Math.max(10, Math.min(90, x)));
  }, [gameComplete]);

  const handleMouseMove = (e: React.MouseEvent) => handleMove(e.clientX);
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  };

  // Game loop
  useEffect(() => {
    if (gameComplete) return;

    let lastTime = 0;
    
    const gameLoop = (time: number) => {
      if (!lastTime) lastTime = time;
      const delta = time - lastTime;
      lastTime = time;

      // Spawn objects
      if (time - lastSpawnRef.current > spawnRate) {
        lastSpawnRef.current = time;
        const isCrystal = Math.random() > config.debrisRatio;
        if (isCrystal) setTotalCrystals(t => t + 1);
        
        setObjects(prev => [...prev, {
          id: objectIdRef.current++,
          x: 10 + Math.random() * 80,
          y: -5,
          type: isCrystal ? 'crystal' : 'debris',
          speed: baseSpeed + Math.random() * 1.5,
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
          const objInRange = obj.x > playerLeft && obj.x < playerRight;
          const atPlayerHeight = newY > 75 && newY < 95;
          
          if (objInRange && atPlayerHeight) {
            if (obj.type === 'crystal') {
              setCrystalsCollected(c => c + 1);
            } else {
              setHits(h => h + 1);
            }
            return; // Remove object
          }
          
          // Keep if still on screen
          if (newY < 105) {
            updated.push({ ...obj, y: newY });
          }
        });
        
        return updated;
      });

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [gameComplete, playerX, playerSize, spawnRate, baseSpeed, config.debrisRatio]);

  // Timer
  useEffect(() => {
    if (gameComplete) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setGameComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameComplete]);

  // Complete game
  useEffect(() => {
    if (gameComplete) {
      const crystalScore = totalCrystals > 0 ? (crystalsCollected / totalCrystals) * 100 : 50;
      const hitPenalty = hits * 10;
      const accuracy = Math.max(0, Math.min(100, Math.round(crystalScore - hitPenalty)));
      const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result,
        });
      }, 500);
    }
  }, [gameComplete, crystalsCollected, totalCrystals, hits, onComplete]);

  return (
    <div className="p-4 flex flex-col items-center">
      <h3 className="text-lg font-bold text-foreground mb-2">Starfall Dodge</h3>
      
      {/* Stats bar */}
      <div className="flex gap-4 mb-2 text-sm">
        <span className="text-cyan-400">💎 {crystalsCollected}</span>
        <span className="text-red-400">💥 {hits}</span>
        <span className="text-yellow-400">⏱️ {timeLeft}s</span>
      </div>

      {/* Game area */}
      <div
        ref={gameAreaRef}
        className="relative w-full max-w-xs h-72 bg-gradient-to-b from-background to-primary/10 rounded-lg border border-border overflow-hidden cursor-none touch-none"
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
      >
        {/* Starfield background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/50 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animation: `twinkle ${1 + Math.random() * 2}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Falling objects */}
        <AnimatePresence>
          {objects.map(obj => (
            <motion.div
              key={obj.id}
              className="absolute"
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
                  className="w-6 h-6 flex items-center justify-center"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <span className="text-xl" style={{ filter: 'drop-shadow(0 0 4px cyan)' }}>💎</span>
                </motion.div>
              ) : (
                <motion.div
                  className="w-5 h-5 rounded-full bg-gradient-to-br from-red-500 to-orange-600"
                  style={{ boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Player avatar */}
        <motion.div
          className="absolute bottom-4"
          style={{
            left: `${playerX}%`,
            transform: 'translateX(-50%)',
          }}
        >
          <motion.div
            className="relative"
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          >
            {/* Shield glow */}
            <div 
              className="absolute inset-0 rounded-full bg-primary/30 blur-md"
              style={{ width: playerSize, height: playerSize }}
            />
            {/* Avatar */}
            <div 
              className="relative rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center"
              style={{ 
                width: playerSize, 
                height: playerSize,
                boxShadow: '0 0 15px hsl(var(--primary))',
              }}
            >
              <span className="text-lg">🛡️</span>
            </div>
          </motion.div>
        </motion.div>

        {/* Touch/move hint */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-xs text-muted-foreground/50">
          Move to dodge & collect
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
        <span>💎 Collect crystals</span>
        <span>🔴 Avoid debris</span>
      </div>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
