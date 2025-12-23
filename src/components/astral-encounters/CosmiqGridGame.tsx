import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult, EncounterResult } from '@/types/astralEncounters';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';
import { DamageEvent } from '@/types/battleSystem';
import { triggerHaptic } from './gameUtils';
import { Undo2, Lightbulb, RotateCcw } from 'lucide-react';

export interface CosmiqGridGameProps {
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  difficulty?: ArcadeDifficulty;
  isPractice?: boolean;
  compact?: boolean;
  companionStats?: { mind: number; body: number; soul: number };
  tierAttackDamage?: number;
}

type CellValue = 0 | 1 | 2 | 3 | 4;
type Grid = CellValue[][];

interface MoveHistory {
  row: number;
  col: number;
  prevValue: CellValue;
}

// Difficulty configs: how many cells to remove (empty cells)
const DIFFICULTY_CONFIG: Record<ArcadeDifficulty, { emptyCells: number; name: string }> = {
  beginner: { emptyCells: 3, name: 'Beginner' },
  easy: { emptyCells: 5, name: 'Easy' },
  medium: { emptyCells: 7, name: 'Medium' },
  hard: { emptyCells: 9, name: 'Hard' },
  master: { emptyCells: 11, name: 'Master' },
};

// Seeded random number generator
const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// Generate a valid 4x4 Sudoku solution using backtracking
const generateSolution = (seed: number): Grid => {
  const grid: Grid = Array(4).fill(null).map(() => Array(4).fill(0));
  let seedOffset = seed;
  
  const isValid = (row: number, col: number, num: number): boolean => {
    // Check row
    for (let c = 0; c < 4; c++) {
      if (grid[row][c] === num) return false;
    }
    // Check column
    for (let r = 0; r < 4; r++) {
      if (grid[r][col] === num) return false;
    }
    // Check 2x2 box
    const boxRow = Math.floor(row / 2) * 2;
    const boxCol = Math.floor(col / 2) * 2;
    for (let r = boxRow; r < boxRow + 2; r++) {
      for (let c = boxCol; c < boxCol + 2; c++) {
        if (grid[r][c] === num) return false;
      }
    }
    return true;
  };

  const solve = (row: number, col: number): boolean => {
    if (row === 4) return true;
    if (col === 4) return solve(row + 1, 0);
    if (grid[row][col] !== 0) return solve(row, col + 1);

    // Shuffle numbers 1-4 using seeded random
    const nums = [1, 2, 3, 4] as CellValue[];
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(seededRandom(seedOffset++) * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }

    for (const num of nums) {
      if (isValid(row, col, num)) {
        grid[row][col] = num;
        if (solve(row, col + 1)) return true;
        grid[row][col] = 0;
      }
    }
    return false;
  };

  solve(0, 0);
  return grid;
};

// Remove cells to create puzzle
const createPuzzle = (solution: Grid, emptyCells: number, seed: number): { puzzle: Grid; given: boolean[][] } => {
  const puzzle: Grid = solution.map(row => [...row]);
  const given: boolean[][] = Array(4).fill(null).map(() => Array(4).fill(true));
  
  const positions: [number, number][] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      positions.push([r, c]);
    }
  }
  
  // Shuffle positions using seeded random
  let seedOffset = seed + 1000;
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seedOffset++) * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  
  // Remove cells
  for (let i = 0; i < Math.min(emptyCells, positions.length); i++) {
    const [r, c] = positions[i];
    puzzle[r][c] = 0;
    given[r][c] = false;
  }
  
  return { puzzle, given };
};

// Check if a value causes conflicts
const getConflicts = (grid: Grid, row: number, col: number): [number, number][] => {
  const value = grid[row][col];
  if (value === 0) return [];
  
  const conflicts: [number, number][] = [];
  
  // Check row
  for (let c = 0; c < 4; c++) {
    if (c !== col && grid[row][c] === value) {
      conflicts.push([row, c]);
    }
  }
  // Check column
  for (let r = 0; r < 4; r++) {
    if (r !== row && grid[r][col] === value) {
      conflicts.push([r, col]);
    }
  }
  // Check 2x2 box
  const boxRow = Math.floor(row / 2) * 2;
  const boxCol = Math.floor(col / 2) * 2;
  for (let r = boxRow; r < boxRow + 2; r++) {
    for (let c = boxCol; c < boxCol + 2; c++) {
      if ((r !== row || c !== col) && grid[r][c] === value) {
        conflicts.push([r, c]);
      }
    }
  }
  
  return conflicts;
};

// Check if puzzle is complete and valid
const isPuzzleComplete = (grid: Grid): boolean => {
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) return false;
      if (getConflicts(grid, r, c).length > 0) return false;
    }
  }
  return true;
};

