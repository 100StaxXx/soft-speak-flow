import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  getCompanionModeConfig,
  isCompanionModeId,
} from "../../../src/shared/companionModes.ts";
import {
  isScheduleReadMessage,
  isUpcomingScheduleDigestMessage,
} from "../../../src/shared/schedulingIntent.ts";
import {
  isAssignedCompanionName,
  normalizeCompanionName,
  synthesizeAssignedCompanionName,
} from "../../../src/lib/companionNameIdentity.ts";
import { TimeoutError, withTimeout } from "../../../src/utils/asyncTimeout.ts";
import { withCompanionChatPersistenceCapability } from "../companion-chat/persistenceCapability.ts";
import {
  CampaignLifecycleStatusSchema,
  COMPANION_CAMPAIGN_LIFECYCLE_STATUSES,
  type CompanionAgentContextLoadWarning,
  type CompanionAgentFollowUp,
  type CompanionAgentIntent,
  type CompanionAgentMode,
  type CompanionAgentRequest,
  type CompanionAgentUnderstandingState,
  type CompanionPendingActionType,
  type LoadedCompanionAgentContext,
  type PendingActionCandidate,
  type PendingActionRow,
  type SubmitCompanionResult,
  SubmitCompanionResultSchema,
} from "./types.ts";
import { consultPlannerForAgent } from "./plannerBridge.ts";
import {
  loadActivePendingAction,
  loadRecentMessages,
  loadThread,
  mergeLatestAssistantAgentDecision,
  persistAgentTurn,
  replacePendingAction,
} from "./persistence.ts";
import {
  buildErrorLog,
  getCompanionAgentFailureReason,
} from "./failureDiagnostics.ts";

type AgentRunSubStage = "context_load" | "openai" | "persistence";

export class AgentRunSubStageError extends Error {
  readonly subStage: AgentRunSubStage;
  readonly originalError: unknown;

  constructor(subStage: AgentRunSubStage, originalError: unknown) {
    const message = originalError instanceof Error
      ? originalError.message
      : typeof originalError === "string"
      ? originalError
      : `companion agent sub-stage ${subStage} failed`;
    super(message, { cause: originalError });
    this.name = "AgentRunSubStageError";
    this.subStage = subStage;
    this.originalError = originalError;
  }
}

const wrapSubStage = async <T>(
  subStage: AgentRunSubStage,
  fn: () => Promise<T>,
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AgentRunSubStageError) throw error;
    throw new AgentRunSubStageError(subStage, error);
  }
};

const readStringField = (
  value: unknown,
  field: string,
): string | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = (value as Record<string, unknown>)[field];
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
};

const describeAgentError = (error: unknown): string => {
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  if (typeof error === "string" && error.length > 0) return error;
  return readStringField(error, "message") ??
    readStringField(error, "error") ??
    "Unknown companion agent failure";
};

const buildContextLoadWarning = (
  source: string,
  required: boolean,
  error: unknown,
): CompanionAgentContextLoadWarning => ({
  source,
  required,
  message: describeAgentError(error),
  code: readStringField(error, "code"),
});

const logCompanionAgentBestEffortFailure = (params: {
  requestId?: string | null;
  subStage: Extract<AgentRunSubStage, "context_load" | "persistence">;
  source: string;
  required?: boolean;
  error: unknown;
}) => {
  const wrapped = new AgentRunSubStageError(params.subStage, params.error);
  console.warn("[companion-agent] best-effort failure", {
    ...buildErrorLog(params.error),
    requestId: params.requestId ?? null,
    stage: params.subStage,
    failureReason: getCompanionAgentFailureReason(wrapped, "agent_run"),
    source: params.source,
    required: params.required ?? false,
  });
};

const loadCompanionContextBestEffort = async <T>(params: {
  requestId?: string | null;
  source: string;
  required: boolean;
  fallback: T;
  warnings: CompanionAgentContextLoadWarning[];
  load: () => Promise<T>;
}): Promise<T> => {
  try {
    return await params.load();
  } catch (error) {
    const warning = buildContextLoadWarning(
      params.source,
      params.required,
      error,
    );
    params.warnings.push(warning);
    logCompanionAgentBestEffortFailure({
      requestId: params.requestId,
      subStage: "context_load",
      source: params.source,
      required: params.required,
      error,
    });
    return params.fallback;
  }
};

const persistAgentTurnBestEffort = async (params: {
  requestId?: string | null;
  persistConversation: () => Promise<void>;
}): Promise<boolean> => {
  try {
    return await withCompanionChatPersistenceCapability(
      params.persistConversation,
    );
  } catch (error) {
    logCompanionAgentBestEffortFailure({
      requestId: params.requestId,
      subStage: "persistence",
      source: "companion_chat_persistence",
      error,
    });
    return false;
  }
};

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_CONVERSATIONS_URL = "https://api.openai.com/v1/conversations";
export const DEFAULT_COMPANION_AGENT_MODEL = "gpt-5.4-mini";

const MAX_TOOL_LOOPS = 6;
const MAX_TASKS = 18;
const MAX_INBOX_TASKS = 8;
const MAX_RECENT_COMPLETED_TASKS = 24;
const MAX_RITUALS = 10;
const MAX_CAMPAIGNS = 8;
const MAX_REFLECTIONS = 8;
const AGENT_RESPONSE_TIMEOUT_MS = 5_000;

const getOptionalEnv = (name: string): string | null => {
  try {
    return Deno.env.get(name) ?? null;
  } catch (error) {
    if (error instanceof Error && error.name === "NotCapable") {
      return null;
    }

    throw error;
  }
};

export const resolveCompanionAgentModel = (
  env: (name: string) => string | null | undefined = getOptionalEnv,
): string =>
  env("OPENAI_COMPANION_AGENT_MODEL") ??
    env("OPENAI_TEXT_MODEL") ??
    DEFAULT_COMPANION_AGENT_MODEL;

const normalizeCompanionAgentModelName = (model: string) =>
  model.trim().toLowerCase();

const supportsNoReasoningEffort = (model: string) =>
  /^gpt-5\.(?:[12]|4(?:-(?:mini|nano))?|5)(?:-\d{4}-\d{2}-\d{2})?$/.test(
    normalizeCompanionAgentModelName(model),
  );

const buildResponsesReasoningConfig = (model: string) =>
  supportsNoReasoningEffort(model)
    ? { reasoning: { effort: "none" as const } }
    : {};

const OPENAI_PROVIDER_UNAVAILABLE_REPLY =
  "I'm having trouble reaching OpenAI right now. Try again in a moment, and I'll pick this back up.";
const OPENAI_EMPTY_OUTPUT_REPLY =
  "I reached my AI path, but it came back blank. Try again in a moment and I'll pick this up.";

type OpenAIProviderFailureReason =
  | "missing_api_key"
  | "model_access"
  | "quota"
  | "rate_limit"
  | "timeout"
  | "invalid_parameter"
  | "auth"
  | "network"
  | "server"
  | "empty_output"
  | "unknown";

type OpenAIProviderOperation = "api_key" | "conversation" | "response";

interface OpenAIProviderDiagnostics {
  provider: "openai";
  operation: OpenAIProviderOperation;
  reason: OpenAIProviderFailureReason;
  model: string;
  status: number | null;
  requestId: string | null;
  responseId: string | null;
  message: string;
}

class OpenAIProviderError extends Error {
  readonly diagnostics: OpenAIProviderDiagnostics;

  constructor(message: string, diagnostics: OpenAIProviderDiagnostics) {
    super(message);
    this.name = "OpenAIProviderError";
    this.diagnostics = diagnostics;
  }
}

const sanitizeOpenAIDiagnosticMessage = (message: string): string => {
  const withoutKeys = message.replace(/sk-[A-Za-z0-9_-]+/g, "sk-...");
  return withoutKeys.length > 700
    ? `${withoutKeys.slice(0, 700)}...`
    : withoutKeys;
};

const classifyOpenAIProviderFailure = (
  message: string,
  status: number | null = null,
): OpenAIProviderFailureReason => {
  const normalized = message.toLowerCase();
  if (normalized.includes("openai_api_key not configured")) {
    return "missing_api_key";
  }
  if (
    normalized.includes("model_not_found") ||
    normalized.includes("does not have access to model") ||
    normalized.includes("model access") ||
    (status === 404 && normalized.includes("model"))
  ) {
    return "model_access";
  }
  if (
    normalized.includes("insufficient_quota") ||
    normalized.includes("exceeded your current quota") ||
    normalized.includes("quota")
  ) {
    return "quota";
  }
  if (status === 429 || normalized.includes("rate limit")) {
    return "rate_limit";
  }
  if (
    status === 408 ||
    normalized.includes("timeout") ||
    normalized.includes("timed out")
  ) {
    return "timeout";
  }
  if (
    status === 401 ||
    status === 403 ||
    normalized.includes("invalid api key") ||
    normalized.includes("incorrect api key")
  ) {
    return "auth";
  }
  if (
    normalized.includes("unknown parameter") ||
    normalized.includes("unsupported parameter") ||
    normalized.includes("invalid_request_error") ||
    normalized.includes("invalid parameter") ||
    normalized.includes("unrecognized request argument")
  ) {
    return "invalid_parameter";
  }
  if (
    normalized.includes("failed to fetch") ||
    normalized.includes("network") ||
    normalized.includes("econnreset") ||
    normalized.includes("connection") ||
    normalized.includes("fetcherror")
  ) {
    return "network";
  }
  if (
    (status !== null && status >= 500) ||
    normalized.includes("service unavailable") ||
    normalized.includes("temporarily unavailable") ||
    normalized.includes("server error") ||
    normalized.includes("internal server error") ||
    normalized.includes("bad gateway") ||
    normalized.includes("gateway timeout")
  ) {
    return "server";
  }

  return "unknown";
};

const readOpenAIRequestId = (response: Response): string | null =>
  response.headers.get("x-request-id") ??
    response.headers.get("openai-request-id") ??
    response.headers.get("request-id");

const buildOpenAIProviderError = (params: {
  operation: OpenAIProviderOperation;
  message: string;
  model?: string;
  status?: number | null;
  requestId?: string | null;
  responseId?: string | null;
}): OpenAIProviderError => {
  const status = params.status ?? null;
  const message = sanitizeOpenAIDiagnosticMessage(params.message);
  return new OpenAIProviderError(message, {
    provider: "openai",
    operation: params.operation,
    reason: classifyOpenAIProviderFailure(message, status),
    model: params.model ?? resolveCompanionAgentModel(),
    status,
    requestId: params.requestId ?? null,
    responseId: params.responseId ?? null,
    message,
  });
};

const buildOpenAIEmptyOutputDiagnostics = (params: {
  responseId: string | null;
}): OpenAIProviderDiagnostics => ({
  provider: "openai",
  operation: "response",
  reason: "empty_output",
  model: resolveCompanionAgentModel(),
  status: null,
  requestId: null,
  responseId: params.responseId,
  message: "OpenAI response contained no usable assistant text.",
});

const getOpenAIProviderDiagnostics = (
  error: unknown,
): OpenAIProviderDiagnostics | null => {
  if (error instanceof OpenAIProviderError) return error.diagnostics;

  if (error instanceof TimeoutError || isOpenAIProviderFallbackError(error)) {
    const message = sanitizeOpenAIDiagnosticMessage(getErrorMessage(error));
    return {
      provider: "openai",
      operation: "response",
      reason: classifyOpenAIProviderFailure(message),
      model: resolveCompanionAgentModel(),
      status: null,
      requestId: null,
      responseId: null,
      message,
    };
  }

  return null;
};

const loggableOpenAIProviderDiagnostics = (
  diagnostics: OpenAIProviderDiagnostics | null | undefined,
) =>
  diagnostics
    ? {
      provider: diagnostics.provider,
      operation: diagnostics.operation,
      reason: diagnostics.reason,
      model: diagnostics.model,
      status: diagnostics.status,
      requestId: diagnostics.requestId,
      responseId: diagnostics.responseId,
      message: diagnostics.message,
    }
    : null;

const medianDuration = (durations: number[]): number | null => {
  if (durations.length === 0) return null;

  const sorted = [...durations].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return Math.round(sorted[middle]);

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};

const attachActualDurationMinutes = async (
  supabase: { from: (table: string) => any },
  userId: string,
  tasks: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> => {
  const taskIds = [
    ...new Set(
      tasks.map((task) => String(task.id ?? "")).filter(
        (id) => id.length > 0,
      ),
    ),
  ];
  if (taskIds.length === 0) return tasks;

  const { data, error } = await supabase
    .from("focus_sessions")
    .select("task_id, actual_duration")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("task_id", taskIds)
    .not("actual_duration", "is", null)
    .gt("actual_duration", 0);

  if (error) throw error;

  const durationsByTaskId = new Map<string, number[]>();
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const taskId = typeof row.task_id === "string" ? row.task_id : null;
    const duration = typeof row.actual_duration === "number"
      ? row.actual_duration
      : null;
    if (!taskId || !duration || !Number.isFinite(duration) || duration <= 0) {
      continue;
    }

    const durations = durationsByTaskId.get(taskId) ?? [];
    durations.push(duration);
    durationsByTaskId.set(taskId, durations);
  }

  return tasks.map((task) => ({
    ...task,
    actual_duration_minutes: medianDuration(
      durationsByTaskId.get(String(task.id ?? "")) ?? [],
    ),
  }));
};

const attachRitualActualDurationMinutes = async (
  supabase: { from: (table: string) => any },
  userId: string,
  rituals: Array<Record<string, unknown>>,
  completedSinceIso: string,
  limit = 200,
): Promise<Array<Record<string, unknown>>> => {
  const ritualIds = [
    ...new Set(
      rituals.map((ritual) => String(ritual.id ?? "")).filter((id) =>
        id.length > 0
      ),
    ),
  ];
  if (ritualIds.length === 0) return rituals;

  const { data: taskRows, error: taskError } = await supabase
    .from("daily_tasks")
    .select("id, habit_source_id")
    .eq("user_id", userId)
    .eq("completed", true)
    .gte("completed_at", completedSinceIso)
    .order("completed_at", { ascending: false })
    .limit(limit)
    .in("habit_source_id", ritualIds);

  if (taskError) throw taskError;

  const taskToRitualId = new Map<string, string>();
  for (const row of (taskRows ?? []) as Array<Record<string, unknown>>) {
    const taskId = typeof row.id === "string" ? row.id : null;
    const ritualId = typeof row.habit_source_id === "string"
      ? row.habit_source_id
      : null;
    if (taskId && ritualId) taskToRitualId.set(taskId, ritualId);
  }

  const taskIds = [...taskToRitualId.keys()];
  if (taskIds.length === 0) {
    return rituals.map((ritual) => ({
      ...ritual,
      actual_duration_minutes: null,
    }));
  }

  const { data: sessionRows, error: sessionError } = await supabase
    .from("focus_sessions")
    .select("task_id, actual_duration")
    .eq("user_id", userId)
    .eq("status", "completed")
    .in("task_id", taskIds)
    .not("actual_duration", "is", null)
    .gt("actual_duration", 0);

  if (sessionError) throw sessionError;

  const durationsByRitualId = new Map<string, number[]>();
  for (const row of (sessionRows ?? []) as Array<Record<string, unknown>>) {
    const taskId = typeof row.task_id === "string" ? row.task_id : null;
    const duration = typeof row.actual_duration === "number"
      ? row.actual_duration
      : null;
    const ritualId = taskId ? taskToRitualId.get(taskId) : null;
    if (!ritualId || !duration || !Number.isFinite(duration) || duration <= 0) {
      continue;
    }

    const durations = durationsByRitualId.get(ritualId) ?? [];
    durations.push(duration);
    durationsByRitualId.set(ritualId, durations);
  }

  return rituals.map((ritual) => ({
    ...ritual,
    actual_duration_minutes: medianDuration(
      durationsByRitualId.get(String(ritual.id ?? "")) ?? [],
    ),
  }));
};

const PrepareTaskUpdateSchema = z.object({
  task_id: z.string().uuid(),
  title: z.string().min(1).max(200).optional().nullable(),
  task_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  estimated_duration: z.number().int().min(1).max(1440).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  priority: z.string().max(40).optional().nullable(),
  completed: z.boolean().optional().nullable(),
  reminder_enabled: z.boolean().optional().nullable(),
  reminder_minutes_before: z.number().int().min(0).max(1440).optional()
    .nullable(),
});

const CalendarProviderSchema = z.enum(["google", "outlook", "all"]);
const QuestCategorySchema = z.enum(["mind", "body", "soul"]);

const PrepareTaskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  task_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  estimated_duration: z.number().int().min(5).max(1440).default(30),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  energy_type: z.enum([
    "deep",
    "admin",
    "physical",
    "errand",
    "social",
    "creative",
    "recovery",
  ]).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  category: QuestCategorySchema.optional().nullable(),
  reminder_enabled: z.boolean().default(false),
  reminder_minutes_before: z.number().int().min(0).max(1440).optional()
    .nullable(),
  send_to_calendar: z.boolean().default(false),
  calendar_provider: CalendarProviderSchema.optional().nullable(),
}).superRefine((value, ctx) => {
  if (value.task_date && !value.scheduled_time) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["scheduled_time"],
      message: "A dated task needs a scheduled time",
    });
  }
  if (value.scheduled_time && !value.task_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["task_date"],
      message: "A scheduled time needs a task date",
    });
  }
  if (value.send_to_calendar && (!value.task_date || !value.scheduled_time)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["send_to_calendar"],
      message: "Calendar sync needs a date and time",
    });
  }
});

const PrepareRitualCreateSchema = z.object({
  title: z.string().min(1).max(200),
  frequency: z.string().min(1).max(50),
  preferred_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  estimated_minutes: z.number().int().min(1).max(1440).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  category: QuestCategorySchema.optional().nullable(),
  reminder_enabled: z.boolean().optional().nullable(),
  reminder_minutes_before: z.number().int().min(0).max(1440).optional()
    .nullable(),
});

const PrepareReminderCreateSchema = z.object({
  target_type: z.enum(["task", "ritual"]),
  target_id: z.string().uuid(),
  reminder_enabled: z.boolean().default(true),
  reminder_minutes_before: z.number().int().min(0).max(1440).optional()
    .nullable(),
});

export const PrepareCampaignUpdateSchema = z.object({
  campaign_id: z.string().uuid(),
  title: z.string().min(1).max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: CampaignLifecycleStatusSchema.optional().nullable(),
  target_days: z.number().int().min(1).max(365).optional().nullable(),
});

