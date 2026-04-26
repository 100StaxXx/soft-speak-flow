export const COMPANION_PLANNER_OPENER_TEMPLATES: readonly string[] = [];

const DEFAULT_COMPANION_PLANNER_OPENER = "";

const getPlannerDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getStableIndex = (seed: string, length: number) => {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) % length;
};

export const getCompanionPlannerOpener = ({
  date = new Date(),
  userId = null,
}: {
  date?: Date;
  userId?: string | null;
} = {}) => {
  if (COMPANION_PLANNER_OPENER_TEMPLATES.length === 0) {
    return DEFAULT_COMPANION_PLANNER_OPENER;
  }

  const seed = `${getPlannerDayKey(date)}:${userId ?? "anonymous"}:planner`;
  return COMPANION_PLANNER_OPENER_TEMPLATES[
    getStableIndex(seed, COMPANION_PLANNER_OPENER_TEMPLATES.length)
  ] ?? DEFAULT_COMPANION_PLANNER_OPENER;
};
