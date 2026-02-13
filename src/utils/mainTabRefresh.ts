export type MainTabPath = "/mentor" | "/inbox" | "/journeys" | "/companion";

const CORE_REFRESH_PREFIXES = [
  "profile",
  "selected-mentor",
  "mentor-personality",
  "calendar-connections",
  "calendar-user-settings",
  "inbox-count",
] as const;

const TAB_REFRESH_PREFIXES: Record<MainTabPath, readonly string[]> = {
  "/mentor": [
    "mentor-page-data",
    "morning-check-in",
    "morning-briefing",
    "weekly-recap",
    "weekly-recaps-all",
    "daily-plan-optimization",
  ],
  "/inbox": ["inbox-tasks", "inbox-count"],
  "/journeys": [
    "daily-tasks",
    "calendar-tasks",
    "habit-surfacing",
    "recurring-templates",
    "epics",
    "habits",
    "quest-calendar-links",
    "streak-at-risk",
  ],
  "/companion": [
    "companion",
    "daily-missions",
    "xp-breakdown",
    "evolution-cards",
    "companion-story",
    "companion-stories-all",
    "companion-postcards",
    "postcards-epics",
    "achievements",
    "epic-rewards",
    "user-epic-rewards",
    "bad-habits",
    "resist-log",
    "memorial-wall",
    "companion-health",
    "companion-lifecycle",
    "companion-mood",
  ],
};

export const MAIN_TAB_REFRESH_EVENT = "main-tab-refresh" as const;

export interface MainTabRefreshEventDetail {
  path: MainTabPath;
  source: "pull-to-refresh";
  triggeredAt: number;
}

export const getCoreRefreshPrefixes = (): string[] => [...CORE_REFRESH_PREFIXES];

export const getTabRefreshPrefixes = (path: MainTabPath): string[] => [
  ...TAB_REFRESH_PREFIXES[path],
];

const matchesPrefix = (keyPrefix: string, targetPrefix: string): boolean => {
  if (keyPrefix === targetPrefix) return true;
  return keyPrefix.startsWith(`${targetPrefix}-`);
};

export const buildRefreshPredicate = (path: MainTabPath) => {
  const allowedPrefixes = new Set([
    ...getCoreRefreshPrefixes(),
    ...getTabRefreshPrefixes(path),
  ]);

  return (query: { queryKey: readonly unknown[] }): boolean => {
    const head = query.queryKey[0];
    if (typeof head !== "string") return false;

    for (const prefix of allowedPrefixes) {
      if (matchesPrefix(head, prefix)) {
        return true;
      }
    }

    return false;
  };
};

export const dispatchMainTabRefreshEvent = (detail: MainTabRefreshEventDetail) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<MainTabRefreshEventDetail>(MAIN_TAB_REFRESH_EVENT, {
      detail,
    }),
  );
};

declare global {
  interface WindowEventMap {
    "main-tab-refresh": CustomEvent<MainTabRefreshEventDetail>;
  }
}
