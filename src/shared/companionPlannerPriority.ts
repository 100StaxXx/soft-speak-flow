import {
  getCompanionBehaviorAwardIntent,
  shouldAwardHardTaskResolve,
  type CompanionStatAttribute,
  type CompanionStatNeed,
} from "./companionStatSignals.ts";

export type PlannerPriorityStarterIntent =
  | "general"
  | "plan_day"
  | "make_room"
  | "what_matters"
  | "relationship_touch"
  | "adjust_today"
  | "low_energy_adjust"
  | "briefing_followup"
  | "goal_breakdown"
  | "free_talk_start"
  | "upcoming_start"
  | "quest_capture"
  | "goal_breakdown_start";

export interface PlannerPriorityTaskInput {
  id: string;
  title: string;
  taskDate: string | null;
  category?: string | null;
  scheduledTime: string | null;
  estimatedDuration: number | null;
  difficulty?: string | null;
  recurrencePattern: string | null;
  completed?: boolean | null;
  priority?: string | null;
  source?: string | null;
  habitSourceId?: string | null;
  epicId?: string | null;
  epicTitle?: string | null;
  contactId?: string | null;
}

export interface PlannerPriorityEpicInput {
  id: string;
  title: string;
  endDate: string | null;
  progressPercentage?: number | null;
  daysRemaining?: number | null;
  habitCount?: number | null;
}

export interface PlannerPriorityRitualInput {
  id: string;
  epicId: string;
  epicTitle: string;
  title: string;
  frequency: string | null;
  preferredTime: string | null;
  currentStreak?: number | null;
}

export interface PlannerPriorityContactInput {
  id: string;
  name: string;
  daysSinceContact: number;
  hasOverdueReminder: boolean;
  reminderReason?: string | null;
}

export interface PlannerPriorityCalendarEventInput {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
  provider: string;
  readOnly: boolean;
}

export interface PlannerPriorityScheduleInsightsInput {
  selectedDate: string;
  dayLoads: Array<{
    date: string;
    totalMinutes: number;
    taskCount: number;
    status: "open" | "balanced" | "busy" | "overloaded";
  }>;
  conflicts: Array<{
    date: string;
    taskAId: string;
    taskBId: string;
    overlapMinutes: number;
  }>;
  suggestedSlots: Array<{
    date: string;
    time: string;
    endTime: string;
    score: number;
    reason: string;
  }>;
}

export interface PlannerPriorityMemoryInput {
  preferredTimeOfDay?: string | null;
  wakeTime?: string | null;
  windDownTime?: string | null;
  peakProductivityTimes?: string[];
  preferredWindows?: Array<{
    timeOfDay: string;
    time?: string | null;
    reason?: string | null;
    sourceCount?: number;
  }>;
  workloadTolerance?: "light" | "normal" | "heavy" | null;
}

export interface PlannerPriorityAISignalsInput {
  suggestedWorkload?: "light" | "normal" | "heavy";
}

export interface PlannerPriorityStatInterpretationInput {
  statProfile: {
    dominantStat: CompanionStatAttribute;
    secondaryStat: CompanionStatAttribute;
  };
  statNeeds: Record<CompanionStatAttribute, CompanionStatNeed>;
  momentumState: string;
  recentMissInterpretation: string;
  narrativeBrief: string;
}

export interface PlannerPriorityReflectionSignalInput {
  date: string;
  source: "check_in" | "reflection";
  mood: string;
  energy?: "low" | "medium" | "high" | null;
  tomorrowAdjustment?: string | null;
}

export interface PlannerPriorityCareSignalsInput {
  overallCare: number;
  hasDormancyWarning: boolean;
  inactiveDays: number;
  daysUntilDormancy: number | null;
}

export interface PlannerPriorityBriefingContextInput {
  content: string;
  actionPrompt?: string | null;
  focus?: string | null;
  inferredGoals?: string[];
}

export interface PlannerPriorityScore {
  id: string;
  kind: "task" | "ritual" | "epic" | "contact" | "recovery";
  title: string;
  score: number;
  reasons: string[];
  taskId?: string | null;
  epicId?: string | null;
  ritualId?: string | null;
  contactId?: string | null;
  targetDate?: string | null;
  suggestedTime?: string | null;
}

