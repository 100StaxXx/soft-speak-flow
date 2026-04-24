import type {
  CompanionPlannerLaunchTarget,
  CompanionPlannerStarterIntent,
} from "@/types/companionPlanner";

export interface CompanionPlannerSurfaceAction {
  id:
    | "plan-day"
    | "advance-campaign"
    | "adjust-day"
    | "right-now"
    | "upcoming"
    | "quest"
    | "goal";
  label: string;
  message: string;
  target: CompanionPlannerLaunchTarget;
  starterIntent: CompanionPlannerStarterIntent;
}

export const COMPANION_PLANNER_SURFACE_ACTIONS: CompanionPlannerSurfaceAction[] =
  [
    {
      id: "plan-day",
      label: "Plan my day",
      message: "Plan my day",
      target: "planner",
      starterIntent: "plan_day",
    },
    {
      id: "advance-campaign",
      label: "Advance my campaign",
      message: "Advance my campaign",
      target: "planner",
      starterIntent: "advance_campaign_start",
    },
    {
      id: "adjust-day",
      label: "Adjust my day",
      message: "Adjust my day",
      target: "planner",
      starterIntent: "adjust_today",
    },
    {
      id: "right-now",
      label: "What should I do right now?",
      message: "What should I do right now?",
      target: "planner",
      starterIntent: "right_now_start",
    },
    {
      id: "upcoming",
      label: "What do I have coming up?",
      message: "What do I have coming up?",
      target: "planner",
      starterIntent: "upcoming_start",
    },
    {
      id: "quest",
      label: "Quest?",
      message: "Quest?",
      target: "planner",
      starterIntent: "quest_capture",
    },
    {
      id: "goal",
      label: "Let's lock in a new goal",
      message: "Let's lock in a new goal",
      target: "campaign_builder",
      starterIntent: "goal_breakdown_start",
    },
  ];
