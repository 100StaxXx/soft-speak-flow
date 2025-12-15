import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';
import { GameStyleWrapper } from './GameStyles';

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

interface TrailParticle {
  id: string;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  createdAt: number;
}

type Direction = 'up' | 'down' | 'left' | 'right';

const GRID_SIZE = 15;
const CELL_SIZE = 20;
const TRAIL_LIFETIME = 600;
const MAX_TRAIL_PARTICLES = 30;
const MIN_SWIPE_DISTANCE = 30;

// Swipe indicator component
const SwipeIndicator = memo(({ direction, visible }: { direction: Direction | null; visible: boolean }) => {
  if (!visible || !direction) return null;
  
  const icons: Record<Direction, typeof ArrowUp> = {
    up: ArrowUp,
    down: ArrowDown,
    left: ArrowLeft,
    right: ArrowRight,
  };
  const Icon = icons[direction];
  
  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
      initial={{ opacity: 0, scale: 1.5 }}
      animate={{ opacity: 0.8, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ duration: 0.2 }}
    >
      <div className="p-4 rounded-full bg-primary/30 backdrop-blur-sm">
        <Icon className="w-12 h-12 text-primary" />
      </div>
    </motion.div>
  );
});
SwipeIndicator.displayName = 'SwipeIndicator';

// Swipe hint for first-time players
const SwipeHint = memo(({ show }: { show: boolean }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="absolute bottom-2 left-0 right-0 text-center z-20"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/20 border border-primary/30">
          <span className="text-xs text-primary">👆 Swipe or tap to change direction</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));
SwipeHint.displayName = 'SwipeHint';

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
        className="absolute rounded-full"
        style={{
          width: CELL_SIZE - 2,
          height: CELL_SIZE - 2,
          background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))',
          boxShadow: '0 0 15px hsl(var(--primary)), 0 0 25px hsl(var(--primary) / 0.5), inset 0 0 8px hsl(var(--primary-foreground) / 0.3)',
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
          className="w-full h-full rounded-full"
          style={{ 
            background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
            boxShadow: '0 0 10px #fbbf24, 0 0 20px #fbbf24, 0 0 30px #fbbf24' 
          }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-xs">✨</span>
      </motion.div>
    );
  }

  return null;
});
Cell.displayName = 'Cell';