export interface ComputePlannerPriorityScoresInput {
  currentDate: string;
  tasks: PlannerPriorityTaskInput[];
  inboxTasks: PlannerPriorityTaskInput[];
  activeEpics: PlannerPriorityEpicInput[];
  rituals: PlannerPriorityRitualInput[];
  calendarEvents: PlannerPriorityCalendarEventInput[];
  contactsNeedingAttention?: PlannerPriorityContactInput[];
  reflectionSignals?: PlannerPriorityReflectionSignalInput[];
  careSignals?: PlannerPriorityCareSignalsInput | null;
  briefingContext?: PlannerPriorityBriefingContextInput | null;
  starterIntent?: PlannerPriorityStarterIntent | null;
  scheduleInsights?: PlannerPriorityScheduleInsightsInput;
  plannerMemory?: PlannerPriorityMemoryInput;
  statInterpretation?: PlannerPriorityStatInterpretationInput;
  aiSignals?: PlannerPriorityAISignalsInput;
}

const LOW_ENERGY_HINTS = [
  "tired",
  "drained",
  "fried",
  "exhausted",
  "overwhelmed",
  "burned out",
  "low energy",
];

const HIGH_ENERGY_HINTS = [
  "locked in",
  "energized",
  "sharp",
  "good",
  "great",
  "strong",
  "ready",
];

