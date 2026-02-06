// New 6-stat system for companions
export type StatInput = {
  vitality?: number | null;
  wisdom?: number | null;
  discipline?: number | null;
  resolve?: number | null;
  creativity?: number | null;
  alignment?: number | null;
};

const clampStat = (value?: number | null, defaultValue = 300) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return defaultValue;
  }
  return Math.max(0, Math.min(1000, value));
};

export const normalizeStats = (stats: StatInput = {}) => ({
  vitality: clampStat(stats.vitality),
  wisdom: clampStat(stats.wisdom),
  discipline: clampStat(stats.discipline),
  resolve: clampStat(stats.resolve),
  creativity: clampStat(stats.creativity),
  alignment: clampStat(stats.alignment),
});

export const calculateBaseStat = (stage: number) => 20 + stage * 8;

// Card stats derived from companion's 6 stats
// Maps companion stats to card combat stats (mind/body/soul for cards)
export const calculateCardStats = (stage: number, stats: StatInput = {}) => {
  const { vitality, wisdom, discipline, resolve, creativity, alignment } = normalizeStats(stats);
  const base = calculateBaseStat(stage);

  // Card stats are derived from companion stats:
  // - Card Mind = base + (wisdom + creativity) contribution
  // - Card Body = base + (vitality + discipline) contribution  
  // - Card Soul = base + (resolve + alignment) contribution
  const mindValue = Math.floor(base + ((wisdom + creativity) / 2) * 0.15);
  const bodyValue = Math.floor(base + ((vitality + discipline) / 2) * 0.15);
  const soulValue = Math.floor(base + ((resolve + alignment) / 2) * 0.15);

  return {
    mind: mindValue,
    body: bodyValue,
    soul: soulValue,
  };
};

export const calculateEnergyCost = (stage: number) => {
  if (stage <= 9) return 1;
  if (stage <= 14) return 2;
  return 3;
};

export const calculateBondLevel = (stage: number, stats: StatInput = {}) => {
  const { vitality, wisdom, discipline, resolve, creativity, alignment } = normalizeStats(stats);
  // Average of all 6 stats, normalized to 0-100 range
  const avgStat = (vitality + wisdom + discipline + resolve + creativity + alignment) / 6;
  const normalizedAvg = avgStat / 10; // 300 default = 30
  return Math.min(100, Math.floor(10 + normalizedAvg + stage * 2));
};

// Legacy exports for backward compatibility (deprecated)
export type AttributeInput = StatInput;
export const normalizeAttributes = normalizeStats;
export const calculateStats = calculateCardStats;
