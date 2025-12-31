import { useState, useCallback, useEffect } from 'react';
import { MiniGameType } from '@/types/astralEncounters';
import { ArcadeDifficulty, DIFFICULTY_ORDER, getNextDifficulty, getPrevDifficulty } from '@/types/arcadeDifficulty';
import { safeLocalStorage } from '@/utils/storage';

interface GameResult {
  difficulty: ArcadeDifficulty;
  accuracy: number;
  success: boolean;
  date: string;
}

interface GameSkillData {
  gamesPlayed: number;
  lastPlayed: string;
  recentResults: GameResult[]; // Last 10 games
  currentStreak: number;
  bestStreak: number;
}

type SkillDataMap = Partial<Record<MiniGameType, GameSkillData>>;

const STORAGE_KEY = 'arcade_skill_tracker_v1';
const MAX_RECENT_RESULTS = 10;
const MIN_GAMES_FOR_RECOMMENDATION = 3;

// Thresholds for recommendations
const ACCURACY_THRESHOLD_UP = 80;
const ACCURACY_THRESHOLD_DOWN = 40;
const WIN_RATE_THRESHOLD_UP = 0.7;
const WIN_RATE_THRESHOLD_DOWN = 0.3;

export const useArcadeSkillTracker = () => {
  const [skillData, setSkillData] = useState<SkillDataMap>({});

  // Load from localStorage on mount
  useEffect(() => {
    const stored = safeLocalStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSkillData(JSON.parse(stored));
      } catch {
        // Invalid data, start fresh
      }
    }
  }, []);

  // Record a game result
  const recordGameResult = useCallback((
    gameType: MiniGameType,
    difficulty: ArcadeDifficulty,
    accuracy: number,
    success: boolean
  ) => {
    setSkillData(prev => {
      const existing = prev[gameType] || {
        gamesPlayed: 0,
        lastPlayed: new Date().toISOString(),
        recentResults: [],
        currentStreak: 0,
        bestStreak: 0,
      };

      const newResult: GameResult = {
        difficulty,
        accuracy,
        success,
        date: new Date().toISOString(),
      };

      // Update streak
      const newStreak = success ? existing.currentStreak + 1 : 0;

      const newData: GameSkillData = {
        gamesPlayed: existing.gamesPlayed + 1,
        lastPlayed: new Date().toISOString(),
        recentResults: [newResult, ...existing.recentResults].slice(0, MAX_RECENT_RESULTS),
        currentStreak: newStreak,
        bestStreak: Math.max(existing.bestStreak, newStreak),
      };

      const newSkillData = {
        ...prev,
        [gameType]: newData,
      };

      // Persist to localStorage
      safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(newSkillData));

      return newSkillData;
    });
  }, []);

  // Get recommended difficulty for a game
  const getRecommendedDifficulty = useCallback((gameType: MiniGameType): ArcadeDifficulty | null => {
    const data = skillData[gameType];
    
    // Need at least 3 games for recommendation
    if (!data || data.gamesPlayed < MIN_GAMES_FOR_RECOMMENDATION) {
      return null;
    }

    // Get last 5 results (or fewer if not available)
    const recentResults = data.recentResults.slice(0, 5);
    if (recentResults.length < MIN_GAMES_FOR_RECOMMENDATION) {
      return null;
    }

    // Calculate average accuracy and win rate from recent games
    const avgAccuracy = recentResults.reduce((sum, r) => sum + r.accuracy, 0) / recentResults.length;
    const winRate = recentResults.filter(r => r.success).length / recentResults.length;

    // Find the most played difficulty in recent games
    const difficultyCount: Partial<Record<ArcadeDifficulty, number>> = {};
    recentResults.forEach(r => {
      difficultyCount[r.difficulty] = (difficultyCount[r.difficulty] || 0) + 1;
    });
    
    let currentDifficulty: ArcadeDifficulty = 'medium';
    let maxCount = 0;
    for (const [diff, count] of Object.entries(difficultyCount)) {
      if (count > maxCount) {
        maxCount = count;
        currentDifficulty = diff as ArcadeDifficulty;
      }
    }

    // Recommend moving UP if performing very well
    if (avgAccuracy >= ACCURACY_THRESHOLD_UP && winRate >= WIN_RATE_THRESHOLD_UP) {
      const nextDiff = getNextDifficulty(currentDifficulty);
      if (nextDiff) return nextDiff;
    }

    // Recommend moving DOWN if struggling
    if (avgAccuracy < ACCURACY_THRESHOLD_DOWN && winRate < WIN_RATE_THRESHOLD_DOWN) {
      const prevDiff = getPrevDifficulty(currentDifficulty);
      if (prevDiff) return prevDiff;
    }

    // Stay at current level
    return currentDifficulty;
  }, [skillData]);

  // Get skill data for a specific game
  const getGameSkillData = useCallback((gameType: MiniGameType): GameSkillData | null => {
    return skillData[gameType] || null;
  }, [skillData]);

  // Get total games played across all games
  const getTotalGamesPlayed = useCallback(() => {
    return Object.values(skillData).reduce((sum, data) => sum + (data?.gamesPlayed || 0), 0);
  }, [skillData]);

  return {
    skillData,
    recordGameResult,
    getRecommendedDifficulty,
    getGameSkillData,
    getTotalGamesPlayed,
  };
};
