import {
  generateInitialColorGrid,
  hasMatchInColorGrid,
  hasValidMoveInColorGrid,
  MAX_CASCADE_STEPS,
  normalizeSpecialCreations,
  pickSpawnColor,
  runCascadeLoopWithLimit,
  type SpecialCreation,
} from './orbMatchLogic';

type TestColor = 'fire' | 'water' | 'earth' | 'light';

const createSeededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

describe('orbMatchLogic', () => {
  it('generates initial boards with no pre-existing matches and at least one valid move', () => {
    const availableColors: TestColor[] = ['fire', 'water', 'earth', 'light'];

    for (let i = 1; i <= 20; i++) {
      const grid = generateInitialColorGrid<TestColor>({
        rows: 5,
        cols: 6,
        availableColors,
        random: createSeededRandom(i),
      });

      expect(hasMatchInColorGrid(grid)).toBe(false);
      expect(hasValidMoveInColorGrid(grid)).toBe(true);
    }
  });

  it('avoids immediate triples on refill when alternatives exist', () => {
    const grid: (TestColor | null)[][] = Array.from({ length: 5 }, () => Array(6).fill(null));

    grid[2][0] = 'fire';
    grid[2][1] = 'fire';
    grid[3][2] = 'water';
    grid[4][2] = 'water';

    const spawned = pickSpawnColor<TestColor>({
      grid,
      row: 2,
      col: 2,
      availableColors: ['fire', 'water', 'earth'],
      strategy: 'refill',
      random: () => 0,
    });

    expect(spawned).toBe('earth');
  });

  it('falls back to available colors when every candidate would create a match', () => {
    const grid: (TestColor | null)[][] = Array.from({ length: 5 }, () => Array(6).fill(null));

    grid[2][0] = 'fire';
    grid[2][1] = 'fire';

    const spawned = pickSpawnColor<TestColor>({
      grid,
      row: 2,
      col: 2,
      availableColors: ['fire'],
      strategy: 'refill',
      random: () => 0,
    });

    expect(spawned).toBe('fire');
  });

  it('normalizes overlapping specials by position with star priority', () => {
    const specials: SpecialCreation<TestColor>[] = [
      { row: 1, col: 2, type: 'line_bomb', color: 'fire' },
      { row: 1, col: 2, type: 'cross_bomb', color: 'fire' },
      { row: 1, col: 2, type: 'star', color: 'fire' },
      { row: 2, col: 4, type: 'line_bomb', color: 'water' },
    ];

    const normalized = normalizeSpecialCreations(specials);

    expect(normalized).toHaveLength(2);
    expect(normalized.find((s) => s.row === 1 && s.col === 2)?.type).toBe('star');
    expect(normalized.find((s) => s.row === 2 && s.col === 4)?.type).toBe('line_bomb');
  });

  it('caps cascade processing at MAX_CASCADE_STEPS and only applies processed score/combo', async () => {
    let remaining = MAX_CASCADE_STEPS + 4;
    let score = 0;
    let combo = 0;
    let maxCombo = 0;

    const result = await runCascadeLoopWithLimit({
      maxSteps: MAX_CASCADE_STEPS,
      getStep: () => (remaining > 0 ? { points: 25 } : null),
      onStep: (_step, stepData) => {
        remaining -= 1;
        score += stepData.points;
        combo += 1;
        maxCombo = Math.max(maxCombo, combo);
      },
    });

    expect(result.stepsProcessed).toBe(MAX_CASCADE_STEPS);
    expect(result.hitLimit).toBe(true);
    expect(result.pendingStep).not.toBeNull();
    expect(score).toBe(MAX_CASCADE_STEPS * 25);
    expect(combo).toBe(MAX_CASCADE_STEPS);
    expect(maxCombo).toBe(MAX_CASCADE_STEPS);
  });

  it('can continue processing on a follow-up pass after hitting the cascade cap', async () => {
    let remaining = MAX_CASCADE_STEPS + 2;

    const firstPass = await runCascadeLoopWithLimit({
      maxSteps: MAX_CASCADE_STEPS,
      getStep: () => (remaining > 0 ? { remaining } : null),
      onStep: () => {
        remaining -= 1;
      },
    });

    expect(firstPass.hitLimit).toBe(true);
    expect(remaining).toBe(2);

    const secondPass = await runCascadeLoopWithLimit({
      maxSteps: MAX_CASCADE_STEPS,
      getStep: () => (remaining > 0 ? { remaining } : null),
      onStep: () => {
        remaining -= 1;
      },
    });

    expect(secondPass.hitLimit).toBe(false);
    expect(secondPass.stepsProcessed).toBe(2);
    expect(remaining).toBe(0);
  });
});
