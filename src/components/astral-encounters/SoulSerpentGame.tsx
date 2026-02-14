import { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic } from './gameUtils';
import { GameStyleWrapper } from './GameStyles';

import { DamageEvent, GAME_DAMAGE_VALUES } from '@/types/battleSystem';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';

interface SoulSerpentGameProps {
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

// Difficulty config for speed adjustments
const DIFFICULTY_CONFIG: Record<ArcadeDifficulty, { baseSpeed: number }> = {
  beginner: { baseSpeed: 400 },
  easy: { baseSpeed: 320 },
  medium: { baseSpeed: 260 },
  hard: { baseSpeed: 200 },
  master: { baseSpeed: 160 },
};

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

const GRID_SIZE = 10;
const DEFAULT_CELL_SIZE = 28; // Default cell size
const CELL_SIZE = DEFAULT_CELL_SIZE; // Used by sub-components
const TRAIL_LIFETIME = 600;
const MAX_TRAIL_PARTICLES = 30;
const MIN_SWIPE_DISTANCE = 30;

// Dynamic cell size based on viewport height
const getCellSize = () => {
  if (typeof window === 'undefined') return 28;
  const vh = window.innerHeight;
  if (vh < 600) return 24;
  if (vh < 700) return 26;
  return 28;
};

// D-Pad button component
const DPadButton = memo(({ 
  direction, 
  onPress,
  disabled 
}: { 
  direction: Direction; 
  onPress: (dir: Direction) => void;
  disabled: boolean;
}) => {
  const icons: Record<Direction, typeof ArrowUp> = {
    up: ArrowUp,
    down: ArrowDown,
    left: ArrowLeft,
    right: ArrowRight,
  };
  const Icon = icons[direction];
  
  const positions: Record<Direction, string> = {
    up: 'top-0 left-1/2 -translate-x-1/2',
    down: 'bottom-0 left-1/2 -translate-x-1/2',
    left: 'left-0 top-1/2 -translate-y-1/2',
    right: 'right-0 top-1/2 -translate-y-1/2',
  };
  
  return (
    <button
      className={`absolute ${positions[direction]} w-12 h-12 rounded-lg 
        bg-primary/20 border border-primary/40 backdrop-blur-sm
        active:bg-primary/40 active:scale-95 transition-all
        flex items-center justify-center touch-manipulation
        ${disabled ? 'opacity-50' : ''}`}
      onTouchStart={(e) => {
        e.preventDefault();
        if (!disabled) onPress(direction);
      }}
      onClick={() => {
        if (!disabled) onPress(direction);
      }}
      disabled={disabled}
    >
      <Icon className="w-6 h-6 text-primary" />
    </button>
  );
});
DPadButton.displayName = 'DPadButton';

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
          <span className="text-xs text-primary">👆 Swipe or use D-Pad below</span>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
));
SwipeHint.displayName = 'SwipeHint';

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

// Check if two adjacent segments are on opposite sides (wrap-around)
const isWrapAround = (p1: { x: number; y: number }, p2: { x: number; y: number }): boolean => {
  const xDiff = Math.abs(p1.x - p2.x);
  const yDiff = Math.abs(p1.y - p2.y);
  // If difference is greater than 1 cell, it's a wrap
  return xDiff > CELL_SIZE * 1.5 || yDiff > CELL_SIZE * 1.5;
};

