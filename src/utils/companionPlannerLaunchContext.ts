import { format, isSameDay } from "date-fns";

import { createCompanionPlannerLaunchIntentId } from "@/shared/companionPlannerSurfaceActions";
import type {
  CompanionPlannerLaunchIntent,
  PlannerBriefingContext,
} from "@/types/companionPlanner";

export interface CompanionPlannerLaunchTask {
  id: string;
  task_text: string;
  task_date?: string | null;
  completed?: boolean | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  habit_source_id?: string | null;
  epic_id?: string | null;
  epic_title?: string | null;
  is_main_quest?: boolean | null;
  priority?: string | null;
  difficulty?: string | null;
}

export interface CompanionPlannerLaunchEpic {
  id: string;
  title: string;
  progress_percentage?: number | null;
}

interface CreatePlanDayLaunchIntentOptions {
  selectedDate: Date;
  tasks: readonly CompanionPlannerLaunchTask[];
  activeEpics?: readonly CompanionPlannerLaunchEpic[];
  currentTime?: Date;
  assumeTasksAreForSelectedDate?: boolean;
}

type PlannerInsightCategory =
  | "finish_scheduled"
  | "needs_schedule"
  | "campaign_opening"
  | "reschedule_overload"
  | "light_structured"
  | "steady_progress";

const PLANNER_INSIGHT_STATEMENTS: Record<PlannerInsightCategory, string[]> = {
  finish_scheduled: [
    "Most of the day already has a time. Finish the scheduled quests before adding anything new.",
    "The structure is already there. Protect the timed quests first, then decide if anything else deserves space.",
    "You have enough on the calendar to start. Work through the scheduled list before reshuffling.",
  ],
  needs_schedule: [
    "The list needs a little shape. Give one important quest a real time so the day has an anchor.",
    "Nothing is really protected yet. Pick the next useful quest and put it somewhere specific.",
    "Start by scheduling the piece that would make the biggest difference for a bigger goal.",
  ],
  campaign_opening: [
    "The day has room. Use one clear block to move an active campaign forward before the space disappears.",
    "You have a light runway today. Choose one campaign touchpoint and make it concrete.",
    "This is a good day to get ahead on a bigger goal: schedule one campaign step now.",
  ],
  reschedule_overload: [
    "This is more than one day can comfortably hold. Keep the fixed commitments and move the least important work before it piles up.",
    "The load is heavy and progress is thin. Reschedule the day around what truly has to happen.",
    "Treat this as a triage day: protect the timed essentials, then push or shrink the rest.",
  ],
  light_structured: [
    "You have a manageable list and the important pieces are timed. Follow the schedule before adding more.",
    "This is already a clean little plan. Stay with the timed quests and let the day stay light.",
    "The day has enough structure to move without overthinking it. Complete the scheduled pieces first.",
  ],
  steady_progress: [
    "The day is workable. Choose the next important quest, then keep the rest in a simple order.",
    "There is enough here to need a plan, but not a total rebuild. Protect the timed work and pick one clear next step.",
    "You have a steady load. Keep the order simple and avoid adding work until the current list moves.",
  ],
};

const safeFormat = (date: Date, formatString: string, fallback: string) => {
  if (Number.isNaN(date.getTime())) return fallback;
  try {
    return format(date, formatString);
  } catch {
    return fallback;
  }
};

