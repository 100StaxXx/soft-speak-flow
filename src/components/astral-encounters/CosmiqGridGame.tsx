import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult, EncounterResult } from '@/types/astralEncounters';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';
import { DamageEvent } from '@/types/battleSystem';
import { triggerHaptic } from './gameUtils';
import { Undo2, Lightbulb, RotateCcw, Clock } from 'lucide-react';

export interface CosmiqGridGameProps {
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  difficulty?: ArcadeDifficulty;
  isPractice?: boolean;
  compact?: boolean;
  companionStats?: { mind: number; body: number; soul: number };
  tierAttackDamage?: number;
}

type CellValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type Grid = CellValue[][];

interface MoveHistory {
  row: number;
  col: number;
  prevValue: CellValue;
}

interface PuzzleData {
  solution: Grid;
  puzzle: Grid;
  given: boolean[][];
}

// Difficulty configs: empty cells + time limit for 9x9 Sudoku (81 cells total)
const DIFFICULTY_CONFIG: Record<ArcadeDifficulty, { emptyCells: number; name: string; timeLimit: number }> = {
  beginner: { emptyCells: 32, name: 'Beginner', timeLimit: 900 },  // 15 min, 49 given
  easy: { emptyCells: 38, name: 'Easy', timeLimit: 720 },          // 12 min, 43 given
  medium: { emptyCells: 46, name: 'Medium', timeLimit: 600 },      // 10 min, 35 given
  hard: { emptyCells: 52, name: 'Hard', timeLimit: 480 },          // 8 min, 29 given
  master: { emptyCells: 58, name: 'Master', timeLimit: 360 },      // 6 min, 23 given
};

// Seeded random number generator
const seededRandom = (seed: number) => {
  const x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// Generate a valid 9x9 Sudoku solution using backtracking
const generateSolution = (seed: number): Grid => {
  const grid: Grid = Array(9).fill(null).map(() => Array(9).fill(0));
  let seedOffset = seed;
  
  const isValid = (row: number, col: number, num: number): boolean => {
    // Check row
    for (let c = 0; c < 9; c++) {
      if (grid[row][c] === num) return false;
    }
    // Check column
    for (let r = 0; r < 9; r++) {
      if (grid[r][col] === num) return false;
    }
    // Check 3x3 box
    const boxRow = Math.floor(row / 3) * 3;
    const boxCol = Math.floor(col / 3) * 3;
    for (let r = boxRow; r < boxRow + 3; r++) {
      for (let c = boxCol; c < boxCol + 3; c++) {
        if (grid[r][c] === num) return false;
      }
    }
    return true;
  };

  const solve = (row: number, col: number): boolean => {
    if (row === 9) return true;
    if (col === 9) return solve(row + 1, 0);
    if (grid[row][col] !== 0) return solve(row, col + 1);

    // Shuffle numbers 1-9 using seeded random
    const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9] as CellValue[];
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
  const given: boolean[][] = Array(9).fill(null).map(() => Array(9).fill(true));
  
  const positions: [number, number][] = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
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
  for (let c = 0; c < 9; c++) {
    if (c !== col && grid[row][c] === value) {
      conflicts.push([row, c]);
    }
  }
  // Check column
  for (let r = 0; r < 9; r++) {
    if (r !== row && grid[r][col] === value) {
      conflicts.push([r, col]);
    }
  }
  // Check 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if ((r !== row || c !== col) && grid[r][c] === value) {
        conflicts.push([r, c]);
      }
    }
  }
  
  return conflicts;
};

