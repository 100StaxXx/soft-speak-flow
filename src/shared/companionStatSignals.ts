export type CompanionStatAttribute =
  | "vitality"
  | "wisdom"
  | "discipline"
  | "resolve"
  | "creativity"
  | "alignment";

export type CompanionAttributeSourceEvent =
  | "habit_complete"
  | "planned_task_on_time"
  | "streak_milestone"
  | "habit_complete_learning"
  | "morning_check_in"
  | "evening_reflection"
  | "daily_chapter_reflection"
  | "health_task_complete"
  | "recovery_block_kept"
  | "hard_task_complete"
  | "bounce_back_day"
  | "creative_block_complete"
  | "epic_progress_complete"
  | "relationship_maintenance_complete"
  | "urge_resist";

export type CompanionMomentumState =
  | "locked_in"
  | "coasting"
  | "slipping"
  | "rebuilding";

export type CompanionMissInterpretation =
  | "overload"
  | "low_energy"
  | "avoidance"
  | "interruption"
  | "normal_variance";

export type CompanionStatNeedLevel = "low" | "medium" | "high";

export type CompanionStatScores = Record<CompanionStatAttribute, number>;

export interface CompanionStatEventInput {
  attribute: CompanionStatAttribute;
  sourceEvent: string;
  amountAwarded: number;
  echoAmount?: number | null;
  createdAt: string;
}

export interface CompanionStatTaskInput {
  id: string;
  title: string;
  taskDate: string | null;
  category?: string | null;
  difficulty?: string | null;
  priority?: string | null;
  completed?: boolean | null;
  scheduledTime?: string | null;
  completedAt?: string | null;
  contactId?: string | null;
  epicTitle?: string | null;
  habitSourceId?: string | null;
}

export interface CompanionStatReflectionInput {
  date: string;
  source: "check_in" | "reflection";
  mood: string;
  energy?: "low" | "medium" | "high" | null;
  wins?: string | null;
  tomorrowAdjustment?: string | null;
}

export interface CompanionStatNeed {
  level: CompanionStatNeedLevel;
  reasons: string[];
}

export interface CompanionStatProfileSummary {
  scores: CompanionStatScores;
  dominantStat: CompanionStatAttribute;
  secondaryStat: CompanionStatAttribute;
}

export interface CompanionStatInterpretation {
  statProfile: CompanionStatProfileSummary;
  statNeeds: Record<CompanionStatAttribute, CompanionStatNeed>;
  momentumState: CompanionMomentumState;
  recentMissInterpretation: CompanionMissInterpretation;
  narrativeBrief: string;
  dailyNarrative: string;
  weeklyNarrative: string;
  identityBootstrap: string;
  recentExpression: Record<CompanionStatAttribute, number>;
}

export interface CompanionStatInterpretationInput {
  scores: Partial<Record<CompanionStatAttribute, number | null | undefined>>;
  recentEvents?: CompanionStatEventInput[];
  recentTasks?: CompanionStatTaskInput[];
  reflectionSignals?: CompanionStatReflectionInput[];
  currentDate?: string;
  scheduleSummary?: {
    selectedDateStatus?: "open" | "balanced" | "busy" | "overloaded" | null;
    overloadedDates?: string[];
  } | null;
}

export interface CompanionBehaviorSignalInput {
  title: string;
  category?: string | null;
  difficulty?: string | null;
  priority?: string | null;
  epicTitle?: string | null;
  contactId?: string | null;
}

export interface CompanionAwardIntent {
  attribute: CompanionStatAttribute;
  sourceEvent: CompanionAttributeSourceEvent;
  amount: number;
  applyEchoGains: boolean;
}

export const COMPANION_STAT_ATTRIBUTES: CompanionStatAttribute[] = [
  "vitality",
  "wisdom",
  "discipline",
  "resolve",
  "creativity",
  "alignment",
];

export const COMPANION_ATTRIBUTE_LABELS: Record<CompanionStatAttribute, string> = {
  vitality: "Vitality",
  wisdom: "Wisdom",
  discipline: "Discipline",
  resolve: "Resolve",
  creativity: "Creativity",
  alignment: "Alignment",
};

