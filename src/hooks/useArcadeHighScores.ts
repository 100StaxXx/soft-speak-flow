import { useState, useCallback, useEffect } from 'react';
import { MiniGameType } from '@/types/astralEncounters';

// Game-specific metric configurations
export const GAME_METRICS: Record<MiniGameType, { 
  label: string; 
  format: (value: number) => string;
  icon: string;
}> = {
  astral_frequency: { label: 'Distance', format: v => `${v}m`, icon: '🚀' },
  galactic_match: { label: 'Level', format: v => `Lvl ${v}`, icon: '🧠' },
  soul_serpent: { label: 'Length', format: v => `${v}`, icon: '🐍' },
  energy_beam: { label: 'Waves', format: v => `Wave ${v}`, icon: '🛡️' },
  eclipse_timing: { label: 'Score', format: v => v.toLocaleString(), icon: '🎵' },
  tap_sequence: { label: 'Level', format: v => `Lvl ${v}`, icon: '🔢' },
  starfall_dodge: { label: 'Time', format: v => `${v}s`, icon: '⭐' },
  orb_match: { label: 'Score', format: v => v.toLocaleString(), icon: '💎' },
};

interface HighScore {
  value: number;          // The actual high score value
  displayValue: string;   // Formatted display string
  metricLabel: string;    // e.g., "Distance", "Level", "Score"
  date: string;
}

type HighScores = Partial<Record<MiniGameType, HighScore>>;

const STORAGE_KEY = 'arcade_high_scores_v2';

export const useArcadeHighScores = () => {
  const [highScores, setHighScores] = useState<HighScores>({});

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setHighScores(JSON.parse(stored));
      }
    } catch (e) {
      // Invalid data, start fresh
    }
  }, []);

  const getHighScore = useCallback(
    (gameType: MiniGameType): HighScore | null => {
      return highScores[gameType] || null;
    },
    [highScores]
  );

  const setHighScore = useCallback(
    (gameType: MiniGameType, value: number): boolean => {
      const metric = GAME_METRICS[gameType];
      if (!metric) return false;

      const existing = highScores[gameType];
      
      // Only update if this is a new high score
      if (existing && existing.value >= value) {
        return false;
      }

      const newScore: HighScore = {
        value,
        displayValue: metric.format(value),
        metricLabel: metric.label,
        date: new Date().toISOString(),
      };

      setHighScores((prev) => {
        const newScores = {
          ...prev,
          [gameType]: newScore,
        };

        // Persist to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newScores));
        } catch (e) {
          // Storage full or unavailable
        }

        return newScores;
      });

      return true;
    },
    [highScores]
  );

  const getAllHighScores = useCallback(() => {
    return highScores;
  }, [highScores]);

  const getTotalGamesWithHighScores = useCallback(() => {
    return Object.keys(highScores).length;
  }, [highScores]);

  const getFormattedHighScore = useCallback((gameType: MiniGameType): string | null => {
    const score = highScores[gameType];
    if (!score) return null;
    return score.displayValue;
  }, [highScores]);

  return {
    highScores,
    getHighScore,
    setHighScore,
    getAllHighScores,
    getTotalGamesWithHighScores,
    getFormattedHighScore,
  };
};
