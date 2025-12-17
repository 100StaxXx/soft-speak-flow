import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult } from '@/types/astralEncounters';
import { GameHUD, CountdownOverlay, PauseOverlay } from './GameHUD';
import { triggerHaptic, useStaticStars } from './gameUtils';

interface OrbMatchGameProps {
  companionStats: { mind: number; body: number; soul: number };
  onComplete: (result: MiniGameResult) => void;
  difficulty?: 'easy' | 'medium' | 'hard';
  questIntervalScale?: number;
}

type OrbColor = 'fire' | 'water' | 'earth' | 'light' | 'dark' | 'cosmic';
type SpecialType = 'normal' | 'line_bomb' | 'star' | 'cross_bomb';

interface Orb {
  id: string;
  color: OrbColor;
  row: number;
  col: number;
  matched?: boolean;
  special?: SpecialType;
  isNew?: boolean;
}

const GRID_ROWS = 5;
const GRID_COLS = 6;

// Pure function - check if grid has any match (moved outside component to avoid recreation)
const hasMatchInGrid = (grid: (Orb | null)[][]): boolean => {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS - 2; col++) {
      const o1 = grid[row][col], o2 = grid[row][col + 1], o3 = grid[row][col + 2];
      if (o1 && o2 && o3 && o1.color === o2.color && o2.color === o3.color) return true;
    }
  }
  for (let col = 0; col < GRID_COLS; col++) {
    for (let row = 0; row < GRID_ROWS - 2; row++) {
      const o1 = grid[row][col], o2 = grid[row + 1][col], o3 = grid[row + 2][col];
      if (o1 && o2 && o3 && o1.color === o2.color && o2.color === o3.color) return true;
    }
  }
  return false;
};

interface MatchExplosion {
  id: string;
  x: number;
  y: number;
  color: string;
  size: number;
  score: number;
}

interface SwapState {
  orb1: { id: string; row: number; col: number };
  orb2: { id: string; row: number; col: number };
}

// Color-blind accessible shapes for each orb type
const ORB_SHAPES: Record<OrbColor, string> = {
  fire: '●',    // Circle
  water: '◆',   // Diamond
  earth: '■',   // Square
  light: '★',   // Star
  dark: '▲',    // Triangle
  cosmic: '✦',  // 4-pointed star
};

// Premium orb color configurations
const ORB_COLORS: Record<OrbColor, { gradient: string; glow: string; inner: string; emoji: string }> = {
  fire: { 
    gradient: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 50%, #ff4757 100%)', 
    glow: 'rgba(255, 107, 107, 0.6)', 
    inner: 'rgba(255, 200, 150, 0.4)',
    emoji: '🔥' 
  },
  water: { 
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00cec9 50%, #0984e3 100%)', 
    glow: 'rgba(79, 172, 254, 0.6)', 
    inner: 'rgba(200, 240, 255, 0.4)',
    emoji: '💧' 
  },
  earth: { 
    gradient: 'linear-gradient(135deg, #00b894 0%, #55a630 50%, #2d6a4f 100%)', 
    glow: 'rgba(0, 184, 148, 0.6)', 
    inner: 'rgba(200, 255, 220, 0.4)',
    emoji: '🌿' 
  },
  light: { 
    gradient: 'linear-gradient(135deg, #ffd93d 0%, #ff9f1c 50%, #f9a825 100%)', 
    glow: 'rgba(255, 217, 61, 0.6)', 
    inner: 'rgba(255, 255, 220, 0.5)',
    emoji: '✨' 
  },
  dark: { 
    gradient: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 50%, #6366f1 100%)', 
    glow: 'rgba(168, 85, 247, 0.6)', 
    inner: 'rgba(220, 200, 255, 0.4)',
    emoji: '🌙' 
  },
  cosmic: { 
    gradient: 'linear-gradient(135deg, #f472b6 0%, #ec4899 50%, #e11d48 100%)', 
    glow: 'rgba(244, 114, 182, 0.6)', 
    inner: 'rgba(255, 200, 230, 0.4)',
    emoji: '💫' 
  },
};


// Star Background
const StarBackground = memo(({ stars, intensity }: { stars: ReturnType<typeof useStaticStars>; intensity?: number }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <div className="absolute inset-0">
      <div className="absolute top-0 left-0 w-32 h-32 bg-purple-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-pink-500/3 rounded-full blur-3xl" />
    </div>
    {stars.map(star => (
      <div
        key={star.id}
        className="absolute rounded-full bg-white gpu-accelerated"
        style={{
          width: star.size,
          height: star.size,
          left: `${star.x}%`,
          top: `${star.y}%`,
          opacity: star.opacity * (intensity || 0.7),
          animation: `twinkle ${star.animationDuration * (intensity ? 0.5 : 1)}s ease-in-out infinite`,
          animationDelay: `${star.animationDelay}s`,
        }}
      />
    ))}
  </div>
));
StarBackground.displayName = 'StarBackground';

