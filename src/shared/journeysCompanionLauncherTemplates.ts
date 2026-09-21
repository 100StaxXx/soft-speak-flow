import {
  COMPANION_PLANNER_SURFACE_ACTIONS,
  type CompanionPlannerSurfaceAction,
} from "@/shared/companionPlannerSurfaceActions";
import type { CompanionPlannerLaunchTarget, CompanionPlannerStarterIntent } from "@/types/companionPlanner";

type JourneysCompanionLauncherSurfaceActionId =
  | "plan-day"
  | "upcoming"
  | "goal";

export interface JourneysCompanionLauncherTemplate {
  id:
    | "free-talk"
    | "quest"
    | JourneysCompanionLauncherSurfaceActionId;
  label: string;
  message: string;
  target: CompanionPlannerLaunchTarget;
  starterIntent: CompanionPlannerStarterIntent;
}

const FREE_TALK_GREETINGS = [
  "How are you doing today?",
  "What's on your heart today?",
  "What would you like to work through?",
  "What needs your attention today?",
  "Would you like to reflect or make a plan?",
  "What are you carrying today?",
  "Where could you use some clarity?",
  "What would make today feel more grounded?",
  "What matters most today?",
  "How can I help you find your next step?",
  "Would a quick check-in help?",
  "What's one thing you want to approach with intention?",
  "What are you hoping to make room for?",
  "Where do you need encouragement today?",
  "Let's take a thoughtful look at your day.",
  "Tell me what today looks like from your side.",
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

const JOURNEYS_LAUNCHER_ACTION_IDS = [
  "plan-day",
  "upcoming",
  "goal",
] as const satisfies readonly JourneysCompanionLauncherSurfaceActionId[];

const JOURNEYS_LAUNCHER_ACTION_ID_SET = new Set<CompanionPlannerSurfaceAction["id"]>(
  JOURNEYS_LAUNCHER_ACTION_IDS,
);

const QUEST_LAUNCHER_TEMPLATE: JourneysCompanionLauncherTemplate = {
  id: "quest",
  label: "Action?",
  message: "New action",
  target: "auto",
  starterIntent: "general",
};

const isJourneysCompanionLauncherAction = (
  action: CompanionPlannerSurfaceAction,
): action is CompanionPlannerSurfaceAction & { id: JourneysCompanionLauncherSurfaceActionId } =>
  JOURNEYS_LAUNCHER_ACTION_ID_SET.has(action.id);

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
  const launcherActions = COMPANION_PLANNER_SURFACE_ACTIONS.filter(
    isJourneysCompanionLauncherAction,
  );
  const goalAction = launcherActions.find((action) => action.id === "goal");
  const primaryActions = launcherActions.filter((action) => action.id !== "goal");

  return [
    {
      id: "free-talk",
      label: greeting,
      message: greeting,
      target: "conversation",
      starterIntent: "free_talk_start",
    },
    ...primaryActions,
    QUEST_LAUNCHER_TEMPLATE,
    ...(goalAction ? [goalAction] : []),
  ];
};