const CampaignRitualSchema = z.object({
  title: z.string().min(1).max(200),
  frequency: z.enum(["daily", "5x_week", "3x_week", "custom", "monthly"])
    .default("daily"),
  custom_days: z.array(z.number().int().min(0).max(6)).max(7).optional()
    .nullable(),
  preferred_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  estimated_minutes: z.number().int().min(1).max(1440).default(15),
  description: z.string().max(2000).optional().nullable(),
  category: QuestCategorySchema.optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("easy"),
  reminder_enabled: z.boolean().default(false),
  reminder_minutes_before: z.number().int().min(0).max(1440).optional()
    .nullable(),
});

const PrepareCampaignCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  target_days: z.number().int().min(1).max(365).default(30),
  rituals: z.array(CampaignRitualSchema).min(1).max(3),
});

const DayPlanBlockSchema = z.object({
  task_id: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  duration_minutes: z.number().int().min(5).max(480),
  energy_type: z.enum([
    "deep",
    "admin",
    "physical",
    "errand",
    "social",
    "creative",
    "recovery",
  ]).optional().nullable(),
  source: z.enum(["campaign", "habit", "recovery", "optimization"])
    .default("optimization"),
  reasoning: z.string().max(1000).optional().nullable(),
  epic_id: z.string().uuid().optional().nullable(),
  habit_source_id: z.string().uuid().optional().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
  reminder_enabled: z.boolean().default(false),
  reminder_minutes_before: z.number().int().min(0).max(1440).optional()
    .nullable(),
  category: QuestCategorySchema.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const PrepareDayPlanSchema = z.object({
  plan_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  blocks: z.array(DayPlanBlockSchema).min(1).max(8),
  send_to_calendar: z.boolean().default(false),
  calendar_provider: CalendarProviderSchema.optional().nullable(),
}).superRefine((value, ctx) => {
  const sortedBlocks = [...value.blocks].sort((left, right) =>
    left.start_time.localeCompare(right.start_time)
  );
  const seenTaskIds = new Set<string>();
  for (let index = 0; index < value.blocks.length; index += 1) {
    const taskId = value.blocks[index].task_id;
    if (!taskId) continue;
    if (seenTaskIds.has(taskId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blocks", index, "task_id"],
        message: "An existing task can appear only once in a day plan",
      });
    }
    seenTaskIds.add(taskId);
  }
  for (let index = 1; index < sortedBlocks.length; index += 1) {
    const previous = sortedBlocks[index - 1];
    const current = sortedBlocks[index];
    const [previousHour, previousMinute] = previous.start_time.split(":").map(
      Number,
    );
    const [currentHour, currentMinute] = current.start_time.split(":").map(
      Number,
    );
    const previousEnd = previousHour * 60 + previousMinute +
      previous.duration_minutes;
    const currentStart = currentHour * 60 + currentMinute;
    if (currentStart < previousEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blocks", index, "start_time"],
        message: "Day-plan blocks cannot overlap",
      });
    }
  }
});

const PrepareJournalEntrySchema = z.object({
  note: z.string().min(1).max(4000),
  mood: z.string().max(80).optional().nullable(),
  reflection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    .nullable(),
});

type GuardedFetch = typeof fetch;

export interface UserCompanionRow {
  id: string;
  companion_name: string | null;
  cached_creature_name: string | null;
  preset_id: string | null;
  spirit_animal: string | null;
  core_element: string | null;
  current_stage: number | null;
  current_mood: string | null;
}

interface RunAgentParams {
  guardedFetch: GuardedFetch;
  supabase: any;
  actorSupabase?: any;
  userId: string;
  request: CompanionAgentRequest;
  openAIApiKey?: string;
  requestId?: string | null;
}

interface ToolCall {
  call_id: string;
  name: string;
  arguments: string;
}

interface OpenAIResponseBody {
  id: string;
  output?: Array<Record<string, unknown>>;
  output_text?: string;
  conversation?: { id?: string } | null;
}

interface AgentRunResult {
  result: {
    reply: string;
    mode: CompanionAgentMode;
    intent: CompanionAgentIntent;
    confidence: number;
    understandingState: CompanionAgentUnderstandingState;
    followUp: CompanionAgentFollowUp | null;
    assumptions: string[];
    evidenceIds: string[];
    structuredResponse: ReturnType<
      typeof consultPlannerForAgent
    >["structuredResponse"];
    preparedActionId: string | null;
  };
  openaiConversationId: string | null;
  lastOpenAIResponseId: string | null;
  actionDecisionSource?: "model" | "deterministic";
  providerDiagnostics?: OpenAIProviderDiagnostics | null;
}

const extractTextFromContentItem = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  const item = asRecord(value);
  if (!item) return "";

  const text = typeof item.text === "string"
    ? item.text
    : typeof item.output_text === "string"
    ? item.output_text
    : typeof item.content === "string"
    ? item.content
    : "";

  return text.trim();
};

function extractOpenAIResponseText(response: OpenAIResponseBody): string {
  const sdkOutputText = response.output_text?.trim();
  if (sdkOutputText) return sdkOutputText;

  const outputTextParts = (response.output ?? [])
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .flatMap((item) => {
      const directText = extractTextFromContentItem(item);
      const content = Array.isArray(item.content)
        ? item.content
        : Array.isArray(item.output)
        ? item.output
        : [];

      return [
        item.type === "output_text" ? directText : "",
        ...content.map(extractTextFromContentItem),
      ];
    })
    .map((text) => text.trim())
    .filter((text) => text.length > 0);

  return outputTextParts.join("\n").trim();
}

const mapPendingActionForResponse = (pendingAction: PendingActionRow) => ({
  id: pendingAction.id,
  status: pendingAction.status,
  intent: pendingAction.intent,
  actionType: pendingAction.action_type,
  proposalId: null,
  summary: pendingAction.summary,
  confirmationMessage: pendingAction.confirmation_message,
  normalizedPayload: pendingAction.normalized_payload,
  affectedEntities: pendingAction.affected_entities,
  expiresAt: pendingAction.expires_at,
  createdAt: pendingAction.created_at,
});

const deriveUnderstandingState = (params: {
  mode: CompanionAgentMode;
  preparedActionId?: string | null;
  followUp?: CompanionAgentFollowUp | null;
}): CompanionAgentUnderstandingState => {
  if (params.followUp || params.mode === "clarify") return "needs_followup";
  if (params.mode === "pending_confirmation" || params.preparedActionId) {
    return "ready_to_draft";
  }
  if (params.mode === "schedule_read") return "ready_to_propose";
  return "enough_to_discuss";
};

type BareStarterIntent =
  | "plan_day"
  | "advance_campaign_start"
  | "make_room"
  | "what_matters"
  | "relationship_touch"
  | "low_energy_adjust"
  | "briefing_followup"
  | "goal_breakdown"
  | "goal_breakdown_start";

interface BareStarterFollowUpConfig {
  intent: CompanionAgentIntent;
  prompts: readonly string[];
  reply: string;
  followUp: CompanionAgentFollowUp;
}

const CONSENT_FIRST_PLANNING_STARTER_INTENTS = new Set<string>([
  "plan_day",
  "plan_week",
  "advance_campaign_start",
  "make_room",
  "what_matters",
  "relationship_touch",
  "low_energy_adjust",
  "briefing_followup",
]);

const isConsentFirstPlanningStarterIntent = (
  value: string | null | undefined,
): boolean =>
  Boolean(value && CONSENT_FIRST_PLANNING_STARTER_INTENTS.has(value));

const withPlanningLauncherFollowUpMetadata = (
  followUp: CompanionAgentFollowUp,
  starterIntent: string,
): CompanionAgentFollowUp =>
  isConsentFirstPlanningStarterIntent(starterIntent)
    ? {
      ...followUp,
      metadata: {
        ...(followUp.metadata ?? {}),
        planningLauncherFollowUp: true,
        sourceStarterIntent: starterIntent,
      },
    }
    : followUp;

const mapPlanningStarterIntentToAgentIntent = (
  starterIntent: string | null | undefined,
): CompanionAgentIntent => {
  switch (starterIntent) {
    case "plan_week":
      return "plan_week";
    case "advance_campaign_start":
      return "goal_setting";
    case "low_energy_adjust":
    case "make_room":
      return "update_existing_plan";
    case "plan_day":
    case "what_matters":
    case "relationship_touch":
    case "briefing_followup":
      return "plan_day";
    default:
      return "unknown";
  }
};

const BARE_STARTER_FOLLOW_UPS: Record<
  BareStarterIntent,
  BareStarterFollowUpConfig
> = {
  plan_day: {
    intent: "plan_day",
    prompts: [
      "plan my day",
      "help me plan my day",
      "help me plan today",
      "plan today",
      "show me today",
      "today look like",
      "what does today look like",
    ],
    reply:
      "Absolutely. Before I shape today, should it lean focus, recovery, or catching up?",
    followUp: {
      question: "Should today lean focus, recovery, or catching up?",
      reason:
        "That choice changes whether I protect deep work, lighten the load, or triage overdue items.",
      expectedAnswerType: "choice",
      options: ["Focus", "Recovery", "Catch up"],
    },
  },
  advance_campaign_start: {
    intent: "goal_setting",
    prompts: ["advance my campaign"],
    reply:
      "Yes. Which campaign should I focus on first, and are we looking for a quick next step or a deeper reset?",
    followUp: {
      question:
        "Which campaign should I focus on, and do you want a quick next step or a deeper reset?",
      reason:
        "Campaign work depends on the target and how much intervention you want right now.",
      expectedAnswerType: "free_text",
      options: ["Quick next step", "Deeper reset"],
    },
  },
  make_room: {
    intent: "update_existing_plan",
    prompts: ["make room"],
    reply:
      "I can make room. What are we making room for: focus work, recovery, or a specific commitment?",
    followUp: {
      question:
        "What are we making room for: focus work, recovery, or a specific commitment?",
      reason:
        "I need the thing being protected before I decide what can move, shrink, or drop.",
      expectedAnswerType: "free_text",
      options: ["Focus work", "Recovery", "Specific commitment"],
    },
  },
  what_matters: {
    intent: "plan_day",
    prompts: ["what matters most", "what matters most?"],
    reply:
      "I can sort the signal from the noise. Are we choosing what to protect, what can move, or what to ignore?",
    followUp: {
      question:
        "Are we choosing what to protect, what can move, or what to ignore?",
      reason:
        "That decides whether I read the day for priority, flexibility, or noise reduction.",
      expectedAnswerType: "choice",
      options: ["Protect", "Move", "Ignore"],
    },
  },
  relationship_touch: {
    intent: "plan_day",
    prompts: ["relationship touch"],
    reply:
      "I can check who needs attention. Are you looking for a quick reach-out, a meaningful follow-up, or just the read?",
    followUp: {
      question:
        "Are you looking for a quick reach-out, a meaningful follow-up, or just the read?",
      reason:
        "Relationship planning should not become a quest unless you explicitly want that.",
      expectedAnswerType: "choice",
      options: ["Quick reach-out", "Meaningful follow-up", "Just the read"],
    },
  },
  low_energy_adjust: {
    intent: "update_existing_plan",
    prompts: ["i'm low energy", "im low energy"],
    reply:
      "Got it. Should I make today lighter, preserve one important thing, or help you recover?",
    followUp: {
      question:
        "Should I make today lighter, preserve one important thing, or help you recover?",
      reason:
        "Low-energy planning should not assume whether you want relief, momentum, or recovery.",
      expectedAnswerType: "choice",
      options: ["Make it lighter", "Preserve one thing", "Help me recover"],
    },
  },
  briefing_followup: {
    intent: "plan_day",
    prompts: ["prepare me for tomorrow"],
    reply:
      "I can prepare tomorrow. Should I focus on logistics, priorities, or making it feel lighter?",
    followUp: {
      question:
        "Should I focus tomorrow prep on logistics, priorities, or making it feel lighter?",
      reason:
        "Tomorrow prep can be a briefing, a priority plan, or a load reduction pass.",
      expectedAnswerType: "choice",
      options: ["Logistics", "Priorities", "Lighter"],
    },
  },
  goal_breakdown: {
    intent: "goal_setting",
    prompts: ["let's lock in a new goal", "lets lock in a new goal"],
    reply: "Great. What goal are we locking in?",
    followUp: {
      question: "What goal are we locking in?",
      reason:
        "A goal needs the actual target before I can break it into useful next steps.",
      expectedAnswerType: "free_text",
      options: [],
    },
  },
  goal_breakdown_start: {
    intent: "goal_setting",
    prompts: ["let's lock in a new goal", "lets lock in a new goal"],
    reply: "Great. What goal are we locking in?",
    followUp: {
      question: "What goal are we locking in?",
      reason:
        "A goal needs the actual target before I can break it into useful next steps.",
      expectedAnswerType: "free_text",
      options: [],
    },
  },
};

const normalizeBareStarterPrompt = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[?!.,]+$/g, "")
    .replace(/\s+/g, " ");

const isThinGenericAgentReply = (value: string): boolean => {
  const normalized = normalizeBareStarterPrompt(value);
  const withoutSentencePunctuation = normalized
    .replace(/[.!?]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized === "i'm here" ||
    normalized === "im here" ||
    normalized === "i am here" ||
    normalized === "here" ||
    withoutSentencePunctuation ===
      "i need a little more to help tell me what you want to do next";
};

const isLauncherTurn = (request: CompanionAgentRequest): boolean =>
  request.turnOrigin === "launcher" || request.turnOrigin === undefined;

const isFollowUpOptionTurn = (request: CompanionAgentRequest): boolean =>
  request.turnOrigin === "follow_up_option" ||
  request.turnOrigin === undefined;

export const isCompanionScheduleReadFastPathRequest = (
  request: CompanionAgentRequest,
): boolean => {
  return request.starterIntent === "upcoming_start" ||
    isUpcomingScheduleDigestMessage(request.message) ||
    isScheduleReadMessage(request.message);
};

const isDeterministicScheduleReadRequest =
  isCompanionScheduleReadFastPathRequest;

export const isContextualPlanDayFastPathRequest = (
  request: CompanionAgentRequest,
): boolean => {
  return request.surface === "journeys" &&
    request.starterIntent === "plan_day" &&
    isLauncherTurn(request) &&
    Boolean(request.briefingContext) &&
    !isExplicitCompanionWriteRequest(request);
};

const looksLikePlannerActionMessage = (message: string): boolean => {
  const normalized = normalizeBareStarterPrompt(message);
  return /\b(add|block|calendar|catch up|create|deadline|delete|do next|finish|habit|make|move|plan|quest|remind|reschedule|ritual|schedule|task|today|tomorrow|week)\b/
    .test(normalized);
};

const isFreeTalkProviderFallbackRequest = (
  request: CompanionAgentRequest,
): boolean =>
  !request.starterIntent &&
  !request.activeFollowUp &&
  !isDeterministicScheduleReadRequest(request) &&
  !looksLikePlannerActionMessage(request.message);

const normalizeModelMode = (value: unknown): CompanionAgentMode | null => {
  const normalized = typeof value === "string" ? value.trim() : "";
  switch (normalized) {
    case "conversation":
    case "conversational":
    case "chat":
      return "conversation";
    case "clarify":
    case "clarification":
      return "clarify";
    case "schedule_read":
    case "schedule-read":
      return "schedule_read";
    case "pending_confirmation":
    case "pending-confirmation":
      return "pending_confirmation";
    case "receipt":
      return "receipt";
    default:
      return null;
  }
};

const normalizeModelIntent = (value: unknown): CompanionAgentIntent | null => {
  const normalized = typeof value === "string" ? value.trim() : "";
  switch (normalized) {
    case "schedule_task":
    case "plan_day":
    case "plan_week":
    case "check_calendar":
    case "update_existing_plan":
    case "goal_setting":
    case "journal":
    case "explore":
    case "reflect":
    case "unknown":
      return normalized as CompanionAgentIntent;
    case "conversation":
    case "conversational":
    case "chat":
    case "general":
      return "unknown";
    default:
      return null;
  }
};

const normalizeModelUnderstandingState = (
  value: unknown,
): CompanionAgentUnderstandingState | null => {
  const normalized = typeof value === "string" ? value.trim() : "";
  switch (normalized) {
    case "needs_followup":
    case "needs-followup":
      return "needs_followup";
    case "enough_to_discuss":
    case "enough-to-discuss":
    case "enough":
      return "enough_to_discuss";
    case "ready_to_propose":
    case "ready-to-propose":
      return "ready_to_propose";
    case "ready_to_draft":
    case "ready-to-draft":
      return "ready_to_draft";
    default:
      return null;
  }
};

const clampConfidence = (value: unknown, fallback = 0.65) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;

const buildLenientChatSubmitResult = (
  raw: unknown,
): SubmitCompanionResult | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const reply = typeof record.reply === "string" ? record.reply.trim() : "";
  if (!reply) return null;

  const mode = normalizeModelMode(record.mode) ?? "conversation";
  const intent = normalizeModelIntent(record.intent) ?? "unknown";
  const understandingState =
    normalizeModelUnderstandingState(record.understanding_state) ??
      deriveUnderstandingState({
        mode,
        preparedActionId: null,
        followUp: null,
      });

  return {
    reply,
    mode,
    intent,
    confidence: clampConfidence(record.confidence),
    understanding_state: understandingState,
    follow_up: null,
    assumptions: [],
    evidence_ids: [],
    structured_response: null,
    prepared_action_id: null,
  };
};

const parseSubmitCompanionResultArguments = (
  argumentsText: string,
  options: { allowLenientChatResult?: boolean } = {},
): SubmitCompanionResult => {
  const raw = JSON.parse(argumentsText || "{}");
  const strict = SubmitCompanionResultSchema.safeParse(raw);
  if (strict.success) return strict.data;

  if (options.allowLenientChatResult) {
    const lenientResult = buildLenientChatSubmitResult(raw);
    if (lenientResult) return lenientResult;
  }

  throw strict.error;
};

const EXPLICIT_COMPANION_WRITE_STARTER_INTENTS = new Set<string>([
  "plan_day",
  "plan_week",
  "advance_campaign_start",
  "make_room",
  "what_matters",
  "low_energy_adjust",
  "briefing_followup",
  "goal_breakdown",
  "goal_breakdown_start",
]);

const WRITE_TARGET_HINT_PATTERN =
  /\b(?:quest|task|reminder|ritual|journal|reflection|calendar|schedule|campaign|goal|habit|appointment|meeting|call|gym|pilates|workout|today|tomorrow|tonight|morning|afternoon|evening|daily|weekly|monthly|monday|tuesday|wednesday|thursday|friday|saturday|sunday|at\s+\d{1,2}(?::\d{2})?(?:\s*(?:am|pm))?|\d{1,2}:\d{2})\b/;

