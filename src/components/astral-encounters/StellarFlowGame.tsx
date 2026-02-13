import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MiniGameResult, EncounterResult } from '@/types/astralEncounters';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';
import { DamageEvent } from '@/types/battleSystem';
import { triggerHaptic } from './gameUtils';
import { RotateCcw, Clock, CheckCircle } from 'lucide-react';
import { 
  generatePuzzle, 
  Puzzle, 
  Cell, 
  Position, 
  ColorId, 
  FLOW_COLORS,
  DIFFICULTY_CONFIG 
} from './stellar-flow/puzzleGenerator';

export interface StellarFlowGameProps {
  onComplete: (result: MiniGameResult) => void;
  onDamage?: (event: DamageEvent) => void;
  difficulty?: ArcadeDifficulty;
  isPractice?: boolean;
  compact?: boolean;
  companionStats?: { mind: number; body: number; soul: number };
  tierAttackDamage?: number;
}

// Map arcade difficulty to game difficulty
const getDifficultyKey = (difficulty: ArcadeDifficulty): string => {
  switch (difficulty) {
    case 'easy': return 'easy';
    case 'medium': return 'medium';
    case 'hard': return 'hard';
    default: return 'medium';
  }
};

// Calculate grid cell size based on container
const getCellSize = (gridSize: number, containerWidth: number): number => {
  const maxSize = Math.min(containerWidth - 32, 350);
  return Math.floor(maxSize / gridSize);
};

