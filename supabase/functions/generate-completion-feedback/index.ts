import { installOpenAICompatibilityShim } from "../_shared/aiClient.ts";
installOpenAICompatibilityShim();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { buildCompletionFeedbackCopy } from "../../../src/shared/completionFeedbackCopy.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-4o-mini";
const ENDPOINT_NAME = "generate-completion-feedback";
const FEATURE_KEY = "ai_completion_feedback";
const OVERDUE_GRACE_MINUTES = 45;

const CompletionFeedbackRequestSchema = z.object({
  taskId: z.string().min(1),
  completionSource: z.enum(["quest", "ritual", "inbox"]).default("quest"),
  completedAt: z.string().datetime().optional(),
  clientContext: z.object({
    taskTitle: z.string().max(160).optional().nullable(),
    taskDate: z.string().max(32).optional().nullable(),
    scheduledTime: z.string().max(16).optional().nullable(),
    difficulty: z.string().max(32).optional().nullable(),
    category: z.string().max(64).optional().nullable(),
    habitSourceId: z.string().max(80).optional().nullable(),
    epicId: z.string().max(80).optional().nullable(),
    epicTitle: z.string().max(160).optional().nullable(),
    completedAllRituals: z.boolean().optional(),
    firstRitualToday: z.boolean().optional(),
  }).optional().default({}),
});

const CompanionToneSchema = z.enum(["proud", "locked_in", "recovery", "calm", "hype"]);
const GenerationSourceSchema = z.enum(["fallback", "ai"]);

const CompletionFeedbackSchema = z.object({
  companion: z.object({
    message: z.string().min(1).max(180),
    tone: CompanionToneSchema,
  }),
  mentor: z.object({
    show: z.boolean(),
    personality: z.string().min(1).max(80),
    message: z.string().min(1).max(180),
  }).optional(),
  followUp: z.object({
    label: z.string().min(1).max(40),
    action: z.string().min(1).max(80),
  }).optional(),
  generationSource: GenerationSourceSchema.optional(),
});

type CompletionFeedbackRequest = z.infer<typeof CompletionFeedbackRequestSchema>;
type CompletionFeedback = z.infer<typeof CompletionFeedbackSchema>;
type CompanionTone = z.infer<typeof CompanionToneSchema>;
type GenerationSource = z.infer<typeof GenerationSourceSchema>;

interface GenerateCompletionFeedbackDeps {
  protectRequest: typeof requireProtectedRequest;
  fetchImpl: typeof fetch;
  now: () => Date;
}

const defaultDeps: GenerateCompletionFeedbackDeps = {
  protectRequest: requireProtectedRequest,
  fetchImpl: fetch,
  now: () => new Date(),
};

interface TaskRow {
  id: string;
  task_text: string | null;
  task_date: string | null;
  completed: boolean | null;
  completed_at: string | null;
  scheduled_time: string | null;
  difficulty: string | null;
  category: string | null;
  habit_source_id: string | null;
  epic_id: string | null;
  is_main_quest: boolean | null;
  epics?: {
    title?: string | null;
    progress_percentage?: number | null;
    target_days?: number | null;
    status?: string | null;
  } | null;
}

interface MentorRow {
  id: string;
  name: string | null;
  slug: string | null;
  tone_description: string | null;
  style: string | null;
}

interface ProfileRow {
  selected_mentor_id: string | null;
  timezone: string | null;
  current_habit_streak: number | null;
}

interface CompletionContext {
  userId: string;
  taskId: string;
  completionSource: "quest" | "ritual" | "inbox";
  title: string;
  campaignTitle: string | null;
  completedAt: string;
  timezone: string;
  localDate: string;
  localHour: number;
  localMinute: number;
  scheduledTime: string | null;
  taskDate: string | null;
  difficulty: string | null;
  category: string | null;
  isRitual: boolean;
  isMainQuest: boolean;
  wasOverdue: boolean;
  firstCompletionToday: boolean;
  firstRitualToday: boolean;
  completedAllRituals: boolean;
  currentStreak: number;
  recentMissedTasks: number;
  incompleteToday: number;
  completedToday: number;
  totalToday: number;
  isOverloaded: boolean;
  isBuildingMomentum: boolean;
  isLateNight: boolean;
  isDifficult: boolean;
  mentor: MentorRow | null;
}

interface SignalScore {
  score: number;
  aiEligible: boolean;
  reasons: string[];
}