// Continuous serpent renderer using SVG with smooth interpolation
// Handles wrap-around by breaking the path into segments
const ContinuousSerpent = memo(({ 
  snake, 
  direction,
  interpolation = 0
}: { 
  snake: Position[]; 
  direction: Direction;
  interpolation?: number;
}) => {
  // Calculate interpolated positions for smooth movement
  const pathPoints = useMemo(() => {
    return snake.map((seg, index) => {
      let x = seg.x * CELL_SIZE + CELL_SIZE / 2;
      let y = seg.y * CELL_SIZE + CELL_SIZE / 2;
      
      // Only interpolate the head for smoother feel
      if (index === 0 && interpolation > 0) {
        const moveDistance = CELL_SIZE * interpolation;
        switch (direction) {
          case 'up': y -= moveDistance; break;
          case 'down': y += moveDistance; break;
          case 'left': x -= moveDistance; break;
          case 'right': x += moveDistance; break;
        }
      }
      
      return { x, y };
    });
  }, [snake, direction, interpolation]);

  // Split path into segments that don't cross the wrap boundary
  const pathSegments = useMemo(() => {
    if (pathPoints.length < 2) return [pathPoints];
    
    const segments: { x: number; y: number }[][] = [];
    let currentSegment: { x: number; y: number }[] = [pathPoints[0]];
    
    for (let i = 1; i < pathPoints.length; i++) {
      const prev = pathPoints[i - 1];
      const curr = pathPoints[i];
      
      // Check if this is a wrap-around (segments on opposite sides of grid)
      if (isWrapAround(prev, curr)) {
        // End current segment and start a new one
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
        }
        currentSegment = [curr];
      } else {
        currentSegment.push(curr);
      }
    }
    
    // Add the last segment
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    
    return segments;
  }, [pathPoints]);

  // Build smooth bezier curve path for a segment
  const buildPathD = (points: { x: number; y: number }[]): string => {
    if (points.length < 2) return '';
    
    let d = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      // Use quadratic bezier for smooth curves
      const midX = (prev.x + curr.x) / 2;
      const midY = (prev.y + curr.y) / 2;
      
      if (i === 1) {
        d += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
      } else {
        d += ` T ${midX} ${midY}`;
      }
    }
    
    // End at the last point
    const last = points[points.length - 1];
    d += ` L ${last.x} ${last.y}`;
    
    return d;
  };

  // Calculate eye positions based on direction
  const eyeOffset = useMemo(() => {
    const offset = CELL_SIZE / 4;
    switch (direction) {
      case 'up': return { left: { x: -offset, y: -offset / 2 }, right: { x: offset, y: -offset / 2 } };
      case 'down': return { left: { x: -offset, y: offset / 2 }, right: { x: offset, y: offset / 2 } };
      case 'left': return { left: { x: -offset / 2, y: -offset }, right: { x: -offset / 2, y: offset } };
      case 'right': return { left: { x: offset / 2, y: -offset }, right: { x: offset / 2, y: offset } };
    }
  }, [direction]);

  const gridSize = GRID_SIZE * CELL_SIZE;

  return (
    <svg 
      className="absolute inset-0 pointer-events-none" 
      width={gridSize} 
      height={gridSize}
      style={{ overflow: 'visible' }}
    >
      <defs>
        {/* Serpent body gradient */}
        <linearGradient id="serpentBodyGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="50%" stopColor="hsl(var(--accent))" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
        </linearGradient>
        
        {/* Head gradient */}
        <radialGradient id="serpentHeadGradient">
          <stop offset="0%" stopColor="hsl(var(--primary))" />
          <stop offset="70%" stopColor="hsl(var(--accent))" />
          <stop offset="100%" stopColor="hsl(var(--primary))" />
        </radialGradient>

        {/* Glow filter */}
        <filter id="serpentGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Render each path segment separately to handle wrap-around */}
      {pathSegments.map((segment, segIndex) => {
        if (segment.length < 2) {
          // Single point segment - render as a circle
          return (
            <circle
              key={`seg-${segIndex}`}
              cx={segment[0].x}
              cy={segment[0].y}
              r={(CELL_SIZE - 6) / 2}
              fill="url(#serpentBodyGradient)"
              filter="url(#serpentGlow)"
            />
          );
        }
        
        const pathD = buildPathD(segment);
        return (
          <g key={`seg-${segIndex}`}>
            {/* Body glow layer */}
            <path
              d={pathD}
              stroke="hsl(var(--primary) / 0.4)"
              strokeWidth={CELL_SIZE + 4}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              filter="url(#serpentGlow)"
            />

            {/* Main body */}
            <path
              d={pathD}
              stroke="url(#serpentBodyGradient)"
              strokeWidth={CELL_SIZE - 6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />

            {/* Scales pattern overlay */}
            <path
              d={pathD}
              stroke="hsl(var(--primary-foreground) / 0.15)"
              strokeWidth={CELL_SIZE - 10}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="4 8"
              fill="none"
            />
          </g>
        );
      })}

      {/* Head */}
      <motion.circle
        cx={pathPoints[0]?.x || 0}
        cy={pathPoints[0]?.y || 0}
        r={(CELL_SIZE / 2) + 2}
        fill="url(#serpentHeadGradient)"
        filter="url(#serpentGlow)"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 0.5, repeat: Infinity }}
      />

      {/* Left eye */}
      <circle
        cx={(pathPoints[0]?.x || 0) + eyeOffset.left.x}
        cy={(pathPoints[0]?.y || 0) + eyeOffset.left.y}
        r={4}
        fill="hsl(var(--background))"
      />
      <circle
        cx={(pathPoints[0]?.x || 0) + eyeOffset.left.x + 1}
        cy={(pathPoints[0]?.y || 0) + eyeOffset.left.y}
        r={2}
        fill="hsl(var(--foreground))"
      />

      {/* Right eye */}
      <circle
        cx={(pathPoints[0]?.x || 0) + eyeOffset.right.x}
        cy={(pathPoints[0]?.y || 0) + eyeOffset.right.y}
        r={4}
        fill="hsl(var(--background))"
      />
      <circle
        cx={(pathPoints[0]?.x || 0) + eyeOffset.right.x + 1}
        cy={(pathPoints[0]?.y || 0) + eyeOffset.right.y}
        r={2}
        fill="hsl(var(--foreground))"
      />
    </svg>
  );
});
ContinuousSerpent.displayName = 'ContinuousSerpent';

