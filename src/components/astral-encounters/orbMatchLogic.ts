export type SpawnStrategy = 'initial' | 'refill';

export type OrbMatchSpecialType = 'normal' | 'line_bomb' | 'star' | 'cross_bomb' | 'cosmic_nova';

export interface SpecialCreation<TColor extends string = string> {
  row: number;
  col: number;
  type: OrbMatchSpecialType;
  color: TColor;
}

export interface PickSpawnColorParams<TColor extends string = string> {
  grid: (TColor | null)[][];
  row: number;
  col: number;
  availableColors: TColor[];
  strategy: SpawnStrategy;
  random?: () => number;
}

export interface GenerateInitialColorGridParams<TColor extends string = string> {
  rows: number;
  cols: number;
  availableColors: TColor[];
  maxAttempts?: number;
  random?: () => number;
}

export interface CascadeLoopParams<TStep> {
  maxSteps: number;
  getStep: () => TStep | null;
  onStep: (stepIndex: number, stepData: TStep) => Promise<void> | void;
}

export interface CascadeLoopResult<TStep> {
  stepsProcessed: number;
  hitLimit: boolean;
  pendingStep: TStep | null;
}

export const MAX_INITIAL_GEN_ATTEMPTS = 30;
export const MAX_CASCADE_STEPS = 8;

const readGridColor = <TColor extends string>(
  grid: (TColor | null)[][],
  row: number,
  col: number,
): TColor | null => {
  if (row < 0 || row >= grid.length) return null;
  if (col < 0 || col >= (grid[0]?.length ?? 0)) return null;
  return grid[row][col];
};

const wouldCreateTripleAtCell = <TColor extends string>(
  grid: (TColor | null)[][],
  row: number,
  col: number,
  color: TColor,
): boolean => {
  const left1 = readGridColor(grid, row, col - 1);
  const left2 = readGridColor(grid, row, col - 2);
  const right1 = readGridColor(grid, row, col + 1);
  const right2 = readGridColor(grid, row, col + 2);
  const up1 = readGridColor(grid, row - 1, col);
  const up2 = readGridColor(grid, row - 2, col);
  const down1 = readGridColor(grid, row + 1, col);
  const down2 = readGridColor(grid, row + 2, col);

  const horizontalTriple =
    (left1 === color && left2 === color) ||
    (left1 === color && right1 === color) ||
    (right1 === color && right2 === color);

  const verticalTriple =
    (up1 === color && up2 === color) ||
    (up1 === color && down1 === color) ||
    (down1 === color && down2 === color);

  return horizontalTriple || verticalTriple;
};

export const pickSpawnColor = <TColor extends string>({
  grid,
  row,
  col,
  availableColors,
  strategy: _strategy,
  random = Math.random,
}: PickSpawnColorParams<TColor>): TColor => {
  if (availableColors.length === 0) {
    throw new Error('pickSpawnColor requires at least one available color');
  }

  const safeColors = availableColors.filter((candidate) => !wouldCreateTripleAtCell(grid, row, col, candidate));
  const pool = safeColors.length > 0 ? safeColors : availableColors;
  const index = Math.floor(random() * pool.length);

  return pool[index];
};

const countMatchedCellsInColorGrid = <TColor extends string>(grid: (TColor | null)[][]): number => {
  const matched = new Set<string>();
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (let row = 0; row < rows; row++) {
    let col = 0;
    while (col < cols) {
      const color = grid[row][col];
      if (!color) {
        col++;
        continue;
      }

      let length = 1;
      while (col + length < cols && grid[row][col + length] === color) {
        length++;
      }

      if (length >= 3) {
        for (let i = 0; i < length; i++) {
          matched.add(`${row},${col + i}`);
        }
      }

      col += Math.max(1, length);
    }
  }

  for (let col = 0; col < cols; col++) {
    let row = 0;
    while (row < rows) {
      const color = grid[row][col];
      if (!color) {
        row++;
        continue;
      }

      let length = 1;
      while (row + length < rows && grid[row + length][col] === color) {
        length++;
      }

      if (length >= 3) {
        for (let i = 0; i < length; i++) {
          matched.add(`${row + i},${col}`);
        }
      }

      row += Math.max(1, length);
    }
  }

  return matched.size;
};

