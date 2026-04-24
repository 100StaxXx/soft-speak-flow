import { COMPANION_PLANNER_SURFACE_ACTIONS } from "@/shared/companionPlannerSurfaceActions";
import type { CompanionPlanningMode } from "@/shared/companionPlanningMode";
import type { CompanionPlannerLaunchTarget, CompanionPlannerStarterIntent } from "@/types/companionPlanner";

export interface JourneysCompanionLauncherTemplate {
  id:
    | "free-talk"
    | "plan-day"
    | "advance-campaign"
    | "adjust-day"
    | "low-energy"
    | "what-matters"
    | "right-now"
    | "upcoming"
    | "quest"
    | "goal";
  label: string;
  message: string;
  target: CompanionPlannerLaunchTarget;
  starterIntent: CompanionPlannerStarterIntent;
  planningMode?: CompanionPlanningMode | null;
}

const FREE_TALK_GREETINGS = [
  "What's good, friend?",
  "What's good, buddy?",
  "What's good, guy?",
  "What's good, dude?",
  "What's good, amigo?",
  "What's good, boss?",
  "What's good, fam?",
  "What's good, chief?",
  "What's good, captain?",
  "What's good, partner?",
  "What's good, legend?",
  "What's good, mon ami?",
  "What's good, pal?",
  "What's good, champ?",
  "What's good, homie?",
  "What's good today?",
] as const;

const getPlannerDayKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  return `${year}-${month}-${day}:${hour}`;
};

const getStableIndex = (seed: string, length: number) => {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash) % length;
};

export const getJourneysCompanionLauncherGreeting = ({
  date = new Date(),
  userId = null,
}: {
  date?: Date;
  userId?: string | null;
} = {}) => {
  const seed = `${getPlannerDayKey(date)}:${userId ?? "anonymous"}:journeys-launcher-greeting`;
  return FREE_TALK_GREETINGS[getStableIndex(seed, FREE_TALK_GREETINGS.length)] ?? FREE_TALK_GREETINGS[0];
};

export const getJourneysCompanionLauncherTemplates = ({
  date = new Date(),
  userId = null,
}: {
  date?: Date;
  userId?: string | null;
} = {}): JourneysCompanionLauncherTemplate[] => {
  const greeting = getJourneysCompanionLauncherGreeting({ date, userId });

  return [
    {
      id: "free-talk",
      label: greeting,
      message: greeting,
      target: "conversation",
      starterIntent: "free_talk_start",
    },
    ...COMPANION_PLANNER_SURFACE_ACTIONS,
  ];
};
