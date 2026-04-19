export const COMPANION_PLANNER_OPENER_TEMPLATES = [
  "The road's open. What are we setting in motion?",
] as const;

export const COMPANION_PLANNER_STARTER_TEMPLATES = [
  "Show me today's route.",
  "Help me make room for what matters.",
  "Help me break a big goal into steps.",
] as const;

const DEFAULT_COMPANION_PLANNER_OPENER = COMPANION_PLANNER_OPENER_TEMPLATES[0];

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
  const seed = `${getPlannerDayKey(date)}:${userId ?? "anonymous"}:planner`;
  return COMPANION_PLANNER_OPENER_TEMPLATES[
    getStableIndex(seed, COMPANION_PLANNER_OPENER_TEMPLATES.length)
  ] ?? DEFAULT_COMPANION_PLANNER_OPENER;
};