const cleanText = (value: string | null | undefined, fallback: string): string => {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed.length > 0 ? trimmed : fallback;
};

const truncateSentence = (value: string, maxLength = 150): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  const sliced = normalized.slice(0, maxLength - 1).trimEnd();
  return `${sliced}.`;
};

const localDateParts = (date: Date, timezone: string): {
  date: string;
  hour: number;
  minute: number;
} => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      hour: Number(get("hour")) || 0,
      minute: Number(get("minute")) || 0,
    };
  } catch {
    return {
      date: date.toISOString().slice(0, 10),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    };
  }
};

const subtractDays = (dateString: string, days: number): string => {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const addDays = (dateString: string, days: number): string => subtractDays(dateString, -days);

const getTimeZoneOffsetMs = (date: Date, timezone: string): number => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
    const localAsUtcMs = Date.UTC(
      Number(get("year")),
      Number(get("month")) - 1,
      Number(get("day")),
      Number(get("hour")),
      Number(get("minute")),
      Number(get("second")),
    );

    return localAsUtcMs - date.getTime();
  } catch {
    return 0;
  }
};

const utcInstantForLocalDateTime = (
  localDate: string,
  timezone: string,
  hour = 0,
  minute = 0,
): Date => {
  const [year, month, day] = localDate.split("-").map(Number);
  if (!year || !month || !day) return new Date(`${localDate}T00:00:00.000Z`);

  const localAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utcMs = localAsUtcMs;

  for (let index = 0; index < 3; index += 1) {
    const offsetMs = getTimeZoneOffsetMs(new Date(utcMs), timezone);
    const nextUtcMs = localAsUtcMs - offsetMs;
    if (Math.abs(nextUtcMs - utcMs) < 1_000) break;
    utcMs = nextUtcMs;
  }

  return new Date(utcMs);
};

