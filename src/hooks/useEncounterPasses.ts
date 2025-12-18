import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'encounter_passes';
const PROMPT_THRESHOLD = 3;

interface PassData {
  date: string;
  count: number;
}

const getTodayKey = (): string => {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
};

const getStoredData = (): PassData | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as PassData;
  } catch {
    return null;
  }
};

const setStoredData = (data: PassData): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const useEncounterPasses = () => {
  const [passCount, setPassCount] = useState(0);

  // Initialize and check for day rollover
  useEffect(() => {
    const today = getTodayKey();
    const stored = getStoredData();
    
    if (stored && stored.date === today) {
      setPassCount(stored.count);
    } else {
      // New day - reset count
      setStoredData({ date: today, count: 0 });
      setPassCount(0);
    }
  }, []);

  const recordPass = useCallback(() => {
    const today = getTodayKey();
    const newCount = passCount + 1;
    setStoredData({ date: today, count: newCount });
    setPassCount(newCount);
    return newCount;
  }, [passCount]);

  const shouldPromptDisable = passCount >= PROMPT_THRESHOLD;

  return {
    passCount,
    recordPass,
    shouldPromptDisable,
    promptThreshold: PROMPT_THRESHOLD,
  };
};
