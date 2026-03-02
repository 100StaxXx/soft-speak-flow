import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  ENCOUNTER_PASSES_LEGACY_KEY,
  getEncounterPassesStorageKey,
} from "@/utils/accountLocalState";
import { safeLocalStorage } from "@/utils/storage";

const PROMPT_THRESHOLD = 3;

interface PassData {
  date: string;
  count: number;
}

const getTodayKey = (): string => {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
};

const getStoredData = (storageKey: string): PassData | null => {
  const stored = safeLocalStorage.getItem(storageKey);
  if (!stored) return null;

  try {
    return JSON.parse(stored) as PassData;
  } catch {
    return null;
  }
};

const setStoredData = (storageKey: string, data: PassData): void => {
  safeLocalStorage.setItem(storageKey, JSON.stringify(data));
};

export const useEncounterPasses = () => {
  const { user } = useAuth();
  const [passCount, setPassCount] = useState(0);

  const userStorageKey = useMemo(
    () => (user?.id ? getEncounterPassesStorageKey(user.id) : null),
    [user?.id],
  );

  // Initialize and check for day rollover
  useEffect(() => {
    const today = getTodayKey();

    if (!userStorageKey) {
      setPassCount(0);
      return;
    }

    const scopedStored = getStoredData(userStorageKey);

    if (scopedStored) {
      const scopedCount = scopedStored.date === today ? scopedStored.count : 0;
      setStoredData(userStorageKey, { date: today, count: scopedCount });
      setPassCount(scopedCount);
      return;
    }

    // Legacy migration for pre-user-scoped storage.
    const legacyStored = getStoredData(ENCOUNTER_PASSES_LEGACY_KEY);
    const migratedCount = legacyStored?.date === today ? legacyStored.count : 0;

    setStoredData(userStorageKey, { date: today, count: migratedCount });
    setPassCount(migratedCount);
    safeLocalStorage.removeItem(ENCOUNTER_PASSES_LEGACY_KEY);
  }, [userStorageKey]);

  const recordPass = useCallback(() => {
    if (!userStorageKey) {
      return passCount;
    }

    const today = getTodayKey();
    const newCount = passCount + 1;
    setStoredData(userStorageKey, { date: today, count: newCount });
    setPassCount(newCount);
    return newCount;
  }, [passCount, userStorageKey]);

  const shouldPromptDisable = passCount >= PROMPT_THRESHOLD;

  return {
    passCount,
    recordPass,
    shouldPromptDisable,
    promptThreshold: PROMPT_THRESHOLD,
  };
};