export const COMPANION_ATTRIBUTE_EVENT_CONFIG: Record<
  CompanionAttributeSourceEvent,
  CompanionAwardIntent
> = {
  habit_complete: {
    attribute: "discipline",
    sourceEvent: "habit_complete",
    amount: 4,
    applyEchoGains: true,
  },
  planned_task_on_time: {
    attribute: "discipline",
    sourceEvent: "planned_task_on_time",
    amount: 3,
    applyEchoGains: true,
  },
  streak_milestone: {
    attribute: "discipline",
    sourceEvent: "streak_milestone",
    amount: 5,
    applyEchoGains: true,
  },
  habit_complete_learning: {
    attribute: "wisdom",
    sourceEvent: "habit_complete_learning",
    amount: 6,
    applyEchoGains: false,
  },
  morning_check_in: {
    attribute: "alignment",
    sourceEvent: "morning_check_in",
    amount: 4,
    applyEchoGains: false,
  },
  evening_reflection: {
    attribute: "alignment",
    sourceEvent: "evening_reflection",
    amount: 4,
    applyEchoGains: false,
  },
  daily_chapter_reflection: {
    attribute: "wisdom",
    sourceEvent: "daily_chapter_reflection",
    amount: 6,
    applyEchoGains: false,
  },
  health_task_complete: {
    attribute: "vitality",
    sourceEvent: "health_task_complete",
    amount: 8,
    applyEchoGains: true,
  },
  recovery_block_kept: {
    attribute: "vitality",
    sourceEvent: "recovery_block_kept",
    amount: 6,
    applyEchoGains: true,
  },
  hard_task_complete: {
    attribute: "resolve",
    sourceEvent: "hard_task_complete",
    amount: 5,
    applyEchoGains: true,
  },
  bounce_back_day: {
    attribute: "resolve",
    sourceEvent: "bounce_back_day",
    amount: 8,
    applyEchoGains: true,
  },
  creative_block_complete: {
    attribute: "creativity",
    sourceEvent: "creative_block_complete",
    amount: 6,
    applyEchoGains: true,
  },
  epic_progress_complete: {
    attribute: "alignment",
    sourceEvent: "epic_progress_complete",
    amount: 5,
    applyEchoGains: true,
  },
  relationship_maintenance_complete: {
    attribute: "alignment",
    sourceEvent: "relationship_maintenance_complete",
    amount: 3,
    applyEchoGains: false,
  },
  urge_resist: {
    attribute: "resolve",
    sourceEvent: "urge_resist",
    amount: 10,
    applyEchoGains: true,
  },
};

export const COMPANION_ECHO_TARGETS: Record<
  CompanionStatAttribute,
  CompanionStatAttribute[]
> = {
  vitality: ["discipline", "alignment"],
  wisdom: ["creativity", "alignment"],
  discipline: ["resolve"],
  resolve: ["discipline", "alignment"],
  creativity: ["wisdom", "discipline"],
  alignment: ["resolve"],
};

const VITALITY_KEYWORDS = [
  "body",
  "exercise",
  "fitness",
  "gym",
  "health",
  "hydrate",
  "meal",
  "mobility",
  "nutrition",
  "recovery",
  "rest",
  "reset",
  "run",
  "sleep",
  "step",
  "stretch",
  "walk",
  "water",
  "workout",
  "yoga",
];

const WISDOM_KEYWORDS = [
  "analyze",
  "book",
  "course",
  "document",
  "learn",
  "lesson",
  "read",
  "research",
  "review",
  "skill",
  "study",
  "train",
  "understand",
];

const CREATIVITY_KEYWORDS = [
  "brainstorm",
  "build",
  "compose",
  "create",
  "creative",
  "design",
  "draft",
  "draw",
  "paint",
  "prototype",
  "ship",
  "sketch",
  "story",
  "write",
];

const ALIGNMENT_KEYWORDS = [
  "align",
  "call",
  "check in",
  "connect",
  "family",
  "friend",
  "gratitude",
  "journal",
  "meditate",
  "prayer",
  "purpose",
  "reach out",
  "reflect",
  "relationship",
  "text",
  "value",
  "values",
];

