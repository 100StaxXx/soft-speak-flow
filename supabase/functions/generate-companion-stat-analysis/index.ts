import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

import { errorResponse, type RequestAuth, requireRequestAuth } from "../_shared/auth.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { getTaskCompletionDisciplineAward } from "../../../src/shared/taskCompletionTiming.ts";

type AttributeType =
  | "vitality"
  | "wisdom"
  | "discipline"
  | "resolve"
  | "creativity"
  | "alignment";

type CompanionStatBand = "Emerging" | "Building" | "Strong" | "Exceptional";
type CompanionStatDriverSource = "attribute_event" | "activity" | "echo";
type CompanionStatDriverWindow = "7d" | "30d";

export interface CompanionStatDriver {
  key: string;
  label: string;
  detail: string;
  sourceType: CompanionStatDriverSource;
  window: CompanionStatDriverWindow;
  count: number | null;
  amount: number | null;
}

export interface CompanionStatBreakdown {
  attribute: AttributeType;
  score: number;
  band: CompanionStatBand;
  status: string;
  primaryReasons: string[];
  recentDrivers: CompanionStatDriver[];
}

export interface CompanionStatAnalysis {
  analysisDate: string;
  timezone: string;
  generatedAt: string;
  mentor: {
    id: string | null;
    name: string;
    tone: string | null;
    avatarUrl: string | null;
    primaryColor: string | null;
  };
  companion: {
    id: string;
    currentStage: number;
    currentXp: number;
  };
  activitySnapshot: {
    activityStartDate: string;
    activityEndDate: string;
    provenanceStartDate: string;
    provenanceEndDate: string;
    morningCheckIns: number;
    eveningReflections: number;
    habitCompletions: number;
    onTimeTasks: number;
    trackedAttributeEvents: number;
    streakMilestones: number;
  };
  statBreakdowns: CompanionStatBreakdown[];
  summary: string;
  suggestedAction: string;
}

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
  task_date: string | null;
  habit_source_id: string | null;
  scheduled_time: string | null;
  completed_at: string | null;
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

