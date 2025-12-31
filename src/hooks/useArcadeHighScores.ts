import { useState, useCallback, useEffect } from 'react';
import { MiniGameType } from '@/types/astralEncounters';
import { ArcadeDifficulty } from '@/types/arcadeDifficulty';
import { safeLocalStorage } from '@/utils/storage';

// Game-specific metric configurations
export const GAME_METRICS: Record<MiniGameType, { 
  label: string; 
  format: (value: number) => string;
  icon: string;
  lowerIsBetter?: boolean; // For time-based games where faster = better
}> = {
  astral_frequency: { label: 'Distance', format: v => `${Math.round(v)}m`, icon: '🚀' },
  galactic_match: { label: 'Level', format: v => `Lvl ${Math.round(v)}`, icon: '🧠' },
  soul_serpent: { label: 'Length', format: v => `${Math.round(v)}`, icon: '🐍' },
  energy_beam: { label: 'Waves', format: v => `Wave ${Math.round(v)}`, icon: '🛡️' },
  eclipse_timing: { label: 'Score', format: v => Math.round(v).toLocaleString(), icon: '🎵' },
  tap_sequence: { label: 'Level', format: v => `Lvl ${Math.round(v)}`, icon: '🔢' },
  starfall_dodge: { label: 'Time', format: v => `${Math.round(v)}s`, icon: '⭐' },
  orb_match: { label: 'Score', format: v => Math.round(v).toLocaleString(), icon: '💎' },
  cosmiq_grid: { label: 'Best Time', format: v => `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, '0')}`, icon: '🧩', lowerIsBetter: true },
  stellar_flow: { label: 'Best Time', format: v => `${Math.floor(v / 60)}:${(v % 60).toString().padStart(2, '0')}`, icon: '🔗', lowerIsBetter: true },
};

interface HighScoreEntry {
  value: number;          // The actual high score value
  displayValue: string;   // Formatted display string
  metricLabel: string;    // e.g., "Distance", "Level", "Score"
  date: string;
  difficulty: ArcadeDifficulty;
}

// Storage format: { "starfall_dodge_easy": {...}, "starfall_dodge_hard": {...}, ... }
type HighScoresV3 = Record<string, HighScoreEntry>;

// Old v2 format for migration
interface HighScoreV2 {
  value: number;
  displayValue: string;
  metricLabel: string;
  date: string;
}
type HighScoresV2 = Partial<Record<MiniGameType, HighScoreV2>>;

const STORAGE_KEY_V3 = 'arcade_high_scores_v3';
const STORAGE_KEY_V2 = 'arcade_high_scores_v2';

// Generate storage key for game + difficulty combo
const getStorageKey = (gameType: MiniGameType, difficulty: ArcadeDifficulty): string => {
  return `${gameType}_${difficulty}`;
};