const RECOVERY_KEYWORDS = [
  "breathe",
  "break",
  "calm",
  "nap",
  "pause",
  "recover",
  "recovery",
  "reset",
  "rest",
  "restore",
  "walk",
];

const LOW_ENERGY_HINTS = [
  "burned out",
  "drained",
  "exhausted",
  "fried",
  "low energy",
  "overwhelmed",
  "tired",
];

const normalizeText = (value: string | null | undefined): string =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const includesAny = (haystack: string, keywords: string[]) =>
  keywords.some((keyword) => haystack.includes(keyword));

const startOfDay = (value: string): Date => new Date(`${value}T00:00:00`);

const resolveCurrentDate = (inputDate?: string) =>
  typeof inputDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(inputDate)
    ? inputDate
    : new Date().toISOString().slice(0, 10);

const addDays = (dateKey: string, days: number) => {
  const seed = startOfDay(dateKey);
  seed.setDate(seed.getDate() + days);
  return seed.toISOString().slice(0, 10);
};

const getNeedWeight = (level: CompanionStatNeedLevel) =>
  level === "high" ? 3 : level === "medium" ? 2 : 1;

const defaultScores = (): CompanionStatScores => ({
  vitality: 300,
  wisdom: 300,
  discipline: 300,
  resolve: 300,
  creativity: 300,
  alignment: 300,
});

export const normalizeCompanionScores = (
  scores: Partial<Record<CompanionStatAttribute, number | null | undefined>>,
): CompanionStatScores => {
  const normalized = defaultScores();

  for (const attribute of COMPANION_STAT_ATTRIBUTES) {
    const raw = scores[attribute];
    normalized[attribute] = typeof raw === "number" && Number.isFinite(raw)
      ? Math.max(100, Math.min(1000, Math.round(raw)))
      : 300;
  }

  return normalized;
};

const getEventAwardConfig = (sourceEvent: string): CompanionAwardIntent | null =>
  Object.prototype.hasOwnProperty.call(COMPANION_ATTRIBUTE_EVENT_CONFIG, sourceEvent)
    ? COMPANION_ATTRIBUTE_EVENT_CONFIG[sourceEvent as CompanionAttributeSourceEvent]
    : null;

export const getCompanionBehaviorAwardIntent = (
  input: CompanionBehaviorSignalInput,
): CompanionAwardIntent | null => {
  const title = normalizeText(input.title);
  const category = normalizeText(input.category);
  const epicTitle = normalizeText(input.epicTitle);
  const combined = [title, epicTitle].filter(Boolean).join(" ");

  if (input.contactId) {
    return COMPANION_ATTRIBUTE_EVENT_CONFIG.relationship_maintenance_complete;
  }

  if (category === "body") {
    return includesAny(combined, RECOVERY_KEYWORDS)
      ? COMPANION_ATTRIBUTE_EVENT_CONFIG.recovery_block_kept
      : COMPANION_ATTRIBUTE_EVENT_CONFIG.health_task_complete;
  }

  if (category === "mind") {
    return COMPANION_ATTRIBUTE_EVENT_CONFIG.habit_complete_learning;
  }

  if (category === "soul") {
    if (includesAny(combined, RECOVERY_KEYWORDS)) {
      return COMPANION_ATTRIBUTE_EVENT_CONFIG.recovery_block_kept;
    }

    if (includesAny(combined, ALIGNMENT_KEYWORDS)) {
      return COMPANION_ATTRIBUTE_EVENT_CONFIG.relationship_maintenance_complete;
    }
  }

  if (epicTitle && includesAny(epicTitle, ALIGNMENT_KEYWORDS)) {
    return COMPANION_ATTRIBUTE_EVENT_CONFIG.epic_progress_complete;
  }

  if (includesAny(combined, RECOVERY_KEYWORDS)) {
    return COMPANION_ATTRIBUTE_EVENT_CONFIG.recovery_block_kept;
  }

  if (includesAny(combined, VITALITY_KEYWORDS)) {
    return COMPANION_ATTRIBUTE_EVENT_CONFIG.health_task_complete;
  }

  if (includesAny(combined, ALIGNMENT_KEYWORDS)) {
    return COMPANION_ATTRIBUTE_EVENT_CONFIG.relationship_maintenance_complete;
  }

  if (includesAny(combined, CREATIVITY_KEYWORDS)) {
    return COMPANION_ATTRIBUTE_EVENT_CONFIG.creative_block_complete;
  }

  if (includesAny(combined, WISDOM_KEYWORDS)) {
    return COMPANION_ATTRIBUTE_EVENT_CONFIG.habit_complete_learning;
  }

  return null;
};