const parseMinutes = (time: string | null): number | null => {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

function computeWasOverdue(context: {
  taskDate: string | null;
  localDate: string;
  scheduledTime: string | null;
  localHour: number;
  localMinute: number;
}): boolean {
  if (context.taskDate && context.taskDate < context.localDate) return true;
  if (context.taskDate && context.taskDate > context.localDate) return false;

  const scheduledMinutes = parseMinutes(context.scheduledTime);
  if (scheduledMinutes === null) return false;

  const completionMinutes = context.localHour * 60 + context.localMinute;
  return completionMinutes - scheduledMinutes >= OVERDUE_GRACE_MINUTES;
}

export function scoreCompletionSignal(context: CompletionContext): SignalScore {
  const reasons: string[] = [];
  let score = 0;

  const add = (condition: boolean, points: number, reason: string) => {
    if (!condition) return;
    score += points;
    reasons.push(reason);
  };

  add(context.firstCompletionToday, 3, "first_completion_today");
  add(context.recentMissedTasks > 0, 2, "recovery_after_missed_tasks");
  add(context.wasOverdue, 2, "overdue_completion");
  add(context.completedAllRituals, 3, "campaign_ritual_set_complete");
  add(context.isMainQuest, 1, "main_quest");
  add(context.isDifficult, 1, "difficult_task");
  add(context.isBuildingMomentum, 2, "momentum_run");
  add(context.isOverloaded, 1, "overloaded_day");
  add(context.isLateNight, 1, "late_night_discipline");
  add(context.currentStreak >= 7, 1, "active_streak");

  return {
    score,
    aiEligible: score >= 3,
    reasons,
  };
}

function stableRandom(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function shouldShowMentor(context: CompletionContext, signal: SignalScore): {
  show: boolean;
  probability: number;
} {
  if (!signal.aiEligible || !context.mentor) {
    return { show: false, probability: 0 };
  }

  let probability = 0.25;
  if (context.firstCompletionToday) probability += 0.08;
  if (context.recentMissedTasks > 0) probability += 0.1;
  if (context.wasOverdue || context.isDifficult) probability += 0.08;
  if (context.completedAllRituals) probability += 0.12;
  if (context.isBuildingMomentum) probability += 0.08;
  if (context.isLateNight) probability += 0.06;

  probability = Math.min(0.6, probability);
  const roll = stableRandom(`${context.userId}:${context.taskId}:${context.completedAt}:mentor`);

  return {
    show: roll < probability,
    probability,
  };
}

export function buildFallbackFeedback(context: CompletionContext): CompletionFeedback {
  const feedback = buildCompletionFeedbackCopy({
    taskId: context.taskId,
    title: context.title,
    campaignTitle: context.campaignTitle,
    completedAt: context.completedAt,
    completionSource: context.completionSource,
    isRitual: context.isRitual,
    completedAllRituals: context.completedAllRituals,
    wasOverdue: context.wasOverdue,
    isLateNight: context.isLateNight,
    isDifficult: context.isDifficult,
    firstCompletionToday: context.firstCompletionToday,
    isBuildingMomentum: context.isBuildingMomentum,
    isOverloaded: context.isOverloaded,
  });

  return {
    companion: {
      message: truncateSentence(feedback.message),
      tone: feedback.tone as CompanionTone,
    },
    generationSource: feedback.generationSource,
  };
}

function sanitizeFeedback(
  feedback: CompletionFeedback,
  fallback: CompletionFeedback,
  generationSource: GenerationSource,
): CompletionFeedback {
  const companionMessage = truncateSentence(feedback.companion.message);
  const mentor = feedback.mentor?.show
    ? {
        show: true,
        personality: truncateSentence(feedback.mentor.personality, 72),
        message: truncateSentence(feedback.mentor.message),
      }
    : undefined;

  return {
    companion: {
      message: companionMessage || fallback.companion.message,
      tone: feedback.companion.tone ?? fallback.companion.tone,
    },
    ...(mentor ? { mentor } : {}),
    ...(feedback.followUp ? { followUp: feedback.followUp } : {}),
    generationSource,
  };
}

async function maybeSingle<T>(query: Promise<{ data: T | null; error: unknown }>): Promise<T | null> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? null;
}

async function buildCompletionContext(
  supabase: any,
  userId: string,
  input: CompletionFeedbackRequest,
  now: Date,
): Promise<CompletionContext | Response> {
  const completedAtDate = input.completedAt ? new Date(input.completedAt) : now;
  const completedAt = Number.isNaN(completedAtDate.getTime()) ? now : completedAtDate;

  const { data: task, error: taskError } = await supabase
    .from("daily_tasks")
    .select(`
      id, task_text, task_date, completed, completed_at, scheduled_time, difficulty, category,
      habit_source_id, epic_id, is_main_quest,
      epics(title, progress_percentage, target_days, status)
    `)
    .eq("id", input.taskId)
    .eq("user_id", userId)
    .maybeSingle();

  if (taskError) throw taskError;
  if (!task) {
    return new Response(JSON.stringify({ error: "Completion target not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const typedTask = task as TaskRow;
  const profile = await maybeSingle<ProfileRow>(
    supabase
      .from("profiles")
      .select("selected_mentor_id, timezone, current_habit_streak")
      .eq("id", userId)
      .maybeSingle(),
  );

  const timezone = cleanText(profile?.timezone, "UTC");
  const parts = localDateParts(completedAt, timezone);
  const taskDate = typedTask.task_date ?? input.clientContext.taskDate ?? null;
  const scheduledTime = typedTask.scheduled_time ?? input.clientContext.scheduledTime ?? null;
  const hasHabitSource = Boolean(typedTask.habit_source_id ?? input.clientContext.habitSourceId);
  if ((input.completionSource === "ritual") !== hasHabitSource) {
    console.warn(`[${ENDPOINT_NAME}] completionSource and habit context disagree`, {
      taskId: typedTask.id,
      completionSource: input.completionSource,
      hasHabitSource,
    });
  }
  const isRitual = input.completionSource === "ritual" || hasHabitSource;
  const campaignTitle = cleanText(
    typedTask.epics?.title ?? input.clientContext.epicTitle,
    "",
  ) || null;

  const sevenDaysAgo = subtractDays(parts.date, 7);
  const localDayStart = utcInstantForLocalDateTime(parts.date, timezone);
  const localDayEnd = utcInstantForLocalDateTime(addDays(parts.date, 1), timezone);

  const [plannedTodayResult, completedTodayResult, missedResult] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select("id, completed, completed_at")
      .eq("user_id", userId)
      .eq("task_date", parts.date),
    supabase
      .from("daily_tasks")
      .select("id, completed, completed_at")
      .eq("user_id", userId)
      .gte("completed_at", localDayStart.toISOString())
      .lt("completed_at", localDayEnd.toISOString()),
    supabase
      .from("daily_tasks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("completed", false)
      .gte("task_date", sevenDaysAgo)
      .lt("task_date", parts.date),
  ]);

  if (plannedTodayResult.error) throw plannedTodayResult.error;
  if (completedTodayResult.error) throw completedTodayResult.error;
  if (missedResult.error) throw missedResult.error;

  const todayTasksById = new Map<string, {
    id: string;
    completed: boolean | null;
    completed_at: string | null;
  }>();
  for (const entry of [
    ...((plannedTodayResult.data ?? []) as Array<{ id: string; completed: boolean | null; completed_at: string | null }>),
    ...((completedTodayResult.data ?? []) as Array<{ id: string; completed: boolean | null; completed_at: string | null }>),
  ]) {
    todayTasksById.set(entry.id, entry);
  }
  const todayTasks = [...todayTasksById.values()];
  const completedToday = todayTasks.filter((entry) => entry.completed === true || entry.completed_at).length;
  const totalToday = todayTasks.length;
  const incompleteToday = todayTasks.filter((entry) => entry.completed !== true && !entry.completed_at).length;
  const recentMissedTasks = missedResult.count ?? 0;

  const context: CompletionContext = {
    userId,
    taskId: typedTask.id,
    completionSource: input.completionSource,
    title: cleanText(typedTask.task_text ?? input.clientContext.taskTitle, "this quest"),
    campaignTitle,
    completedAt: completedAt.toISOString(),
    timezone,
    localDate: parts.date,
    localHour: parts.hour,
    localMinute: parts.minute,
    scheduledTime,
    taskDate,
    difficulty: typedTask.difficulty ?? input.clientContext.difficulty ?? null,
    category: typedTask.category ?? input.clientContext.category ?? null,
    isRitual,
    isMainQuest: typedTask.is_main_quest === true,
    wasOverdue: computeWasOverdue({
      taskDate,
      localDate: parts.date,
      scheduledTime,
      localHour: parts.hour,
      localMinute: parts.minute,
    }),
    firstCompletionToday: completedToday <= 1,
    firstRitualToday: input.clientContext.firstRitualToday === true,
    completedAllRituals: input.clientContext.completedAllRituals === true,
    currentStreak: profile?.current_habit_streak ?? 0,
    recentMissedTasks,
    incompleteToday,
    completedToday,
    totalToday,
    isOverloaded: incompleteToday >= 5 || totalToday >= 8,
    isBuildingMomentum: completedToday >= 3,
    isLateNight: parts.hour >= 22 || parts.hour < 5,
    isDifficult: (typedTask.difficulty ?? input.clientContext.difficulty ?? "").toLowerCase() === "hard",
    mentor: null,
  };

  if (profile?.selected_mentor_id) {
    context.mentor = await maybeSingle<MentorRow>(
      supabase
        .from("mentors")
        .select("id, name, slug, tone_description, style")
        .eq("id", profile.selected_mentor_id)
        .maybeSingle(),
    );
  }

  return context;
}

function buildPrompt(context: CompletionContext, signal: SignalScore, mentorDecision: { show: boolean; probability: number }) {
  const mentorName = cleanText(context.mentor?.name, "the selected mentor");
  const mentorTone = cleanText(context.mentor?.tone_description, "distinct, concise, motivational");
  const mentorStyle = cleanText(context.mentor?.style, cleanText(context.mentor?.slug, "selected mentor"));

  const systemPrompt = `You write Cosmiq completion feedback.

Return only JSON with this shape:
{
  "companion": { "message": string, "tone": "proud" | "locked_in" | "recovery" | "calm" | "hype" },
  "mentor"?: { "show": boolean, "personality": string, "message": string },
  "followUp"?: { "label": string, "action": string }
}

Companion voice: confident, warm, aspirational, slightly cool, never corny.
Keep every message to 1-2 short lines, under 150 characters.
No therapy claims, no medical advice, no guilt, no exclamation spam.
Use the actual context. Do not say "task" if a better title is available.
Mentor is optional and must only appear when requested.`;

  const userPrompt = JSON.stringify({
    completion: {
      title: context.title,
      campaignTitle: context.campaignTitle,
      source: context.completionSource,
      localHour: context.localHour,
      localDate: context.localDate,
      scheduledTime: context.scheduledTime,
      wasOverdue: context.wasOverdue,
      difficulty: context.difficulty,
      category: context.category,
      isMainQuest: context.isMainQuest,
      isRitual: context.isRitual,
      completedAllRituals: context.completedAllRituals,
      firstCompletionToday: context.firstCompletionToday,
      currentStreak: context.currentStreak,
      recentMissedTasks: context.recentMissedTasks,
      incompleteToday: context.incompleteToday,
      completedToday: context.completedToday,
      isOverloaded: context.isOverloaded,
      isBuildingMomentum: context.isBuildingMomentum,
      isLateNight: context.isLateNight,
    },
    signal,
    mentorInstruction: {
      includeMentor: mentorDecision.show,
      probability: mentorDecision.probability,
      mentorName,
      mentorStyle,
      mentorTone,
      rule: mentorDecision.show
        ? "Return mentor.show true with one short line in this mentor personality."
        : "Do not include mentor, or return mentor.show false.",
    },
  });

  return { systemPrompt, userPrompt };
}

async function generateAiFeedback(
  context: CompletionContext,
  signal: SignalScore,
  mentorDecision: { show: boolean; probability: number },
  guardedFetch: typeof fetch,
): Promise<CompletionFeedback | null> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return null;

  const { systemPrompt, userPrompt } = buildPrompt(context, signal, mentorDecision);
  const response = await guardedFetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 260,
      temperature: 0.72,
      response_format: { type: "json_object" },
    }),
  } satisfies RequestInit);

  if (!response.ok) {
    console.error(`[${ENDPOINT_NAME}] AI API error`, await response.text());
    return null;
  }

  const payload = await response.json();
  const rawContent = payload?.choices?.[0]?.message?.content;
  if (typeof rawContent !== "string" || rawContent.trim().length === 0) {
    return null;
  }

  try {
    const parsed = CompletionFeedbackSchema.safeParse(JSON.parse(rawContent));
    return parsed.success ? { ...parsed.data, generationSource: "ai" } : null;
  } catch {
    return null;
  }
}

