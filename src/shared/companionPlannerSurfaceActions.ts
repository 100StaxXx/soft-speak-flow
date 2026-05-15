import type {
  CompanionPlannerLaunchIntent,
  CompanionPlannerLaunchTarget,
  CompanionPlannerStarterIntent,
} from "@/types/companionPlanner";

export interface CompanionPlannerSurfaceAction {
  id:
    | "plan-day"
    | "prepare-tomorrow"
    | "advance-campaign"
    | "make-room"
    | "low-energy"
    | "what-matters"
    | "upcoming"
    | "quest"
    | "goal";
  label: string;
  message: string;
  target: CompanionPlannerLaunchTarget;
  starterIntent: CompanionPlannerStarterIntent;
}

export const COMPANION_PLANNER_QUEST_CAPTURE_OPENING = "New Quest";

export type CompanionPlannerQuestCaptureLaunchSource =
  | "companion_planner"
  | "empty_journeys";

export interface CompanionPlannerQuestCaptureLaunchIntentOptions {
  source?: CompanionPlannerQuestCaptureLaunchSource;
  companionLabel?: string | null;
  dateLabel?: string | null;
  selectedDate?: string | null;
}

export const createCompanionPlannerLaunchIntentId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const normalizeOpeningLabel = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, " ") ?? "";

const toPossessiveName = (value: string | null | undefined) => {
  const label = normalizeOpeningLabel(value);
  if (!label) return "I'm";
  return `${label}${label.endsWith("s") ? "'" : "'s"}`;
};

export const createCompanionPlannerQuestCaptureOpening = (
  options: CompanionPlannerQuestCaptureLaunchIntentOptions = {},
) => {
  if (options.source === "empty_journeys") {
    const dateLabel = normalizeOpeningLabel(options.dateLabel);
    return dateLabel
      ? `Clean slate for ${dateLabel}. What quest should we add?`
      : "Clean slate. What quest should we add?";
  }

  return `${toPossessiveName(options.companionLabel)} ready. What quest are we capturing?`;
};

export const createCompanionPlannerQuestCaptureLaunchIntent =
  (
    options: CompanionPlannerQuestCaptureLaunchIntentOptions = {},
  ): CompanionPlannerLaunchIntent => ({
    id: createCompanionPlannerLaunchIntentId(),
    message: createCompanionPlannerQuestCaptureOpening(options),
    starterIntent: "quest_capture",
    target: "planner",
    briefingContext: null,
    ...(options.selectedDate ? { selectedDate: options.selectedDate } : {}),
  });

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
      id: "upcoming",
      label: "What do I have coming up?",
      message: "What do I have coming up?",
      target: "planner",
      starterIntent: "upcoming_start",
    },
    {
      id: "quest",
      label: "Quest?",
      message: COMPANION_PLANNER_QUEST_CAPTURE_OPENING,
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