export const shouldAwardHardTaskResolve = (
  input: Pick<CompanionBehaviorSignalInput, "difficulty" | "priority">,
) => input.difficulty === "hard" || input.priority === "urgent";

export const computeRecentExpressionByAttribute = (
  recentEvents: CompanionStatEventInput[],
  currentDate?: string,
  windowDays = 14,
): Record<CompanionStatAttribute, number> => {
  const expression = Object.fromEntries(
    COMPANION_STAT_ATTRIBUTES.map((attribute) => [attribute, 0]),
  ) as Record<CompanionStatAttribute, number>;

  const resolvedDate = resolveCurrentDate(currentDate);
  const cutoff = startOfDay(addDays(resolvedDate, -(windowDays - 1))).getTime();
  const ceiling = startOfDay(addDays(resolvedDate, 1)).getTime();

  for (const event of recentEvents) {
    const createdAt = new Date(event.createdAt).getTime();
    if (Number.isNaN(createdAt) || createdAt < cutoff || createdAt >= ceiling) {
      continue;
    }

    expression[event.attribute] += Math.max(0, event.amountAwarded);

    const echoAmount = Math.max(0, event.echoAmount ?? 0);
    if (echoAmount <= 0) continue;

    for (const echoTarget of COMPANION_ECHO_TARGETS[event.attribute] ?? []) {
      expression[echoTarget] += echoAmount;
    }
  }

  return expression;
};

const countRecentCompletedTasks = (
  recentTasks: CompanionStatTaskInput[],
  currentDate: string,
  days = 7,
) =>
  recentTasks.filter((task) =>
    task.completed === true
    && typeof task.taskDate === "string"
    && task.taskDate >= addDays(currentDate, -(days - 1))
    && task.taskDate <= currentDate
  ).length;

const getRecentMissedTasks = (
  recentTasks: CompanionStatTaskInput[],
  currentDate: string,
  days = 7,
) =>
  recentTasks.filter((task) => {
    if (!task.taskDate) return false;
    if (task.taskDate < addDays(currentDate, -(days - 1)) || task.taskDate > currentDate) {
      return false;
    }

    return task.completed !== true && task.taskDate < currentDate;
  });

export const classifyCompanionMissInterpretation = ({
  currentDate,
  recentTasks,
  reflectionSignals,
  scheduleSummary,
}: Pick<
  CompanionStatInterpretationInput,
  "currentDate" | "recentTasks" | "reflectionSignals" | "scheduleSummary"
>): CompanionMissInterpretation => {
  const resolvedDate = resolveCurrentDate(currentDate);
  const missedTasks = getRecentMissedTasks(recentTasks ?? [], resolvedDate);
  if (missedTasks.length <= 1) return "normal_variance";

  const normalizedReflections = (reflectionSignals ?? [])
    .slice(0, 5)
    .map((signal) => normalizeText([
      signal.mood,
      signal.wins,
      signal.tomorrowAdjustment,
    ].filter(Boolean).join(" ")));

  const lowEnergySignals = (reflectionSignals ?? []).filter((signal) =>
    signal.energy === "low"
      || LOW_ENERGY_HINTS.some((hint) => normalizeText(signal.mood).includes(hint))
      || LOW_ENERGY_HINTS.some((hint) =>
        normalizeText(signal.tomorrowAdjustment).includes(hint)
      )
  ).length;

  const overdueVolume = missedTasks.length;
  const hardMisses = missedTasks.filter((task) =>
    task.difficulty === "hard" || task.priority === "high" || task.priority === "urgent"
  ).length;

  if (
    scheduleSummary?.selectedDateStatus === "overloaded"
    || (scheduleSummary?.overloadedDates?.length ?? 0) >= 2
    || overdueVolume >= 4
  ) {
    return "overload";
  }

  if (lowEnergySignals > 0) {
    return "low_energy";
  }

  if (hardMisses >= 2 || normalizedReflections.some((value) => value.includes("avoid"))) {
    return "avoidance";
  }

  if (overdueVolume >= 2) {
    return "interruption";
  }

  return "normal_variance";
};

