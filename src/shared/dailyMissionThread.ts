export type DailyMissionIntention = "finish" | "progress" | "recover";

export interface MissionThreadTask {
  id: string;
  task_text: string;
  completed?: boolean | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  is_main_quest?: boolean | null;
  difficulty?: string | null;
  priority?: string | null;
  category?: string | null;
  epic_id?: string | null;
}

export interface MissionThreadCalendarEvent {
  scheduledTime: string | null;
  estimatedDuration: number;
  isAllDay: boolean;
}

export interface DailyMissionRecommendation {
  intention: DailyMissionIntention;
  intentionLabel: string;
  primaryTaskId: string | null;
  primaryTaskTitle: string;
  primaryTaskDurationMinutes: number;
  optionalTaskIds: string[];
  optionalTaskTitles: string[];
  calendarSummary: string;
  companionAck: string;
  availableMinutes: number;
}

export const DAILY_MISSION_INTENTIONS: ReadonlyArray<{
  key: DailyMissionIntention;
  label: string;
  description: string;
}> = [
  { key: "finish", label: "Finish something", description: "Close one open loop." },
  { key: "progress", label: "Make progress", description: "Move a larger quest forward." },
  { key: "recover", label: "Recover", description: "Protect energy and keep the day gentle." },
];

const DAY_START_MINUTES = 8 * 60;
const DAY_END_MINUTES = 20 * 60;
const DEFAULT_TASK_DURATION_MINUTES = 30;

const parseTimeMinutes = (value: string | null | undefined): number | null => {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d/.test(value)) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

const clampDuration = (value: number | null | undefined): number => {
  if (!value || !Number.isFinite(value)) return DEFAULT_TASK_DURATION_MINUTES;
  return Math.min(8 * 60, Math.max(5, Math.round(value)));
};

interface BusyInterval {
  start: number;
  end: number;
}

const collectBusyIntervals = (
  tasks: MissionThreadTask[],
  events: MissionThreadCalendarEvent[],
): BusyInterval[] => {
  const taskIntervals = tasks.flatMap((task) => {
    if (task.completed) return [];
    const start = parseTimeMinutes(task.scheduled_time);
    if (start === null) return [];
    return [{ start, end: start + clampDuration(task.estimated_duration) }];
  });

  const eventIntervals = events.flatMap((event) => {
    if (event.isAllDay) return [];
    const start = parseTimeMinutes(event.scheduledTime);
    if (start === null) return [];
    return [{ start, end: start + clampDuration(event.estimatedDuration) }];
  });

  return [...taskIntervals, ...eventIntervals]
    .map(({ start, end }) => ({
      start: Math.max(DAY_START_MINUTES, start),
      end: Math.min(DAY_END_MINUTES, end),
    }))
    .filter(({ start, end }) => end > start)
    .sort((left, right) => left.start - right.start);
};

const getLargestFreeWindowMinutes = (intervals: BusyInterval[]): number => {
  let cursor = DAY_START_MINUTES;
  let largestGap = 0;

  for (const interval of intervals) {
    largestGap = Math.max(largestGap, interval.start - cursor);
    cursor = Math.max(cursor, interval.end);
  }

  return Math.max(largestGap, DAY_END_MINUTES - cursor, 0);
};

const scoreTask = (
  task: MissionThreadTask,
  intention: DailyMissionIntention,
  availableMinutes: number,
): number => {
  const duration = clampDuration(task.estimated_duration);
  const priority = task.priority?.toLowerCase();
  const difficulty = task.difficulty?.toLowerCase();
  const category = task.category?.toLowerCase() ?? "";
  let score = 0;

  if (duration <= availableMinutes) score += 30;
  else score -= Math.min(30, Math.ceil((duration - availableMinutes) / 10));
  if (task.scheduled_time) score += 8;
  if (task.is_main_quest) score += intention === "recover" ? 2 : 24;
  if (priority === "high") score += intention === "recover" ? 0 : 18;
  if (priority === "medium") score += 6;

  if (intention === "finish") {
    if (duration <= 45) score += 18;
    if (difficulty === "easy") score += 8;
  } else if (intention === "progress") {
    if (task.epic_id) score += 25;
    if (duration >= 25 && duration <= 90) score += 12;
    if (difficulty === "hard") score += 6;
  } else {
    if (duration <= 20) score += 30;
    else if (duration <= 30) score += 15;
    if (difficulty === "easy") score += 18;
    if (/rest|recover|walk|stretch|break|sleep|reset|care/.test(category)) score += 20;
    if (/rest|recover|walk|stretch|break|reset|breathe/i.test(task.task_text)) score += 20;
  }

  return score;
};

const formatWindow = (minutes: number): string => {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours} hours`;
};

const getFallbackTitle = (intention: DailyMissionIntention): string => {
  if (intention === "recover") return "Protect one 10-minute recovery window";
  if (intention === "progress") return "Choose one 15-minute next step";
  return "Close one small open loop";
};

export function buildDailyMissionRecommendation(input: {
  intention: DailyMissionIntention;
  tasks: MissionThreadTask[];
  calendarEvents?: MissionThreadCalendarEvent[];
}): DailyMissionRecommendation {
  const { intention } = input;
  const calendarEvents = input.calendarEvents ?? [];
  const openTasks = input.tasks.filter((task) => !task.completed);
  const hasAllDayCommitment = calendarEvents.some((event) => event.isAllDay);
  const freeWindowMinutes = getLargestFreeWindowMinutes(collectBusyIntervals(openTasks, calendarEvents));
  const intentionCap = intention === "recover" ? 20 : intention === "finish" ? 45 : 90;
  const availableMinutes = Math.max(10, Math.min(freeWindowMinutes || 10, intentionCap));
  const rankedTasks = [...openTasks].sort((left, right) =>
    scoreTask(right, intention, availableMinutes) - scoreTask(left, intention, availableMinutes),
  );
  const primary = rankedTasks[0] ?? null;
  const optional = rankedTasks.slice(1, 3);
  const intentionLabel = DAILY_MISSION_INTENTIONS.find((option) => option.key === intention)?.label
    ?? "Make progress";
  const primaryTaskTitle = primary?.task_text.trim() || getFallbackTitle(intention);
  const primaryTaskDurationMinutes = primary
    ? Math.min(clampDuration(primary.estimated_duration), availableMinutes)
    : intention === "recover" ? 10 : 15;

  const calendarSummary = hasAllDayCommitment
    ? `Your calendar carries an all-day commitment, so this mission stays deliberately small: ${primaryTaskDurationMinutes} minutes.`
    : calendarEvents.length > 0
      ? `Your largest open window is about ${formatWindow(freeWindowMinutes)}. This mission fits inside it.`
      : `No external calendar blocks are competing with this ${primaryTaskDurationMinutes}-minute mission.`;

  const companionAck = intention === "recover"
    ? `Recovery is the mission today. I’ll treat “${primaryTaskTitle}” as enough.`
    : intention === "finish"
      ? `Let’s close one loop: “${primaryTaskTitle}.” Everything else is optional.`
      : `I’ll keep watch on the larger path. Today’s move is “${primaryTaskTitle}.”`;

  return {
    intention,
    intentionLabel,
    primaryTaskId: primary?.id ?? null,
    primaryTaskTitle,
    primaryTaskDurationMinutes,
    optionalTaskIds: optional.map((task) => task.id),
    optionalTaskTitles: optional.map((task) => task.task_text.trim()).filter(Boolean),
    calendarSummary,
    companionAck,
    availableMinutes: freeWindowMinutes,
  };
}
