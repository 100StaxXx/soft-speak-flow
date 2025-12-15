import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';

interface AstralSerpentGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

interface Position {
  x: number;
  y: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';

const GRID_SIZE = 15;
const CELL_SIZE = 20;

// Memoized cell component for performance
const Cell = memo(({ 
  isHead, 
  isBody, 
  isStardust,
  bodyIndex,
  totalLength
}: { 
  isHead: boolean; 
  isBody: boolean; 
  isStardust: boolean;
  bodyIndex: number;
  totalLength: number;
}) => {
  if (isHead) {
    return (
      <motion.div
        className="absolute rounded-full bg-gradient-to-br from-primary to-accent"
        style={{
          width: CELL_SIZE - 2,
          height: CELL_SIZE - 2,
          boxShadow: '0 0 15px hsl(var(--primary)), 0 0 25px hsl(var(--primary) / 0.5)',
        }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 0.3, repeat: Infinity }}
      />
    );
  }

  if (isBody) {
    const opacity = 1 - (bodyIndex / totalLength) * 0.5;
    return (
      <div
        className="absolute rounded-full"
        style={{
          width: CELL_SIZE - 4,
          height: CELL_SIZE - 4,
          margin: 1,
          background: `linear-gradient(135deg, hsl(var(--primary) / ${opacity}), hsl(var(--accent) / ${opacity}))`,
          boxShadow: `0 0 8px hsl(var(--primary) / ${opacity * 0.5})`,
        }}
      />
    );
  }

  if (isStardust) {
    return (
      <motion.div
        className="absolute"
        style={{
          width: CELL_SIZE - 4,
          height: CELL_SIZE - 4,
          margin: 1,
        }}
        animate={{ 
          rotate: 360,
          scale: [0.8, 1.2, 0.8],
        }}
        transition={{ 
          rotate: { duration: 3, repeat: Infinity, ease: "linear" },
          scale: { duration: 1, repeat: Infinity }
        }}
      >
        <div 
          className="w-full h-full rounded-full bg-gradient-to-br from-yellow-400 to-amber-500"
          style={{ boxShadow: '0 0 10px #fbbf24, 0 0 20px #fbbf24' }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-xs">✨</span>
      </motion.div>
    );
  }

  return null;
});
Cell.displayName = 'Cell';

export const AstralSerpentGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0
}: AstralSerpentGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [snake, setSnake] = useState<Position[]>([{ x: 7, y: 7 }]);
  const [direction, setDirection] = useState<Direction>('right');
  const [stardust, setStardust] = useState<Position>({ x: 10, y: 7 });
  const [score, setScore] = useState(0);
  const [shake, setShake] = useState(false);
  const [showCollect, setShowCollect] = useState(false);
  
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const directionRef = useRef<Direction>('right');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Calculate game speed based on difficulty and companion stats
  const bodyBonus = Math.min(companionStats.body / 100, 1);
  const baseSpeed = difficulty === 'easy' ? 200 : difficulty === 'medium' ? 150 : 100;
  const adjustedSpeed = baseSpeed * (1 - questIntervalScale * 0.2) * (1 - bodyBonus * 0.15);
  const gameSpeed = Math.max(80, adjustedSpeed);

  // Target score based on difficulty
  const targetScore = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 7 : 10;

  const spawnStardust = useCallback((currentSnake: Position[]) => {
    let newPos: Position;
    do {
      newPos = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (currentSnake.some(seg => seg.x === newPos.x && seg.y === newPos.y));
    return newPos;
  }, []);

  const moveSnake = useCallback(() => {
    if (gameState !== 'playing') return;

    setSnake(prevSnake => {
      const head = prevSnake[0];
      const currentDirection = directionRef.current;
      
      let newHead: Position;
      switch (currentDirection) {
        case 'up':
          newHead = { x: head.x, y: head.y - 1 };
          break;
        case 'down':
          newHead = { x: head.x, y: head.y + 1 };
          break;
        case 'left':
          newHead = { x: head.x - 1, y: head.y };
          break;
        case 'right':
          newHead = { x: head.x + 1, y: head.y };
          break;
        default:
          newHead = { x: head.x + 1, y: head.y };
      }

      // Check wall collision
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
        // Game over - hit wall
        setGameState('complete');
        triggerHaptic('error');
        setShake(true);
        setTimeout(() => setShake(false), 300);
        
        const accuracy = Math.round((score / targetScore) * 100);
        onComplete({
          success: score >= Math.ceil(targetScore / 2),
          accuracy: Math.min(100, accuracy),
          result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail'
        });
        return prevSnake;
      }

      // Check self collision
      if (prevSnake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
        setGameState('complete');
        triggerHaptic('error');
        setShake(true);
        setTimeout(() => setShake(false), 300);
        
        const accuracy = Math.round((score / targetScore) * 100);
        onComplete({
          success: score >= Math.ceil(targetScore / 2),
          accuracy: Math.min(100, accuracy),
          result: accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 50 ? 'partial' : 'fail'
        });
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check stardust collection
      if (newHead.x === stardust.x && newHead.y === stardust.y) {
        setScore(s => {
          const newScore = s + 1;
          if (newScore >= targetScore) {
            setGameState('complete');
            triggerHaptic('success');
            onComplete({
              success: true,
              accuracy: 100,
              result: 'perfect'
            });
          }
          return newScore;
        });
        setStardust(spawnStardust(newSnake));
        setShowCollect(true);
        triggerHaptic('medium');
        setTimeout(() => setShowCollect(false), 300);
        return newSnake; // Don't remove tail - snake grows
      }

      newSnake.pop(); // Remove tail
      return newSnake;
    });
  }, [gameState, stardust, score, targetScore, spawnStardust, onComplete]);

  // Game loop
  useEffect(() => {
    if (gameState === 'playing') {
      gameLoopRef.current = setInterval(moveSnake, gameSpeed);
    }
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameState, moveSnake, gameSpeed]);

  // Handle direction changes
  const changeDirection = useCallback((newDirection: Direction) => {
    const opposites: Record<Direction, Direction> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };
    
    if (opposites[newDirection] !== directionRef.current) {
      directionRef.current = newDirection;
      setDirection(newDirection);
      triggerHaptic('light');
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== 'playing') return;
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          changeDirection('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          changeDirection('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          changeDirection('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          changeDirection('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, changeDirection]);

  // Touch/swipe controls
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || gameState !== 'playing') return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    
    const minSwipe = 30;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (Math.abs(deltaX) > minSwipe) {
        changeDirection(deltaX > 0 ? 'right' : 'left');
      }
    } else {
      if (Math.abs(deltaY) > minSwipe) {
        changeDirection(deltaY > 0 ? 'down' : 'up');
      }
    }
    
    touchStartRef.current = null;
  }, [gameState, changeDirection]);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

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
        title="Astral Serpent"
        subtitle="Consume the stardust!"
        score={score}
        maxScore={targetScore}
        combo={snake.length - 1}
        showCombo={true}
        primaryStat={{ value: snake.length, label: 'Length', color: 'hsl(var(--primary))' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Score progress */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: targetScore }).map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full border-2 transition-all ${
              i < score
                ? 'bg-yellow-500 border-yellow-400'
                : 'border-muted bg-muted/20'
            }`}
          />
        ))}
      </div>

      {/* Game Grid */}
      <div
        className="relative rounded-lg overflow-hidden border-2 border-border/50"
        style={{
          width: GRID_SIZE * CELL_SIZE,
          height: GRID_SIZE * CELL_SIZE,
          background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.3) 100%)',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Grid background pattern */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--border) / 0.3) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--border) / 0.3) 1px, transparent 1px)
            `,
            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
          }}
        />

        {/* Stardust */}
        <div
          className="absolute"
          style={{
            left: stardust.x * CELL_SIZE,
            top: stardust.y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
          }}
        >
          <Cell isHead={false} isBody={false} isStardust={true} bodyIndex={0} totalLength={0} />
        </div>

        {/* Snake */}
        {snake.map((segment, index) => (
          <div
            key={index}
            className="absolute transition-all duration-75"
            style={{
              left: segment.x * CELL_SIZE,
              top: segment.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
            }}
          >
            <Cell
              isHead={index === 0}
              isBody={index > 0}
              isStardust={false}
              bodyIndex={index}
              totalLength={snake.length}
            />
          </div>
        ))}

        {/* Collect effect */}
        <AnimatePresence>
          {showCollect && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-yellow-400/20" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Direction controls (mobile) */}
      {gameState === 'playing' && (
        <div className="grid grid-cols-3 gap-2 mt-4 w-36">
          <div />
          <motion.button
            className="w-10 h-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-lg"
            whileTap={{ scale: 0.9 }}
            onClick={() => changeDirection('up')}
          >
            ↑
          </motion.button>
          <div />
          <motion.button
            className="w-10 h-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-lg"
            whileTap={{ scale: 0.9 }}
            onClick={() => changeDirection('left')}
          >
            ←
          </motion.button>
          <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-xs text-muted-foreground">
            {direction[0].toUpperCase()}
          </div>
          <motion.button
            className="w-10 h-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-lg"
            whileTap={{ scale: 0.9 }}
            onClick={() => changeDirection('right')}
          >
            →
          </motion.button>
          <div />
          <motion.button
            className="w-10 h-10 rounded-lg bg-muted/50 border border-border flex items-center justify-center text-lg"
            whileTap={{ scale: 0.9 }}
            onClick={() => changeDirection('down')}
          >
            ↓
          </motion.button>
          <div />
        </div>
      )}

      {/* Instructions */}
      <p className="mt-4 text-sm text-muted-foreground text-center">
        {gameState === 'playing' 
          ? 'Swipe or use arrow keys to move!'
          : 'Get ready...'}
      </p>

      {/* Stat bonus indicator */}
      <p className="mt-2 text-xs text-muted-foreground">
        Body stat bonus: +{Math.round(bodyBonus * 15)}% speed boost
      </p>

      {/* CSS animations */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
      `}</style>
    </div>
  );
};
