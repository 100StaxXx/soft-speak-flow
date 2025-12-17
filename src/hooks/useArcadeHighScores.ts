import { useState, useCallback, useEffect } from 'react';
import { MiniGameType } from '@/types/astralEncounters';

interface HighScore {
  accuracy: number;
  result: string;
  date: string;
}

type HighScores = Partial<Record<MiniGameType, HighScore>>;

const STORAGE_KEY = 'arcade_high_scores';

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
    (gameType: MiniGameType, accuracy: number, result: string): boolean => {
      let isNewHighScore = false;
      
      setHighScores((prev) => {
        const existing = prev[gameType];
        
        // Only update if this is a new high score
        if (existing && existing.accuracy >= accuracy) {
          isNewHighScore = false;
          return prev;
        }

        isNewHighScore = true;

        const newScores = {
          ...prev,
          [gameType]: {
            accuracy,
            result,
            date: new Date().toISOString(),
          },
        };

        // Persist to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(newScores));
        } catch (e) {
          // Storage full or unavailable
        }

        return newScores;
      });

      return isNewHighScore;
    },
    []
  );

  const getAllHighScores = useCallback(() => {
    return highScores;
  }, [highScores]);

  const getTotalGamesWithHighScores = useCallback(() => {
    return Object.keys(highScores).length;
  }, [highScores]);

  const getAverageHighScore = useCallback(() => {
    const scores = Object.values(highScores);
    if (scores.length === 0) return 0;
    const total = scores.reduce((sum, s) => sum + s.accuracy, 0);
    return Math.round(total / scores.length);
  }, [highScores]);

  return {
    highScores,
    getHighScore,
    setHighScore,
    getAllHighScores,
    getTotalGamesWithHighScores,
    getAverageHighScore,
  };
};