export const hasMatchInColorGrid = <TColor extends string>(grid: (TColor | null)[][]): boolean => {
  return countMatchedCellsInColorGrid(grid) > 0;
};

const cloneColorGrid = <TColor extends string>(grid: (TColor | null)[][]): (TColor | null)[][] => {
  return grid.map((row) => [...row]);
};

export const hasValidMoveInColorGrid = <TColor extends string>(grid: (TColor | null)[][]): boolean => {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const current = grid[row][col];
      if (!current) continue;

      if (col + 1 < cols && grid[row][col + 1]) {
        const swapped = cloneColorGrid(grid);
        const right = swapped[row][col + 1];
        swapped[row][col] = right;
        swapped[row][col + 1] = current;
        if (hasMatchInColorGrid(swapped)) return true;
      }

      if (row + 1 < rows && grid[row + 1][col]) {
        const swapped = cloneColorGrid(grid);
        const below = swapped[row + 1][col];
        swapped[row][col] = below;
        swapped[row + 1][col] = current;
        if (hasMatchInColorGrid(swapped)) return true;
      }
    }
  }

  return false;
};

const buildCandidateGrid = <TColor extends string>(
  rows: number,
  cols: number,
  availableColors: TColor[],
  random: () => number,
): TColor[][] => {
  const grid: (TColor | null)[][] = Array.from({ length: rows }, () => Array(cols).fill(null));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      grid[row][col] = pickSpawnColor({
        grid,
        row,
        col,
        availableColors,
        strategy: 'initial',
        random,
      });
    }
  }

  return grid as TColor[][];
};

export const generateInitialColorGrid = <TColor extends string>({
  rows,
  cols,
  availableColors,
  maxAttempts = MAX_INITIAL_GEN_ATTEMPTS,
  random = Math.random,
}: GenerateInitialColorGridParams<TColor>): TColor[][] => {
  if (rows <= 0 || cols <= 0) {
    throw new Error('generateInitialColorGrid requires positive rows and cols');
  }
  if (availableColors.length === 0) {
    throw new Error('generateInitialColorGrid requires at least one color');
  }

  let bestCandidate: TColor[][] | null = null;
  let bestQuality = Number.NEGATIVE_INFINITY;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = buildCandidateGrid(rows, cols, availableColors, random);
    const hasMatches = hasMatchInColorGrid(candidate);
    const hasMove = hasValidMoveInColorGrid(candidate);

    if (!hasMatches && hasMove) {
      return candidate;
    }

    const qualityScore = (hasMove ? 1000 : 0) - countMatchedCellsInColorGrid(candidate);
    if (qualityScore > bestQuality) {
      bestQuality = qualityScore;
      bestCandidate = candidate;
    }
  }

  return bestCandidate ?? buildCandidateGrid(rows, cols, availableColors, random);
};

const SPECIAL_PRIORITY: Record<OrbMatchSpecialType, number> = {
  normal: 0,
  line_bomb: 1,
  cross_bomb: 2,
  star: 3,
  cosmic_nova: 0,
};

export const normalizeSpecialCreations = <TColor extends string>(
  specialsToCreate: SpecialCreation<TColor>[],
): SpecialCreation<TColor>[] => {
  const deduped = new Map<string, SpecialCreation<TColor>>();

  for (const special of specialsToCreate) {
    const key = `${special.row},${special.col}`;
    const existing = deduped.get(key);

    if (!existing || SPECIAL_PRIORITY[special.type] > SPECIAL_PRIORITY[existing.type]) {
      deduped.set(key, special);
    }
  }

  return Array.from(deduped.values());
};

export const runCascadeLoopWithLimit = async <TStep>({
  maxSteps,
  getStep,
  onStep,
}: CascadeLoopParams<TStep>): Promise<CascadeLoopResult<TStep>> => {
  let stepsProcessed = 0;
  let nextStep = getStep();

  while (nextStep && stepsProcessed < maxSteps) {
    stepsProcessed += 1;
    await onStep(stepsProcessed, nextStep);
    nextStep = getStep();
  }

  return {
    stepsProcessed,
    hitLimit: stepsProcessed === maxSteps && nextStep !== null,
    pendingStep: nextStep,
  };
};