const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return "no estimate";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours}h ${remainder}m` : `${hours}h`;
};

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  count === 1 ? singular : plural;

const formatOpenQuestPhrase = (count: number) =>
  count === 0 ? "no open quests" : `${count} open ${pluralize(count, "quest")}`;

const formatTimingPhrase = (openCount: number, scheduledCount: number) => {
  if (openCount === 0) return "nothing left to time";
  if (scheduledCount === 0) return "nothing timed yet";
  if (scheduledCount === openCount) {
    if (openCount === 1) return "already timed";
    if (openCount === 2) return "both already timed";
    return "all already timed";
  }

  const anytimeCount = openCount - scheduledCount;
  return `${scheduledCount} timed and ${anytimeCount} anytime`;
};

const formatContextPhrase = (ritualCount: number, activeCampaignCount: number) => {
  const parts = [
    ritualCount > 0
      ? `${ritualCount} ${pluralize(ritualCount, "ritual")}`
      : null,
    activeCampaignCount > 0
      ? `${activeCampaignCount} active ${pluralize(activeCampaignCount, "campaign")}`
      : null,
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) return "";
  if (parts.length === 1) return `, with ${parts[0]} in the mix`;
  return `, with ${parts.join(" and ")} in the mix`;
};

const choosePlannerInsightCategory = ({
  openQuestCount,
  scheduledQuestCount,
  completedQuestCount,
  totalQuestCount,
  estimatedMinutes,
  activeCampaignCount,
}: {
  openQuestCount: number;
  scheduledQuestCount: number;
  completedQuestCount: number;
  totalQuestCount: number;
  estimatedMinutes: number;
  activeCampaignCount: number;
}): PlannerInsightCategory => {
  const completionRatio = totalQuestCount > 0
    ? completedQuestCount / totalQuestCount
    : 0;
  const lowCompletion = totalQuestCount > 0 && completionRatio < 0.35;
  const heavyLoad = openQuestCount >= 8 || estimatedMinutes >= 420;
  const lightlyScheduled =
    openQuestCount > 0 &&
    (scheduledQuestCount === 0 ||
      (openQuestCount >= 3 && scheduledQuestCount <= 1));

  if (heavyLoad && lowCompletion) return "reschedule_overload";
  if (scheduledQuestCount >= 2 && lowCompletion) return "finish_scheduled";
  if (openQuestCount <= 2 && activeCampaignCount > 0 && scheduledQuestCount <= 1) {
    return "campaign_opening";
  }
  if (lightlyScheduled) return "needs_schedule";
  if (openQuestCount <= 2 && scheduledQuestCount > 0) return "light_structured";
  return "steady_progress";
};

const getDeterministicStatement = (
  category: PlannerInsightCategory,
  seed: string,
) => {
  const statements = PLANNER_INSIGHT_STATEMENTS[category];
  const hash = Array.from(seed).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
  return statements[hash % statements.length] ?? statements[0] ?? "";
};

const summarizeTask = (task: CompanionPlannerLaunchTask) => {
  const details = [
    task.scheduled_time ? `at ${task.scheduled_time.slice(0, 5)}` : null,
    task.estimated_duration ? formatMinutes(task.estimated_duration) : null,
    task.priority ? `${task.priority} priority` : null,
    task.epic_title ? `campaign: ${task.epic_title}` : null,
  ].filter(Boolean);

  return details.length > 0
    ? `${task.task_text} (${details.join(", ")})`
    : task.task_text;
};

export const createPlanDayBriefingContext = ({
  selectedDate,
  tasks,
  activeEpics = [],
  currentTime = new Date(),
  assumeTasksAreForSelectedDate = false,
}: CreatePlanDayLaunchIntentOptions): PlannerBriefingContext => {
  const selectedDateKey = safeFormat(selectedDate, "yyyy-MM-dd", "");
  const dateLabel = safeFormat(selectedDate, "EEEE, MMMM d", "this day");
  const tasksForDate = assumeTasksAreForSelectedDate
    ? tasks
    : tasks.filter((task) => task.task_date === selectedDateKey);
  const completedTasks = tasksForDate.filter((task) => Boolean(task.completed));
  const openTasks = tasksForDate.filter((task) => !task.completed);
  const scheduledTasks = openTasks.filter((task) => Boolean(task.scheduled_time));
  const anytimeTasks = openTasks.length - scheduledTasks.length;
  const ritualTasks = openTasks.filter((task) => Boolean(task.habit_source_id));
  const mainQuests = openTasks.filter((task) => Boolean(task.is_main_quest));
  const estimatedMinutes = openTasks.reduce((total, task) => {
    const minutes = task.estimated_duration ?? 0;
    return Number.isFinite(minutes) && minutes > 0 ? total + minutes : total;
  }, 0);
  const activeCampaignTitles = activeEpics
    .map((epic) => epic.title.trim())
    .filter(Boolean)
    .slice(0, 4);
  const loadSignal =
    openTasks.length >= 8 || estimatedMinutes >= 420
      ? "heavy"
      : openTasks.length <= 2 && estimatedMinutes <= 90
        ? "light"
        : "steady";

  const insightCategory = choosePlannerInsightCategory({
    openQuestCount: openTasks.length,
    scheduledQuestCount: scheduledTasks.length,
    completedQuestCount: completedTasks.length,
    totalQuestCount: tasksForDate.length,
    estimatedMinutes,
    activeCampaignCount: activeEpics.length,
  });
  const statementSeed = [
    selectedDateKey,
    insightCategory,
    openTasks.length,
    scheduledTasks.length,
    completedTasks.length,
    activeEpics.length,
  ].join(":");
  const plannerInsightStatement = getDeterministicStatement(
    insightCategory,
    statementSeed,
  );
  const estimatePhrase = estimatedMinutes > 0
    ? `with about ${formatMinutes(estimatedMinutes)} planned`
    : "with no time estimate yet";
  const progressSentence = tasksForDate.length > 0
    ? `You're ${completedTasks.length} of ${tasksForDate.length} complete${
      formatContextPhrase(ritualTasks.length, activeEpics.length)
    }.`
    : activeEpics.length > 0
      ? `No quests are scheduled here yet, with ${activeEpics.length} active ${
        pluralize(activeEpics.length, "campaign")
      } waiting for a next step.`
      : "No quests are scheduled here yet.";

  const content = [
    `${dateLabel} looks ${loadSignal}: ${formatOpenQuestPhrase(openTasks.length)}, ${formatTimingPhrase(openTasks.length, scheduledTasks.length)}, ${estimatePhrase}.`,
    progressSentence,
  ].join(" ");

  const todayGuardrail = isSameDay(selectedDate, currentTime)
    ? " Because this is today, avoid proposing times that have already passed."
    : "";

  return {
    content,
    focus:
      loadSignal === "heavy"
        ? "Keep this day realistic and offer a lighter version."
        : "Turn the current quest load into a useful plan.",
    actionPrompt:
      `Preserve timed quests, avoid overload, cap the plan to the quests that matter, and explain why the order makes sense.${todayGuardrail}`,
    inferredGoals: activeCampaignTitles,
    dataSnapshot: {
      selectedDate: selectedDateKey,
      dateLabel,
      openQuestCount: openTasks.length,
      scheduledQuestCount: scheduledTasks.length,
      anytimeQuestCount: anytimeTasks,
      ritualQuestCount: ritualTasks.length,
      mainQuestCount: mainQuests.length,
      completedQuestCount: completedTasks.length,
      totalQuestCount: tasksForDate.length,
      estimatedMinutes,
      estimatedLoadLabel: formatMinutes(estimatedMinutes),
      loadSignal,
      plannerInsightCategory: insightCategory,
      plannerInsightStatement,
      activeCampaignCount: activeEpics.length,
      activeCampaignTitles,
      activeCampaigns: activeEpics.slice(0, 8).map((epic) => ({
        id: epic.id,
        title: epic.title,
        progress_percentage: epic.progress_percentage ?? null,
      })),
      topOpenQuests: openTasks.slice(0, 6).map(summarizeTask),
      visibleQuests: openTasks.slice(0, 12).map((task) => ({
        id: task.id,
        task_text: task.task_text,
        task_date: task.task_date ?? null,
        completed: task.completed ?? false,
        scheduled_time: task.scheduled_time ?? null,
        estimated_duration: task.estimated_duration ?? null,
        habit_source_id: task.habit_source_id ?? null,
        epic_id: task.epic_id ?? null,
        epic_title: task.epic_title ?? null,
        is_main_quest: task.is_main_quest ?? false,
        priority: task.priority ?? null,
      })),
    },
  };
};

export const createPlanDayCompanionLaunchIntent = (
  options: CreatePlanDayLaunchIntentOptions,
): CompanionPlannerLaunchIntent => {
  const currentTime = options.currentTime ?? new Date();
  const selectedDateKey = safeFormat(options.selectedDate, "yyyy-MM-dd", "");
  const dateLabel = safeFormat(options.selectedDate, "EEEE, MMMM d", "this day");
  const isSelectedToday = isSameDay(options.selectedDate, currentTime);

  return {
    id: createCompanionPlannerLaunchIntentId(),
    message: isSelectedToday ? "Plan my day" : `Plan my day for ${dateLabel}`,
    starterIntent: "plan_day",
    target: "planner",
    selectedDate: selectedDateKey || null,
    briefingContext: createPlanDayBriefingContext({
      ...options,
      currentTime,
    }),
  };
};