export async function handleGenerateCompletionFeedback(
  req: Request,
  deps: GenerateCompletionFeedbackDeps = defaultDeps,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return handleCors(req);
  }

  const corsHeaders = getCorsHeaders(req);
  let requestId: string = crypto.randomUUID();

  try {
    const protectedRequest = await deps.protectRequest(req, {
      profileKey: "ai.standard",
      endpointName: ENDPOINT_NAME,
      allowServiceRole: false,
    });

    if (protectedRequest instanceof Response) {
      return protectedRequest;
    }

    const { auth, supabase, requestId: protectedRequestId } = protectedRequest;
    requestId = protectedRequestId;

    const body = await req.json().catch(() => null);
    const parsed = CompletionFeedbackRequestSchema.safeParse(body);
    if (!parsed.success) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_INPUT",
        error: "Invalid input",
        requestId,
      });
    }

    const context = await buildCompletionContext(
      supabase,
      auth.userId,
      parsed.data,
      deps.now(),
    );

    if (context instanceof Response) {
      return new Response(context.body, {
        status: context.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fallback = buildFallbackFeedback(context);
    const signal = scoreCompletionSignal(context);
    const mentorDecision = shouldShowMentor(context, signal);

    let feedback: CompletionFeedback | null = null;
    if (signal.aiEligible) {
      const costGuardrails = createCostGuardrailSession({
        supabase,
        endpointKey: ENDPOINT_NAME,
        featureKey: FEATURE_KEY,
        userId: auth.userId,
        requestId,
      });

      await costGuardrails.enforceAccess({
        capabilities: ["text"],
        providers: ["openai"],
        metadata: { signalReasons: signal.reasons },
      });

      const guardedFetch = costGuardrails.wrapFetch(deps.fetchImpl);
      feedback = await generateAiFeedback(
        context,
        signal,
        mentorDecision,
        guardedFetch,
      );
    }

    const output = sanitizeFeedback(feedback ?? fallback, fallback, feedback ? "ai" : "fallback");
    if (!mentorDecision.show) {
      delete output.mentor;
    }

    return new Response(JSON.stringify(output), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }

    console.error(`[${ENDPOINT_NAME}] Error`, error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "INTERNAL_ERROR",
      error: "Request could not be processed right now",
      requestId,
    });
  }
}

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve((req) => handleGenerateCompletionFeedback(req));
}
