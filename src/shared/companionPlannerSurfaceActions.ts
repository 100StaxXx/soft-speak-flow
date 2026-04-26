import type {
  CompanionPlannerLaunchTarget,
  CompanionPlannerStarterIntent,
} from "@/types/companionPlanner";

export interface CompanionPlannerSurfaceAction {
  id:
    | "plan-week"
    | "plan-day"
    | "prepare-tomorrow"
    | "advance-campaign"
    | "adjust-day"
    | "make-room"
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
}

export const COMPANION_PLANNER_SURFACE_ACTIONS: CompanionPlannerSurfaceAction[] =
  [
    {
      id: "plan-week",
      label: "Plan my week",
      message: "Plan my week",
      target: "planner",
      starterIntent: "plan_week",
    },
    {
      id: "plan-day",
      label: "Plan my day",
      message: "Plan my day",
      target: "planner",
      starterIntent: "plan_day",
    },
    {
      id: "prepare-tomorrow",
      label: "Prepare me for tomorrow",
      message: "Prepare me for tomorrow",
      target: "planner",
      starterIntent: "briefing_followup",
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
      id: "make-room",
      label: "Make room",
      message: "Make room",
      target: "planner",
      starterIntent: "make_room",
    },
    {
      id: "low-energy",
      label: "I'm low energy",
      message: "I'm low energy",
      target: "planner",
      starterIntent: "low_energy_adjust",
    },
    {
      id: "what-matters",
      label: "What matters most?",
      message: "What matters most?",
      target: "planner",
      starterIntent: "what_matters",
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