// Check if puzzle is complete and valid
const isPuzzleComplete = (grid: Grid): boolean => {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
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
  isPractice: _isPractice = false,
}: CosmiqGridGameProps) => {
  const config = DIFFICULTY_CONFIG[difficulty];
  
  // Generate daily seed from date
  const dailySeed = useMemo(() => {
    const now = new Date();
    return parseInt(`${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`);
  }, []);
  
  // Generate 1 puzzle for the game
  const puzzleData = useMemo((): PuzzleData => {
    const combinedSeed = dailySeed + Object.keys(DIFFICULTY_CONFIG).indexOf(difficulty) * 1000;
    const solution = generateSolution(combinedSeed);
    const { puzzle, given } = createPuzzle(solution, config.emptyCells, combinedSeed);
    return { solution, puzzle, given };
  }, [dailySeed, difficulty, config.emptyCells]);
  
  // Puzzle state
  const [grid, setGrid] = useState<Grid>(puzzleData.puzzle.map(row => [...row]));
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [conflictCells, setConflictCells] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<MoveHistory[]>([]);
  const [timeRemaining, setTimeRemaining] = useState(config.timeLimit);
  const [gameComplete, setGameComplete] = useState(false);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [gameResult, setGameResult] = useState<'victory' | 'defeat' | null>(null);
  
  // Countdown timer
  useEffect(() => {
    if (gameComplete) return;
    
    const interval = setInterval(() => {
      setTimeRemaining(t => {
        if (t <= 1) {
          clearInterval(interval);
          handleDefeat();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [gameComplete]);
  
  const handleDefeat = useCallback(() => {
    setGameComplete(true);
    setGameResult('defeat');
    triggerHaptic('error');
    
    // Calculate how many cells were filled correctly
    let correctCells = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === puzzleData.solution[r][c] && grid[r][c] !== 0) {
          correctCells++;
        }
      }
    }
    const accuracy = Math.round((correctCells / 81) * 100);
    
    setTimeout(() => {
      const result: MiniGameResult = {
        success: false,
        accuracy,
        result: 'fail' as EncounterResult,
        highScoreValue: correctCells,
        gameStats: {
          time: config.timeLimit,
          puzzlesSolved: 0,
          hintsUsed,
        },
      };
      onComplete(result);
    }, 2000);
  }, [grid, puzzleData.solution, config.timeLimit, hintsUsed, onComplete]);
  
  const handleVictory = useCallback(() => {
    setGameComplete(true);
    setGameResult('victory');
    setShowCelebration(true);
    triggerHaptic('success');
    
    const timeUsed = config.timeLimit - timeRemaining;
    
    setTimeout(() => {
      const result: MiniGameResult = {
        success: true,
        accuracy: 100,
        result: hintsUsed === 0 ? 'perfect' : 'good' as EncounterResult,
        highScoreValue: timeUsed,
        gameStats: {
          time: timeUsed,
          puzzlesSolved: 1,
          hintsUsed,
        },
      };
      onComplete(result);
    }, 2500);
  }, [timeRemaining, config.timeLimit, hintsUsed, difficulty, onComplete]);
  
  // Update conflicts whenever grid changes
  useEffect(() => {
    const newConflicts = new Set<string>();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
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
  
  // Check for puzzle completion
  useEffect(() => {
    if (gameComplete) return;
    
    if (isPuzzleComplete(grid)) {
      handleVictory();
    }
  }, [grid, gameComplete, handleVictory]);
  
  const handleCellTap = useCallback((row: number, col: number) => {
    if (puzzleData.given[row][col] || gameComplete) return;
    setSelectedCell([row, col]);
    triggerHaptic('light');
  }, [puzzleData.given, gameComplete]);
  
  const handleNumberTap = useCallback((num: CellValue) => {
    if (!selectedCell || gameComplete) return;
    const [row, col] = selectedCell;
    if (puzzleData.given[row][col]) return;
    
    // Save to history
    setHistory(h => [...h.slice(-19), { row, col, prevValue: grid[row][col] }]);
    
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
  }, [selectedCell, grid, puzzleData.given, gameComplete, onDamage]);
  
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
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (!puzzleData.given[r][c] && grid[r][c] !== puzzleData.solution[r][c]) {
          setGrid(g => {
            const newGrid = g.map(row => [...row]);
            newGrid[r][c] = puzzleData.solution[r][c];
            return newGrid;
          });
          setHintsUsed(h => h + 1);
          setSelectedCell([r, c]);
          triggerHaptic('medium');
          return;
        }
      }
    }
  }, [grid, puzzleData.solution, puzzleData.given, gameComplete]);
  
  const handleReset = useCallback(() => {
    if (gameComplete) return;
    setGrid(puzzleData.puzzle.map(row => [...row]));
    setHistory([]);
    setSelectedCell(null);
    triggerHaptic('medium');
  }, [puzzleData.puzzle, gameComplete]);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getTimerColor = () => {
    if (timeRemaining <= 60) return 'text-red-400 animate-pulse';
    if (timeRemaining <= 120) return 'text-amber-400';
    return 'text-cyan-400';
  };
  
  const getTimerBgColor = () => {
    if (timeRemaining <= 60) return 'bg-red-500/30 border-red-500/50';
    if (timeRemaining <= 120) return 'bg-amber-500/20 border-amber-500/30';
    return 'bg-white/10 border-white/10';
  };

  // Calculate filled cells for progress
  const filledCells = useMemo(() => {
    let count = 0;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] !== 0) count++;
      }
    }
    return count;
  }, [grid]);
  
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center p-2 overflow-hidden">
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
      <div className="relative z-10 flex items-center justify-between w-full max-w-[320px] mb-2">
        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {filledCells}/81 cells
          </div>
        </div>
        
        {/* Countdown timer */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-sm border ${getTimerBgColor()}`}>
          <Clock className={`w-3.5 h-3.5 ${getTimerColor()}`} />
          <span className={`text-base font-mono font-bold ${getTimerColor()}`}>
            {formatTime(timeRemaining)}
          </span>
        </div>
      </div>
      
      {/* Difficulty label */}
      <div className="relative z-10 text-xs font-medium text-muted-foreground mb-2">
        {config.name} Mode
      </div>
      
      {/* 9x9 Grid */}
      <motion.div
        className="relative z-10 grid grid-cols-9 gap-0 p-0.5 rounded-lg bg-white/5 backdrop-blur-xl border border-white/20"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{
          boxShadow: '0 0 40px hsl(270, 50%, 30% / 0.3)',
        }}
      >
        {grid.map((row, r) => (
          row.map((cell, c) => {
            const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
            const isGiven = puzzleData.given[r][c];
            const hasConflict = conflictCells.has(`${r}-${c}`);
            const isBoxBorderRight = c === 2 || c === 5;
            const isBoxBorderBottom = r === 2 || r === 5;
            
            return (
              <motion.button
                key={`${r}-${c}`}
                onClick={() => handleCellTap(r, c)}
                disabled={isGiven}
                className={`
                  relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-sm sm:text-base font-bold
                  transition-all duration-200
                  ${isBoxBorderRight ? 'border-r-2 border-white/40' : 'border-r border-white/10'}
                  ${isBoxBorderBottom ? 'border-b-2 border-white/40' : 'border-b border-white/10'}
                  ${isGiven 
                    ? 'bg-purple-900/40 text-purple-200 cursor-default' 
                    : 'bg-slate-900/60 hover:bg-slate-800/60 cursor-pointer'
                  }
                  ${isSelected ? 'ring-2 ring-cyan-400 ring-inset bg-cyan-900/30' : ''}
                  ${hasConflict ? 'animate-pulse' : ''}
                `}
                style={{
                  boxShadow: hasConflict 
                    ? 'inset 0 0 15px hsl(0, 80%, 50% / 0.5)' 
                    : isSelected 
                      ? 'inset 0 0 15px hsl(190, 90%, 50% / 0.3)'
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
                    className="absolute inset-0"
                    animate={{
                      boxShadow: [
                        '0 0 8px hsl(190, 90%, 50% / 0.3)',
                        '0 0 15px hsl(190, 90%, 50% / 0.5)',
                        '0 0 8px hsl(190, 90%, 50% / 0.3)',
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
      
      {/* Number selector - 2 rows */}
      <motion.div
        className="relative z-10 flex flex-col gap-2 mt-4"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        {/* Row 1: 1-5 */}
        <div className="flex items-center justify-center gap-1.5">
          {([1, 2, 3, 4, 5] as CellValue[]).map(num => (
            <motion.button
              key={num}
              onClick={() => handleNumberTap(num)}
              disabled={!selectedCell || gameComplete}
              className={`
                w-11 h-11 sm:w-12 sm:h-12 rounded-lg text-lg font-bold
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
        </div>
        
        {/* Row 2: 6-9 + clear */}
        <div className="flex items-center justify-center gap-1.5">
          {([6, 7, 8, 9] as CellValue[]).map(num => (
            <motion.button
              key={num}
              onClick={() => handleNumberTap(num)}
              disabled={!selectedCell || gameComplete}
              className={`
                w-11 h-11 sm:w-12 sm:h-12 rounded-lg text-lg font-bold
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
              w-11 h-11 sm:w-12 sm:h-12 rounded-lg text-xl font-bold
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
        </div>
      </motion.div>
      
      {/* Action buttons */}
      <motion.div
        className="relative z-10 flex items-center gap-2 mt-3"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <button
          onClick={handleUndo}
          disabled={history.length === 0 || gameComplete}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs text-muted-foreground hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Undo
        </button>
        
        <button
          onClick={handleHint}
          disabled={gameComplete}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 text-xs text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <Lightbulb className="w-3.5 h-3.5" />
          Hint
        </button>
        
        <button
          onClick={handleReset}
          disabled={gameComplete}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 border border-white/10 text-xs text-muted-foreground hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </motion.div>
      
      {/* Victory celebration overlay */}
      <AnimatePresence>
        {showCelebration && gameResult === 'victory' && (
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
                Puzzle Solved!
              </h2>
              <p className="text-muted-foreground mt-2">
                {formatTime(timeRemaining)} remaining {hintsUsed === 0 ? '• No hints!' : `• ${hintsUsed} hint${hintsUsed > 1 ? 's' : ''}`}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Defeat overlay */}
      <AnimatePresence>
        {gameResult === 'defeat' && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
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
                  opacity: [1, 0.5, 1],
                }}
                transition={{ duration: 1, repeat: 2 }}
              >
                ⏱️
              </motion.div>
              <h2 className="text-3xl font-bold text-red-400">
                Time's Up!
              </h2>
              <p className="text-muted-foreground mt-2">
                {filledCells} of 81 cells filled
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