const parseDateKey = (dateKey: string | null | undefined): Date | null => {
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseClockTime = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hours = Number.parseInt(match[1] ?? "", 10);
  const minutes = Number.parseInt(match[2] ?? "", 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const getDayPart = (time: string | null | undefined): string | null => {
  const minutes = parseClockTime(time);
  if (minutes === null) return null;
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  if (minutes < 21 * 60) return "evening";
  return "night";
};

const getDaysUntil = (fromDateKey: string, toDateKey: string | null | undefined): number | null => {
  const from = parseDateKey(fromDateKey);
  const to = parseDateKey(toDateKey);
  if (!from || !to) return null;
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const inferEnergy = (
  starterIntent: PlannerPriorityStarterIntent | null | undefined,
  reflectionSignals: PlannerPriorityReflectionSignalInput[] | undefined,
  briefingContext: PlannerPriorityBriefingContextInput | null | undefined,
): "low" | "medium" | "high" => {
  if (starterIntent === "low_energy_adjust") return "low";

  const latestSignal = reflectionSignals?.[0];
  if (latestSignal?.energy) return latestSignal.energy;

  const moodHaystack = [
    latestSignal?.mood,
    latestSignal?.tomorrowAdjustment,
    briefingContext?.content,
    briefingContext?.actionPrompt,
    briefingContext?.focus,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  if (LOW_ENERGY_HINTS.some((hint) => moodHaystack.includes(hint))) return "low";
  if (HIGH_ENERGY_HINTS.some((hint) => moodHaystack.includes(hint))) return "high";
  return "medium";
};

const getPreferredDayPart = (plannerMemory: PlannerPriorityMemoryInput | undefined): string | null => {
  const preferredWindow = plannerMemory?.preferredWindows?.[0];
  if (preferredWindow?.timeOfDay) return preferredWindow.timeOfDay;
  return plannerMemory?.preferredTimeOfDay ?? null;
};

const getSuggestedSlot = (
  scheduleInsights: PlannerPriorityScheduleInsightsInput | undefined,
  targetDate: string | null | undefined,
  preferredDayPart: string | null,
) => {
  if (!scheduleInsights || !targetDate) return null;
  const matchingSlots = scheduleInsights.suggestedSlots.filter((slot) => slot.date === targetDate);
  if (matchingSlots.length === 0) return null;

  if (preferredDayPart) {
    const preferredSlot = matchingSlots.find((slot) => getDayPart(slot.time) === preferredDayPart);
    if (preferredSlot) return preferredSlot;
  }

  return matchingSlots[0] ?? null;
};

const getEpicById = (
  epics: PlannerPriorityEpicInput[],
  epicId: string | null | undefined,
) => epics.find((epic) => epic.id === epicId) ?? null;

const pushReason = (reasons: string[], condition: boolean, reason: string) => {
  if (condition) reasons.push(reason);
};

const getNeedWeight = (level: CompanionStatNeed["level"]) =>
  level === "high" ? 18 : level === "medium" ? 10 : 0;

const getTaskStatMatch = (task: PlannerPriorityTaskInput): CompanionStatAttribute | null => {
  const intent = getCompanionBehaviorAwardIntent({
    title: task.title,
    category: task.category,
    difficulty: task.difficulty,
    priority: task.priority,
    epicTitle: task.epicTitle,
    contactId: task.contactId,
  });

  if (intent) return intent.attribute;
  if (shouldAwardHardTaskResolve({ difficulty: task.difficulty, priority: task.priority })) {
    return "resolve";
  }

  return null;
};

const scoreTask = (
  input: ComputePlannerPriorityScoresInput,
  task: PlannerPriorityTaskInput,
  inferredEnergy: "low" | "medium" | "high",
  preferredDayPart: string | null,
): PlannerPriorityScore | null => {
  if (task.completed) return null;

  let score = 8;
  const reasons: string[] = [];
  const daysUntil = getDaysUntil(input.currentDate, task.taskDate);
  const epic = getEpicById(input.activeEpics, task.epicId);
  const dayLoad = task.taskDate
    ? input.scheduleInsights?.dayLoads.find((entry) => entry.date === task.taskDate)
    : null;
  const suggestedSlot = getSuggestedSlot(input.scheduleInsights, task.taskDate, preferredDayPart);
  const hasConflict = input.scheduleInsights?.conflicts.some((conflict) =>
    conflict.taskAId === task.id || conflict.taskBId === task.id
  ) ?? false;
  const statMatch = getTaskStatMatch(task);

  if (daysUntil !== null) {
    if (daysUntil < 0) {
      score += 34;
      reasons.push("overdue already");
    } else if (daysUntil === 0) {
      score += 28;
      reasons.push("due today");
    } else if (daysUntil === 1) {
      score += 16;
      reasons.push("due tomorrow");
    } else if (daysUntil <= 3) {
      score += 8;
      reasons.push("coming up soon");
    }
  } else if (!task.taskDate) {
    score += 6;
    reasons.push("still floating without a date");
  }

  if (task.priority === "high") {
    score += 14;
    reasons.push("already marked high priority");
  }

  if (task.habitSourceId) {
    score += 12;
    reasons.push("protects an existing streak");
  }

  if (epic) {
    const progress = epic.progressPercentage ?? 0;
    const epicDaysRemaining = epic.daysRemaining ?? getDaysUntil(input.currentDate, epic.endDate);
    if (epicDaysRemaining !== null && epicDaysRemaining <= 7 && progress < 80) {
      score += 12;
      reasons.push("supports a deadline-sensitive epic");
    } else if (progress < 50) {
      score += 6;
      reasons.push("moves an active epic forward");
    }
  }

  if (task.contactId) {
    const relatedContact = input.contactsNeedingAttention?.find((contact) => contact.id === task.contactId);
    if (relatedContact) {
      score += relatedContact.hasOverdueReminder ? 16 : 10;
      reasons.push("helps a relationship that is getting cold");
    }
  }

  if (preferredDayPart) {
    const scheduledDayPart = getDayPart(task.scheduledTime);
    if (scheduledDayPart && scheduledDayPart === preferredDayPart) {
      score += 6;
      reasons.push(`fits your usual ${preferredDayPart} rhythm`);
    }
  }

  if (suggestedSlot) {
    score += clamp(Math.round(suggestedSlot.score / 18), 2, 8);
    reasons.push(`lines up with an open ${suggestedSlot.time} slot`);
  }

  if (hasConflict) {
    score += 10;
    reasons.push("needs conflict cleanup");
  }

  if (dayLoad?.status === "overloaded") {
    score += task.taskDate === input.currentDate ? 9 : 4;
    reasons.push("sits inside an overloaded day");
  }

  if (dayLoad?.status === "open" && task.taskDate === input.currentDate) {
    score += 4;
    reasons.push("has room to land cleanly today");
  }

  if (inferredEnergy === "low") {
    if (task.difficulty === "hard") {
      score -= 7;
      reasons.push("may be heavy for today's energy");
    } else {
      score += 4;
      reasons.push("matches a lighter-energy day");
    }
  } else if (inferredEnergy === "high" && task.difficulty === "hard") {
    score += 5;
    reasons.push("fits a higher-energy window");
  }

  if (input.starterIntent === "make_room" || input.starterIntent === "what_matters") {
    if (task.priority === "high" || daysUntil === 0 || daysUntil === 1) {
      score += 8;
    } else {
      score -= 4;
    }
  }

  if (statMatch) {
    const statNeed = input.statInterpretation?.statNeeds?.[statMatch];
    const statNeedWeight = statNeed ? getNeedWeight(statNeed.level) : 0;
    if (statNeedWeight > 0) {
      score += statNeedWeight;
      reasons.push(`supports ${statMatch} rebalancing right now`);
    }
  }

  if (
    input.statInterpretation?.statNeeds?.resolve
    && shouldAwardHardTaskResolve({ difficulty: task.difficulty, priority: task.priority })
  ) {
    const resolveWeight = getNeedWeight(input.statInterpretation.statNeeds.resolve.level);
    if (resolveWeight > 0) {
      score += Math.max(4, Math.round(resolveWeight / 2));
      reasons.push("helps rebuild resolve through a bounded hard move");
    }
  }

  return {
    id: `task:${task.id}`,
    kind: "task",
    title: task.title,
    score: Math.round(score),
    reasons: reasons.slice(0, 4),
    taskId: task.id,
    epicId: task.epicId ?? null,
    contactId: task.contactId ?? null,
    targetDate: task.taskDate ?? null,
    suggestedTime: suggestedSlot?.time ?? task.scheduledTime ?? null,
  };
};

const scoreRitual = (
  input: ComputePlannerPriorityScoresInput,
  ritual: PlannerPriorityRitualInput,
  preferredDayPart: string | null,
): PlannerPriorityScore => {
  let score = 12;
  const reasons: string[] = [];
  const ritualIntent = getCompanionBehaviorAwardIntent({
    title: ritual.title,
    epicTitle: ritual.epicTitle,
  });

  const streak = ritual.currentStreak ?? 0;
  if (streak > 0) {
    score += clamp(streak * 1.4, 4, 18);
    reasons.push(`protects a ${streak}-day streak`);
  } else {
    score += 5;
    reasons.push("keeps your ritual base steady");
  }

  if (ritual.preferredTime && preferredDayPart && getDayPart(ritual.preferredTime) === preferredDayPart) {
    score += 6;
    reasons.push(`fits your usual ${preferredDayPart} rhythm`);
  }

  const epic = getEpicById(input.activeEpics, ritual.epicId);
  if ((epic?.daysRemaining ?? getDaysUntil(input.currentDate, epic?.endDate)) !== null) {
    const daysRemaining = epic?.daysRemaining ?? getDaysUntil(input.currentDate, epic?.endDate);
    if (daysRemaining !== null && daysRemaining <= 7) {
      score += 6;
      reasons.push("supports an epic with a close horizon");
    }
  }

  if (ritualIntent) {
    const statNeed = input.statInterpretation?.statNeeds?.[ritualIntent.attribute];
    const statNeedWeight = statNeed ? getNeedWeight(statNeed.level) : 0;
    if (statNeedWeight > 0) {
      score += statNeedWeight;
      reasons.push(`supports ${ritualIntent.attribute} rebalancing right now`);
    }
  }

  return {
    id: `ritual:${ritual.id}`,
    kind: "ritual",
    title: ritual.title,
    score: Math.round(score),
    reasons: reasons.slice(0, 4),
    ritualId: ritual.id,
    epicId: ritual.epicId,
    targetDate: input.currentDate,
    suggestedTime: ritual.preferredTime ?? null,
  };
};

const scoreEpic = (
  input: ComputePlannerPriorityScoresInput,
  epic: PlannerPriorityEpicInput,
): PlannerPriorityScore => {
  let score = 14;
  const reasons: string[] = [];
  const daysRemaining = epic.daysRemaining ?? getDaysUntil(input.currentDate, epic.endDate);
  const progress = epic.progressPercentage ?? 0;

  if (daysRemaining !== null) {
    if (daysRemaining < 0) {
      score += 24;
      reasons.push("already passed its target date");
    } else if (daysRemaining <= 3) {
      score += 20;
      reasons.push("deadline is very close");
    } else if (daysRemaining <= 7) {
      score += 12;
      reasons.push("deadline is approaching");
    }
  }

  if (progress < 30) {
    score += 10;
    reasons.push("progress is still early");
  } else if (progress < 60) {
    score += 6;
    reasons.push("still needs momentum");
  }

  if ((epic.habitCount ?? 0) > 0) {
    score += 4;
    reasons.push("has rituals ready to support it");
  }

  return {
    id: `epic:${epic.id}`,
    kind: "epic",
    title: epic.title,
    score: Math.round(score),
    reasons: reasons.slice(0, 4),
    epicId: epic.id,
    targetDate: epic.endDate ?? null,
  };
};

const scoreContact = (
  contact: PlannerPriorityContactInput,
): PlannerPriorityScore => {
  let score = 16;
  const reasons: string[] = [];

  if (contact.hasOverdueReminder) {
    score += 18;
    reasons.push(contact.reminderReason || "follow-up is already overdue");
  }

  score += clamp(Math.round(contact.daysSinceContact / 2), 4, 20);
  reasons.push(`${contact.daysSinceContact} days since you last connected`);

  return {
    id: `contact:${contact.id}`,
    kind: "contact",
    title: `Reach out to ${contact.name}`,
    score: Math.round(score),
    reasons: reasons.slice(0, 4),
    contactId: contact.id,
    targetDate: null,
  };
};

const buildRecoveryScore = (
  input: ComputePlannerPriorityScoresInput,
  inferredEnergy: "low" | "medium" | "high",
): PlannerPriorityScore | null => {
  const todaysLoad = input.scheduleInsights?.dayLoads.find((entry) => entry.date === input.currentDate);
  const selectedDateLoad = input.scheduleInsights?.dayLoads.find((entry) =>
    entry.date === input.scheduleInsights?.selectedDate
  );
  const load = selectedDateLoad ?? todaysLoad ?? null;
  const recoveryReasons: string[] = [];
  let score = 0;

  pushReason(recoveryReasons, input.starterIntent === "low_energy_adjust", "you explicitly asked for a lighter day");
  pushReason(recoveryReasons, input.starterIntent === "make_room", "you asked to make room for what matters");
  pushReason(recoveryReasons, input.starterIntent === "adjust_today", "today needs active reshuffling");
  pushReason(recoveryReasons, inferredEnergy === "low", "energy looks low today");
  pushReason(recoveryReasons, load?.status === "overloaded", "the selected day is overloaded");
  pushReason(recoveryReasons, Boolean(input.careSignals?.hasDormancyWarning), "your companion care state suggests keeping the day realistic");
  pushReason(recoveryReasons, input.statInterpretation?.statNeeds?.vitality?.level === "high", "Vitality needs active protection right now");

  if (input.starterIntent === "low_energy_adjust") score += 28;
  if (input.starterIntent === "make_room" || input.starterIntent === "adjust_today") score += 18;
  if (inferredEnergy === "low") score += 12;
  if (load?.status === "overloaded") score += 16;
  if (input.careSignals?.hasDormancyWarning) score += 8;
  score += getNeedWeight(input.statInterpretation?.statNeeds?.vitality?.level ?? "low");

  if (score === 0) return null;

  return {
    id: "recovery:today",
    kind: "recovery",
    title: "Create breathing room today",
    score,
    reasons: recoveryReasons.slice(0, 4),
    targetDate: (load?.date ?? input.currentDate) || null,
    suggestedTime: input.scheduleInsights?.suggestedSlots.find((slot) =>
      slot.date === (load?.date ?? input.currentDate)
    )?.time ?? null,
  };
};

export const computePlannerPriorityScores = (
  input: ComputePlannerPriorityScoresInput,
): PlannerPriorityScore[] => {
  const inferredEnergy = inferEnergy(input.starterIntent, input.reflectionSignals, input.briefingContext);
  const preferredDayPart = getPreferredDayPart(input.plannerMemory);

  const ranked: PlannerPriorityScore[] = [];
  const recovery = buildRecoveryScore(input, inferredEnergy);
  if (recovery) ranked.push(recovery);

  for (const task of [...input.tasks, ...input.inboxTasks]) {
    const scoredTask = scoreTask(input, task, inferredEnergy, preferredDayPart);
    if (scoredTask) ranked.push(scoredTask);
  }

  for (const ritual of input.rituals) {
    ranked.push(scoreRitual(input, ritual, preferredDayPart));
  }

  for (const epic of input.activeEpics) {
    ranked.push(scoreEpic(input, epic));
  }

  for (const contact of input.contactsNeedingAttention ?? []) {
    ranked.push(scoreContact(contact));
  }

  return ranked
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 16);
};
