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

interface Orb {
  id: string;
  color: OrbColor;
  row: number;
  col: number;
  matched?: boolean;
}

// Premium orb color configurations with refined gradients
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

const GRID_ROWS = 5;
const GRID_COLS = 6;

// Premium star background with refined animation
const StarBackground = memo(({ stars }: { stars: ReturnType<typeof useStaticStars> }) => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Nebula gradients */}
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
          opacity: star.opacity * 0.7,
          animation: `twinkle ${star.animationDuration}s ease-in-out infinite`,
          animationDelay: `${star.animationDelay}s`,
        }}
      />
    ))}
  </div>
));
StarBackground.displayName = 'StarBackground';

// Premium orb component with refined visuals
const OrbComponent = memo(({ 
  orb, 
  cellSize, 
  isSelected,
  isDragging,
  isInPath,
}: { 
  orb: Orb; 
  cellSize: number;
  isSelected: boolean;
  isDragging: boolean;
  isInPath: boolean;
}) => {
  const colorConfig = ORB_COLORS[orb.color];
  const orbSize = cellSize - 8;
  
  return (
    <motion.div
      className={`absolute rounded-full flex items-center justify-center gpu-accelerated ${
        isSelected ? 'z-30' : isInPath ? 'z-20' : 'z-10'
      }`}
      style={{
        width: orbSize,
        height: orbSize,
        left: orb.col * cellSize + (cellSize - orbSize) / 2,
        top: orb.row * cellSize + (cellSize - orbSize) / 2,
        background: colorConfig.gradient,
        boxShadow: isSelected || isInPath 
          ? `0 0 20px ${colorConfig.glow}, 0 0 40px ${colorConfig.glow}, inset 0 2px 4px rgba(255,255,255,0.3)` 
          : `0 4px 12px rgba(0,0,0,0.3), 0 0 15px ${colorConfig.glow}, inset 0 2px 4px rgba(255,255,255,0.2)`,
        transition: isDragging ? 'none' : 'all 0.12s cubic-bezier(0.4, 0, 0.2, 1)',
        border: '2px solid rgba(255,255,255,0.25)',
      }}
      animate={{
        scale: orb.matched ? 0 : isSelected ? 1.18 : isInPath ? 1.1 : 1,
        opacity: orb.matched ? 0 : 1,
      }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
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
      
      {/* Emoji */}
      <span className="text-base select-none relative z-10 drop-shadow-sm">{colorConfig.emoji}</span>
      
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
  const [totalMatches, setTotalMatches] = useState(0);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [showComboPopup, setShowComboPopup] = useState<{ combo: number; x: number; y: number } | null>(null);
  
  const gridRef = useRef<HTMLDivElement>(null);
  const moveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const orbsRef = useRef<Orb[]>(orbs);
  
  // Keep orbsRef in sync with orbs state
  useEffect(() => {
    orbsRef.current = orbs;
  }, [orbs]);

  // Static stars - only calculated once
  const stars = useStaticStars(15);

  // Soul stat bonus - extends move time
  const soulBonus = companionStats.soul / 100;

  // Difficulty config
  const config = useMemo(() => {
    const settings = {
      easy: { colors: 5 as const, moveTime: 6, rounds: 2, targetScore: 150 },
      medium: { colors: 5 as const, moveTime: 5, rounds: 2, targetScore: 200 },
      hard: { colors: 6 as const, moveTime: 4, rounds: 3, targetScore: 280 },
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
        });
      }
    }
    setOrbs(newOrbs);
    orbsRef.current = newOrbs;
  }, [availableColors]);

  // Start a new round
  const startRound = useCallback(() => {
    initializeGrid();
    setMoveTimeLeft(config.moveTime);
    setSelectedOrb(null);
    setDragPath([]);
    isDraggingRef.current = false;
  }, [initializeGrid, config.moveTime]);

  // Handle countdown complete
  const handleCountdownComplete = useCallback(() => {
    setGameState('playing');
    setTimeLeft(config.rounds * 8); // Total game time
    startRound();
  }, [config.rounds, startRound]);

  // Find matches in the grid
  const findMatches = useCallback((currentOrbs: Orb[]): Set<string> => {
    const matchedIds = new Set<string>();
    
    // Create grid map
    const grid: (Orb | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    currentOrbs.forEach(orb => {
      grid[orb.row][orb.col] = orb;
    });

    // Check horizontal matches
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS - 2; col++) {
        const orb1 = grid[row][col];
        const orb2 = grid[row][col + 1];
        const orb3 = grid[row][col + 2];
        
        if (orb1 && orb2 && orb3 && orb1.color === orb2.color && orb2.color === orb3.color) {
          matchedIds.add(orb1.id);
          matchedIds.add(orb2.id);
          matchedIds.add(orb3.id);
          
          // Check for 4+ match
          if (col + 3 < GRID_COLS) {
            const orb4 = grid[row][col + 3];
            if (orb4 && orb4.color === orb1.color) {
              matchedIds.add(orb4.id);
              if (col + 4 < GRID_COLS) {
                const orb5 = grid[row][col + 4];
                if (orb5 && orb5.color === orb1.color) matchedIds.add(orb5.id);
              }
            }
          }
        }
      }
    }

    // Check vertical matches
    for (let col = 0; col < GRID_COLS; col++) {
      for (let row = 0; row < GRID_ROWS - 2; row++) {
        const orb1 = grid[row][col];
        const orb2 = grid[row + 1][col];
        const orb3 = grid[row + 2][col];
        
        if (orb1 && orb2 && orb3 && orb1.color === orb2.color && orb2.color === orb3.color) {
          matchedIds.add(orb1.id);
          matchedIds.add(orb2.id);
          matchedIds.add(orb3.id);
          
          // Check for 4+ match
          if (row + 3 < GRID_ROWS) {
            const orb4 = grid[row + 3][col];
            if (orb4 && orb4.color === orb1.color) {
              matchedIds.add(orb4.id);
              if (row + 4 < GRID_ROWS) {
                const orb5 = grid[row + 4][col];
                if (orb5 && orb5.color === orb1.color) matchedIds.add(orb5.id);
              }
            }
          }
        }
      }
    }

    return matchedIds;
  }, []);

  // Drop orbs and fill gaps
  const dropAndFill = useCallback((currentOrbs: Orb[]): Orb[] => {
    // Create grid
    const grid: (Orb | null)[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(null));
    currentOrbs.forEach(orb => {
      if (!orb.matched) {
        grid[orb.row][orb.col] = orb;
      }
    });

    // Drop orbs down
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
      
      // Fill empty spots at top
      for (let row = emptyRow; row >= 0; row--) {
        const colorIndex = Math.floor(Math.random() * availableColors.length);
        grid[row][col] = {
          id: `${row}-${col}-${Date.now()}-${Math.random()}`,
          color: availableColors[colorIndex],
          row,
          col,
        };
      }
    }

    // Convert back to array with updated positions
    const newOrbs: Orb[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const orb = grid[row][col];
        if (orb) {
          newOrbs.push({ ...orb, row, col });
        }
      }
    }

    return newOrbs;
  }, [availableColors]);

  // Process matches after a move
  const processMatches = useCallback(async (currentOrbs: Orb[]) => {
    let orbsToProcess = currentOrbs;
    let currentCombo = 0;
    let totalMatchedThisMove = 0;

    const processNextCombo = async () => {
      const matchedIds = findMatches(orbsToProcess);
      
      if (matchedIds.size >= 3) {
        currentCombo++;
        totalMatchedThisMove += matchedIds.size;
        
        // Mark as matched
        orbsToProcess = orbsToProcess.map(orb => 
          matchedIds.has(orb.id) ? { ...orb, matched: true } : orb
        );
        setOrbs([...orbsToProcess]);
        orbsRef.current = [...orbsToProcess];
        triggerHaptic('success');
        
        // Show combo popup
        if (currentCombo > 1) {
          setShowComboPopup({ combo: currentCombo, x: 50, y: 50 });
          setTimeout(() => setShowComboPopup(null), 800);
        }
        
        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Drop and fill
        orbsToProcess = dropAndFill(orbsToProcess);
        setOrbs([...orbsToProcess]);
        orbsRef.current = [...orbsToProcess];
        
        // Wait and check for more combos
        await new Promise(resolve => setTimeout(resolve, 200));
        await processNextCombo();
      }
    };

    await processNextCombo();

    if (currentCombo > 0) {
      const baseScore = totalMatchedThisMove * 10;
      const comboMultiplier = 1 + (currentCombo - 1) * 0.5;
      const moveScore = Math.round(baseScore * comboMultiplier);
      
      setScore(s => s + moveScore);
      setTotalMatches(t => t + currentCombo);
      setCombo(c => {
        const newCombo = c + currentCombo;
        setMaxCombo(m => Math.max(m, newCombo));
        return newCombo;
      });
    }

    return currentCombo;
  }, [findMatches, dropAndFill]);

  // Get cell from touch/mouse position
  const getCellFromPosition = useCallback((clientX: number, clientY: number): { row: number; col: number } | null => {
    if (!gridRef.current) return null;
    
    const rect = gridRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const cellSize = rect.width / GRID_COLS;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    
    if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
      return { row, col };
    }
    return null;
  }, []);

  // Swap orbs
  const swapOrbs = useCallback((orb1: Orb, orb2: Orb) => {
    setOrbs(currentOrbs => {
      const newOrbs = currentOrbs.map(orb => {
        if (orb.id === orb1.id) {
          return { ...orb, row: orb2.row, col: orb2.col };
        }
        if (orb.id === orb2.id) {
          return { ...orb, row: orb1.row, col: orb1.col };
        }
        return orb;
      });
      // Sync ref immediately for accurate match detection
      orbsRef.current = newOrbs;
      return newOrbs;
    });
  }, []);

  // Handle drag start
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    if (gameState !== 'playing' || moveTimeLeft <= 0) return;
    
    const cell = getCellFromPosition(clientX, clientY);
    if (!cell) return;
    
    const orb = orbs.find(o => o.row === cell.row && o.col === cell.col);
    if (orb) {
      setSelectedOrb(orb);
      setDragPath([orb.id]);
      isDraggingRef.current = true;
      triggerHaptic('light');
    }
  }, [gameState, moveTimeLeft, getCellFromPosition, orbs]);

  // Handle drag move
  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current || !selectedOrb || gameState !== 'playing') return;
    
    const cell = getCellFromPosition(clientX, clientY);
    if (!cell) return;
    
    const currentOrb = orbs.find(o => o.id === selectedOrb.id);
    if (!currentOrb) return;
    
    // Check if adjacent
    const rowDiff = Math.abs(cell.row - currentOrb.row);
    const colDiff = Math.abs(cell.col - currentOrb.col);
    
    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      const targetOrb = orbs.find(o => o.row === cell.row && o.col === cell.col);
      if (targetOrb && targetOrb.id !== selectedOrb.id) {
        swapOrbs(currentOrb, targetOrb);
        setDragPath(prev => [...prev, targetOrb.id]);
        triggerHaptic('light');
        
        // Update selected orb position
        setSelectedOrb({ ...currentOrb, row: cell.row, col: cell.col });
      }
    }
  }, [selectedOrb, gameState, getCellFromPosition, orbs, swapOrbs]);

  // Handle drag end
  const handleDragEnd = useCallback(async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    
    if (dragPath.length > 1) {
      // Stop move timer
      if (moveTimerRef.current) {
        clearInterval(moveTimerRef.current);
        moveTimerRef.current = null;
      }
      
      // Use ref to get latest orbs state (avoids stale closure)
      const currentOrbs = orbsRef.current;
      
      // Process matches with latest orbs
      await processMatches(currentOrbs);
      
      // Check if round complete or start new move timer
      setRoundsCompleted(r => {
        const newRounds = r + 1;
        if (newRounds >= config.rounds) {
          setTimeout(() => setGameState('complete'), 500);
        } else {
          // Start new round after delay
          setTimeout(() => {
            setMoveTimeLeft(config.moveTime);
          }, 500);
        }
        return newRounds;
      });
    }
    
    setSelectedOrb(null);
    setDragPath([]);
  }, [dragPath, processMatches, config.rounds, config.moveTime]);

  // Mouse/touch event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    handleDragMove(e.clientX, e.clientY);
  }, [handleDragMove]);

  const handleMouseUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
  }, [handleDragStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
  }, [handleDragMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    handleDragEnd();
  }, [handleDragEnd]);

  // Move timer
  useEffect(() => {
    if (gameState !== 'playing' || moveTimeLeft <= 0) return;
    
    moveTimerRef.current = setInterval(() => {
      setMoveTimeLeft(prev => {
        if (prev <= 0.1) {
          // Time's up - force end move
          if (isDraggingRef.current) {
            handleDragEnd();
          }
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    return () => {
      if (moveTimerRef.current) {
        clearInterval(moveTimerRef.current);
      }
    };
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

  // Complete game
  useEffect(() => {
    if (gameState === 'complete') {
      const scoreRatio = Math.min(1, score / config.targetScore);
      const comboBonus = Math.min(maxCombo * 3, 20);
      const accuracy = Math.round(Math.min(100, scoreRatio * 80 + comboBonus));
      const result = accuracy >= 90 ? 'perfect' : accuracy >= 70 ? 'good' : accuracy >= 40 ? 'partial' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: accuracy >= 50,
          accuracy,
          result,
        });
      }, 500);
    }
  }, [gameState, score, config.targetScore, maxCombo, onComplete]);

  const cellSize = useMemo(() => {
    return 280 / GRID_COLS; // Assuming max width of 280px
  }, []);

  return (
    <div className="flex flex-col items-center relative">
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
        title="Orb Match"
        subtitle="Drag orbs to match 3+"
        timeLeft={timeLeft}
        totalTime={config.rounds * 8}
        combo={combo}
        showCombo={true}
        primaryStat={{ value: score, label: 'Score', color: '#a855f7' }}
        secondaryStat={{ value: roundsCompleted, label: `Round ${roundsCompleted + 1}/${config.rounds}`, color: '#22d3ee' }}
        isPaused={gameState === 'paused'}
        onPauseToggle={() => setGameState(gameState === 'paused' ? 'playing' : 'paused')}
      />

      {/* Move timer bar */}
      {gameState === 'playing' && (
        <div className="w-full max-w-xs mb-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary to-accent"
              style={{ width: `${(moveTimeLeft / config.moveTime) * 100}%` }}
              animate={{
                backgroundColor: moveTimeLeft < 2 ? ['hsl(var(--primary))', '#ef4444', 'hsl(var(--primary))'] : undefined,
              }}
              transition={{ duration: 0.5, repeat: moveTimeLeft < 2 ? Infinity : 0 }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground mt-1">
            Move time: {moveTimeLeft.toFixed(1)}s
          </p>
        </div>
      )}

      {/* Game area with premium styling */}
      <div
        ref={gridRef}
        className="relative w-full max-w-xs rounded-2xl overflow-hidden cursor-pointer touch-none game-container"
        style={{ 
          aspectRatio: `${GRID_COLS}/${GRID_ROWS}`,
          maxWidth: 300,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Starfield background */}
        <StarBackground stars={stars} />

        {/* Subtle grid lines */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: GRID_ROWS + 1 }).map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute left-0 right-0"
              style={{ 
                top: `${(i / GRID_ROWS) * 100}%`,
                height: 1,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
              }}
            />
          ))}
          {Array.from({ length: GRID_COLS + 1 }).map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute top-0 bottom-0"
              style={{ 
                left: `${(i / GRID_COLS) * 100}%`,
                width: 1,
                background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
              }}
            />
          ))}
        </div>

        {/* Orbs */}
        {orbs.map(orb => (
          <OrbComponent
            key={orb.id}
            orb={orb}
            cellSize={cellSize}
            isSelected={selectedOrb?.id === orb.id}
            isDragging={isDraggingRef.current}
            isInPath={dragPath.includes(orb.id)}
          />
        ))}

        {/* Combo popup */}
        <AnimatePresence>
          {showComboPopup && (
            <motion.div
              className="absolute z-50 pointer-events-none px-4 py-2 rounded-full combo-badge"
              style={{ 
                left: `${showComboPopup.x}%`, 
                top: `${showComboPopup.y}%`, 
                transform: 'translate(-50%, -50%)' 
              }}
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, y: -40, scale: 1.3 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
            >
              <span className="font-black text-lg text-yellow-400">
                🔥 {showComboPopup.combo}x COMBO!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend with refined styling */}
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-xs">
        {availableColors.slice(0, 4).map(color => (
          <div key={color} className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/5 border border-white/10">
            <span className="text-sm">{ORB_COLORS[color].emoji}</span>
            <span className="capitalize text-white/60 font-medium">{color}</span>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <p className="text-xs text-white/40 mt-3 text-center font-medium">
        Drag orbs to swap • Match 3+ to clear • Chain combos for bonus!
      </p>

      {/* CSS */}
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