// Trail particle component
const TrailParticleComponent = memo(({ particle }: { particle: TrailParticle }) => (
  <motion.div
    className="absolute rounded-full pointer-events-none"
    style={{
      left: particle.x * CELL_SIZE + CELL_SIZE / 2,
      top: particle.y * CELL_SIZE + CELL_SIZE / 2,
      width: (CELL_SIZE - 6) * particle.scale,
      height: (CELL_SIZE - 6) * particle.scale,
      transform: 'translate(-50%, -50%)',
      background: `radial-gradient(circle, hsl(var(--primary) / ${particle.opacity * 0.6}) 0%, hsl(var(--accent) / ${particle.opacity * 0.3}) 50%, transparent 100%)`,
      filter: 'blur(2px)',
    }}
    initial={{ opacity: particle.opacity, scale: particle.scale }}
    animate={{ opacity: 0, scale: 0.2 }}
    transition={{ duration: TRAIL_LIFETIME / 1000, ease: 'easeOut' }}
  />
));
TrailParticleComponent.displayName = 'TrailParticleComponent';

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
  const [trailParticles, setTrailParticles] = useState<TrailParticle[]>([]);
  const [swipeIndicator, setSwipeIndicator] = useState<Direction | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const trailCleanupRef = useRef<NodeJS.Timeout | null>(null);
  const directionRef = useRef<Direction>('right');
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const particleIdRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate game speed based on difficulty and companion stats
  const bodyBonus = Math.min(companionStats.body / 100, 1);
  const baseSpeed = difficulty === 'easy' ? 200 : difficulty === 'medium' ? 150 : 100;
  const adjustedSpeed = baseSpeed * (1 - questIntervalScale * 0.2) * (1 - bodyBonus * 0.15);
  const gameSpeed = Math.max(80, adjustedSpeed);

  // Target score based on difficulty
  const targetScore = difficulty === 'easy' ? 5 : difficulty === 'medium' ? 7 : 10;

  // Add trail particle when snake moves
  const addTrailParticle = useCallback((position: Position, snakeLength: number) => {
    const newParticle: TrailParticle = {
      id: `trail-${particleIdRef.current++}`,
      x: position.x,
      y: position.y,
      opacity: Math.min(0.8, 0.4 + snakeLength * 0.05),
      scale: Math.min(1.2, 0.6 + snakeLength * 0.05),
      createdAt: Date.now(),
    };
    
    setTrailParticles(prev => {
      const updated = [...prev, newParticle];
      if (updated.length > MAX_TRAIL_PARTICLES) {
        return updated.slice(-MAX_TRAIL_PARTICLES);
      }
      return updated;
    });
  }, []);

  // Clean up expired trail particles
  useEffect(() => {
    trailCleanupRef.current = setInterval(() => {
      const now = Date.now();
      setTrailParticles(prev => 
        prev.filter(p => now - p.createdAt < TRAIL_LIFETIME)
      );
    }, 100);
    
    return () => {
      if (trailCleanupRef.current) {
        clearInterval(trailCleanupRef.current);
      }
    };
  }, []);

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
      
      addTrailParticle(head, prevSnake.length);
      
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
        return newSnake;
      }

      newSnake.pop();
      return newSnake;
    });
  }, [gameState, stardust, score, targetScore, spawnStardust, onComplete, addTrailParticle]);

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
      
      // Show swipe indicator briefly
      setSwipeIndicator(newDirection);
      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);
      }
      swipeTimeoutRef.current = setTimeout(() => {
        setSwipeIndicator(null);
      }, 200);
      
      // Hide hint after first input
      if (showSwipeHint) {
        setShowSwipeHint(false);
      }
    }
  }, [showSwipeHint]);

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

  // Touch start handler - record starting position
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameState !== 'playing') return;
    
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [gameState]);

  // Touch end handler - detect swipe or tap
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (gameState !== 'playing' || !gameAreaRef.current || !touchStartRef.current) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Check if it's a swipe (minimum distance threshold)
    if (distance >= MIN_SWIPE_DISTANCE) {
      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        changeDirection(deltaX > 0 ? 'right' : 'left');
      } else {
        // Vertical swipe
        changeDirection(deltaY > 0 ? 'down' : 'up');
      }
    } else {
      // It's a tap - use position relative to snake head
      const rect = gameAreaRef.current.getBoundingClientRect();
      const tapX = touch.clientX - rect.left;
      const tapY = touch.clientY - rect.top;
      
      const head = snake[0];
      const headPixelX = head.x * CELL_SIZE + CELL_SIZE / 2;
      const headPixelY = head.y * CELL_SIZE + CELL_SIZE / 2;
      
      const tapDeltaX = tapX - headPixelX;
      const tapDeltaY = tapY - headPixelY;
      
      if (Math.abs(tapDeltaX) > Math.abs(tapDeltaY)) {
        changeDirection(tapDeltaX > 0 ? 'right' : 'left');
      } else {
        changeDirection(tapDeltaY > 0 ? 'down' : 'up');
      }
    }
    
    touchStartRef.current = null;
  }, [gameState, snake, changeDirection]);

  // Mouse click handler (for desktop tap)
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (gameState !== 'playing' || !gameAreaRef.current) return;
    
    const rect = gameAreaRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const head = snake[0];
    const headPixelX = head.x * CELL_SIZE + CELL_SIZE / 2;
    const headPixelY = head.y * CELL_SIZE + CELL_SIZE / 2;
    
    const deltaX = clickX - headPixelX;
    const deltaY = clickY - headPixelY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      changeDirection(deltaX > 0 ? 'right' : 'left');
    } else {
      changeDirection(deltaY > 0 ? 'down' : 'up');
    }
  }, [gameState, snake, changeDirection]);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <GameStyleWrapper>
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
        <div className="flex gap-1.5 mb-4">
          {Array.from({ length: targetScore }).map((_, i) => (
            <motion.div
              key={i}
              className={`w-3 h-3 rounded-full border-2 transition-all ${
                i < score
                  ? 'border-yellow-400'
                  : 'border-muted-foreground/30 bg-muted/20'
              }`}
              style={i < score ? {
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                boxShadow: '0 0 8px #fbbf24',
              } : {}}
              animate={i < score ? { scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {/* Game Grid - Swipe and tap to control */}
        <motion.div
          ref={gameAreaRef}
          className="relative rounded-xl overflow-hidden cursor-pointer select-none touch-none"
          style={{
            width: GRID_SIZE * CELL_SIZE,
            height: GRID_SIZE * CELL_SIZE,
            background: 'linear-gradient(135deg, hsl(var(--background)) 0%, hsl(var(--muted) / 0.5) 100%)',
            border: '2px solid hsl(var(--border) / 0.5)',
            boxShadow: '0 0 30px hsl(var(--primary) / 0.1), inset 0 0 50px hsl(var(--background) / 0.5)',
          }}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          whileTap={{ scale: 0.99 }}
        >
          {/* Swipe indicator */}
          <AnimatePresence>
            <SwipeIndicator direction={swipeIndicator} visible={swipeIndicator !== null} />
          </AnimatePresence>

          {/* Swipe hint */}
          <SwipeHint show={showSwipeHint && gameState === 'playing'} />

          {/* Nebula background effect */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: `
                radial-gradient(circle at 20% 30%, hsl(var(--primary) / 0.3) 0%, transparent 40%),
                radial-gradient(circle at 80% 70%, hsl(var(--accent) / 0.3) 0%, transparent 40%)
              `,
            }}
          />

          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-15"
            style={{
              backgroundImage: `
                linear-gradient(hsl(var(--border) / 0.4) 1px, transparent 1px),
                linear-gradient(90deg, hsl(var(--border) / 0.4) 1px, transparent 1px)
              `,
              backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
            }}
          />

          {/* Trail particles */}
          <AnimatePresence>
            {trailParticles.map(particle => (
              <TrailParticleComponent key={particle.id} particle={particle} />
            ))}
          </AnimatePresence>

          {/* Render stardust */}
          <div
            style={{
              position: 'absolute',
              left: stardust.x * CELL_SIZE,
              top: stardust.y * CELL_SIZE,
            }}
          >
            <Cell 
              isHead={false} 
              isBody={false} 
              isStardust={true}
              bodyIndex={0}
              totalLength={1}
            />
          </div>

          {/* Render snake */}
          {snake.map((segment, index) => (
            <div
              key={`${segment.x}-${segment.y}-${index}`}
              style={{
                position: 'absolute',
                left: segment.x * CELL_SIZE,
                top: segment.y * CELL_SIZE,
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

          {/* Collection effect */}
          <AnimatePresence>
            {showCollect && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.5 }}
                transition={{ duration: 0.3 }}
              >
                <span className="text-4xl">✨</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Control hint */}
        <p className="mt-4 text-xs text-muted-foreground text-center">
          👆 Swipe to change direction • Tap relative to serpent head
        </p>

        {/* Stat bonus */}
        <p className="mt-1 text-xs text-muted-foreground">
          Body stat bonus: {Math.round(bodyBonus * 15)}% faster serpent
        </p>

        {/* CSS animations */}
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
            20%, 40%, 60%, 80% { transform: translateX(3px); }
          }
          .animate-shake { animation: shake 0.3s ease-in-out; }
        `}</style>
      </div>
    </GameStyleWrapper>
  );
};