export const useArcadeHighScores = () => {
  const [highScores, setHighScores] = useState<HighScoresV3>({});

  // Load from localStorage on mount, with migration from v2
  useEffect(() => {
    const storedV3 = safeLocalStorage.getItem(STORAGE_KEY_V3);
    if (storedV3) {
      try {
        setHighScores(JSON.parse(storedV3));
      } catch {
        // Invalid data, start fresh
      }
      return;
    }

    // Migrate from v2 if exists
    const storedV2 = safeLocalStorage.getItem(STORAGE_KEY_V2);
    if (storedV2) {
      try {
        const v2Data: HighScoresV2 = JSON.parse(storedV2);
        const migratedData: HighScoresV3 = {};

        // Assign old scores to 'medium' difficulty
        for (const [gameType, score] of Object.entries(v2Data)) {
          if (score) {
            const key = getStorageKey(gameType as MiniGameType, 'medium');
            migratedData[key] = {
              ...score,
              difficulty: 'medium',
            };
          }
        }

        setHighScores(migratedData);
        safeLocalStorage.setItem(STORAGE_KEY_V3, JSON.stringify(migratedData));
      } catch {
        // Invalid data, start fresh
      }
    }
  }, []);

  // Get high score for a specific game + difficulty
  const getHighScore = useCallback(
    (gameType: MiniGameType, difficulty: ArcadeDifficulty): HighScoreEntry | null => {
      const key = getStorageKey(gameType, difficulty);
      return highScores[key] || null;
    },
    [highScores]
  );

  // Set high score for a specific game + difficulty
  const setHighScore = useCallback(
    (gameType: MiniGameType, difficulty: ArcadeDifficulty, value: number): boolean => {
      const metric = GAME_METRICS[gameType];
      if (!metric) return false;

      const key = getStorageKey(gameType, difficulty);
      const existing = highScores[key];
      
      // For time-based games, lower is better; for others, higher is better
      const isLowerBetter = metric.lowerIsBetter === true;
      if (existing) {
        const isBetter = isLowerBetter ? value < existing.value : value > existing.value;
        if (!isBetter) {
          return false;
        }
      }

      const newScore: HighScoreEntry = {
        value,
        displayValue: metric.format(value),
        metricLabel: metric.label,
        date: new Date().toISOString(),
        difficulty,
      };

      setHighScores((prev) => {
        const newScores = {
          ...prev,
          [key]: newScore,
        };

        // Persist to localStorage
        safeLocalStorage.setItem(STORAGE_KEY_V3, JSON.stringify(newScores));

        return newScores;
      });

      return true;
    },
    [highScores]
  );

  // Get all high scores
  const getAllHighScores = useCallback(() => {
    return highScores;
  }, [highScores]);

  // Get total unique games with any high score
  const getTotalGamesWithHighScores = useCallback(() => {
    const gamesWithScores = new Set<string>();
    for (const key of Object.keys(highScores)) {
      const gameType = key.split('_').slice(0, -1).join('_'); // Remove difficulty suffix
      gamesWithScores.add(gameType);
    }
    return gamesWithScores.size;
  }, [highScores]);

  // Get formatted high score for a specific game + difficulty
  const getFormattedHighScore = useCallback((gameType: MiniGameType, difficulty: ArcadeDifficulty): string | null => {
    const key = getStorageKey(gameType, difficulty);
    const score = highScores[key];
    if (!score) return null;
    return score.displayValue;
  }, [highScores]);

  // Get all high scores for a specific game (all difficulties)
  const getHighScoresForGame = useCallback((gameType: MiniGameType): Partial<Record<ArcadeDifficulty, HighScoreEntry>> => {
    const result: Partial<Record<ArcadeDifficulty, HighScoreEntry>> = {};
    for (const [key, score] of Object.entries(highScores)) {
      if (key.startsWith(gameType)) {
        result[score.difficulty] = score;
      }
    }
    return result;
  }, [highScores]);

  // Get the best (highest value) high score for a game across all difficulties
  const getBestHighScore = useCallback((gameType: MiniGameType): HighScoreEntry | null => {
    let best: HighScoreEntry | null = null;
    for (const [key, score] of Object.entries(highScores)) {
      if (key.startsWith(gameType)) {
        if (!best || score.value > best.value) {
          best = score;
        }
      }
    }
    return best;
  }, [highScores]);

  // Get formatted high scores map for all difficulties of a game
  const getFormattedHighScoresForGame = useCallback((gameType: MiniGameType): Partial<Record<ArcadeDifficulty, string | null>> => {
    const scores = getHighScoresForGame(gameType);
    const result: Partial<Record<ArcadeDifficulty, string | null>> = {};
    for (const [diff, score] of Object.entries(scores)) {
      result[diff as ArcadeDifficulty] = score?.displayValue || null;
    }
    return result;
  }, [getHighScoresForGame]);

  return {
    highScores,
    getHighScore,
    setHighScore,
    getAllHighScores,
    getTotalGamesWithHighScores,
    getFormattedHighScore,
    getHighScoresForGame,
    getBestHighScore,
    getFormattedHighScoresForGame,
  };
};
