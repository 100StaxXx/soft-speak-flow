// Stellar Flow Puzzle Generator
// Generates solvable Flow-style puzzles where players connect matching colored dots

export type ColorId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Cell {
  color: ColorId | null;
  isEndpoint: boolean;
  pathColor: ColorId | null;
}

export interface Position {
  row: number;
  col: number;
}

export interface ColorPair {
  color: ColorId;
  start: Position;
  end: Position;
  path: Position[];
}

export interface Puzzle {
  size: number;
  pairs: ColorPair[];
  grid: Cell[][];
}

// Cosmic color palette for the game
export const FLOW_COLORS: Record<ColorId, { name: string; hex: string; glow: string }> = {
  1: { name: 'Crimson Nova', hex: '#ff4757', glow: 'rgba(255, 71, 87, 0.6)' },
  2: { name: 'Solar Flare', hex: '#ffa502', glow: 'rgba(255, 165, 2, 0.6)' },
  3: { name: 'Starlight', hex: '#ffd32a', glow: 'rgba(255, 211, 42, 0.6)' },
  4: { name: 'Aurora', hex: '#7bed9f', glow: 'rgba(123, 237, 159, 0.6)' },
  5: { name: 'Nebula', hex: '#70a1ff', glow: 'rgba(112, 161, 255, 0.6)' },
  6: { name: 'Cosmic', hex: '#9c88ff', glow: 'rgba(156, 136, 255, 0.6)' },
  7: { name: 'Stellar', hex: '#dfe6e9', glow: 'rgba(223, 230, 233, 0.6)' },
};

// Difficulty configurations
export const DIFFICULTY_CONFIG: Record<string, { size: number; pairs: number }> = {
  easy: { size: 5, pairs: 3 },
  medium: { size: 5, pairs: 4 },
  hard: { size: 6, pairs: 5 },
  expert: { size: 7, pairs: 6 },
  master: { size: 7, pairs: 7 },
};

// Direction vectors for grid movement (no diagonals)
const DIRECTIONS: Position[] = [
  { row: -1, col: 0 }, // up
  { row: 1, col: 0 },  // down
  { row: 0, col: -1 }, // left
  { row: 0, col: 1 },  // right
];

// Check if position is within grid bounds
const isInBounds = (pos: Position, size: number): boolean => {
  return pos.row >= 0 && pos.row < size && pos.col >= 0 && pos.col < size;
};

// Check if cell is empty (not part of any path)
const isEmpty = (grid: (ColorId | null)[][], pos: Position): boolean => {
  return grid[pos.row][pos.col] === null;
};

// Shuffle array in place
const shuffle = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

// Generate a random path using a random walk algorithm
const generatePath = (
  grid: (ColorId | null)[][],
  start: Position,
  _color: ColorId,
  minLength: number,
  maxLength: number
): Position[] | null => {
  const size = grid.length;
  const path: Position[] = [start];
  const visited = new Set<string>();
  visited.add(`${start.row},${start.col}`);
  
  const targetLength = minLength + Math.floor(Math.random() * (maxLength - minLength + 1));
  
  while (path.length < targetLength) {
    const current = path[path.length - 1];
    const shuffledDirs = shuffle(DIRECTIONS);
    let foundNext = false;
    
    for (const dir of shuffledDirs) {
      const next: Position = { row: current.row + dir.row, col: current.col + dir.col };
      const key = `${next.row},${next.col}`;
      
      if (isInBounds(next, size) && isEmpty(grid, next) && !visited.has(key)) {
        path.push(next);
        visited.add(key);
        foundNext = true;
        break;
      }
    }
    
    if (!foundNext) {
      // Dead end - path is complete
      break;
    }
  }
  
  // Need at least 2 cells for a valid path
  if (path.length < 2) {
    return null;
  }
  
  return path;
};

// Fill the grid with the path
const fillPath = (grid: (ColorId | null)[][], path: Position[], color: ColorId): void => {
  for (const pos of path) {
    grid[pos.row][pos.col] = color;
  }
};

// Get all empty cells in the grid
const getEmptyCells = (grid: (ColorId | null)[][]): Position[] => {
  const empty: Position[] = [];
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[0].length; col++) {
      if (grid[row][col] === null) {
        empty.push({ row, col });
      }
    }
  }
  return empty;
};

