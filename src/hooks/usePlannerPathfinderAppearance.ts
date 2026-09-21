import { useEffect, useMemo, useState } from "react";

import type { PlannerPathfinderThemeMode } from "@/components/companion/plannerPathfinderTheme";
import { plannerPathfinderTheme } from "@/components/companion/plannerPathfinderTheme";
import { safeLocalStorage } from "@/utils/storage";
import { productScopedStorageKey } from "@/config/productRuntime";

export const PLANNER_PATHFINDER_APPEARANCE_STORAGE_KEY = productScopedStorageKey("planner-pathfinder-appearance-v1");
const SETTINGS_CHANGE_EVENT = "planner-pathfinder-appearance-change";

type StoredPlannerPathfinderAppearance = {
  themeMode?: PlannerPathfinderThemeMode;
};

export type PlannerPathfinderAppearance = {
  themeMode: PlannerPathfinderThemeMode;
};

const normalizeAppearance = (
  appearance: StoredPlannerPathfinderAppearance | PlannerPathfinderAppearance | null | undefined,
): PlannerPathfinderAppearance => ({
  themeMode: appearance?.themeMode === "dark" ? "dark" : "light",
});

export const readStoredPlannerPathfinderAppearance = (): PlannerPathfinderAppearance => {
  const raw = safeLocalStorage.getItem(PLANNER_PATHFINDER_APPEARANCE_STORAGE_KEY);
  if (!raw) return normalizeAppearance(undefined);

  try {
    return normalizeAppearance(JSON.parse(raw) as StoredPlannerPathfinderAppearance);
  } catch {
    return normalizeAppearance(undefined);
  }
};

export const writeStoredPlannerPathfinderAppearance = (
  appearance: PlannerPathfinderAppearance,
) => {
  const normalizedAppearance = normalizeAppearance(appearance);
  safeLocalStorage.setItem(
    PLANNER_PATHFINDER_APPEARANCE_STORAGE_KEY,
    JSON.stringify(normalizedAppearance),
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<PlannerPathfinderAppearance>(SETTINGS_CHANGE_EVENT, {
      detail: normalizedAppearance,
    }));
  }
};

export const usePlannerPathfinderAppearance = () => {
  const storedAppearance = useMemo(readStoredPlannerPathfinderAppearance, []);
  const [themeMode, setThemeMode] = useState<PlannerPathfinderThemeMode>(storedAppearance.themeMode);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyStoredAppearance = (
      appearance?: StoredPlannerPathfinderAppearance | PlannerPathfinderAppearance,
    ) => {
      const normalizedAppearance = normalizeAppearance(appearance);
      setThemeMode((current) => (
        current === normalizedAppearance.themeMode ? current : normalizedAppearance.themeMode
      ));
    };

    const handleSettingsChange = (event: Event) => {
      const detail = event instanceof CustomEvent
        ? event.detail as PlannerPathfinderAppearance | undefined
        : undefined;
      applyStoredAppearance(detail ?? readStoredPlannerPathfinderAppearance());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== PLANNER_PATHFINDER_APPEARANCE_STORAGE_KEY) return;
      applyStoredAppearance(readStoredPlannerPathfinderAppearance());
    };

    window.addEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(SETTINGS_CHANGE_EVENT, handleSettingsChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    const storedAppearance = readStoredPlannerPathfinderAppearance();
    if (storedAppearance.themeMode === themeMode) return;

    writeStoredPlannerPathfinderAppearance({ themeMode });
  }, [themeMode]);

  return {
    themeMode,
    setThemeMode,
    themeModeClassName: plannerPathfinderTheme.modeVars[themeMode],
  };
};