const DIRECT_WRITE_REQUEST_PATTERNS = [
  /^(?:please\s+|pls\s+)?(?:add|draft|save|log)\b.+/,
  /\b(?:can|could|would|will)\s+you\s+(?:add|draft|save|log)\b/,
  /\bi\s+(?:need|want)\s+you\s+to\s+(?:add|draft|save|log)\b/,
];

const TARGETED_WRITE_REQUEST_PATTERNS = [
  /^(?:please\s+|pls\s+)?create\b.+/,
  /\b(?:can|could|would|will)\s+you\s+create\b.+/,
  /\bi\s+(?:need|want)\s+you\s+to\s+create\b.+/,
  /\b(?:help me|let's|lets)\s+(?:create|add|draft|save|log)\b.+/,
  /\b(?:can|could|would|will)\s+we\s+(?:create|add|draft|save|log)\b.+/,
  /\bi\s+(?:need|want|would like)\s+to\s+(?:create|add|draft|save|log)\b.+/,
  /\b(?:i'd|id)\s+like\s+to\s+(?:create|add|draft|save|log)\b.+/,
];

const SCHEDULE_WRITE_REQUEST_PATTERNS = [
  /^(?:please\s+|pls\s+)?schedule\b/,
  /\b(?:can|could|would|will)\s+(?:you|we)\s+schedule\b/,
  /\b(?:help me|i need(?: you)? to|i want(?: you)? to|let's|lets)\s+schedule\b/,
];

const PLANNING_WRITE_REQUEST_PATTERNS = [
  /^(?:please\s+|pls\s+)?(?:plan|organize|map\s+out)\s+(?:out\s+)?(?:my\s+)?(?:day|today|tomorrow|week)\b/,
  /\b(?:can|could|would|will)\s+you\s+(?:plan|organize|map\s+out)\s+(?:out\s+)?(?:my\s+)?(?:day|today|tomorrow|week)\b/,
  /\b(?:help\s+me|i\s+need(?:\s+you)?\s+to|i\s+want(?:\s+you)?\s+to|let's|lets)\s+(?:plan|organize|map\s+out)\s+(?:out\s+)?(?:my\s+)?(?:day|today|tomorrow|week)\b/,
  /\b(?:make|build)\s+(?:me\s+)?(?:a\s+)?plan\s+for\s+(?:my\s+)?(?:day|today|tomorrow|week)\b/,
];

const GOAL_WRITE_REQUEST_PATTERNS = [
  /^(?:please\s+|pls\s+)?(?:set|start|build|create|make|lock\s+in)\s+(?:up\s+)?(?:a\s+)?(?:goal|campaign)\b/,
  /\b(?:can|could|would|will)\s+you\s+(?:help\s+me\s+)?(?:set|start|build|create|make|lock\s+in)\s+(?:up\s+)?(?:a\s+)?(?:goal|campaign)\b/,
  /\b(?:help\s+me|i\s+need(?:\s+you)?\s+to|i\s+want(?:\s+you)?\s+to|let's|lets)\s+(?:set|start|build|create|make|lock\s+in)\s+(?:up\s+)?(?:a\s+)?(?:goal|campaign)\b/,
  /\b(?:turn|make|convert)\b.+\b(?:into|as)\b.+\b(?:goal|campaign)\b/,
];

const CORE_UPDATE_WRITE_REQUEST_PATTERNS = [
  /^(?:please\s+|pls\s+)?(?:move|reschedule|update|cancel|delete|remove|complete)\b.+/,
  /\b(?:can|could|would|will)\s+you\s+(?:move|reschedule|update|cancel|delete|remove|complete)\b/,
  /\b(?:help me|i need(?: you)? to|i want(?: you)? to)\s+(?:move|reschedule|update|cancel|delete|remove|complete)\b.+/,
];

const EXTENDED_UPDATE_WRITE_REQUEST_PATTERNS = [
  /^(?:please\s+|pls\s+)?(?:shift|push|pull|adjust|edit|rename|book|fit|squeeze|slot|lock\s+in)\b.+/,
  /\b(?:can|could|would|will)\s+you\s+(?:shift|push|pull|adjust|edit|rename|book|fit|squeeze|slot|lock\s+in)\b.+/,
  /\b(?:help me|i need(?: you)? to|i want(?: you)? to)\s+(?:shift|push|pull|adjust|edit|rename|book|fit|squeeze|slot|lock\s+in)\b.+/,
  /\bmark\b.+\b(?:done|complete|completed)\b/,
];

const isExplicitCompanionWriteMessage = (message: string): boolean => {
  const normalized = normalizeBareStarterPrompt(message);
  const hasWriteTargetHint = WRITE_TARGET_HINT_PATTERN.test(normalized);
  const isScheduleReadQuestion =
    /\b(?:what(?:'s| is)|whats|how|show|check|read|view|see)\b.*\bschedule\b/
      .test(normalized);

  const isDirectWriteRequest =
    DIRECT_WRITE_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    (hasWriteTargetHint &&
      TARGETED_WRITE_REQUEST_PATTERNS.some((pattern) =>
        pattern.test(normalized)
      ));
  const isScheduleWriteRequest = !isScheduleReadQuestion &&
    SCHEDULE_WRITE_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized));
  const isUpdateWriteRequest =
    CORE_UPDATE_WRITE_REQUEST_PATTERNS.some((pattern) =>
      pattern.test(normalized)
    ) ||
    (hasWriteTargetHint &&
      EXTENDED_UPDATE_WRITE_REQUEST_PATTERNS.some((pattern) =>
        pattern.test(normalized)
      ));

  return isDirectWriteRequest ||
    PLANNING_WRITE_REQUEST_PATTERNS.some((pattern) =>
      pattern.test(normalized)
    ) ||
    GOAL_WRITE_REQUEST_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    /\b(remind me|set(?: up)? (?:a )?reminder)\b/.test(normalized) ||
    /\b(?:ritual for)\b/.test(normalized) ||
    /\b(?:turn|make|convert)\b.+\b(?:into|as)\b.+\b(?:quest|task|reminder|ritual|journal)\b/
      .test(normalized) ||
    /\b(?:put|place|block)\b.+\b(?:on|for|at|calendar|schedule|today|tomorrow)\b/
      .test(normalized) ||
    isScheduleWriteRequest ||
    isUpdateWriteRequest;
};

function isExplicitCompanionWriteRequest(
  request: CompanionAgentRequest,
): boolean {
  if (request.turnOrigin === "follow_up_option") return true;
  if (request.surface === "journeys" && request.activeFollowUp) return true;
  if (
    request.starterIntent &&
    EXPLICIT_COMPANION_WRITE_STARTER_INTENTS.has(request.starterIntent)
  ) {
    return true;
  }

  return isExplicitCompanionWriteMessage(request.message) ||
    /\b(?:make|keep)\s+(?:it|today|tomorrow|my day)\s+(?:lighter|easier|simpler|more focused|less busy|more realistic)\b/i
      .test(request.message) ||
    /\b(?:rework|redo|rebalance|lighten|simplify)\s+(?:it|today|tomorrow|my day|the plan)\b/i
      .test(request.message);
}

const getScheduleReadStarterIntent = (
  request: CompanionAgentRequest,
): string | null =>
  request.starterIntent === "upcoming_start" ||
    isUpcomingScheduleDigestMessage(request.message)
    ? "upcoming_start"
    : null;

const resolveBareStarterFollowUp = (
  request: CompanionAgentRequest,
):
  | (BareStarterFollowUpConfig & { starterIntent: BareStarterIntent })
  | null => {
  if (!isLauncherTurn(request)) {
    return null;
  }

  if (request.activeFollowUp) {
    return null;
  }

  const normalizedMessage = normalizeBareStarterPrompt(request.message);
  for (
    const starterIntent of Object.keys(BARE_STARTER_FOLLOW_UPS) as Array<
      BareStarterIntent
    >
  ) {
    if (starterIntent === "plan_day") continue;
    const config = BARE_STARTER_FOLLOW_UPS[starterIntent];
    if (!config.prompts.includes(normalizedMessage)) continue;
    if (request.starterIntent && request.starterIntent !== starterIntent) {
      continue;
    }
    return { ...config, starterIntent };
  }

  return null;
};

const getPlanningStarterIntentFromFollowUp = (
  followUp: CompanionAgentFollowUp | null | undefined,
): string | null => {
  const metadata = asRecord(followUp?.metadata);
  const sourceStarterIntent = typeof metadata?.sourceStarterIntent === "string"
    ? metadata.sourceStarterIntent
    : null;
  return isConsentFirstPlanningStarterIntent(sourceStarterIntent)
    ? sourceStarterIntent
    : null;
};

const isPlanningLauncherFollowUpQuestion = (
  followUp: CompanionAgentFollowUp | null | undefined,
): boolean => {
  if (!followUp) return false;
  if (getPlanningStarterIntentFromFollowUp(followUp)) return true;
  const metadata = asRecord(followUp.metadata);
  if (
    metadata?.planningLauncherFollowUp === true ||
    metadata?.planningLauncherConsent === true
  ) {
    return true;
  }
  const normalizedQuestion = normalizeBareStarterPrompt(followUp.question);
  const normalizedOptions = (followUp.options ?? []).map((option) =>
    normalizeBareStarterPrompt(option)
  );
  const optionSet = new Set(normalizedOptions);
  const hasFocusRecoveryOptions = optionSet.has("focus") &&
    optionSet.has("recovery") &&
    (optionSet.has("catch up") || optionSet.has("catch-up"));
  const hasBlankDayOptions = optionSet.has("focused") &&
    optionSet.has("light") &&
    (optionSet.has("catch up") || optionSet.has("catch-up"));
  const hasEnergyOptions =
    normalizedOptions.some((option) => option.startsWith("low")) &&
    normalizedOptions.some((option) => option.startsWith("medium")) &&
    normalizedOptions.some((option) => option.startsWith("high"));

  const isGenericPlanningConsent =
    normalizedQuestion === "would you like to form a quest" ||
    normalizedQuestion.includes("would you like me to draft");

  return isGenericPlanningConsent ||
    hasFocusRecoveryOptions ||
    hasBlankDayOptions ||
    hasEnergyOptions ||
    normalizedQuestion.includes("what kind of day") ||
    normalizedQuestion.includes("what type of day") ||
    normalizedQuestion.includes("feeling like focusing") ||
    (normalizedQuestion.includes("today") &&
      normalizedQuestion.includes("focus") &&
      (
        normalizedQuestion.includes("recovery") ||
        normalizedQuestion.includes("catch")
      )) ||
    (normalizedQuestion.includes("energy") &&
      normalizedQuestion.includes("working"));
};

const parsePersistedFollowUp = (
  value: unknown,
): CompanionAgentFollowUp | null => {
  const record = asRecord(value);
  if (!record || typeof record.question !== "string") return null;
  const expectedAnswerType = record.expectedAnswerType === "choice" ||
      record.expectedAnswerType === "time" ||
      record.expectedAnswerType === "priority" ||
      record.expectedAnswerType === "confirmation" ||
      record.expectedAnswerType === "free_text"
    ? record.expectedAnswerType
    : "free_text";

  return {
    question: record.question,
    reason: typeof record.reason === "string" ? record.reason : null,
    expectedAnswerType,
    options: Array.isArray(record.options)
      ? record.options.filter((option): option is string =>
        typeof option === "string"
      )
      : [],
    metadata: asRecord(record.metadata) ?? undefined,
  };
};

const getPersistedActiveFollowUp = (
  context: LoadedCompanionAgentContext,
): CompanionAgentFollowUp | null => {
  for (const message of [...context.messages].reverse()) {
    if (message.role !== "assistant") continue;
    const metadata = asRecord(message.metadata);
    const decision = asRecord(metadata?.agentDecision);
    if (decision) return parsePersistedFollowUp(decision.followUp);
  }

  return null;
};

const isPlanDayClarificationText = (value: string): boolean => {
  const normalized = normalizeBareStarterPrompt(value);
  return normalized.includes("what kind of day") ||
    normalized.includes("what type of day") ||
    normalized.includes("feeling like focusing") ||
    normalized.includes("focus, recovery, or catching up") ||
    normalized.includes("should today lean focus") ||
    (normalized.includes("energy") && normalized.includes("working"));
};

const hasRecentPlanDayStarterBeforeLastAssistant = (
  context: LoadedCompanionAgentContext,
): boolean => {
  const lastAssistantIndex = [...context.messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "assistant")?.index;
  if (lastAssistantIndex === undefined) return false;

  const assistantMessage = context.messages[lastAssistantIndex];
  if (!isPlanDayClarificationText(assistantMessage.content)) return false;

  return context.messages
    .slice(Math.max(0, lastAssistantIndex - 6), lastAssistantIndex)
    .some((message) =>
      message.role === "user" &&
      normalizeBareStarterPrompt(message.content).includes("plan my day")
    );
};

const getPlanningStarterIntentFromActiveFollowUp = (
  request: CompanionAgentRequest,
  context: LoadedCompanionAgentContext,
): string | null => {
  const requestStarter = getPlanningStarterIntentFromFollowUp(
    request.activeFollowUp,
  );
  if (requestStarter) return requestStarter;

  const persistedFollowUp = getPersistedActiveFollowUp(context);
  const persistedStarter = getPlanningStarterIntentFromFollowUp(
    persistedFollowUp,
  );
  if (persistedStarter) return persistedStarter;

  if (
    request.activeFollowUp &&
    isPlanningLauncherFollowUpQuestion(request.activeFollowUp)
  ) {
    return "plan_day";
  }
  if (
    persistedFollowUp && isPlanningLauncherFollowUpQuestion(persistedFollowUp)
  ) {
    return "plan_day";
  }

  return hasRecentPlanDayStarterBeforeLastAssistant(context)
    ? "plan_day"
    : null;
};

const isPlanningLauncherFollowUpAnswer = (
  request: CompanionAgentRequest,
  context: LoadedCompanionAgentContext,
): boolean => {
  if (!isFollowUpOptionTurn(request)) {
    return false;
  }

  return isPlanningLauncherFollowUpQuestion(request.activeFollowUp) ||
    isPlanningLauncherFollowUpQuestion(getPersistedActiveFollowUp(context)) ||
    hasRecentPlanDayStarterBeforeLastAssistant(context);
};

const hasActionArtifacts = (result: AgentRunResult["result"]) =>
  result.mode === "pending_confirmation" ||
  result.understandingState === "ready_to_draft" ||
  Boolean(result.preparedActionId) ||
  result.structuredResponse !== null;

function normalizeBareStarterResult(params: {
  request: CompanionAgentRequest;
  result: AgentRunResult["result"];
}) {
  if (isContextualPlanDayFastPathRequest(params.request)) {
    return;
  }

  const followUpConfig = resolveBareStarterFollowUp(params.request);
  if (!followUpConfig) {
    return;
  }

  const keepModelClarification = params.result.mode === "clarify" &&
    params.result.followUp &&
    params.result.reply.includes("?");
  if (keepModelClarification && !hasActionArtifacts(params.result)) {
    return;
  }

  const followUp = withPlanningLauncherFollowUpMetadata(
    params.result.followUp ?? followUpConfig.followUp,
    followUpConfig.starterIntent,
  );

  params.result.reply = keepModelClarification
    ? params.result.reply
    : followUpConfig.reply;
  params.result.mode = "clarify";
  params.result.intent = followUpConfig.intent;
  params.result.confidence = Math.min(params.result.confidence, 0.8);
  params.result.understandingState = "needs_followup";
  params.result.followUp = followUp;
  params.result.structuredResponse = null;
  params.result.preparedActionId = null;
}

function buildBareStarterAgentResult(params: {
  request: CompanionAgentRequest;
  context: LoadedCompanionAgentContext;
}): AgentRunResult | null {
  const followUpConfig = resolveBareStarterFollowUp(params.request);
  if (!followUpConfig) return null;

  return {
    result: {
      reply: followUpConfig.reply,
      mode: "clarify",
      intent: followUpConfig.intent,
      confidence: 0.8,
      understandingState: "needs_followup",
      followUp: withPlanningLauncherFollowUpMetadata(
        followUpConfig.followUp,
        followUpConfig.starterIntent,
      ),
      assumptions: [],
      evidenceIds: [],
      structuredResponse: null,
      preparedActionId: null,
    },
    openaiConversationId: params.context.thread?.openai_conversation_id ?? null,
    lastOpenAIResponseId: params.context.thread?.last_openai_response_id ??
      null,
  };
}

function buildActiveFollowUpClarifyAgentResult(params: {
  followUp: CompanionAgentFollowUp;
  reply?: string | null;
  intent: CompanionAgentIntent;
  confidence: number;
  context: LoadedCompanionAgentContext;
  openaiConversationId?: string | null;
  lastOpenAIResponseId?: string | null;
}): AgentRunResult {
  const usableReply = params.reply?.trim();
  const reply = usableReply && !isThinGenericAgentReply(usableReply)
    ? usableReply
    : `I need your answer to the follow-up before I can act: ${params.followUp.question}`;

  return {
    result: {
      reply,
      mode: "clarify",
      intent: params.intent,
      confidence: Math.min(params.confidence, 0.6),
      understandingState: "needs_followup",
      followUp: params.followUp,
      assumptions: [],
      evidenceIds: [],
      structuredResponse: null,
      preparedActionId: null,
    },
    openaiConversationId: params.openaiConversationId ??
      params.context.thread?.openai_conversation_id ?? null,
    lastOpenAIResponseId: params.lastOpenAIResponseId ??
      params.context.thread?.last_openai_response_id ?? null,
  };
}

const buildAgentDecisionMetadata = (
  result: AgentRunResult["result"],
  providerDiagnostics?: OpenAIProviderDiagnostics | null,
) => ({
  understandingState: result.understandingState,
  followUp: result.followUp,
  assumptions: result.assumptions,
  evidenceIds: result.evidenceIds,
  ...(providerDiagnostics ? { providerDiagnostics } : {}),
});

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asEmbeddedRecord = (value: unknown): Record<string, unknown> | null => {
  if (Array.isArray(value)) return asRecord(value[0]);
  return asRecord(value);
};

const normalizeCampaignRitualLinks = (
  rows: Array<Record<string, unknown>>,
  activeCampaignById: Map<string, Record<string, unknown>>,
) => {
  const seenHabitIds = new Set<string>();
  const rituals: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const campaignId = typeof row.epic_id === "string" ? row.epic_id : null;
    const campaign = campaignId ? activeCampaignById.get(campaignId) : null;
    const habit = asEmbeddedRecord(row.habits);
    const habitId = typeof habit?.id === "string"
      ? habit.id
      : typeof row.habit_id === "string"
      ? row.habit_id
      : null;

    if (!campaignId || !campaign || !habit || !habitId) continue;
    if (habit.is_active === false || seenHabitIds.has(habitId)) continue;

    rituals.push({
      ...habit,
      id: habitId,
      epic_id: campaignId,
      epic_title: typeof campaign.title === "string"
        ? campaign.title
        : "your campaign",
    });
    seenHabitIds.add(habitId);
  }

  return rituals;
};

const toDateOnly = (value: string) => value.slice(0, 10);

const addDays = (dateOnly: string, days: number) => {
  const next = new Date(`${dateOnly}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

const getDateTimeOffset = (value: string): string => {
  const match = value.match(/([+-]\d{2}:\d{2}|Z)$/);
  return match?.[1] ?? "Z";
};

const buildOffsetDateTime = (
  dateKey: string,
  clockTime: string,
  offset: string,
): string => `${dateKey}T${clockTime}:00${offset}`;

const buildDateRange = (request: CompanionAgentRequest) => {
  const baseDate = request.selectedDate ?? toDateOnly(request.currentDateTime);
  const start = request.visibleDateStart ?? baseDate;
  const end = request.visibleDateEnd ??
    addDays(start, (request.horizonDays ?? 7) - 1);
  return {
    start,
    end,
    timezone: getDateTimeOffset(request.currentDateTime),
  };
};

const maybeSingle = async <T>(
  promise: Promise<{ data: T | null; error: any }>,
) => {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
};

const formatDateTimeLabel = (
  date: string | null | undefined,
  time: string | null | undefined,
) => {
  if (!date && !time) return "unscheduled";
  if (date && time) return `${date} at ${time}`;
  return date ?? time ?? "unscheduled";
};

const createPreparedAction = (
  input: Omit<PendingActionCandidate, "id">,
): PendingActionCandidate => ({
  id: crypto.randomUUID(),
  ...input,
});

const isSchemaCompatibilityError = (error: unknown): boolean => {
  const source = typeof error === "object" && error
    ? JSON.stringify(error).toLowerCase()
    : String(error).toLowerCase();

  return source.includes("does not exist") ||
    source.includes("undefined_table") ||
    source.includes("undefined_column") ||
    source.includes("schema cache") ||
    source.includes("relation") ||
    source.includes("column");
};

const normalizeCompanionRow = (
  row: Record<string, unknown> | null,
): UserCompanionRow | null => {
  if (!row || typeof row.id !== "string" || row.id.length === 0) return null;

  return {
    id: row.id,
    companion_name: typeof row.companion_name === "string"
      ? row.companion_name
      : null,
    cached_creature_name: typeof row.cached_creature_name === "string"
      ? row.cached_creature_name
      : null,
    preset_id: typeof row.preset_id === "string" ? row.preset_id : null,
    spirit_animal: typeof row.spirit_animal === "string"
      ? row.spirit_animal
      : null,
    core_element: typeof row.core_element === "string"
      ? row.core_element
      : null,
    current_stage: typeof row.current_stage === "number"
      ? row.current_stage
      : null,
    current_mood: typeof row.current_mood === "string"
      ? row.current_mood
      : null,
  };
};

async function loadCompanionId(
  supabase: any,
  userId: string,
  requestId?: string | null,
) {
  const loadWithSelect = async (selectColumns: string) =>
    maybeSingle<Record<string, unknown>>(
      supabase
        .from("user_companion")
        .select(selectColumns)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );

  const companionSelects = [
    {
      source: "user_companion.identity_extended",
      columns:
        "id, companion_name, cached_creature_name, preset_id, spirit_animal, core_element, current_stage, current_mood",
    },
    {
      source: "user_companion.identity_without_cached_name",
      columns:
        "id, companion_name, preset_id, spirit_animal, core_element, current_stage, current_mood",
    },
    {
      source: "user_companion.identity_minimal",
      columns: "id, companion_name, preset_id, spirit_animal, core_element",
    },
    {
      source: "user_companion.identity_id_only",
      columns: "id",
    },
  ];

  let companion: UserCompanionRow | null = null;
  let lastSchemaError: unknown = null;

  for (const [index, select] of companionSelects.entries()) {
    try {
      companion = normalizeCompanionRow(await loadWithSelect(select.columns));
      break;
    } catch (error) {
      if (!isSchemaCompatibilityError(error)) throw error;
      lastSchemaError = error;
      logCompanionAgentBestEffortFailure({
        requestId,
        subStage: "context_load",
        source: select.source,
        required: index === companionSelects.length - 1,
        error,
      });
    }
  }

  if (!companion && lastSchemaError) {
    throw lastSchemaError;
  }

  if (!companion?.id) {
    throw new Error("Companion not found");
  }

  return companion;
}

async function loadUserAIPreferences(supabase: any, userId: string) {
  const preferredSelect =
    "response_style, tone_preference, detail_level, prefers_direct_answers, companion_mode, companion_mode_adaptation_enabled";
  const fallbackSelect =
    "response_style, tone_preference, detail_level, prefers_direct_answers";

  const { data, error } = await supabase
    .from("user_ai_preferences")
    .select(preferredSelect)
    .eq("user_id", userId)
    .maybeSingle();

  if (!error) return data;

  const source = typeof error === "object" && error
    ? JSON.stringify(error).toLowerCase()
    : String(error).toLowerCase();

  if (
    !source.includes("companion_mode") &&
    !source.includes("companion_mode_adaptation_enabled")
  ) {
    throw error;
  }

  const fallback = await maybeSingle<Record<string, unknown>>(
    supabase
      .from("user_ai_preferences")
      .select(fallbackSelect)
      .eq("user_id", userId)
      .maybeSingle(),
  );

  return fallback;
}

export async function loadCompanionAgentContext(params: {
  supabase: any;
  actorSupabase?: any;
  userId: string;
  companionId: string;
  sessionId: string;
  request: CompanionAgentRequest;
  requestId?: string | null;
}) {
  const range = buildDateRange(params.request);
  const scheduleReadFastPath = isCompanionScheduleReadFastPathRequest(
    params.request,
  );
  const loadWarnings: CompanionAgentContextLoadWarning[] = [];
  const emptyRowsResult = () => ({ data: [], error: null });
  const emptySingleResult = () => ({ data: null, error: null });
  const queryBestEffort = (
    source: string,
    required: boolean,
    fallback: { data: unknown; error: null },
    query: PromiseLike<{ data?: unknown; error?: unknown }>,
  ) =>
    loadCompanionContextBestEffort({
      requestId: params.requestId,
      source,
      required,
      fallback,
      warnings: loadWarnings,
      load: async () => {
        const result = await query;
        if (result.error) throw result.error;
        return { ...result, error: null };
      },
    });

  let thread: any;
  let messages: any;
  let activePendingAction: any;
  let datedTasksResult: any;
  let inboxTasksResult: any;
  let recentCompletedTasksResult: any;
  let ritualsResult: any;
  let campaignsResult: any;
  let aiLearning: any;
  let plannerPreferences: any;
  let profileResult: any;
  let aiPreferences: any;
  let companionMemories: any;
  let reflections: any;
  let dailyCheckIns: any;
  let calendarConnectionsResult: any;

  [
    thread,
    messages,
    activePendingAction,
    datedTasksResult,
    inboxTasksResult,
    recentCompletedTasksResult,
    ritualsResult,
    campaignsResult,
    aiLearning,
    plannerPreferences,
    profileResult,
    aiPreferences,
    companionMemories,
    reflections,
    dailyCheckIns,
    calendarConnectionsResult,
  ] = await Promise.all([
    loadCompanionContextBestEffort({
      requestId: params.requestId,
      source: "companion_chat_threads",
      required: false,
      fallback: null,
      warnings: loadWarnings,
      load: () => loadThread(params.supabase, params.userId, params.sessionId),
    }),
    loadCompanionContextBestEffort({
      requestId: params.requestId,
      source: "companion_chats",
      required: false,
      fallback: [],
      warnings: loadWarnings,
      load: () =>
        loadRecentMessages(
          params.supabase,
          params.userId,
          params.sessionId,
          20,
        ),
    }),
    loadCompanionContextBestEffort({
      requestId: params.requestId,
      source: "companion_pending_actions",
      required: false,
      fallback: null,
      warnings: loadWarnings,
      load: () =>
        loadActivePendingAction(
          params.supabase,
          params.userId,
          params.sessionId,
        ),
    }),
    queryBestEffort(
      "daily_tasks.dated",
      true,
      emptyRowsResult(),
      params.supabase
        .from("daily_tasks")
        .select(
          "id, task_text, task_date, category, scheduled_time, estimated_duration, actual_time_spent, completed, completed_at, epic_id, habit_source_id, priority, location, notes, reminder_enabled, reminder_minutes_before, recurrence_pattern, recurrence_end_date",
        )
        .eq("user_id", params.userId)
        .gte("task_date", range.start)
        .lte("task_date", range.end)
        .order("task_date", { ascending: true })
        .order("scheduled_time", { ascending: true, nullsFirst: false })
        .limit(MAX_TASKS),
    ),
    queryBestEffort(
      "daily_tasks.inbox",
      true,
      emptyRowsResult(),
      params.supabase
        .from("daily_tasks")
        .select(
          "id, task_text, task_date, category, scheduled_time, estimated_duration, actual_time_spent, completed, completed_at, epic_id, habit_source_id, priority, location, notes, reminder_enabled, reminder_minutes_before, recurrence_pattern, recurrence_end_date",
        )
        .eq("user_id", params.userId)
        .is("task_date", null)
        .order("created_at", { ascending: false })
        .limit(MAX_INBOX_TASKS),
    ),
    queryBestEffort(
      "daily_tasks.recent_completed",
      false,
      emptyRowsResult(),
      params.supabase
        .from("daily_tasks")
        .select(
          "id, task_text, task_date, category, scheduled_time, estimated_duration, actual_time_spent, completed, completed_at, epic_id, habit_source_id, priority, location, notes, reminder_enabled, reminder_minutes_before, recurrence_pattern, recurrence_end_date",
        )
        .eq("user_id", params.userId)
        .eq("completed", true)
        .not("completed_at", "is", null)
        .gte(
          "completed_at",
          `${
            addDays(toDateOnly(params.request.currentDateTime), -13)
          }T00:00:00.000Z`,
        )
        .lte(
          "completed_at",
          `${toDateOnly(params.request.currentDateTime)}T23:59:59.999Z`,
        )
        .order("completed_at", { ascending: false })
        .limit(MAX_RECENT_COMPLETED_TASKS),
    ),
    queryBestEffort(
      "habits",
      true,
      emptyRowsResult(),
      params.supabase
        .from("habits")
        .select(
          "id, title, frequency, preferred_time, estimated_minutes, description, category, current_streak, longest_streak, reminder_enabled, reminder_minutes_before, custom_days, custom_month_days, is_active",
        )
        .eq("user_id", params.userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(MAX_RITUALS),
    ),
    queryBestEffort(
      "epics",
      true,
      emptyRowsResult(),
      params.supabase
        .from("epics")
        .select(
          "id, title, description, start_date, end_date, status, target_days, progress_percentage",
        )
        .eq("user_id", params.userId)
        .eq("status", "active")
        .is("completed_at", null)
        .order("updated_at", { ascending: false })
        .limit(MAX_CAMPAIGNS),
    ),
    queryBestEffort(
      "user_ai_learning",
      false,
      emptySingleResult(),
      params.supabase
        .from("user_ai_learning")
        .select(
          "conversation_profile, common_contexts, peak_productivity_times, preferred_epic_duration, preferred_habit_frequency, preferred_habit_difficulty, successful_patterns",
        )
        .eq("user_id", params.userId)
        .maybeSingle(),
    ),
    queryBestEffort(
      "daily_planning_preferences",
      false,
      emptySingleResult(),
      params.supabase
        .from("daily_planning_preferences")
        .select("preferred_work_blocks, wake_time, wind_down_time")
        .eq("user_id", params.userId)
        .maybeSingle(),
    ),
    queryBestEffort(
      "profiles",
      false,
      emptySingleResult(),
      params.supabase
        .from("profiles")
        .select(
          "onboarding_data, current_habit_streak, longest_habit_streak, streak_at_risk, streak_at_risk_since, streak_freezes_available",
        )
        .eq("id", params.userId)
        .maybeSingle(),
    ),
    loadCompanionContextBestEffort({
      requestId: params.requestId,
      source: "user_ai_preferences",
      required: false,
      fallback: null,
      warnings: loadWarnings,
      load: () => loadUserAIPreferences(params.supabase, params.userId),
    }),
    queryBestEffort(
      "companion_memories",
      false,
      emptyRowsResult(),
      params.supabase
        .from("companion_memories")
        .select(
          "id, memory_type, memory_date, memory_context, created_at, last_referenced_at",
        )
        .eq("user_id", params.userId)
        .eq("companion_id", params.companionId)
        .order("last_referenced_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(MAX_REFLECTIONS),
    ),
    queryBestEffort(
      "user_reflections",
      false,
      emptyRowsResult(),
      params.supabase
        .from("user_reflections")
        .select("id, mood, note, reflection_date, created_at")
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(MAX_REFLECTIONS),
    ),
    queryBestEffort(
      "daily_check_ins",
      false,
      emptyRowsResult(),
      params.supabase
        .from("daily_check_ins")
        .select(
          "id, check_in_type, mood, reflection, intention, completed_at, created_at",
        )
        .eq("user_id", params.userId)
        .order("created_at", { ascending: false })
        .limit(MAX_REFLECTIONS),
    ),
    queryBestEffort(
      "user_calendar_connections",
      false,
      emptyRowsResult(),
      params.supabase
        .from("user_calendar_connections")
        .select(
          "id, provider, primary_calendar_id, primary_calendar_name, sync_enabled",
        )
        .eq("user_id", params.userId)
        .eq("sync_enabled", true),
    ),
  ]);

  const requiredContextWarnings = loadWarnings.filter((warning) =>
    warning.required
  );
  if (!scheduleReadFastPath && requiredContextWarnings.length > 0) {
    throw new Error(
      `Required companion planner context unavailable: ${
        requiredContextWarnings.map((warning) => warning.source).join(", ")
      }`,
    );
  }

  const datedTasks = (datedTasksResult.data ?? []) as Array<
    Record<string, unknown>
  >;
  const inboxTasks = (inboxTasksResult.data ?? []) as Array<
    Record<string, unknown>
  >;
  const recentCompletedTaskRows =
    (recentCompletedTasksResult.data ?? []) as Array<
      Record<string, unknown>
    >;
  const recentCompletedTasks = await loadCompanionContextBestEffort({
    requestId: params.requestId,
    source: "focus_sessions.recent_completed_duration",
    required: false,
    fallback: recentCompletedTaskRows.map((task) => ({
      ...task,
      actual_duration_minutes: null,
    })),
    warnings: loadWarnings,
    load: () =>
      attachActualDurationMinutes(
        params.supabase,
        params.userId,
        recentCompletedTaskRows,
      ),
  });
  const tasks = [...datedTasks, ...inboxTasks];
  const campaigns = (campaignsResult.data ?? []) as Array<
    Record<string, unknown>
  >;
  const activeCampaignById = new Map(
    campaigns
      .filter((campaign) => typeof campaign.id === "string")
      .map((campaign) => [String(campaign.id), campaign]),
  );
  const activeCampaignIds = [...activeCampaignById.keys()];
  const campaignRitualLinks = activeCampaignIds.length > 0
    ? await loadCompanionContextBestEffort({
      requestId: params.requestId,
      source: "epic_habits.campaign_rituals",
      required: false,
      fallback: { data: [], error: null },
      warnings: loadWarnings,
      load: async () => {
        const result = await params.supabase
          .from("epic_habits")
          .select(
            "epic_id, habit_id, habits(id, title, frequency, preferred_time, estimated_minutes, description, category, current_streak, longest_streak, reminder_enabled, reminder_minutes_before, custom_days, custom_month_days, is_active)",
          )
          .in("epic_id", activeCampaignIds)
          .limit(MAX_RITUALS);
        if (result.error) throw result.error;
        return { ...result, error: null };
      },
    })
    : { data: [], error: null };
  const campaignRitualRows = normalizeCampaignRitualLinks(
    (campaignRitualLinks.data ?? []) as Array<Record<string, unknown>>,
    activeCampaignById,
  );
  const campaignRitualIdSet = new Set(
    campaignRitualRows.map((ritual) => String(ritual.id)),
  );
  const standaloneRitualRows = ((ritualsResult.data ?? []) as Array<
    Record<string, unknown>
  >)
    .filter((ritual) => !campaignRitualIdSet.has(String(ritual.id ?? "")))
    .map((ritual) => ({
      ...ritual,
      epic_id: "general",
      epic_title: "your goals",
    }));
  const ritualRows = [...campaignRitualRows, ...standaloneRitualRows];
  const ritualDurationStart = `${
    addDays(toDateOnly(params.request.currentDateTime), -59)
  }T00:00:00.000Z`;
  const rituals = await loadCompanionContextBestEffort({
    requestId: params.requestId,
    source: "focus_sessions.ritual_duration",
    required: false,
    fallback: ritualRows.map((ritual) => ({
      ...ritual,
      actual_duration_minutes: null,
    })),
    warnings: loadWarnings,
    load: () =>
      attachRitualActualDurationMinutes(
        params.supabase,
        params.userId,
        ritualRows,
        ritualDurationStart,
      ),
  });
  const calendarConnections = ((calendarConnectionsResult.data ?? []) as Array<
    Record<string, unknown>
  >).filter((connection) =>
    connection.provider === "google" || connection.provider === "outlook"
  );
  const shouldLoadExternalCalendar = Boolean(params.actorSupabase) &&
    (Boolean(
      params.request.starterIntent &&
        !["free_talk_start", "general"].includes(params.request.starterIntent),
    ) ||
      /\b(?:plan|day|week|calendar|schedule|meeting|appointment|today|tomorrow|time|room)\b/i
        .test(params.request.message));
  const calendarEvents: Array<Record<string, unknown>> = [];

  if (shouldLoadExternalCalendar && calendarConnections.length > 0) {
    const startDateTime = buildOffsetDateTime(
      range.start,
      "00:00",
      range.timezone,
    );
    const endDateTime = buildOffsetDateTime(
      addDays(range.end, 1),
      "00:00",
      range.timezone,
    );
    const reads = await Promise.allSettled(
      calendarConnections.map(async (connection) => {
        const provider = String(connection.provider);
        const { data, error } = await params.actorSupabase.functions.invoke(
          `${provider}-calendar-events`,
          {
            body: {
              action: "listRangeEvents",
              startDateTime,
              endDateTime,
              ...(typeof connection.primary_calendar_id === "string"
                ? { calendarId: connection.primary_calendar_id }
                : {}),
            },
          },
        );
        if (error) throw error;
        return Array.isArray(data?.events)
          ? data.events as Array<Record<string, unknown>>
          : [];
      }),
    );

    for (let index = 0; index < reads.length; index += 1) {
      const read = reads[index];
      if (read.status === "fulfilled") {
        calendarEvents.push(...read.value);
        continue;
      }
      const provider = String(
        calendarConnections[index]?.provider ?? "calendar",
      );
      loadWarnings.push(
        buildContextLoadWarning(
          `${provider}_calendar_events`,
          false,
          read.reason,
        ),
      );
    }
  }

  const reminders = [
    ...tasks
      .filter((task) => task.reminder_enabled === true)
      .map((task) => ({
        type: "task",
        id: task.id,
        title: task.task_text,
        task_date: task.task_date,
        scheduled_time: task.scheduled_time,
        reminder_minutes_before: task.reminder_minutes_before,
      })),
    ...rituals
      .filter((ritual) => ritual.reminder_enabled === true)
      .map((ritual) => ({
        type: "ritual",
        id: ritual.id,
        title: ritual.title,
        preferred_time: ritual.preferred_time,
        reminder_minutes_before: ritual.reminder_minutes_before,
      })),
  ];

  const learningRecord = asRecord(aiLearning.data);
  const profile = asRecord(learningRecord?.conversation_profile);
  const profileGoals = Array.isArray(profile?.goals)
    ? profile?.goals.filter((entry): entry is string =>
      typeof entry === "string"
    )
    : [];
  const campaignGoals = campaigns
    .map((campaign) => campaign.title)
    .filter((entry): entry is string => typeof entry === "string");

  const profileRecord = asRecord(profileResult.data);

  const recentMemory = {
    ai_learning: learningRecord,
    ai_learning_peak_productivity_times: learningRecord
      ?.peak_productivity_times,
    ai_preferences: asRecord(aiPreferences),
    planner_preferences: asRecord(plannerPreferences.data),
    profile: profileRecord,
    profile_onboarding: asRecord(profileRecord?.onboarding_data),
    callback_memories: (companionMemories.data ?? []) as Array<
      Record<string, unknown>
    >,
  };

  const preferenceRecord = asRecord(aiPreferences);
  const rawCompanionMode = typeof preferenceRecord?.companion_mode === "string"
    ? preferenceRecord.companion_mode
    : null;
  const companionMode = isCompanionModeId(rawCompanionMode)
    ? rawCompanionMode as LoadedCompanionAgentContext["companionMode"]
    : "alpha";
  const companionModeAdaptationEnabled =
    preferenceRecord?.companion_mode_adaptation_enabled !== false;

  const reflectionRows = [
    ...((reflections.data ?? []) as Array<Record<string, unknown>>),
    ...((dailyCheckIns.data ?? []) as Array<Record<string, unknown>>),
  ]
    .sort((left, right) =>
      String(right.created_at ?? "").localeCompare(
        String(left.created_at ?? ""),
      )
    )
    .slice(0, MAX_REFLECTIONS);

  const context: LoadedCompanionAgentContext = {
    thread,
    messages,
    tasks,
    recentCompletedTasks,
    rituals,
    campaigns,
    calendarEvents,
    calendarConnections,
    reminders,
    goals: [...new Set([...campaignGoals, ...profileGoals])].slice(0, 12),
    recentMemory,
    reflections: reflectionRows,
    activePendingAction,
    companionMode,
    companionModeAdaptationEnabled,
    visibleDateStart: range.start,
    visibleDateEnd: range.end,
    currentDateTime: params.request.currentDateTime,
    timezone: range.timezone,
    ...(loadWarnings.length > 0 ? { loadWarnings } : {}),
  };

  return context;
}

export function resolveCompanionAgentDisplayName(
  companion: UserCompanionRow,
): string {
  const customName = normalizeCompanionName(companion.companion_name);
  if (customName) return customName;

  const companionIdentity = {
    spiritAnimal: companion.spirit_animal,
    presetId: companion.preset_id,
  };
  const cachedName = normalizeCompanionName(companion.cached_creature_name);
  if (cachedName && isAssignedCompanionName(cachedName, companionIdentity)) {
    return cachedName;
  }

  return normalizeCompanionName(
    synthesizeAssignedCompanionName(
      `${companion.id}:${companion.current_stage ?? 0}`,
      companion.core_element,
      companionIdentity,
    ),
  ) ?? "Cosmiq";
}

function buildInstructions(params: {
  surface: "companion" | "journeys";
  currentDateTime: string;
  companion: UserCompanionRow;
  context: LoadedCompanionAgentContext;
  request: CompanionAgentRequest;
}) {
  const companionName = resolveCompanionAgentDisplayName(params.companion);
  const currentMood = params.companion.current_mood?.trim() || "steady";
  const modeConfig = getCompanionModeConfig(params.context.companionMode);
  const journeysReadOnlyTurn = isJourneysReadOnlyTurn(params.request);
  const companionChatOnlyTurn = params.surface === "companion" &&
    !isExplicitCompanionWriteRequest(params.request);
  const writePolicyInstructions = journeysReadOnlyTurn
    ? [
      "For this Journeys turn, you are the user-facing chat only. Do not call prepare tools and do not return pending_confirmation for new actions or campaigns.",
      "If the user mentions a concrete quest, plan change, journal item, reminder, ritual, or broad campaign goal, answer naturally in chat without creating or suggesting app action cards.",
      "Do not ask structured draft-consent follow-ups like 'Should I draft this?' or 'Would you like to start a campaign?'",
      "If a normal conversational question would help, ask it in your reply text with mode conversation and understanding_state enough_to_discuss.",
      "Never say you drafted, prepared, saved, queued, or opened something from this turn.",
    ]
    : companionChatOnlyTurn
    ? [
      "This Companion tab turn has no explicit write request. Reply as direct natural chat only.",
      "Do not call prepare tools, do not return pending_confirmation or ready_to_draft, and do not return structured planner proposals.",
      "Do not ask structured draft-consent follow-ups like 'Should I draft this?' or 'Would you like me to turn this into a quest?'",
      "Words like future, thinking, vibing, goal, or plan are conversational unless the user explicitly asks you to create, add, draft, schedule, move, reschedule, shift, push, pull, adjust, edit, rename, book, fit, squeeze, lock in, update, cancel, delete, save, remind, log, or turn something into a quest.",
      "Never say you drafted, prepared, saved, queued, opened, created, added, or scheduled something from this turn.",
    ]
    : [
      "You must never execute writes. You may only use read tools and prepare tools.",
      "If a write is appropriate and you understand enough, prepare exactly one normalized pending action and then call submit_companion_result with mode pending_confirmation and understanding_state ready_to_draft.",
      "If detail is missing for a useful or safe write, ask one concise clarifying question with mode clarify and understanding_state needs_followup.",
      "Do not say you prepared, saved, queued, or changed something unless you actually used a prepare tool and returned pending_confirmation.",
    ];

  return [
    `You are ${companionName}, Cosmiq's conversational companion.`,
    "Product model: the user is talking directly to ChatGPT, with Cosmiq app powers.",
    "You are the decision layer. The app supplies context, validates actions, and executes only after allowed confirmation.",
    "Interpret intent before acting. Short launcher prompts are complete intent signals, not incomplete forms.",
    "Prompts like 'Plan my day', 'Adjust my day', 'What should I do right now?', 'Make room', 'What matters?', 'Prepare me for tomorrow', and 'Advance my campaign' give you permission to reason from app context.",
    "A planning or goal launcher is permission to reason from the supplied app and calendar context and prepare one useful confirmation draft. Do not make the user fill out a wizard.",
    "For Plan my day, build a realistic plan directly from existing tasks, rituals, campaigns, preferences, and busy calendar events. Ask at most one follow-up only when a missing fact would materially change or make the plan unsafe.",
    "Turn origin matters: launcher means an app template started the turn, composer means the user freely typed or dictated into chat, and follow_up_option means the user clicked a follow-up chip.",
    "For composer turns, treat activeFollowUp as context only. The user may answer it, refine it, ignore it, ask something else, or pivot naturally like ChatGPT; do not force them back into the template form.",
    "Only treat latestUserMessageAnswersFollowUp as true when the context packet says it is true.",
    ...(journeysReadOnlyTurn
      ? [
        "For Journeys planning launchers, keep the visible experience conversational and read-only. Do not create structured draft-consent follow-ups or pending drafts.",
        "If the user names a concrete task, plan change, or campaign goal, respond to it in chat without creating quest or campaign suggestion cards.",
      ]
      : companionChatOnlyTurn
      ? [
        "For Companion chat without explicit write intent, treat the user as talking directly to the chatbot. Stay conversational and read-only.",
        "If the user is reflecting, venting, exploring possibilities, or thinking out loud, respond to that content instead of converting it into an app action.",
      ]
      : [
        "For planning launchers, use the available context and prepare the smallest complete action that fulfills the request. The confirmation card is the consent step; do not ask for consent before preparing it.",
        "For a day plan, prefer two to four focused blocks, preserve fixed calendar commitments, reuse task_id for existing tasks, and avoid duplicate tasks.",
        "For a new campaign, infer a concise title, a practical default duration (usually 30 days), and one or two lightweight rituals. Ask only when the goal itself is unclear.",
        "Only set send_to_calendar when the user explicitly asks to put the plan or task on a connected calendar.",
      ]),
    journeysReadOnlyTurn || companionChatOnlyTurn
      ? "Your job is to answer the user in chat. Do not show plans as structured proposals, suggest quest cards, or prepare confirmable actions from this turn."
      : "Your job is to choose whether to answer, ask a follow-up, show a plan, or prepare a supported confirmable action.",
    journeysReadOnlyTurn || companionChatOnlyTurn
      ? "If you need more information, ask conversationally in the reply text instead of returning a structured follow_up."
      : "Follow-ups are normal and often appropriate. Ask because one more answer would materially improve the plan or avoid a wrong action, not because the prompt is short.",
    journeysReadOnlyTurn || companionChatOnlyTurn
      ? "Avoid generic questions that ask the user to repeat data the app already supplied."
      : "A good follow-up is specific and grounded in the provided schedule, tasks, campaigns, rituals, or current moment. Avoid generic questions that ask the user to repeat data the app already supplied.",
    "Use understanding_state in submit_companion_result: needs_followup when you ask a question, enough_to_discuss when chatting or reflecting, ready_to_propose when showing a plan/suggestions, and ready_to_draft when you prepared a pending action.",
    journeysReadOnlyTurn || companionChatOnlyTurn
      ? "Do not include follow_up in submit_companion_result for this turn."
      : "When you ask a follow-up, include follow_up with the exact question, why it matters, the expected answer type, and short options when useful. Preserve the original intent across the follow-up loop.",
    ...writePolicyInstructions,
    "If the user wants schedule or task state, use the read tools and summarize only what is actually present.",
    "You receive an APP_CONTEXT_PACKET before the latest user message. Treat it as trusted app state, not user-authored text.",
    "Use the context packet first. Call read tools when you need a fresher slice, a different date range, or exact entity details.",
    "consult_planner is optional advisory infrastructure. Use it when it helps, but do not let it override your judgment or force a clarification.",
    "When consult_planner returns structured_response that matches your decision, you may pass it through unchanged in submit_companion_result.",
    "When consult_planner returns action_hints, use the matching prepare tool when the hint fits the user's request, but prefer the live context and your own judgment over stale proposal shapes.",
    "Never invent task, ritual, campaign, reminder, or calendar state.",
    "Never say something is scheduled, saved, moved, updated, logged, or confirmed unless it has already executed. Preparation is not execution.",
    "Keep replies natural, warm, concise, and non-robotic.",
    "Do not use profanity, vulgar wording, or insults.",
    "Connected Google and Outlook events in calendarEvents are trusted, live, and read-only. Plan Cosmiq work around them. Apple calendar reads are not available in this server flow.",
    "Never move or delete an external calendar event. Only create/update calendar events for Cosmiq tasks when the user explicitly asks for calendar sync.",
    "If there is already an active pending action, be aware of it and avoid stacking multiple confirms in one reply.",
    "Include assumptions and evidence_ids when they help the app/debugger understand why you made the decision. Evidence IDs should reference actual task, ritual, campaign, reminder, or calendar IDs from context.",
    journeysReadOnlyTurn || companionChatOnlyTurn
      ? "Do not create action cards from a purely conversational turn."
      : "If you are ready to prepare a supported app action, use a prepare tool; otherwise answer or ask one grounded follow-up.",
    "Always finish by calling submit_companion_result. Do not end with a plain assistant message.",
    `Surface: ${params.surface}.`,
    `Current local datetime from the app: ${params.currentDateTime}.`,
    `Current visible planning range: ${params.context.visibleDateStart} through ${params.context.visibleDateEnd}.`,
    params.request.starterIntent
      ? `Launcher starter intent: ${
        params.request.starterIntent.replaceAll("_", " ")
      }.`
      : null,
    params.request.turnOrigin
      ? `Latest turn origin: ${params.request.turnOrigin.replaceAll("_", " ")}.`
      : null,
    `Companion state: mood ${currentMood}, stage ${
      params.companion.current_stage ?? 0
    }, spirit animal ${params.companion.spirit_animal ?? "unknown"}.`,
    `Selected companion mode: ${modeConfig.label}.`,
    `Mode guidance: ${modeConfig.description}`,
    params.context.companionModeAdaptationEnabled
      ? "Adaptive behavior is enabled, but keep the same named mode identity. Adjust intensity and warmth inside the chosen mode without switching personas."
      : "Adaptive behavior is disabled. Stay consistent with the chosen mode and do not drift into a different persona.",
    params.surface === "journeys"
      ? "Journeys tone should stay especially plainspoken and grounded."
      : "Companion tone can be slightly more intimate, but still concise and useful.",
  ].join("\n");
}

function isJourneysReadOnlyTurn(request: CompanionAgentRequest) {
  return request.surface === "journeys" &&
    !isExplicitCompanionWriteRequest(request);
}

function getDiscussionModeForIntent(
  intent: CompanionAgentIntent,
): CompanionAgentMode {
  switch (intent) {
    case "plan_day":
    case "plan_week":
    case "check_calendar":
    case "update_existing_plan":
    case "schedule_task":
      return "schedule_read";
    default:
      return "conversation";
  }
}

function normalizeUnpersistedActionResult(result: AgentRunResult["result"]) {
  const mode = result.mode === "pending_confirmation"
    ? getDiscussionModeForIntent(result.intent)
    : result.mode;

  result.mode = mode;
  result.understandingState = deriveUnderstandingState({
    mode,
    followUp: result.followUp,
  });
  result.preparedActionId = null;
}

function normalizeJourneysReadOnlyResult(result: AgentRunResult["result"]) {
  const hasActionState = result.mode === "pending_confirmation" ||
    result.understandingState === "ready_to_draft" ||
    Boolean(result.followUp) ||
    Boolean(result.preparedActionId) ||
    Boolean(result.structuredResponse);
  const hasActionLanguage = looksLikeActionConfirmationReply(result.reply);

  if (!hasActionState && !hasActionLanguage) return;

  result.reply = hasActionLanguage
    ? COMPANION_CHAT_ONLY_FALLBACK_REPLY
    : result.reply;
  result.mode = "conversation";
  result.understandingState = "enough_to_discuss";
  result.followUp = null;
  result.structuredResponse = null;
  result.preparedActionId = null;
}

const COMPANION_CHAT_ONLY_FALLBACK_REPLY =
  "I'm here with you. We can think it through without turning it into a quest.";

const looksLikeActionConfirmationReply = (reply: string): boolean => {
  const normalized = normalizeBareStarterPrompt(reply);
  return /\b(?:i|i've|i have)\s+(?:drafted|prepared|queued|saved|opened|scheduled|created|added)\b/
    .test(normalized) ||
    /\b(?:i can|i could|would you like me to|want me to)\s+(?:draft|prepare|create|add|schedule|save|log)\b/
      .test(normalized) ||
    /\b(?:review it|confirm it|pending confirmation|quest draft|drafted this|prepared this)\b/
      .test(normalized);
};

function normalizeCompanionChatOnlyResult(result: AgentRunResult["result"]) {
  const hasStructuredOrActionState = result.mode === "pending_confirmation" ||
    result.understandingState === "ready_to_draft" ||
    (result.understandingState === "ready_to_propose" &&
      result.mode !== "schedule_read") ||
    Boolean(result.followUp) ||
    Boolean(result.preparedActionId) ||
    Boolean(result.structuredResponse);
  const hasActionLanguage = looksLikeActionConfirmationReply(result.reply);

  if (!hasStructuredOrActionState && !hasActionLanguage) return;

  result.reply = hasActionLanguage
    ? COMPANION_CHAT_ONLY_FALLBACK_REPLY
    : result.reply;
  result.mode = "conversation";
  if (
    result.intent === "schedule_task" ||
    result.intent === "plan_day" ||
    result.intent === "plan_week" ||
    result.intent === "update_existing_plan" ||
    result.intent === "goal_setting" ||
    result.intent === "journal"
  ) {
    result.intent = "unknown";
  }
  result.confidence = Math.min(result.confidence, 0.65);
  result.understandingState = "enough_to_discuss";
  result.followUp = null;
  result.structuredResponse = null;
  result.preparedActionId = null;
}

function buildAgentContextPacket(params: {
  context: LoadedCompanionAgentContext;
  request: CompanionAgentRequest;
}) {
  const latestAssistantDecision = [...params.context.messages]
    .reverse()
    .map((message) => asRecord(message.metadata)?.agentDecision)
    .map((decision) => asRecord(decision))
    .find((decision) => decision !== null) ?? null;
  const requestActiveFollowUp = asRecord(params.request.activeFollowUp);
  const persistedActiveFollowUp = asRecord(latestAssistantDecision?.followUp);
  const activeFollowUp = requestActiveFollowUp ?? persistedActiveFollowUp;
  const latestUserMessageAnswersFollowUp =
    params.request.turnOrigin === "follow_up_option" ||
    (params.request.turnOrigin === undefined && Boolean(activeFollowUp));

  return {
    packetType: "cosmiq_companion_context_v1",
    currentDateTime: params.context.currentDateTime,
    timezone: params.context.timezone,
    surface: params.request.surface,
    latestUserMessage: params.request.message,
    turnOrigin: params.request.turnOrigin ?? null,
    launcherStarterIntent: params.request.starterIntent ?? null,
    selectedEntityIds: params.request.selectedEntityIds ?? null,
    visibleDateRange: {
      start: params.context.visibleDateStart,
      end: params.context.visibleDateEnd,
    },
    activeFollowUp,
    latestUserMessageAnswersFollowUp,
    activePendingAction: params.context.activePendingAction,
    goals: params.context.goals,
    tasks: params.context.tasks,
    recentCompletedTasks: params.context.recentCompletedTasks,
    rituals: params.context.rituals,
    campaigns: params.context.campaigns,
    calendarEvents: params.context.calendarEvents,
    calendarConnections: params.context.calendarConnections ?? [],
    reminders: params.context.reminders,
    reflections: params.context.reflections,
    memory: params.context.recentMemory,
    availableCapabilities: [
      "read_current_datetime",
      "read_profile",
      "read_goals",
      "read_calendar_range",
      "read_tasks",
      "read_rituals",
      "read_campaigns",
      "read_reminders",
      "prepare_task_create",
      "prepare_task_update",
      "prepare_ritual_create",
      "prepare_reminder_create",
      "prepare_campaign_create",
      "prepare_campaign_update",
      "prepare_day_plan",
      "prepare_journal_entry",
    ],
    safety: {
      writesRequirePreparedAction: true,
      userConfirmationRequiredBeforeExecution: true,
      externalCalendarReadsEnabled: (params.context.calendarConnections ?? [])
        .length > 0,
      externalCalendarWritesRequireExplicitRequest: true,
    },
  };
}

function buildInitialInput(params: {
  context: LoadedCompanionAgentContext;
  request: CompanionAgentRequest;
  manualHistory: boolean;
}) {
  const contextPacket = {
    role: "user",
    content: `APP_CONTEXT_PACKET\n${
      JSON.stringify(buildAgentContextPacket(params))
    }`,
  };
  const latestHistory = params.context.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  if (!params.manualHistory) {
    return [
      contextPacket,
      { role: "user", content: params.request.message },
    ];
  }

  return [
    contextPacket,
    ...latestHistory,
    { role: "user", content: params.request.message },
  ];
}

async function createOpenAIConversation(params: {
  guardedFetch: GuardedFetch;
  userId: string;
  sessionId: string;
  surface: "companion" | "journeys";
  openAIApiKey?: string;
}) {
  const openAIApiKey = params.openAIApiKey ?? getOptionalEnv("OPENAI_API_KEY");
  if (!openAIApiKey) {
    throw buildOpenAIProviderError({
      operation: "api_key",
      message: "OPENAI_API_KEY not configured",
    });
  }

  let response: Response;
  try {
    response = await params.guardedFetch(OPENAI_CONVERSATIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        metadata: {
          scope: "cosmiq_companion_agent",
          user_id: params.userId,
          session_id: params.sessionId,
          surface: params.surface,
        },
      }),
    });
  } catch (error) {
    throw buildOpenAIProviderError({
      operation: "conversation",
      message: `OpenAI conversation create failed: ${getErrorMessage(error)}`,
    });
  }

  if (!response.ok) {
    throw buildOpenAIProviderError({
      operation: "conversation",
      message: `OpenAI conversation create failed: ${await response.text()}`,
      status: response.status,
      requestId: readOpenAIRequestId(response),
    });
  }

  const body = await response.json() as { id?: string };
  if (!body.id) {
    throw buildOpenAIProviderError({
      operation: "conversation",
      message: "OpenAI conversation id missing",
      requestId: readOpenAIRequestId(response),
    });
  }
  return body.id;
}

async function createOpenAIResponse(params: {
  guardedFetch: GuardedFetch;
  input: Array<Record<string, unknown>>;
  instructions: string;
  conversationId?: string | null;
  previousResponseId?: string | null;
  tools: Array<Record<string, unknown>>;
  openAIApiKey?: string;
}) {
  const openAIApiKey = params.openAIApiKey ?? getOptionalEnv("OPENAI_API_KEY");
  const model = resolveCompanionAgentModel();
  if (!openAIApiKey) {
    throw buildOpenAIProviderError({
      operation: "api_key",
      message: "OPENAI_API_KEY not configured",
      model,
    });
  }

  const body: Record<string, unknown> = {
    model,
    instructions: params.instructions,
    input: params.input,
    tools: params.tools,
    max_output_tokens: 1200,
    max_tool_calls: 20,
    parallel_tool_calls: true,
    store: true,
    ...buildResponsesReasoningConfig(model),
  };

  if (params.conversationId) {
    body.conversation = params.conversationId;
  } else if (params.previousResponseId) {
    body.previous_response_id = params.previousResponseId;
  }

  let response: Response;
  try {
    response = await params.guardedFetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw buildOpenAIProviderError({
      operation: "response",
      message: `OpenAI responses call failed: ${getErrorMessage(error)}`,
      model,
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw buildOpenAIProviderError({
      operation: "response",
      message: `OpenAI responses call failed: ${errorText}`,
      model,
      status: response.status,
      requestId: readOpenAIRequestId(response),
    });
  }

  return await response.json() as OpenAIResponseBody;
}

function getFunctionCalls(response: OpenAIResponseBody): ToolCall[] {
  return (response.output ?? [])
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .filter((item) => item.type === "function_call")
    .map((item) => ({
      call_id: String(item.call_id),
      name: String(item.name),
      arguments: typeof item.arguments === "string" ? item.arguments : "{}",
    }));
}

export function buildToolDefinitions() {
  const functionTool = (
    name: string,
    description: string,
    parameters: Record<string, unknown>,
  ) => ({
    type: "function",
    name,
    description,
    strict: false,
    parameters,
  });

  return [
    functionTool(
      "get_current_datetime",
      "Return the current local datetime, timezone offset, and visible date range.",
      {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    ),
    functionTool(
      "get_user_profile",
      "Return the user's current companion state and learned preference summary.",
      {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    ),
    functionTool(
      "get_user_goals",
      "Return current goals and active campaign titles.",
      {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    ),
    functionTool(
      "get_calendar_range",
      "Return scheduled Cosmiq tasks in the visible range or in a requested local date range.",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          start_date: { type: "string" },
          end_date: { type: "string" },
        },
      },
    ),
    functionTool(
      "get_today_calendar",
      "Return today's scheduled Cosmiq tasks.",
      {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    ),
    functionTool(
      "list_tasks",
      "Return tasks, including scheduled tasks and inbox tasks.",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          include_unscheduled: { type: "boolean" },
        },
      },
    ),
    functionTool(
      "list_rituals",
      "Return active rituals and habit-style routines.",
      {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    ),
    functionTool("list_campaigns", "Return active campaigns and goal tracks.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    functionTool(
      "list_reminders",
      "Return existing reminders on tasks or rituals.",
      {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    ),
    functionTool(
      "get_recent_conversation_context",
      "Return the most recent user and assistant turns from this thread.",
      {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    ),
    functionTool(
      "get_active_pending_action",
      "Return the currently active pending confirmation, if one exists.",
      {
        type: "object",
        additionalProperties: false,
        properties: {},
      },
    ),
    functionTool(
      "consult_planner",
      "Reuse the existing planner logic for schedule reads, day or week planning, prioritization, and goal breakdowns.",
      {
        type: "object",
        additionalProperties: false,
        properties: {
          horizon: {
            type: "string",
            enum: ["day", "week"],
          },
        },
      },
    ),
    functionTool(
      "prepare_task_create",
      "Prepare one new Cosmiq task. Infer sensible duration and energy defaults. A dated task must include a time. Set send_to_calendar only when the user explicitly requests calendar sync.",
      {
        type: "object",
        additionalProperties: false,
        required: ["title"],
        properties: {
          title: { type: "string" },
          task_date: { type: "string" },
          scheduled_time: { type: "string" },
          estimated_duration: { type: "number" },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
          energy_type: {
            type: "string",
            enum: [
              "deep",
              "admin",
              "physical",
              "errand",
              "social",
              "creative",
              "recovery",
            ],
          },
          notes: { type: "string" },
          category: {
            type: "string",
            enum: ["mind", "body", "soul"],
          },
          reminder_enabled: { type: "boolean" },
          reminder_minutes_before: { type: "number" },
          send_to_calendar: { type: "boolean" },
          calendar_provider: {
            type: "string",
            enum: ["google", "outlook", "all"],
          },
        },
      },
    ),
    functionTool(
      "prepare_task_update",
      "Prepare an update to an existing task or scheduled plan item.",
      {
        type: "object",
        additionalProperties: false,
        required: ["task_id"],
        properties: {
          task_id: { type: "string" },
          title: { type: "string" },
          task_date: { type: "string" },
          scheduled_time: { type: "string" },
          estimated_duration: { type: "number" },
          notes: { type: "string" },
          location: { type: "string" },
          priority: { type: "string" },
          completed: { type: "boolean" },
          reminder_enabled: { type: "boolean" },
          reminder_minutes_before: { type: "number" },
        },
      },
    ),
    functionTool(
      "prepare_ritual_create",
      "Prepare a new ritual or repeating habit.",
      {
        type: "object",
        additionalProperties: false,
        required: ["title", "frequency"],
        properties: {
          title: { type: "string" },
          frequency: { type: "string" },
          preferred_time: { type: "string" },
          estimated_minutes: { type: "number" },
          description: { type: "string" },
          category: {
            type: "string",
            enum: ["mind", "body", "soul"],
          },
          reminder_enabled: { type: "boolean" },
          reminder_minutes_before: { type: "number" },
        },
      },
    ),
    functionTool(
      "prepare_reminder_create",
      "Prepare a reminder on an existing task or ritual.",
      {
        type: "object",
        additionalProperties: false,
        required: ["target_type", "target_id"],
        properties: {
          target_type: { type: "string", enum: ["task", "ritual"] },
          target_id: { type: "string" },
          reminder_enabled: { type: "boolean" },
          reminder_minutes_before: { type: "number" },
        },
      },
    ),
    functionTool(
      "prepare_campaign_create",
      "Prepare a new campaign from a conversational goal. Infer a practical title, usually 30 days, and one or two small rituals so the user does not need a setup wizard.",
      {
        type: "object",
        additionalProperties: false,
        required: ["title", "rituals"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          start_date: { type: "string" },
          target_days: { type: "number" },
          rituals: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title"],
              properties: {
                title: { type: "string" },
                frequency: {
                  type: "string",
                  enum: ["daily", "5x_week", "3x_week", "custom", "monthly"],
                },
                custom_days: { type: "array", items: { type: "number" } },
                preferred_time: { type: "string" },
                estimated_minutes: { type: "number" },
                description: { type: "string" },
                category: {
                  type: "string",
                  enum: ["mind", "body", "soul"],
                },
                difficulty: {
                  type: "string",
                  enum: ["easy", "medium", "hard"],
                },
                reminder_enabled: { type: "boolean" },
                reminder_minutes_before: { type: "number" },
              },
            },
          },
        },
      },
    ),
    functionTool(
      "prepare_campaign_update",
      "Prepare an update to an existing campaign or goal track.",
      {
        type: "object",
        additionalProperties: false,
        required: ["campaign_id"],
        properties: {
          campaign_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          end_date: { type: "string" },
          status: {
            type: "string",
            enum: [...COMPANION_CAMPAIGN_LIFECYCLE_STATUSES],
          },
          target_days: { type: "number" },
        },
      },
    ),
    functionTool(
      "prepare_day_plan",
      "Prepare and apply a realistic Cosmiq day plan after confirmation. Use existing task_id values when scheduling existing tasks, plan around read-only calendar events, and set send_to_calendar only when explicitly requested.",
      {
        type: "object",
        additionalProperties: false,
        required: ["plan_date", "blocks"],
        properties: {
          plan_date: { type: "string" },
          blocks: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "start_time", "duration_minutes"],
              properties: {
                task_id: { type: "string" },
                title: { type: "string" },
                start_time: { type: "string" },
                duration_minutes: { type: "number" },
                energy_type: {
                  type: "string",
                  enum: [
                    "deep",
                    "admin",
                    "physical",
                    "errand",
                    "social",
                    "creative",
                    "recovery",
                  ],
                },
                source: {
                  type: "string",
                  enum: ["campaign", "habit", "recovery", "optimization"],
                },
                reasoning: { type: "string" },
                epic_id: { type: "string" },
                habit_source_id: { type: "string" },
                difficulty: {
                  type: "string",
                  enum: ["easy", "medium", "hard"],
                },
                reminder_enabled: { type: "boolean" },
                reminder_minutes_before: { type: "number" },
                category: {
                  type: "string",
                  enum: ["mind", "body", "soul"],
                },
                notes: { type: "string" },
              },
            },
          },
          send_to_calendar: { type: "boolean" },
          calendar_provider: {
            type: "string",
            enum: ["google", "outlook", "all"],
          },
        },
      },
    ),
    functionTool(
      "prepare_journal_entry",
      "Prepare a journal or reflection entry.",
      {
        type: "object",
        additionalProperties: false,
        required: ["note"],
        properties: {
          note: { type: "string" },
          mood: { type: "string" },
          reflection_date: { type: "string" },
        },
      },
    ),
    functionTool(
      "submit_companion_result",
      "Submit the final result for this turn after you have gathered any needed context and optionally prepared one action.",
      {
        type: "object",
        additionalProperties: false,
        required: ["reply", "mode", "intent", "confidence"],
        properties: {
          reply: { type: "string" },
          mode: {
            type: "string",
            enum: [
              "conversation",
              "clarify",
              "schedule_read",
              "pending_confirmation",
              "receipt",
            ],
          },
          intent: {
            type: "string",
            enum: [
              "schedule_task",
              "plan_day",
              "plan_week",
              "check_calendar",
              "update_existing_plan",
              "goal_setting",
              "journal",
              "explore",
              "reflect",
              "unknown",
            ],
          },
          confidence: { type: "number" },
          understanding_state: {
            type: "string",
            enum: [
              "needs_followup",
              "enough_to_discuss",
              "ready_to_propose",
              "ready_to_draft",
            ],
          },
          follow_up: {
            type: "object",
            additionalProperties: false,
            properties: {
              question: { type: "string" },
              reason: { type: "string" },
              expectedAnswerType: {
                type: "string",
                enum: [
                  "free_text",
                  "choice",
                  "time",
                  "priority",
                  "confirmation",
                ],
              },
              options: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          assumptions: {
            type: "array",
            items: { type: "string" },
          },
          evidence_ids: {
            type: "array",
            items: { type: "string" },
          },
          structured_response: {
            type: "object",
            additionalProperties: true,
          },
          prepared_action_id: { type: "string" },
        },
      },
    ),
  ];
}

function filterCalendarRange(
  context: LoadedCompanionAgentContext,
  startDate: string,
  endDate: string,
) {
  const scheduledTasks = context.tasks.filter((task) => {
    const taskDate = typeof task.task_date === "string" ? task.task_date : null;
    return taskDate !== null && taskDate >= startDate && taskDate <= endDate;
  });

  const calendarEvents = context.calendarEvents.filter((event) => {
    const start = typeof event.start_time === "string"
      ? event.start_time.slice(0, 10)
      : "";
    const end = typeof event.end_time === "string"
      ? event.end_time.slice(0, 10)
      : start;
    return start <= endDate && end >= startDate;
  });

  return {
    start_date: startDate,
    end_date: endDate,
    scheduled_tasks: scheduledTasks,
    calendar_events: calendarEvents,
  };
}

function buildToolExecutor(params: {
  context: LoadedCompanionAgentContext;
  preparedActions: Map<string, PendingActionCandidate>;
  requestMessage: string;
  surface: "companion" | "journeys";
  request: CompanionAgentRequest;
}) {
  const findTask = (taskId: string) =>
    params.context.tasks.find((task) => task.id === taskId);
  const findCampaign = (campaignId: string) =>
    params.context.campaigns.find((campaign) => campaign.id === campaignId);
  const hasExplicitCalendarSyncRequest =
    /\b(?:add|put|place|send|sync|block|schedule|save|show)\b[^.?!]*\b(?:calendar|google|outlook)\b|\b(?:calendar|google|outlook)\b[^.?!]*\b(?:add|put|place|send|sync|block|schedule|save|show)\b/i
      .test(params.requestMessage);
  const enforceCalendarSyncConsent = <
    T extends {
      send_to_calendar: boolean;
      calendar_provider?: "google" | "outlook" | "all" | null;
    },
  >(data: T): T =>
    data.send_to_calendar && !hasExplicitCalendarSyncRequest
      ? { ...data, send_to_calendar: false, calendar_provider: null }
      : data;

  return async (call: ToolCall): Promise<Record<string, unknown>> => {
    const parsed = JSON.parse(call.arguments || "{}");

    switch (call.name) {
      case "get_current_datetime":
        return {
          current_date_time: params.context.currentDateTime,
          timezone: params.context.timezone,
          visible_date_start: params.context.visibleDateStart,
          visible_date_end: params.context.visibleDateEnd,
        };
      case "get_user_profile":
        return params.context.recentMemory;
      case "get_user_goals":
        return {
          goals: params.context.goals,
          active_campaigns: params.context.campaigns,
        };
      case "get_calendar_range": {
        const startDate =
          typeof parsed.start_date === "string" && parsed.start_date
            ? parsed.start_date
            : params.context.visibleDateStart;
        const endDate = typeof parsed.end_date === "string" && parsed.end_date
          ? parsed.end_date
          : params.context.visibleDateEnd;
        return filterCalendarRange(params.context, startDate, endDate);
      }
      case "get_today_calendar": {
        const today = toDateOnly(params.context.currentDateTime);
        return filterCalendarRange(params.context, today, today);
      }
      case "list_tasks":
        return {
          tasks: parsed.include_unscheduled === false
            ? params.context.tasks.filter((task) =>
              typeof task.task_date === "string"
            )
            : params.context.tasks,
        };
      case "list_rituals":
        return { rituals: params.context.rituals };
      case "list_campaigns":
        return { campaigns: params.context.campaigns };
      case "list_reminders":
        return { reminders: params.context.reminders };
      case "get_recent_conversation_context":
        return {
          messages: params.context.messages.map((message) => ({
            role: message.role,
            content: message.content,
            created_at: message.created_at,
            source: message.source,
          })),
        };
      case "get_active_pending_action":
        return {
          pending_action: params.context.activePendingAction,
        };
      case "consult_planner": {
        const plannerResult = consultPlannerForAgent({
          message: params.requestMessage,
          currentDateTime: params.context.currentDateTime,
          selectedDate: params.request.selectedDate ?? null,
          briefingContext: params.request.briefingContext ?? null,
          surface: params.surface,
          horizon: parsed.horizon === "week" ? "week" : "day",
          starterIntent: params.request.starterIntent ?? null,
          context: params.context,
        });

        return {
          mode: plannerResult.mode,
          reply: plannerResult.reply,
          follow_up_questions: plannerResult.questions,
          schedule_insights: plannerResult.scheduleInsights,
          structured_response: plannerResult.structuredResponse,
        };
      }
      case "prepare_task_create": {
        const data = enforceCalendarSyncConsent(
          PrepareTaskCreateSchema.parse(parsed),
        );
        const when = formatDateTimeLabel(data.task_date, data.scheduled_time);
        const candidate = createPreparedAction({
          actionType: "task_create",
          intent: "schedule_task",
          summary: `Create "${data.title}" for ${when}.`,
          confirmationMessage: `Want me to add "${data.title}" for ${when}?`,
          normalizedPayload: data,
          affectedEntities: null,
        });
        params.preparedActions.set(candidate.id, candidate);
        return { prepared_action_id: candidate.id, ...candidate };
      }
      case "prepare_task_update": {
        const data = PrepareTaskUpdateSchema.parse(parsed);
        const existingTask = findTask(data.task_id);
        if (!existingTask) {
          return { error: "task_not_found" };
        }
        const nextTitle = data.title ??
          String(existingTask.task_text ?? "task");
        const nextDate = data.task_date ??
          (typeof existingTask.task_date === "string"
            ? existingTask.task_date
            : null);
        const nextTime = data.scheduled_time ??
          (typeof existingTask.scheduled_time === "string"
            ? existingTask.scheduled_time
            : null);
        const summary = `Update "${nextTitle}" to ${
          formatDateTimeLabel(nextDate, nextTime)
        }.`;
        const candidate = createPreparedAction({
          actionType: "task_update",
          intent: "update_existing_plan",
          summary,
          confirmationMessage: `Want me to update "${nextTitle}" to ${
            formatDateTimeLabel(nextDate, nextTime)
          }?`,
          normalizedPayload: data,
          affectedEntities: { task_id: data.task_id },
        });
        params.preparedActions.set(candidate.id, candidate);
        return { prepared_action_id: candidate.id, ...candidate };
      }
      case "prepare_ritual_create": {
        const data = PrepareRitualCreateSchema.parse(parsed);
        const summary =
          `Create ritual "${data.title}" with ${data.frequency} frequency.`;
        const candidate = createPreparedAction({
          actionType: "ritual_create",
          intent: "goal_setting",
          summary,
          confirmationMessage: `Want me to create the ritual "${data.title}"?`,
          normalizedPayload: data,
          affectedEntities: null,
        });
        params.preparedActions.set(candidate.id, candidate);
        return { prepared_action_id: candidate.id, ...candidate };
      }
      case "prepare_reminder_create": {
        const data = PrepareReminderCreateSchema.parse(parsed);
        const summary = `Add a reminder on that ${data.target_type}.`;
        const candidate = createPreparedAction({
          actionType: "reminder_create",
          intent: "update_existing_plan",
          summary,
          confirmationMessage: `Want me to set that reminder?`,
          normalizedPayload: data,
          affectedEntities: {
            target_type: data.target_type,
            target_id: data.target_id,
          },
        });
        params.preparedActions.set(candidate.id, candidate);
        return { prepared_action_id: candidate.id, ...candidate };
      }
      case "prepare_campaign_create": {
        const parsedData = PrepareCampaignCreateSchema.parse(parsed);
        const data = {
          ...parsedData,
          start_date: parsedData.start_date ??
            toDateOnly(params.context.currentDateTime),
        };
        const ritualLabel = data.rituals.length === 1 ? "ritual" : "rituals";
        const candidate = createPreparedAction({
          actionType: "campaign_create",
          intent: "goal_setting",
          summary:
            `Create a ${data.target_days}-day campaign "${data.title}" with ${data.rituals.length} ${ritualLabel}.`,
          confirmationMessage:
            `Ready for me to start "${data.title}" and add those ${ritualLabel}?`,
          normalizedPayload: data,
          affectedEntities: null,
        });
        params.preparedActions.set(candidate.id, candidate);
        return { prepared_action_id: candidate.id, ...candidate };
      }
      case "prepare_campaign_update": {
        const data = PrepareCampaignUpdateSchema.parse(parsed);
        const existingCampaign = findCampaign(data.campaign_id);
        const summary = `Update campaign "${
          data.title ?? String(existingCampaign?.title ?? "campaign")
        }".`;
        const candidate = createPreparedAction({
          actionType: "campaign_update",
          intent: "goal_setting",
          summary,
          confirmationMessage: `Want me to update that campaign?`,
          normalizedPayload: data,
          affectedEntities: { campaign_id: data.campaign_id },
        });
        params.preparedActions.set(candidate.id, candidate);
        return { prepared_action_id: candidate.id, ...candidate };
      }
      case "prepare_day_plan": {
        const data = enforceCalendarSyncConsent(
          PrepareDayPlanSchema.parse(parsed),
        );
        const candidate = createPreparedAction({
          actionType: "day_plan_apply",
          intent: "plan_day",
          summary: `Plan ${data.plan_date} with ${data.blocks.length} focused ${
            data.blocks.length === 1 ? "block" : "blocks"
          }.`,
          confirmationMessage:
            `Want me to apply this plan to ${data.plan_date}?`,
          normalizedPayload: data,
          affectedEntities: {
            plan_date: data.plan_date,
            task_ids: data.blocks.flatMap((block) =>
              block.task_id ? [block.task_id] : []
            ),
          },
        });
        params.preparedActions.set(candidate.id, candidate);
        return { prepared_action_id: candidate.id, ...candidate };
      }
      case "prepare_journal_entry": {
        const data = PrepareJournalEntrySchema.parse(parsed);
        const summary = "Save this as a journal entry.";
        const candidate = createPreparedAction({
          actionType: "journal_entry",
          intent: "journal",
          summary,
          confirmationMessage: "Want me to save that to your journal?",
          normalizedPayload: data,
          affectedEntities: null,
        });
        params.preparedActions.set(candidate.id, candidate);
        return { prepared_action_id: candidate.id, ...candidate };
      }
      case "submit_companion_result":
        return SubmitCompanionResultSchema.parse(parsed);
      default:
        return { error: `unknown_tool:${call.name}` };
    }
  };
}

function buildToolOutput(callId: string, output: unknown) {
  return {
    type: "function_call_output",
    call_id: callId,
    output: JSON.stringify(output),
  };
}

function isLinkageError(error: unknown) {
  const message = error instanceof Error
    ? error.message.toLowerCase()
    : String(error).toLowerCase();
  const hasPreviousResponseLinkage = message.includes("previous_response_id") ||
    message.includes("previous response");
  const hasConversationLinkage = message.includes("conversation") &&
    (message.includes("not found") ||
      message.includes("invalid") ||
      message.includes("missing"));

  return hasPreviousResponseLinkage || hasConversationLinkage;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isOpenAIProviderFallbackError(error: unknown) {
  if (error instanceof OpenAIProviderError) return true;

  const message = getErrorMessage(error).toLowerCase();
  const isOpenAIError = message.includes("openai_api_key not configured") ||
    message.includes("openai conversation create failed") ||
    message.includes("openai responses call failed") ||
    message.includes("openai conversation id missing");

  const hasProviderFailureSignal = message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("connection") ||
    message.includes("fetcherror") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("insufficient_quota") ||
    message.includes("exceeded your current quota") ||
    message.includes("service unavailable") ||
    message.includes("temporarily unavailable") ||
    message.includes("server error") ||
    message.includes("internal server error") ||
    message.includes("bad gateway") ||
    message.includes("gateway timeout") ||
    message.includes("invalid api key") ||
    message.includes("incorrect api key") ||
    message.includes("invalid_request_error") ||
    message.includes("unknown parameter") ||
    message.includes("unsupported parameter") ||
    message.includes("model_not_found") ||
    message.includes("does not have access to model") ||
    /\b(408|429|500|502|503|504)\b/.test(message);

  return message.includes("openai_api_key not configured") ||
    message.includes("openai conversation id missing") ||
    (isOpenAIError && hasProviderFailureSignal);
}

function isPlannerFallbackError(error: unknown) {
  return error instanceof TimeoutError || error instanceof SyntaxError ||
    error instanceof z.ZodError ||
    isOpenAIProviderFallbackError(error);
}

function mapPlannerFallbackIntent(
  plannerResult: ReturnType<typeof consultPlannerForAgent>,
): CompanionAgentIntent {
  if (plannerResult.structuredResponse?.planDay) return "plan_day";
  if (plannerResult.structuredResponse?.comingUp) {
    return "check_calendar";
  }

  return "unknown";
}

const getRequiredScheduleReadContextWarnings = (
  context: LoadedCompanionAgentContext,
) => (context.loadWarnings ?? []).filter((warning) => warning.required);

function buildScheduleReadContextUnavailableResult(params: {
  request: CompanionAgentRequest;
  context: LoadedCompanionAgentContext;
  warnings: CompanionAgentContextLoadWarning[];
}): AgentRunResult {
  console.warn("[companion-agent] schedule read core context unavailable", {
    sessionId: params.request.sessionId,
    sources: params.warnings.map((warning) => warning.source),
  });

  return {
    result: {
      reply:
        "I couldn’t load your planner right now, so I don’t want to guess at what’s coming up. Please try again in a moment.",
      mode: "schedule_read" as CompanionAgentMode,
      intent: "check_calendar" as CompanionAgentIntent,
      confidence: 0.1,
      understandingState:
        "enough_to_discuss" as CompanionAgentUnderstandingState,
      followUp: null,
      assumptions: [],
      evidenceIds: [],
      structuredResponse: null,
      preparedActionId: null,
    },
    openaiConversationId: params.context.thread?.openai_conversation_id ?? null,
    lastOpenAIResponseId: params.context.thread?.last_openai_response_id ??
      null,
    actionDecisionSource: "deterministic",
  };
}

function buildDeterministicScheduleReadResult(params: {
  request: CompanionAgentRequest;
  context: LoadedCompanionAgentContext;
}): AgentRunResult {
  const plannerStarterIntent = getScheduleReadStarterIntent(params.request);
  const plannerResult = consultPlannerForAgent({
    message: params.request.message,
    currentDateTime: params.context.currentDateTime,
    selectedDate: params.request.selectedDate ?? null,
    briefingContext: params.request.briefingContext ?? null,
    surface: params.request.surface,
    horizon: "day",
    starterIntent: plannerStarterIntent,
    activeFollowUp: null,
    context: params.context,
  });
  const mode = plannerResult.questions.length > 0
    ? "clarify" as CompanionAgentMode
    : plannerResult.mode === "proposal" ||
        plannerResult.mode === "schedule_read"
    ? "schedule_read" as CompanionAgentMode
    : "conversation" as CompanionAgentMode;
  const followUp = plannerResult.questions[0]
    ? {
      question: plannerResult.questions[0].prompt,
      reason: plannerResult.questions[0].reason ?? null,
      expectedAnswerType: plannerResult.questions[0].options?.length
        ? "choice" as const
        : "free_text" as const,
      options: plannerResult.questions[0].options ?? [],
      metadata: {
        ...(plannerResult.questions[0].metadata ?? {}),
        questionId: plannerResult.questions[0].id,
        ...(params.request.selectedDate
          ? { selectedDate: params.request.selectedDate }
          : {}),
        ...(params.request.briefingContext
          ? { briefingContext: params.request.briefingContext }
          : {}),
      },
    }
    : null;

  return {
    result: {
      reply: plannerResult.reply,
      mode,
      intent: mapPlannerFallbackIntent(plannerResult),
      confidence: 0.82,
      understandingState: deriveUnderstandingState({ mode, followUp }),
      followUp,
      assumptions: [],
      evidenceIds: [],
      structuredResponse: plannerResult.structuredResponse ?? null,
      preparedActionId: null,
    },
    openaiConversationId: params.context.thread?.openai_conversation_id ?? null,
    lastOpenAIResponseId: params.context.thread?.last_openai_response_id ??
      null,
    actionDecisionSource: "deterministic",
  };
}

function buildDeterministicPlanDayTriageResult(params: {
  request: CompanionAgentRequest;
  context: LoadedCompanionAgentContext;
}): AgentRunResult {
  const plannerResult = consultPlannerForAgent({
    message: params.request.message,
    currentDateTime: params.context.currentDateTime,
    selectedDate: params.request.selectedDate ?? null,
    briefingContext: params.request.briefingContext ?? null,
    surface: params.request.surface,
    starterIntent: "plan_day",
    activeFollowUp: null,
    context: params.context,
  });
  const mode = plannerResult.questions.length > 0
    ? "clarify" as CompanionAgentMode
    : plannerResult.mode === "proposal" ||
        plannerResult.mode === "schedule_read"
    ? "schedule_read" as CompanionAgentMode
    : "conversation" as CompanionAgentMode;
  const followUp = plannerResult.questions[0]
    ? {
      question: plannerResult.questions[0].prompt,
      reason: plannerResult.questions[0].reason ?? null,
      expectedAnswerType: plannerResult.questions[0].options?.length
        ? "choice" as const
        : "free_text" as const,
      options: plannerResult.questions[0].options ?? [],
      metadata: {
        ...(plannerResult.questions[0].metadata ?? {}),
        questionId: plannerResult.questions[0].id,
        ...(params.request.selectedDate
          ? { selectedDate: params.request.selectedDate }
          : {}),
        ...(params.request.briefingContext
          ? { briefingContext: params.request.briefingContext }
          : {}),
      },
    }
    : null;

  return {
    result: {
      reply: plannerResult.reply,
      mode,
      intent: "plan_day" as CompanionAgentIntent,
      confidence: 0.82,
      understandingState: deriveUnderstandingState({ mode, followUp }),
      followUp,
      assumptions: [],
      evidenceIds: [],
      structuredResponse: plannerResult.structuredResponse ?? null,
      preparedActionId: null,
    },
    openaiConversationId: params.context.thread?.openai_conversation_id ?? null,
    lastOpenAIResponseId: params.context.thread?.last_openai_response_id ??
      null,
    actionDecisionSource: "deterministic",
  };
}

const buildAffectedEntities = (
  actionType: CompanionPendingActionType,
  normalizedPayload: Record<string, unknown>,
) =>
  actionType === "task_update" &&
    typeof normalizedPayload.task_id === "string"
    ? { task_id: normalizedPayload.task_id }
    : actionType === "day_plan_apply" &&
        typeof normalizedPayload.plan_date === "string"
    ? { plan_date: normalizedPayload.plan_date }
    : (actionType === "campaign_update" || actionType === "campaign_adjust") &&
        typeof normalizedPayload.campaign_id === "string"
    ? { campaign_id: normalizedPayload.campaign_id }
    : actionType === "reminder_create" &&
        typeof normalizedPayload.target_id === "string" &&
        typeof normalizedPayload.target_type === "string"
    ? {
      target_id: normalizedPayload.target_id,
      target_type: normalizedPayload.target_type,
    }
    : null;

export async function runCompanionAgent(params: RunAgentParams) {
  const companion = await wrapSubStage(
    "context_load",
    () => loadCompanionId(params.supabase, params.userId, params.requestId),
  );
  const context = await wrapSubStage(
    "context_load",
    () =>
      loadCompanionAgentContext({
        supabase: params.supabase,
        actorSupabase: params.actorSupabase,
        userId: params.userId,
        companionId: companion.id,
        sessionId: params.request.sessionId,
        request: params.request,
        requestId: params.requestId,
      }),
  );

  const scheduleReadFastPath = isCompanionScheduleReadFastPathRequest(
    params.request,
  );
  const contextualPlanDayFastPath = isContextualPlanDayFastPathRequest(
    params.request,
  );
  const requiredScheduleReadWarnings = scheduleReadFastPath
    ? getRequiredScheduleReadContextWarnings(context)
    : [];
  let agentResult: AgentRunResult | null = scheduleReadFastPath
    ? requiredScheduleReadWarnings.length > 0
      ? buildScheduleReadContextUnavailableResult({
        request: params.request,
        context,
        warnings: requiredScheduleReadWarnings,
      })
      : buildDeterministicScheduleReadResult({
        request: params.request,
        context,
      })
    : contextualPlanDayFastPath
    ? buildDeterministicPlanDayTriageResult({
      request: params.request,
      context,
    })
    : null;

  const preparedActions = new Map<string, PendingActionCandidate>();

  if (!agentResult) {
    const executeTool = buildToolExecutor({
      context,
      preparedActions,
      requestMessage: params.request.message,
      surface: params.request.surface,
      request: params.request,
    });
    const tools = buildToolDefinitions();
    const instructions = buildInstructions({
      surface: params.request.surface,
      currentDateTime: params.request.currentDateTime,
      companion,
      context,
      request: params.request,
    });

    const runResponseLoop = async (transport: {
      conversationId?: string | null;
      previousResponseId?: string | null;
      manualHistory: boolean;
    }): Promise<AgentRunResult> => {
      let response = await createOpenAIResponse({
        guardedFetch: params.guardedFetch,
        input: buildInitialInput({
          context,
          request: params.request,
          manualHistory: transport.manualHistory,
        }),
        instructions,
        conversationId: transport.conversationId,
        previousResponseId: transport.previousResponseId,
        tools,
        openAIApiKey: params.openAIApiKey,
      });

      let currentConversationId = response.conversation?.id ??
        transport.conversationId ?? null;
      let currentPreviousResponseId = response.id;

      for (let loop = 0; loop < MAX_TOOL_LOOPS; loop += 1) {
        const functionCalls = getFunctionCalls(response);
        if (functionCalls.length === 0) {
          const outputReply = extractOpenAIResponseText(response);
          const activeFollowUp = params.request.activeFollowUp ??
            getPersistedActiveFollowUp(context);
          if (
            (!outputReply || isThinGenericAgentReply(outputReply)) &&
            isDeterministicScheduleReadRequest(params.request)
          ) {
            return buildPlannerFallbackResult("thin_schedule_read_output", {
              starterIntent: getScheduleReadStarterIntent(params.request),
              ignoreActiveFollowUp: true,
              confidence: 0.82,
              suppressWarning: true,
            });
          }
          if (
            isFollowUpOptionTurn(params.request) &&
            activeFollowUp &&
            (!outputReply || isThinGenericAgentReply(outputReply))
          ) {
            const planningStarterIntent = getPlanningStarterIntentFromFollowUp(
              activeFollowUp,
            );
            return buildActiveFollowUpClarifyAgentResult({
              followUp: activeFollowUp,
              intent: isPlanningLauncherFollowUpQuestion(activeFollowUp)
                ? mapPlanningStarterIntentToAgentIntent(planningStarterIntent)
                : "unknown",
              confidence: 0.25,
              context,
              openaiConversationId: currentConversationId,
              lastOpenAIResponseId: currentPreviousResponseId,
            });
          }

          const usableOutputReply = outputReply &&
              !isThinGenericAgentReply(outputReply)
            ? outputReply
            : null;
          const providerDiagnostics = usableOutputReply
            ? null
            : buildOpenAIEmptyOutputDiagnostics({
              responseId: currentPreviousResponseId,
            });
          if (providerDiagnostics) {
            console.warn("[companion-agent] empty openai output", {
              sessionId: params.request.sessionId,
              providerDiagnostics: loggableOpenAIProviderDiagnostics(
                providerDiagnostics,
              ),
            });
          }

          return {
            result: {
              reply: usableOutputReply ?? OPENAI_EMPTY_OUTPUT_REPLY,
              mode: "conversation" as CompanionAgentMode,
              intent: "unknown" as CompanionAgentIntent,
              confidence: 0.25,
              understandingState:
                "enough_to_discuss" as CompanionAgentUnderstandingState,
              followUp: null,
              assumptions: [],
              evidenceIds: [],
              structuredResponse: null,
              preparedActionId: null,
            },
            openaiConversationId: currentConversationId,
            lastOpenAIResponseId: currentPreviousResponseId,
            actionDecisionSource: "model",
            providerDiagnostics,
          };
        }

        const finalCall = functionCalls.find((call) =>
          call.name === "submit_companion_result"
        );
        if (finalCall) {
          const payload = parseSubmitCompanionResultArguments(
            finalCall.arguments,
            {
              allowLenientChatResult: isFreeTalkProviderFallbackRequest(
                params.request,
              ) || isJourneysReadOnlyTurn(params.request) ||
                (
                  params.request.surface === "companion" &&
                  !isExplicitCompanionWriteRequest(params.request)
                ),
            },
          );
          const payloadReply = payload.reply.trim();
          const followUp = payload.follow_up ?? null;
          const preparedActionId = payload.prepared_action_id ?? null;
          const activeFollowUp = params.request.activeFollowUp ??
            getPersistedActiveFollowUp(context);
          const followUpToPreserve = activeFollowUp ?? followUp;
          if (
            isThinGenericAgentReply(payloadReply) &&
            isDeterministicScheduleReadRequest(params.request)
          ) {
            return buildPlannerFallbackResult("thin_schedule_read_result", {
              starterIntent: getScheduleReadStarterIntent(params.request),
              ignoreActiveFollowUp: true,
              confidence: 0.82,
              suppressWarning: true,
            });
          }
          if (
            isFollowUpOptionTurn(params.request) &&
            followUpToPreserve &&
            isThinGenericAgentReply(payloadReply)
          ) {
            const planningStarterIntent = getPlanningStarterIntentFromFollowUp(
              followUpToPreserve,
            );
            return buildActiveFollowUpClarifyAgentResult({
              followUp: followUpToPreserve,
              intent: payload.intent === "unknown" &&
                  isPlanningLauncherFollowUpQuestion(followUpToPreserve)
                ? mapPlanningStarterIntentToAgentIntent(planningStarterIntent)
                : payload.intent,
              confidence: payload.confidence,
              context,
              openaiConversationId: currentConversationId,
              lastOpenAIResponseId: currentPreviousResponseId,
            });
          }

          const understandingState = payload.understanding_state ??
            deriveUnderstandingState({
              mode: payload.mode,
              preparedActionId,
              followUp,
            });
          const usablePayloadReply = payloadReply &&
              !isThinGenericAgentReply(payloadReply)
            ? payloadReply
            : null;
          const providerDiagnostics = usablePayloadReply
            ? null
            : buildOpenAIEmptyOutputDiagnostics({
              responseId: currentPreviousResponseId,
            });
          if (providerDiagnostics) {
            console.warn("[companion-agent] thin openai result reply", {
              sessionId: params.request.sessionId,
              providerDiagnostics: loggableOpenAIProviderDiagnostics(
                providerDiagnostics,
              ),
            });
          }
          return {
            result: {
              reply: usablePayloadReply ?? OPENAI_EMPTY_OUTPUT_REPLY,
              mode: payload.mode,
              intent: payload.intent,
              confidence: payload.confidence,
              understandingState,
              followUp,
              assumptions: payload.assumptions ?? [],
              evidenceIds: payload.evidence_ids ?? [],
              structuredResponse: payload.structured_response ?? null,
              preparedActionId,
            },
            openaiConversationId: currentConversationId,
            lastOpenAIResponseId: currentPreviousResponseId,
            actionDecisionSource: "model",
            providerDiagnostics,
          };
        }

        const toolOutputs = [];
        for (const functionCall of functionCalls) {
          const output = await executeTool(functionCall);
          toolOutputs.push(buildToolOutput(functionCall.call_id, output));
        }

        response = await createOpenAIResponse({
          guardedFetch: params.guardedFetch,
          input: toolOutputs,
          instructions,
          conversationId: currentConversationId,
          previousResponseId: currentConversationId
            ? null
            : currentPreviousResponseId,
          tools,
          openAIApiKey: params.openAIApiKey,
        });

        currentConversationId = response.conversation?.id ??
          currentConversationId;
        currentPreviousResponseId = response.id;
      }

      throw new Error("Companion agent exceeded tool loop limit");
    };

    const runResponseLoopWithTimeout = (transport: {
      conversationId?: string | null;
      previousResponseId?: string | null;
      manualHistory: boolean;
    }): Promise<AgentRunResult> =>
      withTimeout(
        () => runResponseLoop(transport),
        {
          timeoutMs: AGENT_RESPONSE_TIMEOUT_MS,
          operation: "companion agent response loop",
          timeoutCode: "COMPANION_AGENT_TIMEOUT",
        },
      );

    function buildPlannerFallbackResult(
      reason: string,
      options: {
        starterIntent?: string | null;
        forcePlanDayFollowUp?: boolean;
        confidence?: number;
        ignoreActiveFollowUp?: boolean;
        suppressWarning?: boolean;
        openaiConversationId?: string | null;
        lastOpenAIResponseId?: string | null;
        providerDiagnostics?: OpenAIProviderDiagnostics | null;
      } = {},
    ): AgentRunResult {
      if (!options.suppressWarning) {
        console.warn("[companion-agent] planner fallback", {
          sessionId: params.request.sessionId,
          reason,
          providerDiagnostics: loggableOpenAIProviderDiagnostics(
            options.providerDiagnostics,
          ),
        });
      }

      const plannerStarterIntent = options.starterIntent ??
        params.request.starterIntent ??
        null;
      const plannerResult = consultPlannerForAgent({
        message: params.request.message,
        currentDateTime: context.currentDateTime,
        selectedDate: params.request.selectedDate ?? null,
        briefingContext: params.request.briefingContext ?? null,
        surface: params.request.surface,
        horizon: "day",
        starterIntent: plannerStarterIntent,
        forcePlanDayFollowUp: options.forcePlanDayFollowUp,
        activeFollowUp: !options.ignoreActiveFollowUp &&
            isFollowUpOptionTurn(params.request)
          ? params.request.activeFollowUp ?? getPersistedActiveFollowUp(context)
          : null,
        context,
      });

      const mode = plannerResult.questions.length > 0
        ? "clarify" as CompanionAgentMode
        : plannerResult.mode === "proposal"
        ? "schedule_read" as CompanionAgentMode
        : plannerResult.mode === "schedule_read"
        ? "schedule_read" as CompanionAgentMode
        : "conversation" as CompanionAgentMode;
      const followUp = plannerResult.questions[0]
        ? {
          question: plannerResult.questions[0].prompt,
          reason: plannerResult.questions[0].reason ?? null,
          expectedAnswerType: plannerResult.questions[0].id ===
                "plan_day_quest_consent" ||
              plannerResult.questions[0].id === "planning_launcher_consent"
            ? "confirmation" as const
            : plannerResult.questions[0].options?.length
            ? "choice" as const
            : "free_text" as const,
          options: plannerResult.questions[0].options ?? [],
          metadata: {
            ...(plannerResult.questions[0].metadata ?? {}),
            questionId: plannerResult.questions[0].id,
            ...(params.request.selectedDate
              ? { selectedDate: params.request.selectedDate }
              : {}),
            ...(params.request.briefingContext
              ? { briefingContext: params.request.briefingContext }
              : {}),
          },
        }
        : null;

      return {
        result: {
          reply: plannerResult.reply,
          mode,
          intent: (
              plannerStarterIntent === "plan_day" ||
              options.forcePlanDayFollowUp === true
            ) && plannerResult.questions.length > 0
            ? "plan_day"
            : mapPlannerFallbackIntent(plannerResult),
          confidence: options.confidence ?? 0.55,
          understandingState: mode === "pending_confirmation"
            ? "ready_to_draft"
            : deriveUnderstandingState({ mode, followUp }),
          followUp,
          assumptions: [],
          evidenceIds: [],
          structuredResponse: plannerResult.structuredResponse ?? null,
          preparedActionId: null,
        },
        openaiConversationId: options.openaiConversationId ??
          context.thread?.openai_conversation_id ?? null,
        lastOpenAIResponseId: options.lastOpenAIResponseId ??
          context.thread?.last_openai_response_id ?? null,
        actionDecisionSource: "deterministic",
        providerDiagnostics: options.providerDiagnostics ?? null,
      };
    }

    function buildProviderUnavailableResult(
      providerDiagnostics: OpenAIProviderDiagnostics,
    ): AgentRunResult {
      console.warn("[companion-agent] openai provider fallback", {
        sessionId: params.request.sessionId,
        providerDiagnostics: loggableOpenAIProviderDiagnostics(
          providerDiagnostics,
        ),
      });

      return {
        result: {
          reply: OPENAI_PROVIDER_UNAVAILABLE_REPLY,
          mode: "conversation" as CompanionAgentMode,
          intent: "unknown" as CompanionAgentIntent,
          confidence: 0.1,
          understandingState:
            "enough_to_discuss" as CompanionAgentUnderstandingState,
          followUp: null,
          assumptions: [],
          evidenceIds: [],
          structuredResponse: null,
          preparedActionId: null,
        },
        openaiConversationId: context.thread?.openai_conversation_id ?? null,
        lastOpenAIResponseId: context.thread?.last_openai_response_id ?? null,
        actionDecisionSource: "deterministic",
        providerDiagnostics,
      };
    }

    function buildOpenAIOutputUnavailableResult(
      providerDiagnostics: OpenAIProviderDiagnostics,
    ): AgentRunResult {
      console.warn("[companion-agent] openai output fallback", {
        sessionId: params.request.sessionId,
        providerDiagnostics: loggableOpenAIProviderDiagnostics(
          providerDiagnostics,
        ),
      });

      return {
        result: {
          reply: OPENAI_EMPTY_OUTPUT_REPLY,
          mode: "conversation" as CompanionAgentMode,
          intent: "unknown" as CompanionAgentIntent,
          confidence: 0.1,
          understandingState:
            "enough_to_discuss" as CompanionAgentUnderstandingState,
          followUp: null,
          assumptions: [],
          evidenceIds: [],
          structuredResponse: null,
          preparedActionId: null,
        },
        openaiConversationId: context.thread?.openai_conversation_id ?? null,
        lastOpenAIResponseId: context.thread?.last_openai_response_id ?? null,
        actionDecisionSource: "deterministic",
        providerDiagnostics,
      };
    }

    function buildFallbackResultForOpenAIError(error: unknown): AgentRunResult {
      const providerDiagnostics = getOpenAIProviderDiagnostics(error);
      if (
        providerDiagnostics && isFreeTalkProviderFallbackRequest(params.request)
      ) {
        return buildProviderUnavailableResult(providerDiagnostics);
      }
      if (isFreeTalkProviderFallbackRequest(params.request)) {
        return buildOpenAIOutputUnavailableResult(
          providerDiagnostics ??
            buildOpenAIEmptyOutputDiagnostics({
              responseId: context.thread?.last_openai_response_id ?? null,
            }),
        );
      }

      return buildPlannerFallbackResult(getErrorMessage(error), {
        providerDiagnostics,
      });
    }

    const bareStarterResult = buildBareStarterAgentResult({
      request: params.request,
      context,
    });
    const planningFollowUpStarterIntent =
      getPlanningStarterIntentFromActiveFollowUp(
        params.request,
        context,
      );
    const deterministicPlanningFollowUpResult = bareStarterResult
      ? null
      : isPlanningLauncherFollowUpAnswer(params.request, context)
      ? buildPlannerFallbackResult("planning_launcher_follow_up_answer", {
        starterIntent: planningFollowUpStarterIntent,
        forcePlanDayFollowUp: planningFollowUpStarterIntent === "plan_day",
        confidence: 0.78,
      })
      : null;

    agentResult = bareStarterResult ??
      deterministicPlanningFollowUpResult ??
      await wrapSubStage("openai", async () => {
        try {
          if (context.thread?.openai_conversation_id) {
            return await runResponseLoopWithTimeout({
              conversationId: context.thread.openai_conversation_id,
              manualHistory: false,
            });
          }
          if (context.thread?.last_openai_response_id) {
            return await runResponseLoopWithTimeout({
              previousResponseId: context.thread.last_openai_response_id,
              manualHistory: false,
            });
          }
          const conversationId = await createOpenAIConversation({
            guardedFetch: params.guardedFetch,
            userId: params.userId,
            sessionId: params.request.sessionId,
            surface: params.request.surface,
            openAIApiKey: params.openAIApiKey,
          });
          return await runResponseLoopWithTimeout({
            conversationId,
            manualHistory: false,
          });
        } catch (error) {
          if (isLinkageError(error)) {
            console.warn("[companion-agent] linkage fallback", {
              sessionId: params.request.sessionId,
              message: error instanceof Error ? error.message : String(error),
            });

            try {
              return await runResponseLoopWithTimeout({
                manualHistory: true,
              });
            } catch (manualHistoryError) {
              if (!isPlannerFallbackError(manualHistoryError)) {
                throw manualHistoryError;
              }
              return buildFallbackResultForOpenAIError(manualHistoryError);
            }
          }
          if (isPlannerFallbackError(error)) {
            return buildFallbackResultForOpenAIError(error);
          }
          throw error;
        }
      });
  }

  if (!agentResult) {
    throw new Error("Companion agent did not produce a result");
  }

  normalizeBareStarterResult({
    request: params.request,
    result: agentResult.result,
  });
  if (
    isJourneysReadOnlyTurn(params.request) &&
    (
      agentResult.actionDecisionSource === "model" ||
      agentResult.result.mode === "pending_confirmation" ||
      agentResult.result.understandingState === "ready_to_draft"
    )
  ) {
    normalizeJourneysReadOnlyResult(agentResult.result);
  }
  if (
    params.request.surface === "companion" &&
    !isExplicitCompanionWriteRequest(params.request)
  ) {
    normalizeCompanionChatOnlyResult(agentResult.result);
  }

  let persistedPendingAction: PendingActionRow | null =
    context.activePendingAction;
  let candidateToPersist: PendingActionCandidate | null = null;
  const modelAuthoredActionDecision =
    agentResult.actionDecisionSource === "model" &&
    !isJourneysReadOnlyTurn(params.request);

  if (
    modelAuthoredActionDecision &&
    agentResult.result.mode === "pending_confirmation" &&
    agentResult.result.preparedActionId
  ) {
    candidateToPersist =
      preparedActions.get(agentResult.result.preparedActionId) ?? null;
  }

  if (
    !persistedPendingAction &&
    !candidateToPersist &&
    (
      agentResult.result.mode === "pending_confirmation" ||
      agentResult.result.understandingState === "ready_to_draft" ||
      agentResult.result.preparedActionId
    )
  ) {
    normalizeUnpersistedActionResult(agentResult.result);
  }

  if (candidateToPersist) {
    agentResult.result.mode = "pending_confirmation";
    agentResult.result.intent = candidateToPersist.intent;
    agentResult.result.understandingState = "ready_to_draft";
    agentResult.result.preparedActionId = candidateToPersist.id;
    persistedPendingAction = await wrapSubStage(
      "persistence",
      () =>
        replacePendingAction({
          supabase: params.supabase,
          userId: params.userId,
          companionId: companion.id,
          sessionId: params.request.sessionId,
          intent: candidateToPersist.intent,
          candidate: candidateToPersist,
          metadata: {
            source: "companion-agent",
            visibleDateStart: context.visibleDateStart,
            visibleDateEnd: context.visibleDateEnd,
          },
        }),
    );
  }

  const persistConversation = async () => {
    const responsePendingAction = persistedPendingAction
      ? mapPendingActionForResponse(persistedPendingAction)
      : null;
    await persistAgentTurn({
      supabase: params.supabase,
      userId: params.userId,
      companionId: companion.id,
      sessionId: params.request.sessionId,
      surface: params.request.surface,
      userMessage: params.request.message,
      assistantReply: agentResult.result.reply,
      inputMode: params.request.inputMode,
      openaiConversationId: agentResult.openaiConversationId,
      lastOpenAIResponseId: agentResult.lastOpenAIResponseId,
      assistantMode: agentResult.result.mode,
      assistantIntent: agentResult.result.intent,
      agentDecision: buildAgentDecisionMetadata(
        agentResult.result,
        agentResult.providerDiagnostics,
      ),
      structuredResponse: agentResult.result.structuredResponse ?? null,
      pendingAction: responsePendingAction,
    });
  };
  const persistenceReady = await persistAgentTurnBestEffort({
    requestId: params.requestId,
    persistConversation,
  });

  console.log("[companion-agent] turn", {
    sessionId: params.request.sessionId,
    userId: params.userId,
    intent: agentResult.result.intent,
    confidence: agentResult.result.confidence,
    mode: agentResult.result.mode,
    understandingState: agentResult.result.understandingState,
    toolsPrepared: preparedActions.size,
    pendingActionId: persistedPendingAction?.id ?? null,
    persistenceReady,
    openaiConversationId: agentResult.openaiConversationId,
    openaiResponseId: agentResult.lastOpenAIResponseId,
    providerDiagnostics: loggableOpenAIProviderDiagnostics(
      agentResult.providerDiagnostics,
    ),
  });

  return {
    companionId: companion.id,
    reply: agentResult.result.reply,
    mode: agentResult.result.mode,
    intent: agentResult.result.intent,
    confidence: agentResult.result.confidence,
    understandingState: agentResult.result.understandingState,
    followUp: agentResult.result.followUp,
    assumptions: agentResult.result.assumptions,
    evidenceIds: agentResult.result.evidenceIds,
    structuredResponse: agentResult.result.structuredResponse ?? null,
    providerDiagnostics: agentResult.providerDiagnostics ?? undefined,
    pendingAction: persistedPendingAction
      ? mapPendingActionForResponse(persistedPendingAction)
      : undefined,
    threadState: {
      threadId: params.request.sessionId,
      sessionId: params.request.sessionId,
      openaiConversationId: agentResult.openaiConversationId ?? null,
      lastOpenAIResponseId: agentResult.lastOpenAIResponseId ?? null,
      hasPendingAction: Boolean(persistedPendingAction?.status === "pending"),
    },
  };
}
