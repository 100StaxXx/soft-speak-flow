import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import { errorResponse, type RequestAuth, requireRequestAuth } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import {
  buildCompanionStatInterpretation,
  COMPANION_ECHO_TARGETS,
  getCompanionBehaviorAwardIntent,
  type CompanionStatAttribute,
  type CompanionStatReflectionInput,
  type CompanionStatTaskInput,
} from "../../../src/shared/companionStatSignals.ts";
import {
  type CompanionStatAnalysis,
  type CompanionStatBand,
  type CompanionStatBreakdown,
  type CompanionStatDriver,
  validateCompanionStatAnalysis,
} from "../../../src/shared/companionStatAnalysis.ts";
import { buildCompanionFantasyTitle } from "../../../src/shared/companionStatFantasyTitles.ts";
import { getTaskCompletionDisciplineAward } from "../../../src/shared/taskCompletionTiming.ts";

type AttributeType = CompanionStatAttribute;

interface ProfileRow {
  selected_mentor_id: string | null;
  timezone: string | null;
}

interface MentorRow {
  id: string;
  name: string;
  tone_description: string | null;
  avatar_url: string | null;
  primary_color: string | null;
}

interface CompanionRow {
  id: string;
  current_stage: number;
  current_xp: number;
  vitality: number | null;
  wisdom: number | null;
  discipline: number | null;
  resolve: number | null;
  creativity: number | null;
  alignment: number | null;
}

interface CachedAnalysisRow {
  payload: CompanionStatAnalysis;
}

interface DailyCheckInRow {
  check_in_date: string;
  mood: string | null;
  intention: string | null;
}

interface EveningReflectionRow {
  reflection_date: string;
  mood: string;
}

interface HabitCompletionRow {
  date: string;
  habit_id: string | null;
}

interface DailyTaskRow {
  id: string;
  task_text: string;
  task_date: string | null;
  category: string | null;
  difficulty: string | null;
  priority: string | null;
  completed: boolean | null;
  habit_source_id: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
  contact_id: string | null;
  epic_id: string | null;
}

interface CompanionAttributeEventRow {
  attribute: string;
  source_event: string;
  amount_awarded: number;
  echo_amount: number;
  created_at: string;
}

interface BuildCompanionStatAnalysisInput {
  analysisDate: string;
  timezone: string;
  generatedAt: string;
  mentor: CompanionStatAnalysis["mentor"];
  companion: CompanionRow;
  checkIns: DailyCheckInRow[];
  reflections: EveningReflectionRow[];
  habitCompletions: HabitCompletionRow[];
  completedTasks: DailyTaskRow[];
  attributeEvents: CompanionAttributeEventRow[];
  activityStartDate: string;
  provenanceStartDate: string;
}

interface GenerateMentorCopyResult {
  summary: string;
  suggestedAction: string;
}

interface GenerateCompanionStatAnalysisDeps {
  authenticate: (req: Request, corsHeaders: HeadersInit) => Promise<RequestAuth | Response>;
  createSupabaseClient: () => any;
  fetchImpl: typeof fetch;
  now: () => Date;
}

const ATTRIBUTE_ORDER: readonly AttributeType[] = [
  "vitality",
  "wisdom",
  "discipline",
  "resolve",
  "creativity",
  "alignment",
];

const ATTRIBUTE_LABELS: Record<AttributeType, string> = {
  vitality: "Vitality",
  wisdom: "Wisdom",
  discipline: "Discipline",
  resolve: "Resolve",
  creativity: "Creativity",
  alignment: "Alignment",
};

const MODEL_NAME = "gpt-4o-mini";

const RequestSchema = z.object({
  forceRefresh: z.boolean().optional().default(false),
});

const defaultDeps: GenerateCompanionStatAnalysisDeps = {
  authenticate: requireRequestAuth,
  createSupabaseClient: () => {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(supabaseUrl, supabaseKey);
  },
  fetchImpl: fetch,
  now: () => new Date(),
};

function clampScore(value: number | null | undefined): number {
  const numericValue = typeof value === "number" && Number.isFinite(value) ? value : 300;
  return Math.max(100, Math.min(1000, Math.round(numericValue)));
}

export function getCompanionStatBand(score: number): CompanionStatBand {
  if (score <= 299) return "Emerging";
  if (score <= 499) return "Building";
  if (score <= 699) return "Strong";
  return "Exceptional";
}

