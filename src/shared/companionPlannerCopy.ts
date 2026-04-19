export const COMPANION_PLANNER_OPENER_TEMPLATES = [
  "What's gucci, fam. Hand me the calendar.",
  "Let's see what's coming up before the day starts freelancing.",
  "Show me the board. We're making room for what actually matters.",
  "Calendar check. We protect the priorities and cut the noise.",
  "All right, let's sort this day out before it gets disrespectful.",
  "You bring the goals. I'll help make the time.",
] as const;

export const COMPANION_PLANNER_STARTER_TEMPLATES = [
  "Plan my day.",
  "What do I have coming up?",
  "Help me make time for what matters most today.",
  "Help me break down a big goal.",
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