export const deriveCompanionMomentumState = ({
  currentDate,
  recentEvents,
  recentTasks,
  reflectionSignals,
  scheduleSummary,
}: Pick<
  CompanionStatInterpretationInput,
  "currentDate" | "recentEvents" | "recentTasks" | "reflectionSignals" | "scheduleSummary"
>): CompanionMomentumState => {
  const resolvedDate = resolveCurrentDate(currentDate);
  const completedTasks = countRecentCompletedTasks(recentTasks ?? [], resolvedDate, 7);
  const missedTasks = getRecentMissedTasks(recentTasks ?? [], resolvedDate, 7);
  const recentAwardedEvents = (recentEvents ?? []).filter((event) => {
    const createdAt = new Date(event.createdAt);
    if (Number.isNaN(createdAt.getTime())) return false;
    const createdDate = createdAt.toISOString().slice(0, 10);
    return createdDate >= addDays(resolvedDate, -6)
      && createdDate <= resolvedDate
      && event.amountAwarded > 0;
  });
  const totalTaskSignals = completedTasks + missedTasks.length;
  const completionRate = totalTaskSignals > 0 ? completedTasks / totalTaskSignals : 0.5;
  const missInterpretation = classifyCompanionMissInterpretation({
    currentDate: resolvedDate,
    recentTasks,
    reflectionSignals,
    scheduleSummary,
  });
  const hasBounceBack = recentAwardedEvents.some((event) =>
    event.sourceEvent === "bounce_back_day"
  );

  if (completionRate >= 0.72 && recentAwardedEvents.length >= 5) {
    return "locked_in";
  }

  if (
    hasBounceBack
    || (completionRate >= 0.5 && missedTasks.length > 0 && missInterpretation !== "normal_variance")
  ) {
    return "rebuilding";
  }

  if (completionRate <= 0.4 && missedTasks.length >= 2) {
    return "slipping";
  }

  return "coasting";
};

const pushNeedReason = (
  needs: Record<CompanionStatAttribute, CompanionStatNeed>,
  attribute: CompanionStatAttribute,
  level: CompanionStatNeedLevel,
  reason: string,
) => {
  const existing = needs[attribute];
  if (getNeedWeight(level) > getNeedWeight(existing.level)) {
    existing.level = level;
  }

  if (!existing.reasons.includes(reason)) {
    existing.reasons.push(reason);
  }
};