// Match Explosion Effect
const MatchExplosionEffect = memo(({ explosion, onComplete }: { explosion: MatchExplosion; onComplete: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const particleCount = explosion.size >= 5 ? 16 : explosion.size >= 4 ? 12 : 8;

  return (
    <div 
      className="absolute pointer-events-none z-50"
      style={{ left: explosion.x, top: explosion.y, transform: 'translate(-50%, -50%)' }}
    >
      {/* Central burst ring */}
      <motion.div
        className="absolute rounded-full"
        style={{ 
          width: 60, 
          height: 60, 
          left: -30, 
          top: -30,
          border: `3px solid ${explosion.color}`,
          boxShadow: `0 0 20px ${explosion.color}`,
        }}
        initial={{ scale: 0, opacity: 1 }}
        animate={{ scale: 2.5, opacity: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      
      {/* Particles */}
      {Array.from({ length: particleCount }).map((_, i) => {
        const angle = (i / particleCount) * 360;
        const distance = 40 + Math.random() * 30;
        return (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full"
            style={{ 
              background: explosion.color,
              boxShadow: `0 0 8px ${explosion.color}`,
              left: -6,
              top: -6,
            }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ 
              x: Math.cos(angle * Math.PI / 180) * distance,
              y: Math.sin(angle * Math.PI / 180) * distance,
              scale: 0,
              opacity: 0,
            }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        );
      })}
      
      {/* Score popup */}
      <motion.div
        className="absolute text-lg font-black whitespace-nowrap"
        style={{ 
          color: explosion.color,
          textShadow: `0 0 10px ${explosion.color}, 0 2px 4px rgba(0,0,0,0.5)`,
          left: 0,
          top: 0,
        }}
        initial={{ y: 0, opacity: 1, scale: 1 }}
        animate={{ y: -50, opacity: 0, scale: 1.3 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        +{explosion.score}
      </motion.div>
    </div>
  );
});
MatchExplosionEffect.displayName = 'MatchExplosionEffect';

// Cascade Multiplier Display
const CascadeMultiplier = memo(({ multiplier }: { multiplier: number }) => (
  <motion.div
    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
    initial={{ scale: 0, opacity: 0 }}
    animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0] }}
    transition={{ duration: 0.8 }}
  >
    <span className="text-4xl font-black text-yellow-400" style={{ textShadow: '0 0 20px rgba(250,204,21,0.8)' }}>
      x{multiplier}!
    </span>
  </motion.div>
));
CascadeMultiplier.displayName = 'CascadeMultiplier';

// Hint Indicator
const HintIndicator = memo(({ orbs, cellSize }: { orbs: { row: number; col: number }[]; cellSize: number }) => (
  <>
    {orbs.map((pos, i) => (
      <motion.div
        key={i}
        className="absolute rounded-full pointer-events-none z-40"
        style={{
          width: cellSize - 12,
          height: cellSize - 12,
          left: pos.col * cellSize + 6,
          top: pos.row * cellSize + 6,
          border: '3px solid rgba(255, 215, 0, 0.8)',
          boxShadow: '0 0 15px rgba(255, 215, 0, 0.6), inset 0 0 10px rgba(255, 215, 0, 0.3)',
        }}
        animate={{ 
          scale: [1, 1.1, 1],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{ duration: 1, repeat: Infinity }}
      />
    ))}
  </>
));
HintIndicator.displayName = 'HintIndicator';

// Score Progress Ring
const ScoreProgressRing = memo(({ progress, isComplete }: { progress: number; isComplete: boolean }) => {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(1, progress));
  
  return (
    <svg className="absolute -right-1 -top-1" width="44" height="44" viewBox="0 0 44 44">
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="3"
      />
      <motion.circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke={isComplete ? '#22c55e' : '#a855f7'}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        animate={isComplete ? { 
          stroke: ['#22c55e', '#4ade80', '#22c55e'],
          filter: ['drop-shadow(0 0 4px #22c55e)', 'drop-shadow(0 0 8px #22c55e)', 'drop-shadow(0 0 4px #22c55e)'],
        } : {}}
        transition={{ duration: 1, repeat: isComplete ? Infinity : 0 }}
      />
    </svg>
  );
});
ScoreProgressRing.displayName = 'ScoreProgressRing';

// Urgency Overlay (last 5 seconds)
const UrgencyOverlay = memo(() => (
  <motion.div
    className="absolute inset-0 pointer-events-none z-30 rounded-2xl"
    style={{ 
      boxShadow: 'inset 0 0 40px rgba(239, 68, 68, 0.4)',
      border: '2px solid rgba(239, 68, 68, 0.5)',
    }}
    animate={{ 
      boxShadow: [
        'inset 0 0 40px rgba(239, 68, 68, 0.3)',
        'inset 0 0 60px rgba(239, 68, 68, 0.5)',
        'inset 0 0 40px rgba(239, 68, 68, 0.3)',
      ],
    }}
    transition={{ duration: 0.5, repeat: Infinity }}
  />
));
UrgencyOverlay.displayName = 'UrgencyOverlay';

// Perfect Game Banner
const PerfectGameBanner = memo(() => (
  <motion.div
    className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      className="px-8 py-4 rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, rgba(250,204,21,0.3) 0%, rgba(234,179,8,0.2) 100%)',
        border: '2px solid rgba(250,204,21,0.6)',
        boxShadow: '0 0 40px rgba(250,204,21,0.4)',
      }}
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <span className="text-2xl font-black text-yellow-400" style={{ textShadow: '0 0 20px rgba(250,204,21,0.8)' }}>
        ⭐ PERFECT! +50 BONUS ⭐
      </span>
    </motion.div>
  </motion.div>
));
PerfectGameBanner.displayName = 'PerfectGameBanner';