export const CosmiqGridGame = ({
  onComplete,
  onDamage,
  difficulty = 'medium',
  isPractice = false,
}: CosmiqGridGameProps) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  
  // Generate daily seed from date
  const dailySeed = useMemo(() => {
    const now = new Date();
    return parseInt(`${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`);
  }, []);
  
  const { solution, puzzle: initialPuzzle, given } = useMemo(() => {
    // Combine daily seed with difficulty for unique puzzles per difficulty
    const combinedSeed = dailySeed + Object.keys(DIFFICULTY_CONFIG).indexOf(difficulty) * 1000;
    const sol = generateSolution(combinedSeed);
    const { puzzle, given } = createPuzzle(sol, config.emptyCells, combinedSeed);
    return { solution: sol, puzzle, given };
  }, [dailySeed, difficulty, config.emptyCells]);
  
  const [grid, setGrid] = useState<Grid>(initialPuzzle);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [conflictCells, setConflictCells] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<MoveHistory[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Timer
  useEffect(() => {
    if (gameComplete) return;
    const interval = setInterval(() => {
      setElapsedTime(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameComplete]);
  
  // Update conflicts whenever grid changes
  useEffect(() => {
    const newConflicts = new Set<string>();
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (grid[r][c] !== 0) {
          const cellConflicts = getConflicts(grid, r, c);
          if (cellConflicts.length > 0) {
            newConflicts.add(`${r}-${c}`);
            cellConflicts.forEach(([cr, cc]) => newConflicts.add(`${cr}-${cc}`));
          }
        }
      }
    }
    setConflictCells(newConflicts);
  }, [grid]);
  
  // Check for completion
  useEffect(() => {
    if (!gameComplete && isPuzzleComplete(grid)) {
      setGameComplete(true);
      setShowCelebration(true);
      triggerHaptic('success');
      
      // Calculate result
      const baseXP = [15, 25, 35, 45, 60][Object.keys(DIFFICULTY_CONFIG).indexOf(difficulty)];
      const timeBonus = Math.max(0, 120 - elapsedTime) / 4; // Up to 30 bonus XP for speed
      const hintPenalty = hintsUsed * 5;
      
      setTimeout(() => {
        const result: MiniGameResult = {
          success: true,
          accuracy: 100,
          result: hintsUsed === 0 ? 'perfect' : 'good' as EncounterResult,
          highScoreValue: elapsedTime, // Lower is better for time-based
          gameStats: {
            time: elapsedTime,
            puzzlesSolved: 1,
            hintsUsed,
          },
        };
        onComplete(result);
      }, 2000);
    }
  }, [grid, gameComplete, elapsedTime, hintsUsed, difficulty, onComplete]);
  
  const handleCellTap = useCallback((row: number, col: number) => {
    if (given[row][col] || gameComplete) return;
    setSelectedCell([row, col]);
    triggerHaptic('light');
  }, [given, gameComplete]);
  
  const handleNumberTap = useCallback((num: CellValue) => {
    if (!selectedCell || gameComplete) return;
    const [row, col] = selectedCell;
    if (given[row][col]) return;
    
    // Save to history
    setHistory(h => [...h.slice(-9), { row, col, prevValue: grid[row][col] }]);
    
    // Update grid
    setGrid(g => {
      const newGrid = g.map(r => [...r]);
      newGrid[row][col] = num;
      return newGrid;
    });
    
    triggerHaptic('light');
    
    // Check for conflict
    const newGrid = grid.map(r => [...r]);
    newGrid[row][col] = num;
    if (num !== 0 && getConflicts(newGrid, row, col).length > 0) {
      triggerHaptic('error');
      if (onDamage) {
        onDamage({ target: 'player', amount: 5, source: 'conflict' });
      }
    }
  }, [selectedCell, grid, given, gameComplete, onDamage]);
  
  const handleUndo = useCallback(() => {
    if (history.length === 0 || gameComplete) return;
    const last = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setGrid(g => {
      const newGrid = g.map(r => [...r]);
      newGrid[last.row][last.col] = last.prevValue;
      return newGrid;
    });
    triggerHaptic('light');
  }, [history, gameComplete]);
  
  const handleHint = useCallback(() => {
    if (gameComplete) return;
    
    // Find first empty or wrong cell
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (!given[r][c] && grid[r][c] !== solution[r][c]) {
          setGrid(g => {
            const newGrid = g.map(row => [...row]);
            newGrid[r][c] = solution[r][c];
            return newGrid;
          });
          setHintsUsed(h => h + 1);
          setSelectedCell([r, c]);
          triggerHaptic('medium');
          return;
        }
      }
    }
  }, [grid, solution, given, gameComplete]);
  
  const handleReset = useCallback(() => {
    setGrid(initialPuzzle);
    setHistory([]);
    setSelectedCell(null);
    triggerHaptic('medium');
  }, [initialPuzzle]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Cosmic background */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(260,50%,8%)] via-[hsl(270,40%,6%)] to-[hsl(280,30%,4%)]" />
      
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/60"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              opacity: [0.3, 0.8, 0.3],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>
      
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-xs mb-4">
        <div className="text-sm font-medium text-muted-foreground">
          {config.name}
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
          <span className="text-lg font-mono font-bold text-cyan-400">
            {formatTime(elapsedTime)}
          </span>
        </div>
      </div>
      
      {/* Grid */}
      <motion.div
        className="relative z-10 grid grid-cols-4 gap-0.5 p-1 rounded-xl bg-white/5 backdrop-blur-xl border border-white/20"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          boxShadow: '0 0 40px hsl(270, 50%, 30% / 0.3)',
        }}
      >
        {grid.map((row, r) => (
          row.map((cell, c) => {
            const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
            const isGiven = given[r][c];
            const hasConflict = conflictCells.has(`${r}-${c}`);
            const isBoxBorderRight = c === 1;
            const isBoxBorderBottom = r === 1;
            
            return (
              <motion.button
                key={`${r}-${c}`}
                onClick={() => handleCellTap(r, c)}
                disabled={isGiven}
                className={`
                  relative w-16 h-16 flex items-center justify-center text-2xl font-bold
                  transition-all duration-200
                  ${isBoxBorderRight ? 'border-r-2 border-white/30' : ''}
                  ${isBoxBorderBottom ? 'border-b-2 border-white/30' : ''}
                  ${isGiven 
                    ? 'bg-purple-900/40 text-purple-200 cursor-default' 
                    : 'bg-slate-900/60 hover:bg-slate-800/60 cursor-pointer'
                  }
                  ${isSelected ? 'ring-2 ring-cyan-400 ring-inset bg-cyan-900/30' : ''}
                  ${hasConflict ? 'animate-pulse' : ''}
                `}
                style={{
                  boxShadow: hasConflict 
                    ? 'inset 0 0 20px hsl(0, 80%, 50% / 0.5)' 
                    : isSelected 
                      ? 'inset 0 0 20px hsl(190, 90%, 50% / 0.3)'
                      : undefined,
                }}
                whileTap={{ scale: isGiven ? 1 : 0.95 }}
              >
                <span className={`
                  ${isGiven ? 'text-purple-300' : 'text-cyan-300'}
                  ${hasConflict ? 'text-red-400' : ''}
                `}>
                  {cell !== 0 ? cell : ''}
                </span>
                
                {/* Selection glow */}
                {isSelected && (
                  <motion.div
                    className="absolute inset-0 rounded-sm"
                    animate={{
                      boxShadow: [
                        '0 0 10px hsl(190, 90%, 50% / 0.3)',
                        '0 0 20px hsl(190, 90%, 50% / 0.5)',
                        '0 0 10px hsl(190, 90%, 50% / 0.3)',
                      ],
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.button>
            );
          })
        ))}
      </motion.div>
      
      {/* Number selector */}
      <motion.div
        className="relative z-10 flex items-center gap-2 mt-6"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {([1, 2, 3, 4] as CellValue[]).map(num => (
          <motion.button
            key={num}
            onClick={() => handleNumberTap(num)}
            disabled={!selectedCell || gameComplete}
            className={`
              w-14 h-14 rounded-xl text-xl font-bold
              bg-gradient-to-br from-cyan-500/20 to-purple-500/20
              border border-white/20 backdrop-blur-sm
              hover:from-cyan-500/30 hover:to-purple-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
            `}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-cyan-300">{num}</span>
          </motion.button>
        ))}
        
        {/* Clear button */}
        <motion.button
          onClick={() => handleNumberTap(0)}
          disabled={!selectedCell || gameComplete}
          className={`
            w-14 h-14 rounded-xl text-xl font-bold
            bg-gradient-to-br from-red-500/20 to-orange-500/20
            border border-white/20 backdrop-blur-sm
            hover:from-red-500/30 hover:to-orange-500/30
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
          `}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-red-400">×</span>
        </motion.button>
      </motion.div>
      
      {/* Action buttons */}
      <motion.div
        className="relative z-10 flex items-center gap-3 mt-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <button
          onClick={handleUndo}
          disabled={history.length === 0 || gameComplete}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm text-muted-foreground hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Undo2 className="w-4 h-4" />
          Undo
        </button>
        
        <button
          onClick={handleHint}
          disabled={gameComplete}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 border border-amber-500/30 text-sm text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Lightbulb className="w-4 h-4" />
          Hint
        </button>
        
        <button
          onClick={handleReset}
          disabled={gameComplete}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm text-muted-foreground hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </motion.div>
      
      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              <motion.div
                className="text-6xl mb-4"
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 10, -10, 0],
                }}
                transition={{ duration: 0.5, repeat: 3 }}
              >
                ✨
              </motion.div>
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                Solved!
              </h2>
              <p className="text-muted-foreground mt-2">
                {formatTime(elapsedTime)} {hintsUsed === 0 ? '• No hints!' : `• ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''}`}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
