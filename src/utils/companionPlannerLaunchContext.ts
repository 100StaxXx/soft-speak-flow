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

  const content = [
    `Planning snapshot for ${dateLabel}: ${openTasks.length} open quests`,
    `(${scheduledTasks.length} timed, ${anytimeTasks} anytime)`,
    `${ritualTasks.length} rituals`,
    `${completedTasks.length}/${tasksForDate.length} complete`,
    `${activeEpics.length} active campaigns`,
    `${formatMinutes(estimatedMinutes)} estimated`,
  ].join(", ");

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