// Shuffle Animation
const ShuffleOverlay = memo(() => (
  <motion.div
    className="absolute inset-0 flex items-center justify-center z-50 bg-black/50 rounded-2xl"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 0.5, repeat: 2 }}
    >
      <span className="text-4xl">🔀</span>
    </motion.div>
    <span className="ml-3 text-lg font-bold text-white">Shuffling...</span>
  </motion.div>
));
ShuffleOverlay.displayName = 'ShuffleOverlay';

// Enhanced Orb Component with spring physics and special types
const OrbComponent = memo(({ 
  orb, 
  cellSize, 
  isSelected,
  isDragging,
  isInPath,
  isReverting,
  showAccessibility,
}: { 
  orb: Orb; 
  cellSize: number;
  isSelected: boolean;
  isDragging: boolean;
  isInPath: boolean;
  isReverting?: boolean;
  showAccessibility?: boolean;
}) => {
  const colorConfig = ORB_COLORS[orb.color];
  const orbSize = cellSize - 8;
  
  // Special orb indicators
  const specialBorder = orb.special === 'line_bomb' ? '3px dashed rgba(255,255,255,0.8)' 
    : orb.special === 'star' ? '3px solid gold'
    : orb.special === 'cross_bomb' ? '3px double rgba(255,255,255,0.8)'
    : '2px solid rgba(255,255,255,0.25)';
  
  const specialGlow = orb.special === 'line_bomb' ? ', 0 0 15px rgba(255,255,255,0.5)'
    : orb.special === 'star' ? ', 0 0 20px gold, 0 0 30px gold'
    : orb.special === 'cross_bomb' ? ', 0 0 15px rgba(255,255,255,0.6)'
    : '';
  
  return (
    <motion.div
      layout
      layoutId={orb.id}
      className={`absolute rounded-full flex items-center justify-center gpu-accelerated ${
        isSelected ? 'z-30' : isInPath ? 'z-20' : 'z-10'
      }`}
      style={{
        width: orbSize,
        height: orbSize,
        background: colorConfig.gradient,
        border: specialBorder,
      }}
      initial={orb.isNew ? { y: -cellSize * 3, opacity: 0 } : false}
      animate={{
        x: orb.col * cellSize + (cellSize - orbSize) / 2,
        y: orb.row * cellSize + (cellSize - orbSize) / 2,
        scale: orb.matched ? [1, 1.3, 0] : isSelected ? 1.18 : isInPath ? 1.1 : 1,
        opacity: orb.matched ? [1, 1, 0] : 1,
        rotate: isReverting ? [-5, 5, -5, 0] : isDragging && isSelected ? [-2, 2, -2, 2] : 0,
        boxShadow: isSelected || isInPath 
          ? `0 8px 25px rgba(0,0,0,0.4), 0 0 20px ${colorConfig.glow}, 0 0 40px ${colorConfig.glow}${specialGlow}` 
          : `0 4px 12px rgba(0,0,0,0.3), 0 0 15px ${colorConfig.glow}${specialGlow}`,
      }}
      transition={orb.matched ? { duration: 0.3 } : {
        type: 'spring',
        stiffness: orb.isNew ? 300 : 500,
        damping: orb.isNew ? 20 : 30,
        mass: 0.8,
      }}
    >
      {/* Inner highlight */}
      <div 
        className="absolute rounded-full pointer-events-none"
        style={{
          width: '60%',
          height: '60%',
          top: '10%',
          left: '20%',
          background: `radial-gradient(circle at 30% 30%, ${colorConfig.inner}, transparent 70%)`,
        }}
      />
      
      {/* Match flash */}
      {orb.matched && (
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: 'white' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.8, 0] }}
          transition={{ duration: 0.2 }}
        />
      )}
      
      {/* Emoji or accessibility shape */}
      <span className="text-base select-none relative z-10 drop-shadow-sm">
        {showAccessibility ? ORB_SHAPES[orb.color] : colorConfig.emoji}
      </span>
      
      {/* Special type indicator */}
      {orb.special === 'star' && (
        <motion.div
          className="absolute inset-[-3px] rounded-full pointer-events-none"
          style={{ border: '2px solid gold' }}
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}
      
      {/* Selection ring */}
      {(isSelected || isInPath) && (
        <motion.div 
          className="absolute inset-[-4px] rounded-full pointer-events-none"
          style={{ 
            border: `2px solid ${colorConfig.glow}`,
            boxShadow: `0 0 12px ${colorConfig.glow}`,
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.6, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
});
OrbComponent.displayName = 'OrbComponent';

// Main Game Component
export const OrbMatchGame = ({
  companionStats,
  onComplete,
  difficulty = 'medium',
  questIntervalScale = 0,
}: OrbMatchGameProps) => {
  const [gameState, setGameState] = useState<'countdown' | 'playing' | 'paused' | 'complete'>('countdown');
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [selectedOrb, setSelectedOrb] = useState<Orb | null>(null);
  const [dragPath, setDragPath] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [moveTimeLeft, setMoveTimeLeft] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [cascadeLevel, setCascadeLevel] = useState(0);
  const [showCascade, setShowCascade] = useState(false);
  const [explosions, setExplosions] = useState<MatchExplosion[]>([]);
  const [showComboPopup, setShowComboPopup] = useState<{ combo: number; x: number; y: number } | null>(null);
  const [hint, setHint] = useState<{ row: number; col: number }[] | null>(null);
  const [isShuffling, setIsShuffling] = useState(false);
  const [showPerfect, setShowPerfect] = useState(false);
  const [revertingOrbs, setRevertingOrbs] = useState<Set<string>>(new Set());
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [starIntensity, setStarIntensity] = useState(0.7);
  
  const gridRef = useRef<HTMLDivElement>(null);
  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hintTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const orbsRef = useRef<Orb[]>(orbs);
  const lastSwapRef = useRef<SwapState | null>(null);
  
  useEffect(() => {
    orbsRef.current = orbs;
  }, [orbs]);

  const stars = useStaticStars(15);
  const soulBonus = companionStats.soul / 100;

  const config = useMemo(() => {
    const settings = {
      easy: { colors: 5 as const, moveTime: 6, targetScore: 150, totalTime: 30 },
      medium: { colors: 5 as const, moveTime: 5, targetScore: 200, totalTime: 30 },
      hard: { colors: 6 as const, moveTime: 4, targetScore: 280, totalTime: 30 },
    };
    const s = settings[difficulty];
    return {
      ...s,
      moveTime: Math.max(3, s.moveTime - questIntervalScale * 0.5 + soulBonus * 1.5),
    };
  }, [difficulty, questIntervalScale, soulBonus]);

  const availableColors = useMemo((): OrbColor[] => {
    const allColors: OrbColor[] = ['fire', 'water', 'earth', 'light', 'dark', 'cosmic'];
    return allColors.slice(0, config.colors);
  }, [config.colors]);

  const cellSize = useMemo(() => 280 / GRID_COLS, []);

  // Find a valid move for hint system
  const findValidMove = useCallback((currentOrbs: Orb[]): { row: number; col: number }[] | null => {
    const grid: (Orb | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    currentOrbs.forEach(orb => { grid[orb.row][orb.col] = orb; });

    // Check each possible swap
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const orb = grid[row][col];
        if (!orb) continue;

        // Check right swap
        if (col < GRID_COLS - 1 && grid[row][col + 1]) {
          const testGrid = grid.map(r => [...r]);
          testGrid[row][col] = grid[row][col + 1];
          testGrid[row][col + 1] = orb;
          if (hasMatchInGrid(testGrid)) {
            return [{ row, col }, { row, col: col + 1 }];
          }
        }

        // Check down swap
        if (row < GRID_ROWS - 1 && grid[row + 1][col]) {
          const testGrid = grid.map(r => [...r]);
          testGrid[row][col] = grid[row + 1][col];
          testGrid[row + 1][col] = orb;
          if (hasMatchInGrid(testGrid)) {
            return [{ row, col }, { row: row + 1, col }];
          }
        }
      }
    }
    return null;
  }, []);


  // Shuffle board if no moves available
  const shuffleBoard = useCallback(() => {
    setIsShuffling(true);
    triggerHaptic('medium');
    
    setTimeout(() => {
      setOrbs(currentOrbs => {
        const colors = currentOrbs.map(o => o.color);
        // Fisher-Yates shuffle
        for (let i = colors.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [colors[i], colors[j]] = [colors[j], colors[i]];
        }
        return currentOrbs.map((orb, idx) => ({ ...orb, color: colors[idx] }));
      });
      setIsShuffling(false);
    }, 1000);
  }, []);

  // Initialize grid
  const initializeGrid = useCallback(() => {
    const newOrbs: Orb[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const colorIndex = Math.floor(Math.random() * availableColors.length);
        newOrbs.push({
          id: `${row}-${col}`,
          color: availableColors[colorIndex],
          row,
          col,
          special: 'normal',
        });
      }
    }
    setOrbs(newOrbs);
    orbsRef.current = newOrbs;
  }, [availableColors]);

  const startRound = useCallback(() => {
    initializeGrid();
    setMoveTimeLeft(config.moveTime);
    setSelectedOrb(null);
    setDragPath([]);
    setHint(null);
    isDraggingRef.current = false;
  }, [initializeGrid, config.moveTime]);

  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    setTimeLeft(config.totalTime);
    startRound();
  }, [config.totalTime, startRound]);

  // Reset hint timer on activity
  const resetHintTimer = useCallback(() => {
    setHint(null);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    
    hintTimerRef.current = setTimeout(() => {
      const validMove = findValidMove(orbsRef.current);
      if (validMove) {
        setHint(validMove);
        triggerHaptic('light');
      }
    }, 4000);
  }, [findValidMove]);

  // Find matches
  const findMatches = useCallback((currentOrbs: Orb[]): { matched: Set<string>; matchGroups: { ids: string[]; size: number; color: OrbColor; centerRow: number; centerCol: number }[] } => {
    const matchedIds = new Set<string>();
    const matchGroups: { ids: string[]; size: number; color: OrbColor; centerRow: number; centerCol: number }[] = [];
    
    const grid: (Orb | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    currentOrbs.forEach(orb => { grid[orb.row][orb.col] = orb; });

    // Find horizontal matches
    for (let row = 0; row < GRID_ROWS; row++) {
      let col = 0;
      while (col < GRID_COLS) {
        const startOrb = grid[row][col];
        if (!startOrb) { col++; continue; }
        
        let matchLength = 1;
        while (col + matchLength < GRID_COLS && grid[row][col + matchLength]?.color === startOrb.color) {
          matchLength++;
        }
        
        if (matchLength >= 3) {
          const group: string[] = [];
          for (let i = 0; i < matchLength; i++) {
            const orb = grid[row][col + i];
            if (orb) {
              matchedIds.add(orb.id);
              group.push(orb.id);
            }
          }
          matchGroups.push({
            ids: group,
            size: matchLength,
            color: startOrb.color,
            centerRow: row,
            centerCol: col + Math.floor(matchLength / 2),
          });
        }
        col += Math.max(1, matchLength);
      }
    }

    // Find vertical matches
    for (let col = 0; col < GRID_COLS; col++) {
      let row = 0;
      while (row < GRID_ROWS) {
        const startOrb = grid[row][col];
        if (!startOrb) { row++; continue; }
        
        let matchLength = 1;
        while (row + matchLength < GRID_ROWS && grid[row + matchLength][col]?.color === startOrb.color) {
          matchLength++;
        }
        
        if (matchLength >= 3) {
          const group: string[] = [];
          for (let i = 0; i < matchLength; i++) {
            const orb = grid[row + i][col];
            if (orb && !matchedIds.has(orb.id)) {
              group.push(orb.id);
            }
            if (orb) matchedIds.add(orb.id);
          }
          if (group.length > 0) {
            matchGroups.push({
              ids: group,
              size: matchLength,
              color: startOrb.color,
              centerRow: row + Math.floor(matchLength / 2),
              centerCol: col,
            });
          }
        }
        row += Math.max(1, matchLength);
      }
    }

    return { matched: matchedIds, matchGroups };
  }, []);

  // Drop and fill
  const dropAndFill = useCallback((currentOrbs: Orb[]): Orb[] => {
    const grid: (Orb | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    currentOrbs.forEach(orb => {
      if (!orb.matched) grid[orb.row][orb.col] = orb;
    });

    for (let col = 0; col < GRID_COLS; col++) {
      let emptyRow = GRID_ROWS - 1;
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (grid[row][col]) {
          if (row !== emptyRow) {
            grid[emptyRow][col] = grid[row][col];
            grid[row][col] = null;
          }
          emptyRow--;
        }
      }
      
      for (let row = emptyRow; row >= 0; row--) {
        const colorIndex = Math.floor(Math.random() * availableColors.length);
        grid[row][col] = {
          id: `${row}-${col}-${Date.now()}-${Math.random()}`,
          color: availableColors[colorIndex],
          row,
          col,
          special: 'normal',
          isNew: true,
        };
      }
    }

    const newOrbs: Orb[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const orb = grid[row][col];
        if (orb) newOrbs.push({ ...orb, row, col });
      }
    }

    return newOrbs;
  }, [availableColors]);

  // Revert swap animation
  const revertSwap = useCallback((swap: SwapState) => {
    triggerHaptic('error');
    setRevertingOrbs(new Set([swap.orb1.id, swap.orb2.id]));
    
    setOrbs(currentOrbs => {
      return currentOrbs.map(orb => {
        if (orb.id === swap.orb1.id) return { ...orb, row: swap.orb1.row, col: swap.orb1.col };
        if (orb.id === swap.orb2.id) return { ...orb, row: swap.orb2.row, col: swap.orb2.col };
        return orb;
      });
    });
    
    setTimeout(() => setRevertingOrbs(new Set()), 300);
  }, []);

  // Process matches
  const processMatches = useCallback(async (currentOrbs: Orb[]): Promise<number> => {
    let orbsToProcess = currentOrbs;
    let currentCascade = 0;
    let totalScore = 0;

    const processNextCascade = async (): Promise<void> => {
      const { matched, matchGroups } = findMatches(orbsToProcess);
      
      if (matched.size >= 3) {
        currentCascade++;
        setCascadeLevel(currentCascade);
        
        if (currentCascade > 1) {
          setShowCascade(true);
          setTimeout(() => setShowCascade(false), 800);
        }
        
        // Create special orbs for 4+ matches
        const specialOrbs: { id: string; special: SpecialType }[] = [];
        matchGroups.forEach(group => {
          if (group.size >= 5) {
            // Star orb (clears all of that color)
            specialOrbs.push({ id: `special-${Date.now()}-${Math.random()}`, special: 'star' });
          } else if (group.size === 4) {
            // Line bomb (clears row or column)
            specialOrbs.push({ id: `special-${Date.now()}-${Math.random()}`, special: 'line_bomb' });
          }
        });
        
        // Create explosions
        const newExplosions: MatchExplosion[] = matchGroups.map(group => {
          const baseScore = group.size * 10;
          const cascadeMultiplier = 1 + (currentCascade - 1) * 0.5;
          const groupScore = Math.round(baseScore * cascadeMultiplier);
          totalScore += groupScore;
          
          return {
            id: `exp-${Date.now()}-${Math.random()}`,
            x: group.centerCol * cellSize + cellSize / 2,
            y: group.centerRow * cellSize + cellSize / 2,
            color: ORB_COLORS[group.color].glow,
            size: group.size,
            score: groupScore,
          };
        });
        
        setExplosions(prev => [...prev, ...newExplosions]);
        
        // Mark as matched
        orbsToProcess = orbsToProcess.map(orb => 
          matched.has(orb.id) ? { ...orb, matched: true } : orb
        );
        setOrbs([...orbsToProcess]);
        orbsRef.current = [...orbsToProcess];
        
        // Screen shake for big matches
        if (matched.size >= 5) {
          triggerHaptic('heavy');
          setStarIntensity(1.2);
          setTimeout(() => setStarIntensity(0.7), 300);
        } else {
          triggerHaptic('success');
        }
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 350));
        
        // Drop and fill
        orbsToProcess = dropAndFill(orbsToProcess);
        setOrbs([...orbsToProcess]);
        orbsRef.current = [...orbsToProcess];
        
        // Wait and check for cascades
        await new Promise(resolve => setTimeout(resolve, 250));
        await processNextCascade();
      }
    };

    await processNextCascade();

    if (currentCascade > 0) {
      setScore(s => s + totalScore);
      setCombo(c => {
        const newCombo = c + currentCascade;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
      
      if (currentCascade > 1) {
        setShowComboPopup({ combo: currentCascade, x: 50, y: 50 });
        setTimeout(() => setShowComboPopup(null), 800);
      }
      
      setMoveTimeLeft(config.moveTime);
      resetHintTimer();
      
      // Check for no moves after settling
      setTimeout(() => {
        const validMove = findValidMove(orbsRef.current);
        if (!validMove && gameState === 'playing') {
          shuffleBoard();
        }
      }, 300);
    }

    setCascadeLevel(0);
    return currentCascade;
  }, [findMatches, dropAndFill, config.moveTime, cellSize, resetHintTimer, findValidMove, gameState, shuffleBoard]);

  const getCellFromPosition = useCallback((clientX: number, clientY: number): { row: number; col: number } | null => {
    if (!gridRef.current) return null;
    
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const col = Math.floor(x / (rect.width / GRID_COLS));
    const row = Math.floor(y / (rect.height / GRID_ROWS));
    
    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
      return { row, col };
    }
    return null;
  }, []);

  const swapOrbs = useCallback((orb1: Orb, orb2: Orb) => {
    // Store original positions for potential revert
    lastSwapRef.current = {
      orb1: { id: orb1.id, row: orb1.row, col: orb1.col },
      orb2: { id: orb2.id, row: orb2.row, col: orb2.col },
    };
    
    setOrbs(currentOrbs => {
      const newOrbs = currentOrbs.map(orb => {
        if (orb.id === orb1.id) return { ...orb, row: orb2.row, col: orb2.col };
        if (orb.id === orb2.id) return { ...orb, row: orb1.row, col: orb1.col };
        return orb;
      });
      orbsRef.current = newOrbs;
      return newOrbs;
    });
  }, []);

  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (gameState !== 'playing' || moveTimeLeft <= 0 || isShuffling) return;
    
    const cell = getCellFromPosition(clientX, clientY);
    if (!cell) return;
    
    const orb = orbs.find(o => o.row === cell.row && o.col === cell.col);
    if (orb) {
      setSelectedOrb(orb);
      setDragPath([orb.id]);
      isDraggingRef.current = true;
      triggerHaptic('light');
      setHint(null);
    }
  }, [gameState, moveTimeLeft, isShuffling, getCellFromPosition, orbs]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current || !selectedOrb || gameState !== 'playing') return;
    
    const cell = getCellFromPosition(clientX, clientY);
    if (!cell) return;
    
    const currentOrb = orbs.find(o => o.id === selectedOrb.id);
    if (!currentOrb) return;
    
    const rowDiff = Math.abs(cell.row - currentOrb.row);
    const colDiff = Math.abs(cell.col - currentOrb.col);
    
    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      const targetOrb = orbs.find(o => o.row === cell.row && o.col === cell.col);
      if (targetOrb && targetOrb.id !== selectedOrb.id) {
        swapOrbs(currentOrb, targetOrb);
        setDragPath(prev => [...prev, targetOrb.id]);
        triggerHaptic('light');
        setSelectedOrb({ ...currentOrb, row: cell.row, col: cell.col });
      }
    }
  }, [selectedOrb, gameState, getCellFromPosition, orbs, swapOrbs]);

  const handleDragEnd = useCallback(async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    
    if (dragPath.length > 1) {
      if (moveTimerRef.current) {
        clearInterval(moveTimerRef.current);
        moveTimerRef.current = null;
      }
      
      const currentOrbs = orbsRef.current;
      const matchCount = await processMatches(currentOrbs);
      
      // Revert if no matches
      if (matchCount === 0 && lastSwapRef.current) {
        revertSwap(lastSwapRef.current);
      }
      
      lastSwapRef.current = null;
    }
    
    setSelectedOrb(null);
    setDragPath([]);
    resetHintTimer();
  }, [dragPath, processMatches, revertSwap, resetHintTimer]);

  // Event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => handleDragStart(e.clientX, e.clientY), [handleDragStart]);
  const handleMouseMove = useCallback((e: React.MouseEvent) => handleDragMove(e.clientX, e.clientY), [handleDragMove]);
  const handleMouseUp = useCallback(() => handleDragEnd(), [handleDragEnd]);
  const handleTouchStart = useCallback((e: React.TouchEvent) => { e.preventDefault(); handleDragStart(e.touches[0].clientX, e.touches[0].clientY); }, [handleDragStart]);
  const handleTouchMove = useCallback((e: React.TouchEvent) => { e.preventDefault(); handleDragMove(e.touches[0].clientX, e.touches[0].clientY); }, [handleDragMove]);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => { e.preventDefault(); handleDragEnd(); }, [handleDragEnd]);

  // Move timer
  useEffect(() => {
    if (gameState !== 'playing' || moveTimeLeft <= 0) return;
    
    moveTimerRef.current = setInterval(() => {
      setMoveTimeLeft(prev => {
        if (prev <= 0.1) {
          if (isDraggingRef.current) handleDragEnd();
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => { if (moveTimerRef.current) clearInterval(moveTimerRef.current); };
  }, [gameState, moveTimeLeft, handleDragEnd]);

  // Game timer
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

  // Start hint timer when playing
  useEffect(() => {
    if (gameState === 'playing') {
      resetHintTimer();
    }
    return () => { if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
  }, [gameState, resetHintTimer]);

  // Check for perfect game and completion
  useEffect(() => {
    if (gameState === 'complete') {
      const isPerfect = score >= config.targetScore && timeLeft > 5;
      const finalScore = isPerfect ? score + 50 : score;
      
      if (isPerfect) {
        setShowPerfect(true);
        triggerHaptic('heavy');
      }
      
      const passed = finalScore >= config.targetScore;
      const comboBonus = Math.min(maxCombo * 2, 15);
      const accuracy = passed 
        ? Math.round(Math.min(100, 70 + ((finalScore - config.targetScore) / config.targetScore) * 30 + comboBonus))
        : Math.round(Math.min(50, (finalScore / config.targetScore) * 50));
      
      const result = passed && accuracy >= 90 ? 'perfect' : passed && accuracy >= 70 ? 'good' : passed ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({ success: passed, accuracy, result });
      }, isPerfect ? 1500 : 500);
    }
  }, [gameState, score, config.targetScore, maxCombo, timeLeft, onComplete]);

  // Remove explosions after animation
  const removeExplosion = useCallback((id: string) => {
    setExplosions(prev => prev.filter(e => e.id !== id));
  }, []);

  const scoreProgress = score / config.targetScore;
  const isUrgent = timeLeft <= 5 && gameState === 'playing';

  return (
    <div className="flex flex-col items-center relative">
      {gameState === 'countdown' && <CountdownOverlay count={3} onComplete={handleCountdownComplete} />}
      
      <AnimatePresence>
        {gameState === 'paused' && <PauseOverlay onResume={() => setGameState('playing')} />}
      </AnimatePresence>

      <GameHUD
        title="Orb Match"
        subtitle={`Target: ${config.targetScore} pts`}
        timeLeft={timeLeft}
        totalTime={config.totalTime}
        combo={combo}
        showCombo={true}
        primaryStat={{ 
          value: score, 
          label: `${score}/${config.targetScore}`, 
          color: score >= config.targetScore ? '#22c55e' : '#a855f7' 
        }}
        secondaryStat={{ 
          value: Math.round(scoreProgress * 100), 
          label: `${Math.min(100, Math.round(scoreProgress * 100))}%`, 
          color: '#22d3ee' 
        }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Score progress ring */}
      <div className="relative w-full max-w-xs mb-2">
        <div className="absolute right-0 top-0">
          <ScoreProgressRing progress={scoreProgress} isComplete={score >= config.targetScore} />
        </div>
        
        {/* Move timer bar */}
        {gameState === 'playing' && (
          <div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full"
                style={{ 
                  width: `${(moveTimeLeft / config.moveTime) * 100}%`,
                  background: moveTimeLeft < 2 
                    ? 'linear-gradient(90deg, #ef4444, #f87171)' 
                    : 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
                }}
                animate={moveTimeLeft < 2 ? { opacity: [1, 0.5, 1] } : {}}
                transition={{ duration: 0.3, repeat: moveTimeLeft < 2 ? Infinity : 0 }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-1">
              Move: {moveTimeLeft.toFixed(1)}s
            </p>
          </div>
        )}
      </div>

      {/* Accessibility toggle */}
      <button 
        className="text-xs text-muted-foreground mb-2 underline"
        onClick={() => setShowAccessibility(!showAccessibility)}
      >
        {showAccessibility ? 'Show Emojis' : 'Show Shapes (Accessibility)'}
      </button>

      {/* Game area */}
      <div
        ref={gridRef}
        className="relative w-full max-w-xs rounded-2xl overflow-hidden cursor-pointer touch-none game-container"
        style={{ aspectRatio: `${GRID_COLS}/${GRID_ROWS}`, maxWidth: 300 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <StarBackground stars={stars} intensity={starIntensity} />

        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: GRID_ROWS + 1 }).map((_, i) => (
            <div key={`h-${i}`} className="absolute left-0 right-0" style={{ 
              top: `${(i / GRID_ROWS) * 100}%`, height: 1,
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
            }} />
          ))}
          {Array.from({ length: GRID_COLS + 1 }).map((_, i) => (
            <div key={`v-${i}`} className="absolute top-0 bottom-0" style={{ 
              left: `${(i / GRID_COLS) * 100}%`, width: 1,
              background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
            }} />
          ))}
        </div>

        {/* Hint indicators */}
        {hint && <HintIndicator orbs={hint} cellSize={cellSize} />}

        {/* Orbs */}
        <AnimatePresence>
          {orbs.map(orb => (
            <OrbComponent
              key={orb.id}
              orb={orb}
              cellSize={cellSize}
              isSelected={selectedOrb?.id === orb.id}
              isDragging={isDraggingRef.current}
              isInPath={dragPath.includes(orb.id)}
              isReverting={revertingOrbs.has(orb.id)}
              showAccessibility={showAccessibility}
            />
          ))}
        </AnimatePresence>

        {/* Match explosions */}
        {explosions.map(explosion => (
          <MatchExplosionEffect 
            key={explosion.id} 
            explosion={explosion} 
            onComplete={() => removeExplosion(explosion.id)} 
          />
        ))}

        {/* Cascade multiplier */}
        <AnimatePresence>
          {showCascade && cascadeLevel > 1 && <CascadeMultiplier multiplier={cascadeLevel} />}
        </AnimatePresence>

        {/* Combo popup */}
        <AnimatePresence>
          {showComboPopup && (
            <motion.div
              className="absolute z-50 pointer-events-none px-4 py-2 rounded-full combo-badge"
              style={{ left: `${showComboPopup.x}%`, top: `${showComboPopup.y}%`, transform: 'translate(-50%, -50%)' }}
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, y: -40, scale: 1.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
            >
              <span className="font-black text-lg text-yellow-400">🔥 {showComboPopup.combo}x COMBO!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Urgency overlay */}
        {isUrgent && <UrgencyOverlay />}

        {/* Shuffle overlay */}
        <AnimatePresence>
          {isShuffling && <ShuffleOverlay />}
        </AnimatePresence>

        {/* Perfect game banner */}
        <AnimatePresence>
          {showPerfect && <PerfectGameBanner />}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs">
        {availableColors.slice(0, 4).map(color => (
          <div key={color} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
            <span className="text-sm">{showAccessibility ? ORB_SHAPES[color] : ORB_COLORS[color].emoji}</span>
            <span className="capitalize text-white/60 font-medium">{color}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-white/40 mt-3 text-center font-medium">
        Drag to swap • Match 3+ • Chain combos for bonus!
      </p>

      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 0.9; transform: scale(1.1); }
        }
        .gpu-accelerated {
          transform: translateZ(0);
          backface-visibility: hidden;
          will-change: transform, opacity;
        }
        .game-container {
          background: linear-gradient(145deg, rgba(0,0,0,0.85) 0%, rgba(15,15,35,0.95) 50%, rgba(25,15,45,0.9) 100%);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
        }
        .combo-badge {
          background: linear-gradient(135deg, rgba(250,204,21,0.2) 0%, rgba(251,191,36,0.1) 100%);
          border: 1px solid rgba(250,204,21,0.4);
          box-shadow: 0 0 20px rgba(250,204,21,0.3);
        }
      `}</style>
    </div>
  );
};