function buildGenericTrackedBreakdown(
  attribute: AttributeType,
  score: number,
  events: CompanionAttributeEventRow[],
): CompanionStatBreakdown {
  const band = getCompanionStatBand(score);
  const trackedEvents = events.filter((event) => event.amount_awarded > 0);

  if (!trackedEvents.length) {
    return {
      attribute,
      score,
      band,
      status: createStatus(band, []),
      primaryReasons: createFallbackReasons(attribute),
      recentDrivers: [],
    };
  }

  const totalAwarded = sumAwardedAmount(trackedEvents);
  const drivers = [
    createDriver({
      key: `${attribute}:tracked`,
      label: `${ATTRIBUTE_LABELS[attribute]} gains`,
      detail: `${trackedEvents.length} tracked ${ATTRIBUTE_LABELS[attribute].toLowerCase()} ${pluralize(
        trackedEvents.length,
        "award",
      )} contributed ${totalAwarded} total points in the last 30 days.`,
      sourceType: "attribute_event",
      window: "30d",
      count: trackedEvents.length,
      amount: totalAwarded,
    }),
  ];

  return {
    attribute,
    score,
    band,
    status: createStatus(band, drivers),
    primaryReasons: drivers.map((driver) => driver.detail),
    recentDrivers: drivers,
  };
}

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

  const disciplineEvents = attributeEvents.filter((event) => event.attribute === "discipline");
  const wisdomEvents = attributeEvents.filter((event) => event.attribute === "wisdom");
  const alignmentEvents = attributeEvents.filter((event) => event.attribute === "alignment");
  const resolveEvents = attributeEvents.filter((event) => event.attribute === "resolve");
  const vitalityEvents = attributeEvents.filter((event) => event.attribute === "vitality");
  const creativityEvents = attributeEvents.filter((event) => event.attribute === "creativity");

  const habitDisciplineEvents = disciplineEvents.filter(
    (event) => event.source_event === "habit_complete" && event.amount_awarded > 0,
  );
  const onTimeDisciplineEvents = disciplineEvents.filter(
    (event) => event.source_event === "planned_task_on_time" && event.amount_awarded > 0,
  );
  const streakDisciplineEvents = disciplineEvents.filter(
    (event) => event.source_event === "streak_milestone" && event.amount_awarded > 0,
  );
  const wisdomLearningEvents = wisdomEvents.filter(
    (event) => event.source_event === "habit_complete_learning" && event.amount_awarded > 0,
  );
  const morningAlignmentEvents = alignmentEvents.filter(
    (event) => event.source_event === "morning_check_in" && event.amount_awarded > 0,
  );
  const eveningAlignmentEvents = alignmentEvents.filter(
    (event) => event.source_event === "evening_reflection" && event.amount_awarded > 0,
  );

  const disciplineDrivers: CompanionStatDriver[] = [];
  if (habitDisciplineEvents.length > 0) {
    const totalAwarded = sumAwardedAmount(habitDisciplineEvents);
    disciplineDrivers.push(
      createDriver({
        key: "discipline:habit_complete",
        label: "Habit completions",
        detail: `${habitDisciplineEvents.length} habit ${pluralize(
          habitDisciplineEvents.length,
          "completion",
        )} awarded ${totalAwarded} Discipline in the last 30 days.`,
        sourceType: "attribute_event",
        window: "30d",
        count: habitDisciplineEvents.length,
        amount: totalAwarded,
      }),
    );
  }
  if (onTimeDisciplineEvents.length > 0) {
    const totalAwarded = sumAwardedAmount(onTimeDisciplineEvents);
    disciplineDrivers.push(
      createDriver({
        key: "discipline:planned_task_on_time",
        label: "On-time task wins",
        detail: `${onTimeDisciplineEvents.length} planned task ${pluralize(
          onTimeDisciplineEvents.length,
          "win",
        )} awarded ${totalAwarded} Discipline in the last 30 days.`,
        sourceType: "attribute_event",
        window: "30d",
        count: onTimeDisciplineEvents.length,
        amount: totalAwarded,
      }),
    );
  }
  if (streakDisciplineEvents.length > 0) {
    const totalAwarded = sumAwardedAmount(streakDisciplineEvents);
    disciplineDrivers.push(
      createDriver({
        key: "discipline:streak_milestone",
        label: "Streak milestones",
        detail: `${streakDisciplineEvents.length} streak ${pluralize(
          streakDisciplineEvents.length,
          "milestone",
        )} awarded ${totalAwarded} Discipline in the last 30 days.`,
        sourceType: "attribute_event",
        window: "30d",
        count: streakDisciplineEvents.length,
        amount: totalAwarded,
      }),
    );
  }
  if (!disciplineDrivers.length) {
    if (habitCompletions.length > 0) {
      disciplineDrivers.push(
        createDriver({
          key: "discipline:habit_activity",
          label: "Habit activity",
          detail: `${habitCompletions.length} habit ${pluralize(
            habitCompletions.length,
            "completion",
          )} were logged in the last 7 days, but no recent tracked Discipline boosts were recorded yet.`,
          sourceType: "activity",
          window: "7d",
          count: habitCompletions.length,
          amount: null,
        }),
      );
    }
    if (onTimeTasks.length > 0) {
      disciplineDrivers.push(
        createDriver({
          key: "discipline:on_time_activity",
          label: "Scheduled follow-through",
          detail: `${onTimeTasks.length} planned task ${pluralize(
            onTimeTasks.length,
            "was",
            "were",
          )} finished on time in the last 7 days, but no recent tracked Discipline boosts were recorded yet.`,
          sourceType: "activity",
          window: "7d",
          count: onTimeTasks.length,
          amount: null,
        }),
      );
    }
  }

  const wisdomDrivers: CompanionStatDriver[] = [];
  if (wisdomLearningEvents.length > 0) {
    const totalAwarded = sumAwardedAmount(wisdomLearningEvents);
    wisdomDrivers.push(
      createDriver({
        key: "wisdom:habit_complete_learning",
        label: "Learning-linked habits",
        detail: `${wisdomLearningEvents.length} learning ${pluralize(
          wisdomLearningEvents.length,
          "award",
        )} contributed ${totalAwarded} Wisdom in the last 30 days.`,
        sourceType: "attribute_event",
        window: "30d",
        count: wisdomLearningEvents.length,
        amount: totalAwarded,
      }),
    );
  } else if (habitCompletions.length > 0) {
    wisdomDrivers.push(
      createDriver({
        key: "wisdom:habit_activity",
        label: "Learning activity",
        detail: `${habitCompletions.length} habit ${pluralize(
          habitCompletions.length,
          "completion",
        )} were logged in the last 7 days, but no recent tracked Wisdom boosts were recorded yet.`,
        sourceType: "activity",
        window: "7d",
        count: habitCompletions.length,
        amount: null,
      }),
    );
  }

  const alignmentDrivers: CompanionStatDriver[] = [];
  if (morningAlignmentEvents.length > 0) {
    const totalAwarded = sumAwardedAmount(morningAlignmentEvents);
    alignmentDrivers.push(
      createDriver({
        key: "alignment:morning_check_in",
        label: "Morning check-ins",
        detail: `${morningAlignmentEvents.length} morning ${pluralize(
          morningAlignmentEvents.length,
          "check-in",
        )} contributed ${totalAwarded} Alignment in the last 30 days.`,
        sourceType: "attribute_event",
        window: "30d",
        count: morningAlignmentEvents.length,
        amount: totalAwarded,
      }),
    );
  } else if (checkIns.length > 0) {
    alignmentDrivers.push(
      createDriver({
        key: "alignment:check_in_activity",
        label: "Morning check-ins",
        detail: `${checkIns.length} morning ${pluralize(
          checkIns.length,
          "check-in",
        )} were logged in the last 7 days, but no recent tracked Alignment boosts were recorded yet.`,
        sourceType: "activity",
        window: "7d",
        count: checkIns.length,
        amount: null,
      }),
    );
  }
  if (eveningAlignmentEvents.length > 0) {
    const totalAwarded = sumAwardedAmount(eveningAlignmentEvents);
    alignmentDrivers.push(
      createDriver({
        key: "alignment:evening_reflection",
        label: "Evening reflections",
        detail: `${eveningAlignmentEvents.length} evening ${pluralize(
          eveningAlignmentEvents.length,
          "reflection",
        )} contributed ${totalAwarded} Alignment in the last 30 days.`,
        sourceType: "attribute_event",
        window: "30d",
        count: eveningAlignmentEvents.length,
        amount: totalAwarded,
      }),
    );
  } else if (reflections.length > 0) {
    alignmentDrivers.push(
      createDriver({
        key: "alignment:reflection_activity",
        label: "Evening reflections",
        detail: `${reflections.length} evening ${pluralize(
          reflections.length,
          "reflection",
        )} were logged in the last 7 days, but no recent tracked Alignment boosts were recorded yet.`,
        sourceType: "activity",
        window: "7d",
        count: reflections.length,
        amount: null,
      }),
    );
  }

  const resolveDrivers: CompanionStatDriver[] = [];
  if (resolveEvents.filter((event) => event.amount_awarded > 0).length > 0) {
    const trackedResolveEvents = resolveEvents.filter((event) => event.amount_awarded > 0);
    const totalAwarded = sumAwardedAmount(trackedResolveEvents);
    resolveDrivers.push(
      createDriver({
        key: "resolve:direct",
        label: "Tracked resolve gains",
        detail: `${trackedResolveEvents.length} tracked ${pluralize(
          trackedResolveEvents.length,
          "event",
        )} contributed ${totalAwarded} Resolve in the last 30 days.`,
        sourceType: "attribute_event",
        window: "30d",
        count: trackedResolveEvents.length,
        amount: totalAwarded,
      }),
    );
  }

  const disciplineEchoEvents = disciplineEvents.filter((event) => event.echo_amount > 0);
  if (disciplineEchoEvents.length > 0) {
    const totalEchoAmount = sumEchoAmount(disciplineEchoEvents);
    resolveDrivers.push(
      createDriver({
        key: "resolve:discipline_echo",
        label: "Discipline echo gains",
        detail: `${disciplineEchoEvents.length} Discipline ${pluralize(
          disciplineEchoEvents.length,
          "award",
        )} added ${totalEchoAmount} Resolve through echo gains in the last 30 days.`,
        sourceType: "echo",
        window: "30d",
        count: disciplineEchoEvents.length,
        amount: totalEchoAmount,
      }),
    );
  }

  const vitalityBreakdown = buildGenericTrackedBreakdown("vitality", scoredCompanion.vitality, vitalityEvents);
  const creativityBreakdown = buildGenericTrackedBreakdown("creativity", scoredCompanion.creativity, creativityEvents);

  const statBreakdowns: CompanionStatBreakdown[] = [
    vitalityBreakdown,
    {
      attribute: "wisdom",
      score: scoredCompanion.wisdom,
      band: getCompanionStatBand(scoredCompanion.wisdom),
      status: createStatus(getCompanionStatBand(scoredCompanion.wisdom), wisdomDrivers),
      primaryReasons: wisdomDrivers.length ? wisdomDrivers.map((driver) => driver.detail) : createFallbackReasons("wisdom"),
      recentDrivers: wisdomDrivers,
    },
    {
      attribute: "discipline",
      score: scoredCompanion.discipline,
      band: getCompanionStatBand(scoredCompanion.discipline),
      status: createStatus(getCompanionStatBand(scoredCompanion.discipline), disciplineDrivers),
      primaryReasons: disciplineDrivers.length ? disciplineDrivers.map((driver) => driver.detail) : createFallbackReasons("discipline"),
      recentDrivers: disciplineDrivers,
    },
    {
      attribute: "resolve",
      score: scoredCompanion.resolve,
      band: getCompanionStatBand(scoredCompanion.resolve),
      status: createStatus(getCompanionStatBand(scoredCompanion.resolve), resolveDrivers),
      primaryReasons: resolveDrivers.length ? resolveDrivers.map((driver) => driver.detail) : createFallbackReasons("resolve"),
      recentDrivers: resolveDrivers,
    },
    creativityBreakdown,
    {
      attribute: "alignment",
      score: scoredCompanion.alignment,
      band: getCompanionStatBand(scoredCompanion.alignment),
      status: createStatus(getCompanionStatBand(scoredCompanion.alignment), alignmentDrivers),
      primaryReasons: alignmentDrivers.length ? alignmentDrivers.map((driver) => driver.detail) : createFallbackReasons("alignment"),
      recentDrivers: alignmentDrivers,
    },
  ];

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
      trackedAttributeEvents: attributeEvents.filter((event) => event.amount_awarded > 0).length,
      streakMilestones: streakDisciplineEvents.length,
    },
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
    ? `${analysis.mentor.name} sees your clearest recent momentum in ${ATTRIBUTE_LABELS[strongest.attribute]}. The most visible recent behavior is ${strongestActivity[1]} ${strongestActivity[0]}, while ${ATTRIBUTE_LABELS[weakest.attribute]} has the thinnest recent evidence behind it.`
    : `${analysis.mentor.name} sees a long-run stat picture here, but not much recent tracked activity yet. ${ATTRIBUTE_LABELS[strongest.attribute]} is currently your strongest base, and ${ATTRIBUTE_LABELS[weakest.attribute]} is the clearest place to rebuild momentum.`;

  const suggestedActionByAttribute: Record<AttributeType, string> = {
    vitality: "Log one body-focused habit or quest today so your next stat read has a clearer physical signal to work from.",
    wisdom: "Complete one learning-focused habit today so Wisdom gets a fresh, trackable push.",
    discipline: "Finish one planned task on time or close one habit streak today to give Discipline a clean win.",
    resolve: "Use one discipline win as your anchor today; Resolve reads best when follow-through stays visible.",
    creativity: "Route one small creative or shipping action through the app today so Creativity can start building a real trail.",
    alignment: "Pair a morning check-in with an evening reflection today so Alignment gets a full-day signal.",
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
- Keep the tone aligned with: ${analysis.mentor.tone ?? "supportive, specific, and accountable"}`;

  const userPrompt = `Use this deterministic analysis snapshot:

${JSON.stringify({
    analysisDate: analysis.analysisDate,
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
      return new Response(
        JSON.stringify({
          analysis: (existingAnalysis as CachedAnalysisRow).payload,
          cached: true,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
        .select("id, task_date, habit_source_id, scheduled_time, completed_at")
        .eq("user_id", userId)
        .eq("completed", true)
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

    const upsertPayload = {
      user_id: userId,
      companion_id: (companion as CompanionRow).id,
      mentor_id: mentor?.id ?? null,
      analysis_date: analysisDate,
      payload: analysis,
      updated_at: now.toISOString(),
    };

    const { error: upsertError } = await supabase
      .from("companion_stat_analyses")
      .upsert(upsertPayload, { onConflict: "user_id,analysis_date" });

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ analysis, cached: false }),
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