export const StellarFlowGame = ({
  onComplete,
  onDamage,
  difficulty = 'medium',
  isPractice = false,
  compact = false,
}: StellarFlowGameProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(350);
  
  const difficultyKey = getDifficultyKey(difficulty);
  const config = DIFFICULTY_CONFIG[difficultyKey] || DIFFICULTY_CONFIG.medium;
  
  // Game state
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [paths, setPaths] = useState<Map<ColorId, Position[]>>(new Map());
  const [activeColor, setActiveColor] = useState<ColorId | null>(null);
  const [currentPath, setCurrentPath] = useState<Position[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [resetCount, setResetCount] = useState(0);
  
  const cellSize = useMemo(() => getCellSize(config.size, containerWidth), [config.size, containerWidth]);
  
  // Measure container
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);
  
  // Initialize puzzle
  useEffect(() => {
    const newPuzzle = generatePuzzle(difficultyKey);
    setPuzzle(newPuzzle);
    setGrid(newPuzzle.grid.map(row => row.map(cell => ({ ...cell }))));
    setPaths(new Map());
    setActiveColor(null);
    setCurrentPath([]);
    setIsDrawing(false);
    setStartTime(Date.now());
    setIsComplete(false);
  }, [difficultyKey, resetCount]);
  
  // Timer
  useEffect(() => {
    if (isComplete) return;
    
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 100);
    
    return () => clearInterval(interval);
  }, [startTime, isComplete]);
  
  // Check if puzzle is solved - only requires all pairs to be connected
  const checkSolution = useCallback(() => {
    if (!puzzle) return false;
    
    // Check all pairs are connected (no need for 100% grid fill)
    for (const pair of puzzle.pairs) {
      const pathForColor = paths.get(pair.color);
      if (!pathForColor || pathForColor.length < 2) {
        return false;
      }
      
      // Check path connects both endpoints
      const first = pathForColor[0];
      const last = pathForColor[pathForColor.length - 1];
      
      const connectsStart = 
        (first.row === pair.start.row && first.col === pair.start.col) ||
        (last.row === pair.start.row && last.col === pair.start.col);
      const connectsEnd = 
        (first.row === pair.end.row && first.col === pair.end.col) ||
        (last.row === pair.end.row && last.col === pair.end.col);
      
      if (!connectsStart || !connectsEnd) {
        return false;
      }
    }
    
    return true;
  }, [puzzle, paths]);
  
  // Handle victory
  useEffect(() => {
    if (isComplete || !puzzle) return;
    
    if (checkSolution()) {
      setIsComplete(true);
      triggerHaptic('success');
      
      const timeTaken = Math.floor((Date.now() - startTime) / 1000);
      const baseXP = { easy: 15, medium: 25, hard: 35, expert: 45, master: 50 }[difficultyKey] || 25;
      const timeBonus = Math.max(0, Math.floor((180 - timeTaken) / 10));
      const perfectBonus = resetCount === 0 ? 15 : 0;
      
      const accuracy = Math.min(100, 80 + Math.floor(20 * (1 - timeTaken / 300)));
      const result: EncounterResult = accuracy >= 90 ? 'perfect' : accuracy >= 60 ? 'good' : 'fail';
      
      setTimeout(() => {
        onComplete({
          success: true,
          accuracy,
          result,
          highScoreValue: timeTaken,
          gameStats: {
            time: timeTaken,
            pathsConnected: puzzle.pairs.length,
            cellsFilled: config.size * config.size,
          },
        });
      }, 800);
    }
  }, [grid, paths, isComplete, puzzle, startTime, resetCount, difficultyKey, config.size, onComplete, checkSolution]);
  
  // Get cell at position
  const getCellAtPoint = useCallback((clientX: number, clientY: number): Position | null => {
    if (!containerRef.current) return null;
    
    const gridElement = containerRef.current.querySelector('.stellar-grid');
    if (!gridElement) return null;
    
    const rect = gridElement.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    
    if (row >= 0 && row < config.size && col >= 0 && col < config.size) {
      return { row, col };
    }
    return null;
  }, [cellSize, config.size]);
  
  // Check if two positions are adjacent
  const isAdjacent = (a: Position, b: Position): boolean => {
    const rowDiff = Math.abs(a.row - b.row);
    const colDiff = Math.abs(a.col - b.col);
    return rowDiff + colDiff === 1;
  };
  
  // Clear a color's path from the grid
  const clearColorPath = useCallback((color: ColorId) => {
    setGrid(prev => {
      const newGrid = prev.map(row => row.map(cell => ({ ...cell })));
      for (const row of newGrid) {
        for (const cell of row) {
          if (cell.pathColor === color && !cell.isEndpoint) {
            cell.pathColor = null;
          }
        }
      }
      return newGrid;
    });
    setPaths(prev => {
      const newPaths = new Map(prev);
      newPaths.delete(color);
      return newPaths;
    });
  }, []);
  
  // Start drawing
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isComplete) return;
    
    const pos = getCellAtPoint(e.clientX, e.clientY);
    if (!pos) return;
    
    const cell = grid[pos.row][pos.col];
    
    // Can only start from an endpoint
    if (cell.isEndpoint && cell.color) {
      triggerHaptic('light');
      
      // Clear any existing path for this color
      clearColorPath(cell.color);
      
      setActiveColor(cell.color);
      setCurrentPath([pos]);
      setIsDrawing(true);
      
      // Update grid to show we're starting from this endpoint
      setGrid(prev => {
        const newGrid = prev.map(row => row.map(c => ({ ...c })));
        newGrid[pos.row][pos.col].pathColor = cell.color;
        return newGrid;
      });
    }
  }, [grid, isComplete, getCellAtPoint, clearColorPath]);
  
  // Continue drawing
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !activeColor || isComplete) return;
    
    const pos = getCellAtPoint(e.clientX, e.clientY);
    if (!pos) return;
    
    // Check if already in current path
    const existingIndex = currentPath.findIndex(p => p.row === pos.row && p.col === pos.col);
    
    if (existingIndex !== -1 && existingIndex < currentPath.length - 1) {
      // Backtracking - remove cells after this position
      const newPath = currentPath.slice(0, existingIndex + 1);
      setCurrentPath(newPath);
      
      // Update grid
      setGrid(prev => {
        const newGrid = prev.map(row => row.map(c => ({ ...c })));
        
        // Clear cells that are no longer in path
        for (let i = existingIndex + 1; i < currentPath.length; i++) {
          const p = currentPath[i];
          if (!newGrid[p.row][p.col].isEndpoint) {
            newGrid[p.row][p.col].pathColor = null;
          }
        }
        return newGrid;
      });
      return;
    }
    
    // Check if this is a new valid cell
    const lastPos = currentPath[currentPath.length - 1];
    if (lastPos.row === pos.row && lastPos.col === pos.col) return;
    
    if (!isAdjacent(lastPos, pos)) return;
    
    const cell = grid[pos.row][pos.col];
    
    // Can't cross other paths (except our own endpoint)
    if (cell.pathColor && cell.pathColor !== activeColor) {
      triggerHaptic('error');
      if (onDamage) {
        onDamage({ target: 'player', amount: 3, source: 'collision' });
      }
      return;
    }
    
    // Can't enter other endpoints
    if (cell.isEndpoint && cell.color !== activeColor) {
      return;
    }
    
    // Add to path
    triggerHaptic('light');
    setCurrentPath(prev => [...prev, pos]);
    
    // Update grid
    setGrid(prev => {
      const newGrid = prev.map(row => row.map(c => ({ ...c })));
      newGrid[pos.row][pos.col].pathColor = activeColor;
      return newGrid;
    });
    
  }, [isDrawing, activeColor, currentPath, grid, isComplete, getCellAtPoint, onDamage]);
  
  // Stop drawing
  const handlePointerUp = useCallback(() => {
    if (!isDrawing || !activeColor) return;
    
    setIsDrawing(false);
    
    // Check if we connected to the other endpoint
    if (currentPath.length >= 2) {
      const lastPos = currentPath[currentPath.length - 1];
      const lastCell = grid[lastPos.row][lastPos.col];
      
      if (lastCell.isEndpoint && lastCell.color === activeColor) {
        // Path complete!
        triggerHaptic('success');
        setPaths(prev => new Map(prev).set(activeColor, [...currentPath]));
      } else {
        // Path incomplete - keep it but it's not connected
        setPaths(prev => new Map(prev).set(activeColor, [...currentPath]));
      }
    }
    
    setActiveColor(null);
    setCurrentPath([]);
  }, [isDrawing, activeColor, currentPath, grid]);
  
  // Reset puzzle
  const handleReset = useCallback(() => {
    if (!puzzle) return;
    
    triggerHaptic('medium');
    setGrid(puzzle.grid.map(row => row.map(cell => ({ ...cell }))));
    setPaths(new Map());
    setActiveColor(null);
    setCurrentPath([]);
    setIsDrawing(false);
    setResetCount(prev => prev + 1);
  }, [puzzle]);
  
  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Count connected pairs
  const connectedPairs = useMemo(() => {
    if (!puzzle) return 0;
    
    let count = 0;
    for (const pair of puzzle.pairs) {
      const path = paths.get(pair.color);
      if (path && path.length >= 2) {
        const first = path[0];
        const last = path[path.length - 1];
        const lastCell = grid[last.row]?.[last.col];
        if (lastCell?.isEndpoint && lastCell.color === pair.color) {
          count++;
        }
      }
    }
    return count;
  }, [puzzle, paths, grid]);
  
  // Calculate filled cells percentage
  const filledPercent = useMemo(() => {
    let filled = 0;
    let total = 0;
    for (const row of grid) {
      for (const cell of row) {
        total++;
        if (cell.isEndpoint || cell.pathColor !== null) {
          filled++;
        }
      }
    }
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  }, [grid]);
  
  if (!puzzle) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Preparing puzzle...</div>
      </div>
    );
  }
  
  const gridSizePx = cellSize * config.size;
  
  return (
    <div 
      ref={containerRef}
      className="flex flex-col items-center gap-4 w-full select-none touch-none"
    >
      {/* Header with timer and reset */}
      <div className="flex items-center justify-between w-full max-w-[350px] px-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="font-mono text-lg font-bold text-foreground">
            {formatTime(elapsedTime)}
          </span>
        </div>
        
        <motion.button
          onClick={handleReset}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-sm">Reset</span>
        </motion.button>
      </div>
      
      {/* Progress indicators */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-muted-foreground">
            <span className="text-foreground font-bold">{connectedPairs}</span>/{puzzle.pairs.length} paths
          </span>
        </div>
        <div className="h-4 w-px bg-white/20" />
        <div className="text-muted-foreground">
          <span className="text-foreground font-bold">{filledPercent}%</span> filled
        </div>
      </div>
      
      {/* Game grid */}
      <div 
        className="stellar-grid relative rounded-xl overflow-hidden"
        style={{ 
          width: gridSizePx, 
          height: gridSizePx,
          background: 'linear-gradient(135deg, hsl(260, 30%, 12%) 0%, hsl(240, 25%, 8%) 100%)',
          boxShadow: '0 0 40px rgba(139, 92, 246, 0.2), inset 0 0 60px rgba(0, 0, 0, 0.5)',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Grid lines */}
        <svg 
          className="absolute inset-0 pointer-events-none"
          width={gridSizePx}
          height={gridSizePx}
        >
          {/* Vertical lines */}
          {Array.from({ length: config.size + 1 }).map((_, i) => (
            <line
              key={`v-${i}`}
              x1={i * cellSize}
              y1={0}
              x2={i * cellSize}
              y2={gridSizePx}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          ))}
          {/* Horizontal lines */}
          {Array.from({ length: config.size + 1 }).map((_, i) => (
            <line
              key={`h-${i}`}
              x1={0}
              y1={i * cellSize}
              x2={gridSizePx}
              y2={i * cellSize}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          ))}
          
          {/* Draw paths */}
          {Array.from(paths.entries()).map(([color, path]) => {
            if (path.length < 2) return null;
            
            const colorData = FLOW_COLORS[color];
            const points = path.map(p => ({
              x: p.col * cellSize + cellSize / 2,
              y: p.row * cellSize + cellSize / 2,
            }));
            
            const pathD = points.reduce((d, p, i) => {
              return d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
            }, '');
            
            return (
              <g key={color}>
                {/* Glow */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={colorData.glow}
                  strokeWidth={cellSize * 0.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: 'blur(8px)' }}
                />
                {/* Main path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={colorData.hex}
                  strokeWidth={cellSize * 0.35}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
          
          {/* Draw current path being drawn */}
          {isDrawing && currentPath.length >= 1 && activeColor && (
            <g>
              {currentPath.length >= 2 && (() => {
                const colorData = FLOW_COLORS[activeColor];
                const points = currentPath.map(p => ({
                  x: p.col * cellSize + cellSize / 2,
                  y: p.row * cellSize + cellSize / 2,
                }));
                
                const pathD = points.reduce((d, p, i) => {
                  return d + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
                }, '');
                
                return (
                  <>
                    <motion.path
                      d={pathD}
                      fill="none"
                      stroke={colorData.glow}
                      strokeWidth={cellSize * 0.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ filter: 'blur(8px)' }}
                      initial={{ opacity: 0.5 }}
                      animate={{ opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 0.5, repeat: Infinity }}
                    />
                    <path
                      d={pathD}
                      fill="none"
                      stroke={colorData.hex}
                      strokeWidth={cellSize * 0.35}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                );
              })()}
            </g>
          )}
        </svg>
        
        {/* Endpoints */}
        {grid.map((row, rowIndex) => 
          row.map((cell, colIndex) => {
            if (!cell.isEndpoint || !cell.color) return null;
            
            const colorData = FLOW_COLORS[cell.color];
            const isActive = activeColor === cell.color;
            
            return (
              <motion.div
                key={`${rowIndex}-${colIndex}`}
                className="absolute flex items-center justify-center"
                style={{
                  left: colIndex * cellSize,
                  top: rowIndex * cellSize,
                  width: cellSize,
                  height: cellSize,
                }}
              >
                {/* Glow */}
                <motion.div
                  className="absolute rounded-full"
                  style={{
                    width: cellSize * 0.7,
                    height: cellSize * 0.7,
                    backgroundColor: colorData.glow,
                    filter: 'blur(10px)',
                  }}
                  animate={{
                    scale: isActive ? [1, 1.3, 1] : 1,
                    opacity: isActive ? [0.6, 0.9, 0.6] : 0.5,
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: isActive ? Infinity : 0,
                  }}
                />
                {/* Dot */}
                <motion.div
                  className="relative rounded-full border-2"
                  style={{
                    width: cellSize * 0.55,
                    height: cellSize * 0.55,
                    backgroundColor: colorData.hex,
                    borderColor: 'rgba(255,255,255,0.3)',
                    boxShadow: `0 0 15px ${colorData.hex}`,
                  }}
                  animate={{
                    scale: isActive ? [1, 1.1, 1] : 1,
                  }}
                  transition={{
                    duration: 0.4,
                    repeat: isActive ? Infinity : 0,
                  }}
                />
              </motion.div>
            );
          })
        )}
        
        {/* Victory overlay */}
        <AnimatePresence>
          {isComplete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="text-4xl"
              >
                ✨
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Color legend */}
      <div className="flex flex-wrap justify-center gap-2 max-w-[350px]">
        {puzzle.pairs.map(pair => {
          const colorData = FLOW_COLORS[pair.color];
          const isConnected = (() => {
            const path = paths.get(pair.color);
            if (!path || path.length < 2) return false;
            const last = path[path.length - 1];
            const lastCell = grid[last.row]?.[last.col];
            return lastCell?.isEndpoint && lastCell.color === pair.color;
          })();
          
          return (
            <div 
              key={pair.color}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all ${
                isConnected 
                  ? 'bg-white/10 opacity-100' 
                  : 'bg-white/5 opacity-60'
              }`}
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colorData.hex }}
              />
              {isConnected && <CheckCircle className="w-3 h-3 text-emerald-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StellarFlowGame;
