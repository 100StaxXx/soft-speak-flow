import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getCompanionModeConfig, isCompanionModeId } from "../../../src/shared/companionModes.ts";
import { withCompanionChatPersistenceCapability } from "../companion-chat/persistenceCapability.ts";
import {
  type CompanionAgentIntent,
  type CompanionAgentMode,
  type CompanionAgentRequest,
  type LoadedCompanionAgentContext,
  type PendingActionCandidate,
  type PendingActionRow,
  SubmitCompanionResultSchema,
} from "./types.ts";
import { consultPlannerForAgent } from "./plannerBridge.ts";
import {
  loadActivePendingAction,
  loadRecentMessages,
  loadThread,
  persistAgentTurn,
  replacePendingAction,
} from "./persistence.ts";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_CONVERSATIONS_URL = "https://api.openai.com/v1/conversations";

const MAX_TOOL_LOOPS = 6;
const MAX_TASKS = 18;
const MAX_INBOX_TASKS = 8;
const MAX_RITUALS = 10;
const MAX_CAMPAIGNS = 8;
const MAX_CALENDAR_EVENTS = 16;
const MAX_REFLECTIONS = 8;

const PrepareTaskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  task_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scheduled_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  estimated_duration: z.number().int().min(1).max(1440).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  epic_id: z.string().uuid().optional().nullable(),
  priority: z.string().max(40).optional().nullable(),
  reminder_enabled: z.boolean().optional().nullable(),
  reminder_minutes_before: z.number().int().min(0).max(1440).optional().nullable(),
});

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
  reminder_minutes_before: z.number().int().min(0).max(1440).optional().nullable(),
});

const PrepareRitualCreateSchema = z.object({
  title: z.string().min(1).max(200),
  frequency: z.string().min(1).max(50),
  preferred_time: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  estimated_minutes: z.number().int().min(1).max(1440).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(80).optional().nullable(),
  reminder_enabled: z.boolean().optional().nullable(),
  reminder_minutes_before: z.number().int().min(0).max(1440).optional().nullable(),
});

const PrepareReminderCreateSchema = z.object({
  target_type: z.enum(["task", "ritual"]),
  target_id: z.string().uuid(),
  reminder_enabled: z.boolean().default(true),
  reminder_minutes_before: z.number().int().min(0).max(1440).optional().nullable(),
});

const PrepareCampaignUpdateSchema = z.object({
  campaign_id: z.string().uuid(),
  title: z.string().min(1).max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  status: z.string().max(60).optional().nullable(),
  target_days: z.number().int().min(1).max(365).optional().nullable(),
});

const PrepareJournalEntrySchema = z.object({
  note: z.string().min(1).max(4000),
  mood: z.string().max(80).optional().nullable(),
  reflection_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
});

type GuardedFetch = typeof fetch;

interface UserCompanionRow {
  id: string;
  companion_name: string | null;
  spirit_animal: string | null;
  current_stage: number | null;
  current_mood: string | null;
}