export function formatDateInTimezone(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function shiftDateString(dateString: string, deltaDays: number): string {
  const seed = new Date(`${dateString}T12:00:00Z`);
  seed.setUTCDate(seed.getUTCDate() + deltaDays);
  return seed.toISOString().slice(0, 10);
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

function sumAwardedAmount(events: CompanionAttributeEventRow[]): number {
  return events.reduce((sum, event) => sum + Math.max(0, event.amount_awarded || 0), 0);
}

function sumEchoAmount(events: CompanionAttributeEventRow[]): number {
  return events.reduce((sum, event) => sum + Math.max(0, event.echo_amount || 0), 0);
}

function createDriver(input: CompanionStatDriver): CompanionStatDriver {
  return input;
}

function createStatus(band: CompanionStatBand, drivers: CompanionStatDriver[]): string {
  const hasTrackedDriver = drivers.some((driver) => driver.sourceType === "attribute_event" || driver.sourceType === "echo");
  if (!drivers.length) {
    return `${band} score with no recent tracked boosts yet`;
  }
  if (hasTrackedDriver) {
    return `${band} score with recent tracked momentum`;
  }
  return `${band} score with recent activity, but no recent tracked boosts yet`;
}

function createFallbackReasons(attribute: AttributeType): string[] {
  if (attribute === "vitality" || attribute === "creativity") {
    return [
      `No recent tracked boosts are available for ${ATTRIBUTE_LABELS[attribute]} yet, so this score reads as longer-run progress rather than a recent causal trail.`,
    ];
  }

  return [
    `No recent tracked boosts were found for ${ATTRIBUTE_LABELS[attribute]}, so this score is mostly a long-run snapshot right now.`,
  ];
}

const SOURCE_EVENT_LABELS: Record<string, string> = {
  habit_complete: "Habit completions",
  planned_task_on_time: "On-time task wins",
  streak_milestone: "Streak milestones",
  habit_complete_learning: "Learning-linked completions",
  morning_check_in: "Morning check-ins",
  evening_reflection: "Evening reflections",
  health_task_complete: "Health and body wins",
  recovery_block_kept: "Recovery blocks kept",
  hard_task_complete: "Hard task wins",
  bounce_back_day: "Bounce-back days",
  creative_block_complete: "Creative blocks",
  epic_progress_complete: "Epic-linked progress",
  relationship_maintenance_complete: "Relationship maintenance",
  urge_resist: "Urge resist wins",
};

const ATTRIBUTE_ACTIVITY_LABELS: Record<AttributeType, string> = {
  vitality: "Body and recovery activity",
  wisdom: "Learning activity",
  discipline: "Follow-through activity",
  resolve: "Hard task activity",
  creativity: "Creative activity",
  alignment: "Alignment activity",
};

const mapTaskToStatInput = (task: DailyTaskRow): CompanionStatTaskInput => ({
  id: task.id,
  title: task.task_text,
  taskDate: task.task_date,
  category: task.category,
  difficulty: task.difficulty,
  priority: task.priority,
  completed: task.completed,
  scheduledTime: task.scheduled_time,
  completedAt: task.completed_at,
  contactId: task.contact_id,
  habitSourceId: task.habit_source_id,
});

const buildRecentReflectionSignals = (
  checkIns: DailyCheckInRow[],
  reflections: EveningReflectionRow[],
): CompanionStatReflectionInput[] => {
  const checkInSignals = checkIns.map((checkIn) => ({
    date: checkIn.check_in_date,
    source: "check_in" as const,
    mood: checkIn.mood ?? "unknown",
    energy: checkIn.mood?.toLowerCase().includes("tired")
      || checkIn.mood?.toLowerCase().includes("low")
      ? "low" as const
      : "medium" as const,
    wins: checkIn.intention ?? null,
    tomorrowAdjustment: null,
  }));

  const reflectionSignals = reflections.map((reflection) => ({
    date: reflection.reflection_date,
    source: "reflection" as const,
    mood: reflection.mood ?? "unknown",
    energy: reflection.mood?.toLowerCase().includes("tired")
      || reflection.mood?.toLowerCase().includes("drained")
      ? "low" as const
      : "medium" as const,
    wins: null,
    tomorrowAdjustment: null,
  }));

  return [...checkInSignals, ...reflectionSignals]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 10);
};

const buildActivityCountMap = (
  tasks: DailyTaskRow[],
): Record<AttributeType, number> => {
  const counts = Object.fromEntries(
    ATTRIBUTE_ORDER.map((attribute) => [attribute, 0]),
  ) as Record<AttributeType, number>;

  for (const task of tasks.filter((candidate) => candidate.completed === true)) {
    const intent = getCompanionBehaviorAwardIntent({
      title: task.task_text,
      category: task.category,
      difficulty: task.difficulty,
      priority: task.priority,
      contactId: task.contact_id,
    });

    if (intent) {
      counts[intent.attribute] += 1;
    }

    if (task.difficulty === "hard") {
      counts.resolve += 1;
    }
  }

  return counts;
};

const buildDriversForAttribute = (
  attribute: AttributeType,
  attributeEvents: CompanionAttributeEventRow[],
  activityCount: number,
): CompanionStatDriver[] => {
  const drivers: CompanionStatDriver[] = [];
  const trackedEvents = attributeEvents.filter((event) => event.amount_awarded > 0);
  const groupedBySource = new Map<string, CompanionAttributeEventRow[]>();

  for (const event of trackedEvents) {
    const existing = groupedBySource.get(event.source_event) ?? [];
    existing.push(event);
    groupedBySource.set(event.source_event, existing);
  }

  for (const [sourceEvent, events] of groupedBySource.entries()) {
    const totalAwarded = sumAwardedAmount(events);
    const label = SOURCE_EVENT_LABELS[sourceEvent] ?? `${ATTRIBUTE_LABELS[attribute]} gains`;
    drivers.push(createDriver({
      key: `${attribute}:${sourceEvent}`,
      label,
      detail: `${events.length} ${label.toLowerCase()} ${pluralize(events.length, "event")} contributed ${totalAwarded} ${ATTRIBUTE_LABELS[attribute]} in the last 30 days.`,
      sourceType: "attribute_event",
      window: "30d",
      count: events.length,
      amount: totalAwarded,
    }));
  }

  if (drivers.length === 0 && activityCount > 0) {
    drivers.push(createDriver({
      key: `${attribute}:activity`,
      label: ATTRIBUTE_ACTIVITY_LABELS[attribute],
      detail: `${activityCount} ${ATTRIBUTE_ACTIVITY_LABELS[attribute].toLowerCase()} ${pluralize(activityCount, "signal")} showed up in the last 7 days, even though no tracked ${ATTRIBUTE_LABELS[attribute]} award was written yet.`,
      sourceType: "activity",
      window: "7d",
      count: activityCount,
      amount: null,
    }));
  }

  const echoEvents = attributeEvents
    .filter((event) => event.echo_amount > 0)
    .filter((event) =>
      (COMPANION_ECHO_TARGETS[event.attribute as AttributeType] ?? []).includes(attribute)
    );

  if (echoEvents.length > 0) {
    const totalEchoAmount = sumEchoAmount(echoEvents);
    drivers.push(createDriver({
      key: `${attribute}:echo`,
      label: "Echo gains",
      detail: `${echoEvents.length} related stat ${pluralize(echoEvents.length, "award")} added ${totalEchoAmount} ${ATTRIBUTE_LABELS[attribute]} through echo gains in the last 30 days.`,
      sourceType: "echo",
      window: "30d",
      count: echoEvents.length,
      amount: totalEchoAmount,
    }));
  }

  return drivers
    .sort((left, right) => (right.amount ?? 0) - (left.amount ?? 0) || (right.count ?? 0) - (left.count ?? 0))
    .slice(0, 4);
};

export function buildCompanionStatAnalysisPayload({
  analysisDate,
  timezone,
  generatedAt,
  mentor,
  companion,
  checkIns,
  reflections,
  habitCompletions,
  completedTasks,
  attributeEvents,
  activityStartDate,
  provenanceStartDate,
}: BuildCompanionStatAnalysisInput): CompanionStatAnalysis {
  const scoredCompanion = {
    vitality: clampScore(companion.vitality),
    wisdom: clampScore(companion.wisdom),
    discipline: clampScore(companion.discipline),
    resolve: clampScore(companion.resolve),
    creativity: clampScore(companion.creativity),
    alignment: clampScore(companion.alignment),
  } satisfies Record<AttributeType, number>;

  const recentTasks = completedTasks.map(mapTaskToStatInput);
  const reflectionSignals = buildRecentReflectionSignals(checkIns, reflections);
  const positiveAttributeEvents = attributeEvents.filter((event) => event.amount_awarded > 0);
  const activityCountMap = buildActivityCountMap(completedTasks);
  const interpretation = buildCompanionStatInterpretation({
    scores: scoredCompanion,
    currentDate: analysisDate,
    recentEvents: attributeEvents.map((event) => ({
      attribute: event.attribute as AttributeType,
      sourceEvent: event.source_event,
      amountAwarded: event.amount_awarded,
      echoAmount: event.echo_amount,
      createdAt: event.created_at,
    })),
    recentTasks,
    reflectionSignals,
  });

  const onTimeTasks = completedTasks.filter((task) => {
    if (!task.completed_at) return false;
    const award = getTaskCompletionDisciplineAward({
      taskId: task.id,
      taskDate: task.task_date ?? analysisDate,
      habitSourceId: task.habit_source_id,
      scheduledTime: task.scheduled_time,
      completedAt: new Date(task.completed_at),
    });

    return award?.kind === "planned_task_on_time";
  });

  const hardTaskWins = completedTasks.filter((task) => task.completed === true && task.difficulty === "hard");
  const relationshipActions = completedTasks.filter((task) =>
    task.completed === true && Boolean(task.contact_id)
  );
  const creativeActions = completedTasks.filter((task) => {
    if (task.completed !== true) return false;
    const intent = getCompanionBehaviorAwardIntent({
      title: task.task_text,
      category: task.category,
      difficulty: task.difficulty,
      priority: task.priority,
      contactId: task.contact_id,
    });
    return intent?.attribute === "creativity";
  });
  const healthActions = completedTasks.filter((task) => {
    if (task.completed !== true) return false;
    const intent = getCompanionBehaviorAwardIntent({
      title: task.task_text,
      category: task.category,
      difficulty: task.difficulty,
      priority: task.priority,
      contactId: task.contact_id,
    });
    return intent?.sourceEvent === "health_task_complete";
  });
  const recoveryActions = completedTasks.filter((task) => {
    if (task.completed !== true) return false;
    const intent = getCompanionBehaviorAwardIntent({
      title: task.task_text,
      category: task.category,
      difficulty: task.difficulty,
      priority: task.priority,
      contactId: task.contact_id,
    });
    return intent?.sourceEvent === "recovery_block_kept";
  });
  const streakMilestones = attributeEvents.filter((event) =>
    event.source_event === "streak_milestone" && event.amount_awarded > 0
  );
  const bounceBackDays = attributeEvents.filter((event) =>
    event.source_event === "bounce_back_day" && event.amount_awarded > 0
  );
  const epicLinkedCompletions = attributeEvents.filter((event) =>
    event.source_event === "epic_progress_complete" && event.amount_awarded > 0
  );

  const statBreakdowns: CompanionStatBreakdown[] = ATTRIBUTE_ORDER.map((attribute) => {
    const drivers = buildDriversForAttribute(
      attribute,
      attributeEvents.filter((event) => event.attribute === attribute),
      activityCountMap[attribute],
    );
    const band = getCompanionStatBand(scoredCompanion[attribute]);
    return {
      attribute,
      score: scoredCompanion[attribute],
      band,
      status: createStatus(band, drivers),
      primaryReasons: drivers.length
        ? drivers.map((driver) => driver.detail)
        : createFallbackReasons(attribute),
      recentDrivers: drivers,
    };
  });

  const strongestRecentDrivers = [...statBreakdowns]
    .flatMap((breakdown) => breakdown.recentDrivers)
    .sort((left, right) => (right.amount ?? 0) - (left.amount ?? 0) || (right.count ?? 0) - (left.count ?? 0))
    .slice(0, 4);

  return {
    analysisDate,
    timezone,
    generatedAt,
    mentor,
    companion: {
      id: companion.id,
      currentStage: companion.current_stage,
      currentXp: companion.current_xp,
    },
    activitySnapshot: {
      activityStartDate,
      activityEndDate: analysisDate,
      provenanceStartDate,
      provenanceEndDate: analysisDate,
      morningCheckIns: checkIns.length,
      eveningReflections: reflections.length,
      habitCompletions: habitCompletions.length,
      onTimeTasks: onTimeTasks.length,
      trackedAttributeEvents: positiveAttributeEvents.length,
      streakMilestones: streakMilestones.length,
      hardTaskWins: hardTaskWins.length,
      recoveryActions: recoveryActions.length,
      healthActions: healthActions.length,
      creativeActions: creativeActions.length,
      relationshipActions: relationshipActions.length,
      epicLinkedCompletions: epicLinkedCompletions.length,
      bounceBackDays: bounceBackDays.length,
    },
    statProfile: interpretation.statProfile,
    statNeeds: interpretation.statNeeds,
    fantasyTitle: buildCompanionFantasyTitle({
      analysisDate,
      statProfile: interpretation.statProfile,
      statNeeds: interpretation.statNeeds,
      momentumState: interpretation.momentumState,
    }),
    momentumState: interpretation.momentumState,
    recentMissInterpretation: interpretation.recentMissInterpretation,
    narrativeBrief: interpretation.narrativeBrief,
    dailyNarrative: interpretation.dailyNarrative,
    weeklyNarrative: interpretation.weeklyNarrative,
    identityBootstrap: interpretation.identityBootstrap,
    strongestRecentDrivers,
    statBreakdowns,
    summary: "",
    suggestedAction: "",
  };
}

export function buildFallbackMentorCopy(analysis: CompanionStatAnalysis): GenerateMentorCopyResult {
  const sortedByScore = [...analysis.statBreakdowns].sort((left, right) => right.score - left.score);
  const strongest = sortedByScore[0];
  const weakest = [...analysis.statBreakdowns].sort((left, right) => left.score - right.score)[0];
  const activityEntries = [
    ["morning check-ins", analysis.activitySnapshot.morningCheckIns],
    ["evening reflections", analysis.activitySnapshot.eveningReflections],
    ["habit completions", analysis.activitySnapshot.habitCompletions],
    ["on-time tasks", analysis.activitySnapshot.onTimeTasks],
  ] as const;
  const strongestActivity = [...activityEntries].sort((left, right) => right[1] - left[1])[0];

  const summary = strongestActivity[1] > 0
    ? `${analysis.mentor.name} sees you trending ${ATTRIBUTE_LABELS[analysis.statProfile.dominantStat]} with ${ATTRIBUTE_LABELS[analysis.statProfile.secondaryStat]} close behind. ${analysis.dailyNarrative} fits the recent activity, and ${ATTRIBUTE_LABELS[weakest.attribute]} is the clearest place to rebalance next.`
    : `${analysis.mentor.name} sees a long-run stat picture here, but not much recent tracked activity yet. ${ATTRIBUTE_LABELS[strongest.attribute]} is currently your strongest base, ${analysis.momentumState.replace("_", " ")} is the current momentum state, and ${ATTRIBUTE_LABELS[weakest.attribute]} is the clearest place to rebuild momentum.`;

  const suggestedActionByAttribute: Record<AttributeType, string> = {
    vitality: "Protect your energy with one real recovery block or body-first task today so Vitality gets a clearer signal.",
    wisdom: "Complete one learning-focused task today so Wisdom gets a fresh, trackable push.",
    discipline: "Finish one planned task on time today so Discipline gets a clean, visible win.",
    resolve: "Choose one uncomfortable but bounded task today so Resolve can rebuild through follow-through.",
    creativity: "Ship one small creative block today so Creativity has a real trail to point to.",
    alignment: "Pair one reflection, check-in, or relationship touch with today's plan so Alignment catches back up.",
  };

  return {
    summary,
    suggestedAction: suggestedActionByAttribute[weakest.attribute],
  };
}

async function generateMentorCopy(
  analysis: CompanionStatAnalysis,
  fetchImpl: typeof fetch,
): Promise<GenerateMentorCopyResult> {
  const fallback = buildFallbackMentorCopy(analysis);
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");

  if (!openAIApiKey) {
    return fallback;
  }

  const systemPrompt = `You are ${analysis.mentor.name}, a concise mentor. You are writing a stats analysis summary for the user.

Rules:
- Return strict JSON with keys "summary" and "suggestedAction"
- "summary" must be 2-4 sentences, grounded in the supplied data only
- "suggestedAction" must be one sentence
- Do not invent causes for stats that say "no recent tracked boosts yet"
- Do not mention hidden systems, probabilities, or anything outside the payload
- Use the momentum state, dominant stat, and miss interpretation only if the payload supports them
- Keep the tone aligned with: ${analysis.mentor.tone ?? "supportive, specific, and accountable"}`;

  const userPrompt = `Use this deterministic analysis snapshot:

${JSON.stringify({
    analysisDate: analysis.analysisDate,
    statProfile: analysis.statProfile,
    momentumState: analysis.momentumState,
    recentMissInterpretation: analysis.recentMissInterpretation,
    dailyNarrative: analysis.dailyNarrative,
    weeklyNarrative: analysis.weeklyNarrative,
    activitySnapshot: analysis.activitySnapshot,
    statBreakdowns: analysis.statBreakdowns.map((breakdown) => ({
      attribute: breakdown.attribute,
      score: breakdown.score,
      band: breakdown.band,
      status: breakdown.status,
      primaryReasons: breakdown.primaryReasons,
    })),
  }, null, 2)}`;

  try {
    const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 350,
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      return fallback;
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content;
    if (typeof rawContent !== "string") {
      return fallback;
    }

    const parsed = JSON.parse(rawContent) as Partial<GenerateMentorCopyResult>;
    const summary = typeof parsed.summary === "string" && parsed.summary.trim().length > 0
      ? parsed.summary.trim()
      : fallback.summary;
    const suggestedAction = typeof parsed.suggestedAction === "string" && parsed.suggestedAction.trim().length > 0
      ? parsed.suggestedAction.trim()
      : fallback.suggestedAction;

    return { summary, suggestedAction };
  } catch {
    return fallback;
  }
}

export async function handleGenerateCompanionStatAnalysis(
  req: Request,
  deps: GenerateCompanionStatAnalysisDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);

  try {
    const requestAuth = await deps.authenticate(req, corsHeaders);
    if (requestAuth instanceof Response) {
      return requestAuth;
    }

    if (requestAuth.isServiceRole) {
      return errorResponse(403, "User authentication required", corsHeaders);
    }

    const body = await req.json().catch(() => ({}));
    const validation = RequestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: validation.error.errors }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { forceRefresh } = validation.data;
    const userId = requestAuth.userId;
    const supabase = deps.createSupabaseClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("selected_mentor_id, timezone")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) throw profileError;

    const timezone = (profile as ProfileRow | null)?.timezone || "UTC";
    const now = deps.now();
    const analysisDate = formatDateInTimezone(now, timezone);

    const { data: existingAnalysis, error: existingAnalysisError } = await supabase
      .from("companion_stat_analyses")
      .select("payload")
      .eq("user_id", userId)
      .eq("analysis_date", analysisDate)
      .maybeSingle();

    if (existingAnalysisError) throw existingAnalysisError;

    if (existingAnalysis && !forceRefresh) {
      const cachedAnalysisValidation = validateCompanionStatAnalysis(
        (existingAnalysis as CachedAnalysisRow).payload,
      );

      if (cachedAnalysisValidation.ok) {
        return new Response(
          JSON.stringify({
            analysis: cachedAnalysisValidation.data,
            cached: true,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.warn("Ignoring malformed cached companion stat analysis payload", {
        userId,
        analysisDate,
        error: cachedAnalysisValidation.error,
      });
    }

    const { data: companion, error: companionError } = await supabase
      .from("user_companion")
      .select("id, current_stage, current_xp, vitality, wisdom, discipline, resolve, creativity, alignment")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (companionError) throw companionError;
    if (!companion) {
      return errorResponse(404, "Companion not found", corsHeaders);
    }

    let mentor: MentorRow | null = null;
    const selectedMentorId = (profile as ProfileRow | null)?.selected_mentor_id ?? null;
    if (selectedMentorId) {
      const { data: selectedMentor, error: mentorError } = await supabase
        .from("mentors")
        .select("id, name, tone_description, avatar_url, primary_color")
        .eq("id", selectedMentorId)
        .maybeSingle();

      if (mentorError) throw mentorError;
      mentor = selectedMentor as MentorRow | null;
    }

    if (!mentor) {
      const { data: fallbackMentor, error: fallbackMentorError } = await supabase
        .from("mentors")
        .select("id, name, tone_description, avatar_url, primary_color")
        .limit(1)
        .maybeSingle();

      if (fallbackMentorError) throw fallbackMentorError;
      mentor = fallbackMentor as MentorRow | null;
    }

    const activityStartDate = shiftDateString(analysisDate, -6);
    const provenanceStartDate = shiftDateString(analysisDate, -29);

    const [
      checkInsResult,
      reflectionsResult,
      habitCompletionsResult,
      completedTasksResult,
      attributeEventsResult,
    ] = await Promise.all([
      supabase
        .from("daily_check_ins")
        .select("check_in_date, mood, intention")
        .eq("user_id", userId)
        .eq("check_in_type", "morning")
        .gte("check_in_date", activityStartDate)
        .lte("check_in_date", analysisDate),
      supabase
        .from("evening_reflections")
        .select("reflection_date, mood")
        .eq("user_id", userId)
        .gte("reflection_date", activityStartDate)
        .lte("reflection_date", analysisDate),
      supabase
        .from("habit_completions")
        .select("date, habit_id")
        .eq("user_id", userId)
        .gte("date", activityStartDate)
        .lte("date", analysisDate),
      supabase
        .from("daily_tasks")
        .select("id, task_text, task_date, category, difficulty, priority, completed, habit_source_id, scheduled_time, completed_at, contact_id, epic_id")
        .eq("user_id", userId)
        .gte("task_date", activityStartDate)
        .lte("task_date", analysisDate),
      supabase
        .from("companion_attribute_events")
        .select("attribute, source_event, amount_awarded, echo_amount, created_at")
        .eq("user_id", userId)
        .gte("created_at", `${provenanceStartDate}T00:00:00.000Z`)
        .lte("created_at", `${analysisDate}T23:59:59.999Z`),
    ]);

    if (checkInsResult.error) throw checkInsResult.error;
    if (reflectionsResult.error) throw reflectionsResult.error;
    if (habitCompletionsResult.error) throw habitCompletionsResult.error;
    if (completedTasksResult.error) throw completedTasksResult.error;
    if (attributeEventsResult.error) throw attributeEventsResult.error;

    const analysisBase = buildCompanionStatAnalysisPayload({
      analysisDate,
      timezone,
      generatedAt: now.toISOString(),
      mentor: {
        id: mentor?.id ?? null,
        name: mentor?.name ?? "Your Guide",
        tone: mentor?.tone_description ?? "Supportive and specific",
        avatarUrl: mentor?.avatar_url ?? null,
        primaryColor: mentor?.primary_color ?? null,
      },
      companion: companion as CompanionRow,
      checkIns: (checkInsResult.data ?? []) as DailyCheckInRow[],
      reflections: (reflectionsResult.data ?? []) as EveningReflectionRow[],
      habitCompletions: (habitCompletionsResult.data ?? []) as HabitCompletionRow[],
      completedTasks: (completedTasksResult.data ?? []) as DailyTaskRow[],
      attributeEvents: (attributeEventsResult.data ?? []) as CompanionAttributeEventRow[],
      activityStartDate,
      provenanceStartDate,
    });

    const mentorCopy = await generateMentorCopy(analysisBase, deps.fetchImpl);
    const analysis: CompanionStatAnalysis = {
      ...analysisBase,
      summary: mentorCopy.summary,
      suggestedAction: mentorCopy.suggestedAction,
    };

    const analysisValidation = validateCompanionStatAnalysis(analysis);
    if (!analysisValidation.ok) {
      throw new Error(`Generated malformed stat analysis payload: ${analysisValidation.error}`);
    }

    const upsertPayload = {
      user_id: userId,
      companion_id: (companion as CompanionRow).id,
      mentor_id: mentor?.id ?? null,
      analysis_date: analysisDate,
      payload: analysisValidation.data,
      updated_at: now.toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("companion_stat_analyses")
      .upsert(upsertPayload, { onConflict: "user_id,analysis_date" });

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ analysis: analysisValidation.data, cached: false }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in generate-companion-stat-analysis:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateCompanionStatAnalysis(req));
}