// Stardust component
const Stardust = memo(({ position }: { position: Position }) => (
  <motion.div
    className="absolute"
    style={{
      left: position.x * CELL_SIZE,
      top: position.y * CELL_SIZE,
      width: CELL_SIZE,
      height: CELL_SIZE,
    }}
  >
    <motion.div
      className="relative w-full h-full flex items-center justify-center"
      animate={{ 
        rotate: 360,
        scale: [0.9, 1.3, 0.9],
      }}
      transition={{ 
        rotate: { duration: 3, repeat: Infinity, ease: "linear" },
        scale: { duration: 1, repeat: Infinity }
      }}
    >
      <div 
        className="w-[90%] h-[90%] rounded-full"
        style={{ 
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
          boxShadow: '0 0 15px #fbbf24, 0 0 25px #fbbf24, 0 0 35px #fbbf24' 
        }}
      />
      <span className="absolute text-sm">✨</span>
    </motion.div>
  </motion.div>
));
Stardust.displayName = 'Stardust';

export const SoulSerpentGame = ({
  companionStats: _companionStats,
  onComplete,
  onDamage,
  tierAttackDamage = 15,
  difficulty = 'medium',
  questIntervalScale = 0,
  maxTimer: _maxTimer,
  isPractice = false,
  compact = false,
}: SoulSerpentGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [snake, setSnake] = useState<Position[]>([{ x: 5, y: 5 }]);
  const [direction, setDirection] = useState<Direction>('right');
  const [stardust, setStardust] = useState<Position>({ x: 7, y: 5 });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [shake, setShake] = useState(false);
  const [showCollect, setShowCollect] = useState(false);
  const [trailParticles, setTrailParticles] = useState<TrailParticle[]>([]);
  const [swipeIndicator, setSwipeIndicator] = useState<Direction | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [interpolation, setInterpolation] = useState(0); // 0 to 1 for smooth movement
  
  const trailCleanupRef = useRef<NodeJS.Timeout | null>(null);
  const directionRef = useRef<Direction>('right');
  const lastDirectionRef = useRef<Direction>('right'); // Track last applied direction
  const directionQueueRef = useRef<Direction[]>([]); // Queue for buffered inputs
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const particleIdRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Dynamic cell size based on viewport
  const cellSize = useMemo(() => getCellSize(), []);
  
  // Speed based on difficulty (slower for smoother feel)
  const diffConfig = DIFFICULTY_CONFIG[difficulty];
  const adjustedSpeed = diffConfig.baseSpeed * (1 - questIntervalScale * 0.1);
  const gameSpeed = Math.max(120, adjustedSpeed);

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

  // Calculate accuracy based on score achieved (endless mode) - binary win/lose
  const calculateAccuracy = useCallback((finalScore: number): { accuracy: number; result: 'perfect' | 'good' | 'fail' } => {
    // Score thresholds based on difficulty
    const thresholds: Record<ArcadeDifficulty, { fail: number; good: number; perfect: number }> = {
      beginner: { fail: 2, good: 4, perfect: 7 },
      easy: { fail: 3, good: 6, perfect: 10 },
      medium: { fail: 4, good: 8, perfect: 12 },
      hard: { fail: 5, good: 10, perfect: 15 },
      master: { fail: 6, good: 12, perfect: 18 },
    };
    
    const t = thresholds[difficulty];
    
    if (finalScore < t.fail) {
      return { accuracy: Math.round((finalScore / t.fail) * 40), result: 'fail' };
    } else if (finalScore < t.good) {
      return { accuracy: 50 + Math.round(((finalScore - t.fail) / (t.good - t.fail)) * 30), result: 'good' };
    } else if (finalScore < t.perfect) {
      return { accuracy: 80 + Math.round(((finalScore - t.good) / (t.perfect - t.good)) * 10), result: 'good' };
    } else {
      return { accuracy: Math.min(100, 90 + Math.round((finalScore - t.perfect) * 0.5)), result: 'perfect' };
    }
  }, [difficulty]);

  const moveSnake = useCallback(() => {
    if (gameState !== 'playing') return;

    // Process direction queue
    if (directionQueueRef.current.length > 0) {
      const nextDirection = directionQueueRef.current.shift()!;
      directionRef.current = nextDirection;
      lastDirectionRef.current = nextDirection;
      setDirection(nextDirection);
    }

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

      // Wrap-around walls
      if (newHead.x < 0) newHead.x = GRID_SIZE - 1;
      if (newHead.x >= GRID_SIZE) newHead.x = 0;
      if (newHead.y < 0) newHead.y = GRID_SIZE - 1;
      if (newHead.y >= GRID_SIZE) newHead.y = 0;

      // Self collision = game over (check against body, not including tail that will be removed)
      const bodyToCheck = prevSnake.slice(0, -1); // Exclude tail since it moves
      if (bodyToCheck.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
        setGameState('complete');
        triggerHaptic('error');
        setShake(true);
        setTimeout(() => setShake(false), 300);
        
        // Player takes tier-based collision damage (game ends)
        onDamage?.({ target: 'player', amount: tierAttackDamage, source: 'collision' });
        
        // Calculate result based on score achieved
        const { accuracy, result } = calculateAccuracy(score);
        
        onComplete({
          success: result !== 'fail',
          accuracy,
          result,
          highScoreValue: score,
          gameStats: {
            score,
          },
        });
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check stardust collection
      if (newHead.x === stardust.x && newHead.y === stardust.y) {
        const newScore = score + 1;
        
        // MILESTONE DAMAGE: Deal damage every 5 stardust collected (faster pacing)
        if (newScore > 0 && newScore % 5 === 0) {
          onDamage?.({ target: 'adversary', amount: GAME_DAMAGE_VALUES.soul_serpent.scoreMilestone, source: 'score_milestone' });
        }
        
        // Practice mode: end after collecting 5 stardust
        if (isPractice && newScore >= 5) {
          setScore(newScore);
          setGameState('complete');
          onComplete({ success: true, accuracy: 80, result: 'good', highScoreValue: newScore, gameStats: { score: newScore } });
          return newSnake;
        }
        
        setScore(s => {
          const updated = s + 1;
          if (updated > highScore) {
            setHighScore(updated);
          }
          return updated;
        });
        setStardust(spawnStardust(newSnake));
        setShowCollect(true);
        triggerHaptic('medium');
        setTimeout(() => setShowCollect(false), 300);
        return newSnake; // Grow snake
      }

      newSnake.pop(); // Remove tail if no food eaten
      return newSnake;
    });
    
    // Reset interpolation for smooth animation
    setInterpolation(0);
  }, [gameState, stardust, score, highScore, spawnStardust, onComplete, addTrailParticle, calculateAccuracy, onDamage, isPractice]);

  // Game loop with smooth interpolation
  useEffect(() => {
    if (gameState !== 'playing') return;
    
    let lastTime = performance.now();
    let accumulator = 0;
    
    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;
      accumulator += deltaTime;
      
      // Update interpolation for smooth visual movement
      const progress = Math.min(1, accumulator / gameSpeed);
      setInterpolation(progress);
      
      // Move snake at fixed intervals
      if (accumulator >= gameSpeed) {
        moveSnake();
        accumulator = 0;
      }
      
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };
    
    animationFrameRef.current = requestAnimationFrame(gameLoop);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState, moveSnake, gameSpeed]);

  // Handle direction changes with queue to prevent retreating
  const changeDirection = useCallback((newDirection: Direction) => {
    const opposites: Record<Direction, Direction> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };
    
    // Get the effective current direction (last in queue, or current if queue empty)
    const effectiveDirection = directionQueueRef.current.length > 0 
      ? directionQueueRef.current[directionQueueRef.current.length - 1] 
      : lastDirectionRef.current;
    
    // Don't allow reversing into yourself
    if (opposites[newDirection] === effectiveDirection) {
      return; // Block reverse direction
    }
    
    // Don't queue the same direction twice
    if (newDirection === effectiveDirection) {
      return;
    }
    
    // Add to queue (max 2 buffered inputs)
    if (directionQueueRef.current.length < 2) {
      directionQueueRef.current.push(newDirection);
    }
    
    triggerHaptic('light');
    
    setSwipeIndicator(newDirection);
    if (swipeTimeoutRef.current) {
      clearTimeout(swipeTimeoutRef.current);
    }
    swipeTimeoutRef.current = setTimeout(() => {
      setSwipeIndicator(null);
    }, 200);
    
    if (showSwipeHint) {
      setShowSwipeHint(false);
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

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (gameState !== 'playing') return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, [gameState]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (gameState !== 'playing' || !gameAreaRef.current || !touchStartRef.current) return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance >= MIN_SWIPE_DISTANCE) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        changeDirection(deltaX > 0 ? 'right' : 'left');
      } else {
        changeDirection(deltaY > 0 ? 'down' : 'up');
      }
    }
    
    touchStartRef.current = null;
  }, [gameState, changeDirection]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (gameState !== 'playing' || !gameAreaRef.current) return;
    
    const rect = gameAreaRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const head = snake[0];
    const headPixelX = head.x * cellSize + cellSize / 2;
    const headPixelY = head.y * cellSize + cellSize / 2;
    
    const deltaX = clickX - headPixelX;
    const deltaY = clickY - headPixelY;
    
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      changeDirection(deltaX > 0 ? 'right' : 'left');
    } else {
      changeDirection(deltaY > 0 ? 'down' : 'up');
    }
  }, [gameState, snake, changeDirection, cellSize]);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
  }, []);

  useEffect(() => {
    return () => {
      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  const gridPixelSize = GRID_SIZE * cellSize;

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
          title="Soul Serpent"
          subtitle="Survive as long as possible!"
          score={score}
          showCombo={true}
          combo={snake.length - 1}
          primaryStat={{ value: snake.length, label: 'Length', color: 'hsl(var(--primary))' }}
          isPaused={gameState === 'paused'}
          onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
          compact={compact}
        />


        {/* Game Grid */}
        <motion.div
          ref={gameAreaRef}
          className="relative rounded-xl overflow-hidden cursor-pointer select-none touch-none"
          style={{
            width: gridPixelSize,
            height: gridPixelSize,
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
              backgroundSize: `${cellSize}px ${cellSize}px`,
            }}
          />

          {/* Trail particles */}
          <AnimatePresence>
            {trailParticles.map(particle => (
              <TrailParticleComponent key={particle.id} particle={particle} />
            ))}
          </AnimatePresence>

          {/* Stardust */}
          <Stardust position={stardust} />

          {/* Continuous Serpent */}
          <ContinuousSerpent snake={snake} direction={direction} interpolation={interpolation} />

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

        {/* D-Pad Controls - Compact */}
        <div 
          className="relative mt-2"
          style={{ width: 140, height: 140 }}
        >
          <DPadButton direction="up" onPress={changeDirection} disabled={gameState !== 'playing'} />
          <DPadButton direction="down" onPress={changeDirection} disabled={gameState !== 'playing'} />
          <DPadButton direction="left" onPress={changeDirection} disabled={gameState !== 'playing'} />
          <DPadButton direction="right" onPress={changeDirection} disabled={gameState !== 'playing'} />
          
          {/* Center indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-muted/30 border border-border/30" />
        </div>

        {/* Control hint */}
        <p className="mt-2 text-xs text-muted-foreground text-center">
          Swipe or D-Pad • Walls wrap!
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
