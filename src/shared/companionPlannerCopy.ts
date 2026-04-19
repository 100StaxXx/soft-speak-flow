export const COMPANION_PLANNER_OPENER_TEMPLATES = [
  "I'm here. Ask what's coming up, talk through the day, or tell me what you want to change.",
  "Let's look at what's ahead and make the day feel more manageable.",
  "We can sort through your schedule, talk it out, or turn something into a concrete plan.",
  "Tell me what's on your mind, and I'll help you shape the next move.",
  "Ask about today, tomorrow, or the week ahead, and we'll work from there.",
  "Bring me the messy version. I'll help you make sense of it.",
] as const;

export const COMPANION_PLANNER_STARTER_TEMPLATES = [
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
