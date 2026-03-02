import { safeLocalStorage } from "@/utils/storage";

const WEEKLY_RECAP_DISMISSED_PREFIX = "recap-dismissed-";
const LEGACY_WEEKLY_RECAP_PATTERN = /^recap-dismissed-\d{4}-\d{2}-\d{2}$/;

export const ENCOUNTER_PASSES_LEGACY_KEY = "encounter_passes";

export const getEncounterPassesStorageKey = (userId: string) => `encounter_passes_${userId}`;

export const getWeeklyRecapDismissedKey = (userId: string, weekStartDate: string) =>
  `${WEEKLY_RECAP_DISMISSED_PREFIX}${userId}-${weekStartDate}`;

export const getLegacyWeeklyRecapDismissedKey = (weekStartDate: string) =>
  `${WEEKLY_RECAP_DISMISSED_PREFIX}${weekStartDate}`;

const getLocalStorageKeys = (): string[] => {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return [];
  }

  try {
    return Object.keys(window.localStorage);
  } catch {
    return [];
  }
};

export const clearUserAccountLocalState = (userId: string | null | undefined): void => {
  if (!userId) return;

  const userRecapPrefix = `${WEEKLY_RECAP_DISMISSED_PREFIX}${userId}-`;
  const encounterKey = getEncounterPassesStorageKey(userId);

  for (const key of getLocalStorageKeys()) {
    if (key.startsWith(userRecapPrefix) || key === encounterKey) {
      safeLocalStorage.removeItem(key);
    }
  }
};

export const clearLegacyAccountLocalState = (): void => {
  safeLocalStorage.removeItem(ENCOUNTER_PASSES_LEGACY_KEY);

  for (const key of getLocalStorageKeys()) {
    if (LEGACY_WEEKLY_RECAP_PATTERN.test(key)) {
      safeLocalStorage.removeItem(key);
    }
  }
};