export const deriveCompanionStatNeeds = ({
  scores,
  recentExpression,
  momentumState,
  recentMissInterpretation,
  recentTasks,
  reflectionSignals,
}: {
  scores: CompanionStatScores;
  recentExpression: Record<CompanionStatAttribute, number>;
  momentumState: CompanionMomentumState;
  recentMissInterpretation: CompanionMissInterpretation;
  recentTasks: CompanionStatTaskInput[];
  reflectionSignals: CompanionStatReflectionInput[];
}): Record<CompanionStatAttribute, CompanionStatNeed> => {
  const needs = Object.fromEntries(
    COMPANION_STAT_ATTRIBUTES.map((attribute) => [attribute, {
      level: "low" as CompanionStatNeedLevel,
      reasons: [] as string[],
    }]),
  ) as Record<CompanionStatAttribute, CompanionStatNeed>;

  for (const attribute of COMPANION_STAT_ATTRIBUTES) {
    const score = scores[attribute];
    const expression = recentExpression[attribute];

    if (score < 340) {
      pushNeedReason(needs, attribute, "high", `${COMPANION_ATTRIBUTE_LABELS[attribute]} has been running low lately.`);
    } else if (score < 430) {
      pushNeedReason(needs, attribute, "medium", `${COMPANION_ATTRIBUTE_LABELS[attribute]} could use a steadier recent signal.`);
    } else if (expression === 0 && score < 520) {
      pushNeedReason(needs, attribute, "medium", `${COMPANION_ATTRIBUTE_LABELS[attribute]} has not had a recent tracked push.`);
    }
  }

  const recoverySignals = recentTasks.filter((task) =>
    includesAny(normalizeText(task.title), RECOVERY_KEYWORDS)
  ).length;
  const reflectionCount = reflectionSignals.length;
  const onTimeFriendlySignals = recentTasks.filter((task) =>
    task.completed === true && task.scheduledTime
  ).length;

  if (recentExpression.discipline >= recentExpression.vitality + 8 && recoverySignals === 0) {
    pushNeedReason(needs, "vitality", "high", "You've been pushing output harder than recovery.");
  }

  if (
    recentExpression.discipline + recentExpression.wisdom + recentExpression.creativity >= 18
    && reflectionCount <= 1
  ) {
    pushNeedReason(needs, "alignment", "medium", "There has been a lot of output without much reflection.");
  }

  if (recentExpression.creativity >= recentExpression.discipline + 6 && onTimeFriendlySignals <= 1) {
    pushNeedReason(needs, "discipline", "medium", "The week has more spark than structure right now.");
  }

  if (recentExpression.creativity === 0 && recentExpression.wisdom + recentExpression.discipline >= 12) {
    pushNeedReason(needs, "creativity", "medium", "The week could use a little more originality and play.");
  }

  if (recentMissInterpretation === "low_energy" || recentMissInterpretation === "overload") {
    pushNeedReason(needs, "vitality", "high", "Your recent misses read more like strain than laziness.");
  }

  if (recentMissInterpretation === "avoidance" || momentumState === "rebuilding") {
    pushNeedReason(needs, "resolve", "medium", "Resolve grows when the next hard move gets smaller and cleaner.");
  }

  return needs;
};

const getTopNeedAttribute = (
  statNeeds: Record<CompanionStatAttribute, CompanionStatNeed>,
) =>
  [...COMPANION_STAT_ATTRIBUTES]
    .sort((left, right) => {
      const levelDiff = getNeedWeight(statNeeds[right].level) - getNeedWeight(statNeeds[left].level);
      if (levelDiff !== 0) return levelDiff;
      return statNeeds[right].reasons.length - statNeeds[left].reasons.length;
    })[0] ?? "alignment";

const getDominantDailyNarrative = (
  dominantStat: CompanionStatAttribute,
  highestNeed: CompanionStatAttribute,
  statNeeds: Record<CompanionStatAttribute, CompanionStatNeed>,
  momentumState: CompanionMomentumState,
) => {
  if (highestNeed === "vitality" && getNeedWeight(statNeeds.vitality.level) >= 2) {
    return "Vitality protection day";
  }

  if (momentumState === "rebuilding") {
    return "Resolve reset day";
  }

  switch (dominantStat) {
    case "discipline":
      return "Discipline-heavy day";
    case "resolve":
      return "Resolve day";
    case "creativity":
      return "Creativity-forward day";
    case "alignment":
      return "Alignment reset day";
    case "wisdom":
      return "Wisdom-building day";
    case "vitality":
      return "Vitality-first day";
    default:
      return "Momentum day";
  }
};