interface RunAgentParams {
  guardedFetch: GuardedFetch;
  supabase: any;
  userId: string;
  request: CompanionAgentRequest;
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

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const toDateOnly = (value: string) => value.slice(0, 10);

const addDays = (dateOnly: string, days: number) => {
  const next = new Date(`${dateOnly}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
};

const buildDateRange = (request: CompanionAgentRequest) => {
  const baseDate = toDateOnly(request.currentDateTime);
  const start = request.visibleDateStart ?? baseDate;
  const end = request.visibleDateEnd ?? addDays(start, (request.horizonDays ?? 7) - 1);
  return {
    start,
    end,
    timezone: request.currentDateTime.slice(-6),
  };
};

const maybeSingle = async <T>(promise: Promise<{ data: T | null; error: any }>) => {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
};

const formatDateTimeLabel = (date: string | null | undefined, time: string | null | undefined) => {
  if (!date && !time) return "unscheduled";
  if (date && time) return `${date} at ${time}`;
  return date ?? time ?? "unscheduled";
};

const createPreparedAction = (input: Omit<PendingActionCandidate, "id">): PendingActionCandidate => ({
  id: crypto.randomUUID(),
  ...input,
});

async function loadCompanionId(supabase: any, userId: string) {
  const companion = await maybeSingle<UserCompanionRow>(
    supabase
      .from("user_companion")
      .select("id, companion_name, spirit_animal, current_stage, current_mood")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

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
    !source.includes("companion_mode")
    && !source.includes("companion_mode_adaptation_enabled")
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

async function loadCompanionAgentContext(params: {
  supabase: any;
  userId: string;
  companionId: string;
  sessionId: string;
  request: CompanionAgentRequest;
}) {
  const range = buildDateRange(params.request);

  const [
    thread,
    messages,
    activePendingAction,
    datedTasksResult,
    inboxTasksResult,
    ritualsResult,
    campaignsResult,
    calendarResult,
    aiLearning,
    plannerPreferences,
    aiPreferences,
    companionMemories,
    reflections,
    dailyCheckIns,
  ] = await Promise.all([
    loadThread(params.supabase, params.userId, params.sessionId),
    loadRecentMessages(params.supabase, params.userId, params.sessionId, 20),
    loadActivePendingAction(params.supabase, params.userId, params.sessionId),
    params.supabase
      .from("daily_tasks")
      .select("id, task_text, task_date, scheduled_time, estimated_duration, completed, epic_id, priority, location, notes, reminder_enabled, reminder_minutes_before, recurrence_pattern, recurrence_end_date")
      .eq("user_id", params.userId)
      .gte("task_date", range.start)
      .lte("task_date", range.end)
      .order("task_date", { ascending: true })
      .order("scheduled_time", { ascending: true, nullsFirst: false })
      .limit(MAX_TASKS),
    params.supabase
      .from("daily_tasks")
      .select("id, task_text, task_date, scheduled_time, estimated_duration, completed, epic_id, priority, location, notes, reminder_enabled, reminder_minutes_before, recurrence_pattern, recurrence_end_date")
      .eq("user_id", params.userId)
      .is("task_date", null)
      .order("created_at", { ascending: false })
      .limit(MAX_INBOX_TASKS),
    params.supabase
      .from("habits")
      .select("id, title, frequency, preferred_time, estimated_minutes, description, category, reminder_enabled, reminder_minutes_before")
      .eq("user_id", params.userId)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(MAX_RITUALS),
    params.supabase
      .from("epics")
      .select("id, title, description, start_date, end_date, status, target_days, progress_percentage")
      .eq("user_id", params.userId)
      .is("completed_at", null)
      .order("updated_at", { ascending: false })
      .limit(MAX_CAMPAIGNS),
    params.supabase
      .from("external_calendar_events")
      .select("id, title, start_time, end_time, is_all_day, location, description, source")
      .eq("user_id", params.userId)
      .lt("start_time", `${addDays(range.end, 1)}T00:00:00`)
      .gte("end_time", `${range.start}T00:00:00`)
      .order("start_time", { ascending: true })
      .limit(MAX_CALENDAR_EVENTS),
    params.supabase
      .from("user_ai_learning")
      .select("conversation_profile, common_contexts, peak_productivity_times, preferred_epic_duration, preferred_habit_frequency, preferred_habit_difficulty, successful_patterns")
      .eq("user_id", params.userId)
      .maybeSingle(),
    params.supabase
      .from("daily_planning_preferences")
      .select("preferred_work_blocks, wake_time, wind_down_time")
      .eq("user_id", params.userId)
      .maybeSingle(),
    loadUserAIPreferences(params.supabase, params.userId),
    params.supabase
      .from("companion_memories")
      .select("id, memory_type, memory_date, memory_context, created_at, last_referenced_at")
      .eq("user_id", params.userId)
      .eq("companion_id", params.companionId)
      .order("last_referenced_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(MAX_REFLECTIONS),
    params.supabase
      .from("user_reflections")
      .select("id, mood, note, reflection_date, created_at")
      .eq("user_id", params.userId)
      .order("created_at", { ascending: false })
      .limit(MAX_REFLECTIONS),
    params.supabase
      .from("daily_check_ins")
      .select("id, check_in_type, mood, reflection, intention, completed_at, created_at")
      .eq("user_id", params.userId)
      .order("created_at", { ascending: false })
      .limit(MAX_REFLECTIONS),
  ]);

  const check = (result: { error: any }) => {
    if (result.error) throw result.error;
  };

  [
    datedTasksResult,
    inboxTasksResult,
    ritualsResult,
    campaignsResult,
    calendarResult,
    aiLearning,
    plannerPreferences,
    companionMemories,
    reflections,
    dailyCheckIns,
  ].forEach(check);

  const datedTasks = (datedTasksResult.data ?? []) as Array<Record<string, unknown>>;
  const inboxTasks = (inboxTasksResult.data ?? []) as Array<Record<string, unknown>>;
  const tasks = [...datedTasks, ...inboxTasks];
  const rituals = (ritualsResult.data ?? []) as Array<Record<string, unknown>>;
  const campaigns = (campaignsResult.data ?? []) as Array<Record<string, unknown>>;
  const calendarEvents = (calendarResult.data ?? []) as Array<Record<string, unknown>>;

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
    ? profile?.goals.filter((entry): entry is string => typeof entry === "string")
    : [];
  const campaignGoals = campaigns
    .map((campaign) => campaign.title)
    .filter((entry): entry is string => typeof entry === "string");

  const recentMemory = {
    ai_learning: learningRecord,
    ai_learning_peak_productivity_times: learningRecord?.peak_productivity_times,
    ai_preferences: asRecord(aiPreferences),
    planner_preferences: asRecord(plannerPreferences.data),
    callback_memories: (companionMemories.data ?? []) as Array<Record<string, unknown>>,
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
      String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""))
    )
    .slice(0, MAX_REFLECTIONS);

  const context: LoadedCompanionAgentContext = {
    thread,
    messages,
    tasks,
    rituals,
    campaigns,
    calendarEvents,
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
  };

  return context;
}

function buildInstructions(params: {
  surface: "companion" | "journeys";
  currentDateTime: string;
  companion: UserCompanionRow;
  context: LoadedCompanionAgentContext;
}) {
  const companionName = params.companion.companion_name?.trim() || "Cosmiq";
  const currentMood = params.companion.current_mood?.trim() || "steady";
  const modeConfig = getCompanionModeConfig(params.context.companionMode);

  return [
    `You are ${companionName}, Cosmiq's conversational companion.`,
    "You are conversational first and scheduler second.",
    "Interpret intent before acting. Do not force planning when the user is reflective, exploratory, or emotional.",
    "Your job is to choose whether to converse, clarify, summarize current state, or prepare a confirmable action.",
    "You must never execute writes. You may only use read tools and prepare tools.",
    "If a write is appropriate, prepare exactly one normalized pending action and then call submit_companion_result with mode pending_confirmation.",
    "If detail is missing for a write, ask one concise clarifying question with mode clarify.",
    "If the user wants schedule or task state, use the read tools and summarize only what is actually present.",
    "When consult_planner returns structured_response for Plan My Day or coming-up summaries, pass that structured_response through unchanged in submit_companion_result.",
    "Never invent task, ritual, campaign, reminder, or calendar state.",
    "Never say something is scheduled, saved, moved, updated, logged, or confirmed unless it has already executed. Preparation is not execution.",
    "Keep replies natural, warm, concise, and non-robotic.",
    "External calendar events are read-only in v1. If the user wants to change a calendar event directly, explain the limitation and offer a task-based alternative when appropriate.",
    "If there is already an active pending action, be aware of it and avoid stacking multiple confirms in one reply.",
    "You have access to consult_planner, which reuses Cosmiq's existing planning logic for schedule reads, day or week planning, prioritization, and goal breakdowns. Use it before preparing actions for planning-heavy requests.",
    "Always finish by calling submit_companion_result. Do not end with a plain assistant message.",
    `Surface: ${params.surface}.`,
    `Current local datetime from the app: ${params.currentDateTime}.`,
    `Current visible planning range: ${params.context.visibleDateStart} through ${params.context.visibleDateEnd}.`,
    `Companion state: mood ${currentMood}, stage ${params.companion.current_stage ?? 0}, spirit animal ${params.companion.spirit_animal ?? "unknown"}.`,
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

function buildInitialInput(params: {
  context: LoadedCompanionAgentContext;
  request: CompanionAgentRequest;
  manualHistory: boolean;
}) {
  const latestHistory = params.context.messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  if (!params.manualHistory) {
    return [{ role: "user", content: params.request.message }];
  }

  return [
    ...latestHistory,
    { role: "user", content: params.request.message },
  ];
}

async function createOpenAIConversation(params: {
  guardedFetch: GuardedFetch;
  userId: string;
  sessionId: string;
  surface: "companion" | "journeys";
}) {
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) throw new Error("OPENAI_API_KEY not configured");

  const response = await params.guardedFetch(OPENAI_CONVERSATIONS_URL, {
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

  if (!response.ok) {
    throw new Error(`OpenAI conversation create failed: ${await response.text()}`);
  }

  const body = await response.json() as { id?: string };
  if (!body.id) throw new Error("OpenAI conversation id missing");
  return body.id;
}

async function createOpenAIResponse(params: {
  guardedFetch: GuardedFetch;
  input: Array<Record<string, unknown>>;
  instructions: string;
  conversationId?: string | null;
  previousResponseId?: string | null;
  tools: Array<Record<string, unknown>>;
}) {
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) throw new Error("OPENAI_API_KEY not configured");

  const body: Record<string, unknown> = {
    model: Deno.env.get("OPENAI_COMPANION_AGENT_MODEL")
      ?? Deno.env.get("OPENAI_TEXT_MODEL")
      ?? "gpt-4.1",
    instructions: params.instructions,
    input: params.input,
    tools: params.tools,
    max_output_tokens: 1200,
    max_tool_calls: 20,
    parallel_tool_calls: true,
    store: true,
  };

  if (params.conversationId) {
    body.conversation = params.conversationId;
  } else if (params.previousResponseId) {
    body.previous_response_id = params.previousResponseId;
  }

  const response = await params.guardedFetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI responses call failed: ${errorText}`);
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

function buildToolDefinitions() {
  const functionTool = (
    name: string,
    description: string,
    parameters: Record<string, unknown>,
  ) => ({
    type: "function",
    name,
    description,
    parameters,
  });

  return [
    functionTool("get_current_datetime", "Return the current local datetime, timezone offset, and visible date range.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    functionTool("get_user_profile", "Return the user's current companion state and learned preference summary.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    functionTool("get_user_goals", "Return current goals and active campaign titles.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    functionTool("get_calendar_range", "Return scheduled tasks and calendar events in the visible range or in a requested local date range.", {
      type: "object",
      additionalProperties: false,
      properties: {
        start_date: { type: "string" },
        end_date: { type: "string" },
      },
    }),
    functionTool("get_today_calendar", "Return today's scheduled tasks and calendar events.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    functionTool("list_tasks", "Return tasks, including scheduled tasks and inbox tasks.", {
      type: "object",
      additionalProperties: false,
      properties: {
        include_unscheduled: { type: "boolean" },
      },
    }),
    functionTool("list_rituals", "Return active rituals and habit-style routines.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    functionTool("list_campaigns", "Return active campaigns and goal tracks.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    functionTool("list_reminders", "Return existing reminders on tasks or rituals.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    functionTool("get_recent_conversation_context", "Return the most recent user and assistant turns from this thread.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    functionTool("get_active_pending_action", "Return the currently active pending confirmation, if one exists.", {
      type: "object",
      additionalProperties: false,
      properties: {},
    }),
    functionTool("consult_planner", "Reuse the existing planner logic for schedule reads, day or week planning, prioritization, and goal breakdowns.", {
      type: "object",
      additionalProperties: false,
      properties: {
        horizon: {
          type: "string",
          enum: ["day", "week"],
        },
      },
    }),
    functionTool("prepare_task_create", "Prepare a new task or scheduled plan item. Use this for normal scheduling requests.", {
      type: "object",
      additionalProperties: false,
      required: ["title"],
      properties: {
        title: { type: "string" },
        task_date: { type: "string" },
        scheduled_time: { type: "string" },
        estimated_duration: { type: "number" },
        notes: { type: "string" },
        location: { type: "string" },
        epic_id: { type: "string" },
        priority: { type: "string" },
        reminder_enabled: { type: "boolean" },
        reminder_minutes_before: { type: "number" },
      },
    }),
    functionTool("prepare_task_update", "Prepare an update to an existing task or scheduled plan item.", {
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
    }),
    functionTool("prepare_ritual_create", "Prepare a new ritual or repeating habit.", {
      type: "object",
      additionalProperties: false,
      required: ["title", "frequency"],
      properties: {
        title: { type: "string" },
        frequency: { type: "string" },
        preferred_time: { type: "string" },
        estimated_minutes: { type: "number" },
        description: { type: "string" },
        category: { type: "string" },
        reminder_enabled: { type: "boolean" },
        reminder_minutes_before: { type: "number" },
      },
    }),
    functionTool("prepare_reminder_create", "Prepare a reminder on an existing task or ritual.", {
      type: "object",
      additionalProperties: false,
      required: ["target_type", "target_id"],
      properties: {
        target_type: { type: "string", enum: ["task", "ritual"] },
        target_id: { type: "string" },
        reminder_enabled: { type: "boolean" },
        reminder_minutes_before: { type: "number" },
      },
    }),
    functionTool("prepare_campaign_update", "Prepare an update to an existing campaign or goal track.", {
      type: "object",
      additionalProperties: false,
      required: ["campaign_id"],
      properties: {
        campaign_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        end_date: { type: "string" },
        status: { type: "string" },
        target_days: { type: "number" },
      },
    }),
    functionTool("prepare_journal_entry", "Prepare a journal or reflection entry.", {
      type: "object",
      additionalProperties: false,
      required: ["note"],
      properties: {
        note: { type: "string" },
        mood: { type: "string" },
        reflection_date: { type: "string" },
      },
    }),
    functionTool("submit_companion_result", "Submit the final result for this turn after you have gathered any needed context and optionally prepared one action.", {
      type: "object",
      additionalProperties: false,
      required: ["reply", "mode", "intent", "confidence"],
      properties: {
        reply: { type: "string" },
        mode: {
          type: "string",
          enum: ["conversation", "clarify", "schedule_read", "pending_confirmation", "receipt"],
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
        structured_response: {
          type: "object",
        },
        prepared_action_id: { type: "string" },
      },
    }),
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
    const start = typeof event.start_time === "string" ? event.start_time.slice(0, 10) : "";
    const end = typeof event.end_time === "string" ? event.end_time.slice(0, 10) : start;
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
}) {
  const findTask = (taskId: string) =>
    params.context.tasks.find((task) => task.id === taskId);
  const findCampaign = (campaignId: string) =>
    params.context.campaigns.find((campaign) => campaign.id === campaignId);

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
        const startDate = typeof parsed.start_date === "string" && parsed.start_date
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
            ? params.context.tasks.filter((task) => typeof task.task_date === "string")
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
          surface: params.surface,
          horizon: parsed.horizon === "week" ? "week" : "day",
          context: params.context,
        });

        return {
          mode: plannerResult.mode,
          reply: plannerResult.reply,
          follow_up_questions: plannerResult.questions,
          action_hints: plannerResult.actionHints,
          schedule_insights: plannerResult.scheduleInsights,
          structured_response: plannerResult.structuredResponse,
        };
      }
      case "prepare_task_create": {
        const data = PrepareTaskCreateSchema.parse(parsed);
        const summary = `Add "${data.title}" for ${formatDateTimeLabel(data.task_date ?? null, data.scheduled_time ?? null)}.`;
        const candidate = createPreparedAction({
          actionType: "task_create",
          intent: "schedule_task",
          summary,
          confirmationMessage: `Want me to add "${data.title}" for ${formatDateTimeLabel(data.task_date ?? null, data.scheduled_time ?? null)}?`,
          normalizedPayload: data,
          affectedEntities: data.epic_id ? { epic_id: data.epic_id } : null,
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
        const nextTitle = data.title ?? String(existingTask.task_text ?? "task");
        const nextDate = data.task_date ?? (typeof existingTask.task_date === "string" ? existingTask.task_date : null);
        const nextTime = data.scheduled_time ?? (typeof existingTask.scheduled_time === "string" ? existingTask.scheduled_time : null);
        const summary = `Update "${nextTitle}" to ${formatDateTimeLabel(nextDate, nextTime)}.`;
        const candidate = createPreparedAction({
          actionType: "task_update",
          intent: "update_existing_plan",
          summary,
          confirmationMessage: `Want me to update "${nextTitle}" to ${formatDateTimeLabel(nextDate, nextTime)}?`,
          normalizedPayload: data,
          affectedEntities: { task_id: data.task_id },
        });
        params.preparedActions.set(candidate.id, candidate);
        return { prepared_action_id: candidate.id, ...candidate };
      }
      case "prepare_ritual_create": {
        const data = PrepareRitualCreateSchema.parse(parsed);
        const summary = `Create ritual "${data.title}" with ${data.frequency} frequency.`;
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
      case "prepare_campaign_update": {
        const data = PrepareCampaignUpdateSchema.parse(parsed);
        const existingCampaign = findCampaign(data.campaign_id);
        const summary = `Update campaign "${data.title ?? String(existingCampaign?.title ?? "campaign")}".`;
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
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes("previous_response_id")
    || message.includes("conversation")
    || message.includes("not found")
    || message.includes("invalid");
}

export async function runCompanionAgent(params: RunAgentParams) {
  const companion = await loadCompanionId(params.supabase, params.userId);
  const context = await loadCompanionAgentContext({
    supabase: params.supabase,
    userId: params.userId,
    companionId: companion.id,
    sessionId: params.request.sessionId,
    request: params.request,
  });

  const preparedActions = new Map<string, PendingActionCandidate>();
  const executeTool = buildToolExecutor({
    context,
    preparedActions,
    requestMessage: params.request.message,
    surface: params.request.surface,
  });
  const tools = buildToolDefinitions();
  const instructions = buildInstructions({
    surface: params.request.surface,
    currentDateTime: params.request.currentDateTime,
    companion,
    context,
  });

  const runResponseLoop = async (transport: {
    conversationId?: string | null;
    previousResponseId?: string | null;
    manualHistory: boolean;
  }) => {
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
    });

    let currentConversationId = response.conversation?.id ?? transport.conversationId ?? null;
    let currentPreviousResponseId = response.id;

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop += 1) {
      const functionCalls = getFunctionCalls(response);
      if (functionCalls.length === 0) {
        return {
          result: {
            reply: response.output_text?.trim() || "I’m here.",
            mode: "conversation" as CompanionAgentMode,
            intent: "unknown" as CompanionAgentIntent,
            confidence: 0.25,
            structuredResponse: null,
            preparedActionId: null,
          },
          openaiConversationId: currentConversationId,
          lastOpenAIResponseId: currentPreviousResponseId,
        };
      }

      const finalCall = functionCalls.find((call) => call.name === "submit_companion_result");
      if (finalCall) {
        const payload = SubmitCompanionResultSchema.parse(JSON.parse(finalCall.arguments || "{}"));
        return {
          result: {
            reply: payload.reply.trim(),
            mode: payload.mode,
            intent: payload.intent,
            confidence: payload.confidence,
            structuredResponse: payload.structured_response ?? null,
            preparedActionId: payload.prepared_action_id ?? null,
          },
          openaiConversationId: currentConversationId,
          lastOpenAIResponseId: currentPreviousResponseId,
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
        previousResponseId: currentConversationId ? null : currentPreviousResponseId,
        tools,
      });

      currentConversationId = response.conversation?.id ?? currentConversationId;
      currentPreviousResponseId = response.id;
    }

    throw new Error("Companion agent exceeded tool loop limit");
  };

  let agentResult: Awaited<ReturnType<typeof runResponseLoop>>;
  try {
    if (context.thread?.openai_conversation_id) {
      agentResult = await runResponseLoop({
        conversationId: context.thread.openai_conversation_id,
        manualHistory: false,
      });
    } else if (context.thread?.last_openai_response_id) {
      agentResult = await runResponseLoop({
        previousResponseId: context.thread.last_openai_response_id,
        manualHistory: false,
      });
    } else {
      const conversationId = await createOpenAIConversation({
        guardedFetch: params.guardedFetch,
        userId: params.userId,
        sessionId: params.request.sessionId,
        surface: params.request.surface,
      });
      agentResult = await runResponseLoop({
        conversationId,
        manualHistory: false,
      });
    }
  } catch (error) {
    if (!isLinkageError(error)) {
      throw error;
    }

    console.warn("[companion-agent] linkage fallback", {
      sessionId: params.request.sessionId,
      message: error instanceof Error ? error.message : String(error),
    });

    agentResult = await runResponseLoop({
      manualHistory: true,
    });
  }

  let persistedPendingAction: PendingActionRow | null = context.activePendingAction;
  if (agentResult.result.mode === "pending_confirmation" && agentResult.result.preparedActionId) {
    const candidate = preparedActions.get(agentResult.result.preparedActionId);
    if (candidate) {
      persistedPendingAction = await replacePendingAction({
        supabase: params.supabase,
        userId: params.userId,
        companionId: companion.id,
        sessionId: params.request.sessionId,
        intent: agentResult.result.intent,
        candidate,
        metadata: {
          source: "companion-agent",
          visibleDateStart: context.visibleDateStart,
          visibleDateEnd: context.visibleDateEnd,
        },
      });
    }
  }

  const persistenceReady = await withCompanionChatPersistenceCapability(async () => {
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
    });
  });

  console.log("[companion-agent] turn", {
    sessionId: params.request.sessionId,
    userId: params.userId,
    intent: agentResult.result.intent,
    confidence: agentResult.result.confidence,
    mode: agentResult.result.mode,
    toolsPrepared: preparedActions.size,
    pendingActionId: persistedPendingAction?.id ?? null,
    persistenceReady,
    openaiConversationId: agentResult.openaiConversationId,
    openaiResponseId: agentResult.lastOpenAIResponseId,
  });

  return {
    companionId: companion.id,
    reply: agentResult.result.reply,
    mode: agentResult.result.mode,
    intent: agentResult.result.intent,
    confidence: agentResult.result.confidence,
    structuredResponse: agentResult.result.structuredResponse ?? null,
    pendingAction: persistedPendingAction
      ? {
          id: persistedPendingAction.id,
          status: persistedPendingAction.status,
          intent: persistedPendingAction.intent,
          actionType: persistedPendingAction.action_type,
          summary: persistedPendingAction.summary,
          confirmationMessage: persistedPendingAction.confirmation_message,
          normalizedPayload: persistedPendingAction.normalized_payload,
          affectedEntities: persistedPendingAction.affected_entities,
          expiresAt: persistedPendingAction.expires_at,
          createdAt: persistedPendingAction.created_at,
        }
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