// Generate a complete puzzle
export const generatePuzzle = (difficulty: string): Puzzle => {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const { size, pairs: numPairs } = config;
  
  // Keep trying until we get a valid puzzle
  for (let attempts = 0; attempts < 100; attempts++) {
    const grid: (ColorId | null)[][] = Array(size).fill(null).map(() => Array(size).fill(null));
    const colorPairs: ColorPair[] = [];
    let success = true;
    
    for (let i = 0; i < numPairs && success; i++) {
      const color = (i + 1) as ColorId;
      const emptyCells = getEmptyCells(grid);
      
      if (emptyCells.length < 4) {
        success = false;
        break;
      }
      
      // Try to generate a path starting from a random empty cell
      const shuffledEmpty = shuffle(emptyCells);
      let pathFound = false;
      
      for (const startCell of shuffledEmpty.slice(0, 10)) {
        const minLen = Math.max(2, Math.floor(size / 2));
        const maxLen = Math.floor(size * 1.5);
        const path = generatePath(grid, startCell, color, minLen, maxLen);
        
        if (path && path.length >= 2) {
          fillPath(grid, path, color);
          colorPairs.push({
            color,
            start: path[0],
            end: path[path.length - 1],
            path,
          });
          pathFound = true;
          break;
        }
      }
      
      if (!pathFound) {
        success = false;
      }
    }
    
    if (success && colorPairs.length === numPairs) {
      // Create the display grid with only endpoints visible
      const displayGrid: Cell[][] = Array(size).fill(null).map(() => 
        Array(size).fill(null).map(() => ({
          color: null,
          isEndpoint: false,
          pathColor: null,
        }))
      );
      
      // Mark endpoints
      for (const pair of colorPairs) {
        displayGrid[pair.start.row][pair.start.col] = {
          color: pair.color,
          isEndpoint: true,
          pathColor: null,
        };
        displayGrid[pair.end.row][pair.end.col] = {
          color: pair.color,
          isEndpoint: true,
          pathColor: null,
        };
      }
      
      return {
        size,
        pairs: colorPairs,
        grid: displayGrid,
      };
    }
  }
  
  // Fallback: return a simple preset puzzle
  return generateFallbackPuzzle(config.size, config.pairs);
};

// Generate a simple fallback puzzle if random generation fails
const generateFallbackPuzzle = (size: number, numPairs: number): Puzzle => {
  const grid: Cell[][] = Array(size).fill(null).map(() => 
    Array(size).fill(null).map(() => ({
      color: null,
      isEndpoint: false,
      pathColor: null,
    }))
  );
  
  const pairs: ColorPair[] = [];
  
  // Create simple horizontal pairs
  for (let i = 0; i < numPairs && i < size; i++) {
    const color = (i + 1) as ColorId;
    const start = { row: i, col: 0 };
    const end = { row: i, col: size - 1 };
    
    const path: Position[] = [];
    for (let col = 0; col < size; col++) {
      path.push({ row: i, col });
    }
    
    pairs.push({ color, start, end, path });
    
    grid[start.row][start.col] = { color, isEndpoint: true, pathColor: null };
    grid[end.row][end.col] = { color, isEndpoint: true, pathColor: null };
  }
  
  return { size, pairs, grid };
};

// Check if the puzzle is solved (all pairs connected - no need for 100% grid fill)
export const isPuzzleSolved = (
  _grid: Cell[][],
  originalPairs: ColorPair[],
  paths: Map<ColorId, { row: number; col: number }[]>
): boolean => {
  // Check if all pairs are connected via their paths
  for (const pair of originalPairs) {
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
};

// Check if a path is valid (no crossing other paths, connects to endpoint)
export const isValidPath = (
  path: Position[],
  color: ColorId,
  grid: Cell[][],
  size: number
): boolean => {
  if (path.length < 2) return false;
  
  for (let i = 0; i < path.length; i++) {
    const pos = path[i];
    
    if (!isInBounds(pos, size)) return false;
    
    const cell = grid[pos.row][pos.col];
    
    // First and last should be endpoints of this color
    if (i === 0 || i === path.length - 1) {
      if (!cell.isEndpoint || cell.color !== color) {
        return false;
      }
    } else {
      // Middle cells should be empty or already part of this path
      if (cell.isEndpoint) return false;
      if (cell.pathColor !== null && cell.pathColor !== color) return false;
    }
    
    // Check adjacency
    if (i > 0) {
      const prev = path[i - 1];
      const rowDiff = Math.abs(pos.row - prev.row);
      const colDiff = Math.abs(pos.col - prev.col);
      if (rowDiff + colDiff !== 1) return false; // Must be adjacent, no diagonals
    }
  }
  
  return true;
};