export const buildCompanionStatInterpretation = ({
  scores,
  recentEvents = [],
  recentTasks = [],
  reflectionSignals = [],
  currentDate,
  scheduleSummary,
}: CompanionStatInterpretationInput): CompanionStatInterpretation => {
  const normalizedScores = normalizeCompanionScores(scores);
  const recentExpression = computeRecentExpressionByAttribute(recentEvents, currentDate, 14);
  const weightedStrength = Object.fromEntries(
    COMPANION_STAT_ATTRIBUTES.map((attribute) => {
      const scoreWeight = Math.max(0, normalizedScores[attribute] - 100) / 100;
      const recentWeight = recentExpression[attribute] * 4;
      return [attribute, scoreWeight + recentWeight];
    }),
  ) as Record<CompanionStatAttribute, number>;

  const sortedAttributes = [...COMPANION_STAT_ATTRIBUTES].sort((left, right) => {
    const diff = weightedStrength[right] - weightedStrength[left];
    if (diff !== 0) return diff;
    return normalizedScores[right] - normalizedScores[left];
  });

  const dominantStat = sortedAttributes[0] ?? "discipline";
  const secondaryStat = sortedAttributes[1] ?? dominantStat;
  const recentMissInterpretation = classifyCompanionMissInterpretation({
    currentDate,
    recentTasks,
    reflectionSignals,
    scheduleSummary,
  });
  const momentumState = deriveCompanionMomentumState({
    currentDate,
    recentEvents,
    recentTasks,
    reflectionSignals,
    scheduleSummary,
  });
  const statNeeds = deriveCompanionStatNeeds({
    scores: normalizedScores,
    recentExpression,
    momentumState,
    recentMissInterpretation,
    recentTasks,
    reflectionSignals,
  });
  const highestNeed = getTopNeedAttribute(statNeeds);
  const dailyNarrative = getDominantDailyNarrative(
    dominantStat,
    highestNeed,
    statNeeds,
    momentumState,
  );
  const weeklyNarrative = `${COMPANION_ATTRIBUTE_LABELS[dominantStat]} is leading lately, with ${COMPANION_ATTRIBUTE_LABELS[secondaryStat]} close behind. ${COMPANION_ATTRIBUTE_LABELS[highestNeed]} is the clearest rebalance need next.`;

  const narrativeBrief = momentumState === "locked_in"
    ? `You've been trending ${COMPANION_ATTRIBUTE_LABELS[dominantStat]} + ${COMPANION_ATTRIBUTE_LABELS[secondaryStat]}. I'm keeping the pressure useful while I protect ${COMPANION_ATTRIBUTE_LABELS[highestNeed].toLowerCase()} next.`
    : momentumState === "rebuilding"
    ? `You're already bouncing back. I want the next move to strengthen ${COMPANION_ATTRIBUTE_LABELS[highestNeed].toLowerCase()} without blowing up the day.`
    : momentumState === "slipping"
    ? `This looks more strained than lazy. I'm protecting the essentials and rebuilding ${COMPANION_ATTRIBUTE_LABELS[highestNeed].toLowerCase()} first.`
    : `You've kept ${COMPANION_ATTRIBUTE_LABELS[dominantStat]} online, but ${COMPANION_ATTRIBUTE_LABELS[highestNeed].toLowerCase()} wants a little more intentional support.`;

  const identityBootstrap = `Here's who you've been lately: ${COMPANION_ATTRIBUTE_LABELS[dominantStat]} has been your clearest trait, ${COMPANION_ATTRIBUTE_LABELS[secondaryStat]} is growing behind it, and ${COMPANION_ATTRIBUTE_LABELS[highestNeed]} is the clearest place to rebalance next.`;

  return {
    statProfile: {
      scores: normalizedScores,
      dominantStat,
      secondaryStat,
    },
    statNeeds,
    momentumState,
    recentMissInterpretation,
    narrativeBrief,
    dailyNarrative,
    weeklyNarrative,
    identityBootstrap,
    recentExpression,
  };
};

export const summarizeCompanionNeed = (
  attribute: CompanionStatAttribute,
  need: CompanionStatNeed,
): string => {
  if (need.reasons.length === 0) {
    return `${COMPANION_ATTRIBUTE_LABELS[attribute]} need is ${need.level}.`;
  }

  return `${COMPANION_ATTRIBUTE_LABELS[attribute]} need is ${need.level}: ${need.reasons[0]}`;
};

export const mapAttributeEventToAwardIntent = (
  sourceEvent: string,
): CompanionAwardIntent | null => getEventAwardConfig(sourceEvent);
