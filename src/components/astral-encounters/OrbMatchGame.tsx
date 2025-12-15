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

const ORB_COLORS: Record<OrbColor, { bg: string; glow: string; emoji: string }> = {
  fire: { bg: 'from-red-500 to-orange-600', glow: 'rgba(239, 68, 68, 0.6)', emoji: '🔥' },
  water: { bg: 'from-blue-500 to-cyan-500', glow: 'rgba(59, 130, 246, 0.6)', emoji: '💧' },
  earth: { bg: 'from-green-500 to-emerald-600', glow: 'rgba(34, 197, 94, 0.6)', emoji: '🌿' },
  light: { bg: 'from-yellow-400 to-amber-500', glow: 'rgba(250, 204, 21, 0.6)', emoji: '✨' },
  dark: { bg: 'from-purple-600 to-violet-700', glow: 'rgba(147, 51, 234, 0.6)', emoji: '🌙' },
  cosmic: { bg: 'from-pink-500 to-rose-600', glow: 'rgba(236, 72, 153, 0.6)', emoji: '💫' },
};

const GRID_ROWS = 5;
const GRID_COLS = 6;

// Memoized static star background
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
          animationDelay: `${star.animationDelay}s`,
        }}
      />
    ))}
  </div>
));
StarBackground.displayName = 'StarBackground';

// Memoized orb component
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
  
  return (
    <motion.div
      className={`absolute rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing ${
        isSelected ? 'z-30 scale-110' : isInPath ? 'z-20 scale-105' : 'z-10'
      }`}
      style={{
        width: cellSize - 6,
        height: cellSize - 6,
        left: orb.col * cellSize + 3,
        top: orb.row * cellSize + 3,
        boxShadow: isSelected || isInPath 
          ? `0 0 20px ${colorConfig.glow}, 0 0 40px ${colorConfig.glow}` 
          : `0 0 10px ${colorConfig.glow}`,
        transition: isDragging ? 'none' : 'all 0.15s ease-out',
      }}
      animate={{
        scale: orb.matched ? 0 : isSelected ? 1.15 : isInPath ? 1.08 : 1,
        opacity: orb.matched ? 0 : 1,
      }}
      transition={{ duration: 0.15 }}
    >
      <div className={`w-full h-full rounded-full bg-gradient-to-br ${colorConfig.bg} flex items-center justify-center border-2 border-white/30`}>
        <span className="text-lg select-none">{colorConfig.emoji}</span>
      </div>
      {(isSelected || isInPath) && (
        <div 
          className="absolute inset-0 rounded-full animate-pulse"
          style={{ 
            boxShadow: `0 0 15px ${colorConfig.glow}`,
            background: `radial-gradient(circle, ${colorConfig.glow} 0%, transparent 70%)`,
          }}
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

      {/* Game area */}
      <div
        ref={gridRef}
        className="relative w-full max-w-xs bg-gradient-to-b from-slate-900 via-slate-900/95 to-primary/20 rounded-xl border border-border/50 overflow-hidden cursor-pointer touch-none shadow-2xl"
        style={{ 
          aspectRatio: `${GRID_COLS}/${GRID_ROWS}`,
          maxWidth: 280,
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

        {/* Grid lines */}
        <div className="absolute inset-0 pointer-events-none">
          {Array.from({ length: GRID_ROWS + 1 }).map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute left-0 right-0 h-px bg-white/5"
              style={{ top: `${(i / GRID_ROWS) * 100}%` }}
            />
          ))}
          {Array.from({ length: GRID_COLS + 1 }).map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute top-0 bottom-0 w-px bg-white/5"
              style={{ left: `${(i / GRID_COLS) * 100}%` }}
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
              className="absolute z-50 pointer-events-none font-bold text-xl text-yellow-400"
              style={{ left: `${showComboPopup.x}%`, top: `${showComboPopup.y}%`, transform: 'translate(-50%, -50%)' }}
              initial={{ opacity: 1, scale: 1 }}
              animate={{ opacity: 0, y: -30, scale: 1.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
            >
              🔥 {showComboPopup.combo}x COMBO!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-4 text-xs">
        {availableColors.slice(0, 4).map(color => (
          <div key={color} className="flex items-center gap-1">
            <span>{ORB_COLORS[color].emoji}</span>
            <span className="capitalize text-muted-foreground">{color}</span>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Drag an orb across the grid • Orbs swap as you pass • Match 3+ to score!
      </p>

      {/* CSS animations */}
      <style>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};
