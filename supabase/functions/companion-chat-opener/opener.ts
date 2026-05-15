import {
  buildCompanionChatThreadPreview,
  buildCompanionChatThreadTitle,
} from "../companion-chat/threadPersistence.ts";
import { ensureThreadRow } from "../companion-agent/persistence.ts";
import {
  resolveCompanionAgentDisplayName,
  resolveCompanionAgentModel,
  type UserCompanionRow,
} from "../companion-agent/agent.ts";
import type { LoadedCompanionAgentContext } from "../companion-agent/types.ts";
import { buildSystemPrompt } from "../companion-planner-chat/orchestrator.ts";
import { getRandomCompanionChatOpeningLine } from "../../../src/shared/companionChatOpeners.ts";

type GuardedFetch = typeof fetch;

const OPENAI_CONVERSATIONS_URL = "https://api.openai.com/v1/conversations";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_OPENER_WORDS = 45;
const MAX_FACTS_PER_SIGNAL = 4;
const UNSAFE_OPENER_TONE_PATTERN =
  /\b(amateur nonsense|clown production|full clown|because of you|underqualified|less embarrassing|shut down half|department of excuses|low-budget improv|train wreck)\b/i;

export type CompanionOpenerSignalType =
  | "missed_task"
  | "low_energy"
  | "busy_day"
  | "streak"
  | "campaign_drift"
  | "open_context";

export interface CompanionOpenerSignal {
  type: CompanionOpenerSignalType;
  facts: string[];
}

export interface CompanionOpenerSnapshot {
  currentDateTime: string;
  timezone: string;
  companion: {
    name: string;
    mood: string;
    stage: number | null;
    spiritAnimal: string | null;
  };
  primarySignal: CompanionOpenerSignal;
  profile: Record<string, unknown> | null;
  goals: string[];
  tasks: Array<Record<string, unknown>>;
  recentCompletedTasks: Array<Record<string, unknown>>;
  rituals: Array<Record<string, unknown>>;
  campaigns: Array<Record<string, unknown>>;
  calendarEvents: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  reflections: Array<Record<string, unknown>>;
  memory: Record<string, unknown>;
}

export interface GeneratedCompanionOpener {
  reply: string;
  speechText: string;
  signal: CompanionOpenerSignal;
  openaiConversationId: string | null;
  lastOpenAIResponseId: string | null;
}

export interface PersistCompanionOpenerTurnParams {
  supabase: any;
  userId: string;
  companionId: string;
  sessionId: string;
  reply: string;
  signal: CompanionOpenerSignal;
  currentDateTime: string;
  createdAt: string;
  openaiConversationId?: string | null;
  lastOpenAIResponseId?: string | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const readString = (
  record: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = record?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
};

const readNumber = (
  record: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

const readBoolean = (
  record: Record<string, unknown> | null | undefined,
  key: string,
) => {
  const value = record?.[key];
  return typeof value === "boolean" ? value : null;
};

const compactRecord = (
  record: Record<string, unknown>,
  keys: string[],
) =>
  keys.reduce<Record<string, unknown>>((acc, key) => {
    if (record[key] !== undefined && record[key] !== null) {
      acc[key] = record[key];
    }
    return acc;
  }, {});

const toDateOnly = (value: string) => value.slice(0, 10);

const toLocalTime = (value: string) => {
  const match = value.match(/T(\d{2}:\d{2})/);
  return match?.[1] ?? null;
};

const titleOf = (record: Record<string, unknown>) =>
  readString(record, "task_text") ??
    readString(record, "title") ??
    readString(record, "summary") ??
    "Untitled";

const hasLowEnergyLanguage = (value: string | null) =>
  Boolean(
    value &&
      /\b(low energy|tired|exhausted|drained|overwhelmed|anxious|stressed|burned out|burnt out|foggy|heavy)\b/i
        .test(value),
  );

const daysUntil = (dateKey: string | null, currentDateKey: string) => {
  if (!dateKey) return null;
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  const current = new Date(`${currentDateKey}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || Number.isNaN(current.getTime())) {
    return null;
  }
  return Math.round((date.getTime() - current.getTime()) / 86_400_000);
};

const buildSignal = (
  type: CompanionOpenerSignalType,
  facts: string[],
): CompanionOpenerSignal => ({
  type,
  facts: facts.filter(Boolean).slice(0, MAX_FACTS_PER_SIGNAL),
});

export function selectCompanionOpenerSignal(params: {
  context: LoadedCompanionAgentContext;
  currentDateTime: string;
}): CompanionOpenerSignal {
  const currentDate = toDateOnly(params.currentDateTime);
  const currentTime = toLocalTime(params.currentDateTime);
  const tasks = params.context.tasks.map(asRecord).filter(
    (task): task is Record<string, unknown> => task !== null,
  );
  const calendarEvents = params.context.calendarEvents.map(asRecord).filter(
    (event): event is Record<string, unknown> => event !== null,
  );
  const rituals = params.context.rituals.map(asRecord).filter(
    (ritual): ritual is Record<string, unknown> => ritual !== null,
  );
  const campaigns = params.context.campaigns.map(asRecord).filter(
    (campaign): campaign is Record<string, unknown> => campaign !== null,
  );
  const reflections = params.context.reflections.map(asRecord).filter(
    (reflection): reflection is Record<string, unknown> => reflection !== null,
  );
  const profile = asRecord(params.context.recentMemory.profile);

  const todayTasks = tasks.filter((task) =>
    readString(task, "task_date") === currentDate
  );
  const missedTasks = todayTasks.filter((task) => {
    if (readBoolean(task, "completed") === true) return false;
    const scheduledTime = readString(task, "scheduled_time");
    return Boolean(scheduledTime && currentTime && scheduledTime < currentTime);
  });

  if (missedTasks.length > 0) {
    return buildSignal("missed_task", [
      `${missedTasks.length} earlier task${
        missedTasks.length === 1 ? "" : "s"
      } still open`,
      `First missed task: ${titleOf(missedTasks[0])}`,
    ]);
  }

  const lowEnergyReflection = reflections.find((reflection) =>
    hasLowEnergyLanguage(readString(reflection, "mood")) ||
    hasLowEnergyLanguage(readString(reflection, "reflection")) ||
    hasLowEnergyLanguage(readString(reflection, "intention")) ||
    hasLowEnergyLanguage(readString(reflection, "note"))
  );
  if (lowEnergyReflection) {
    return buildSignal("low_energy", [
      `Recent check-in/reflection suggests low energy: ${
        readString(lowEnergyReflection, "mood") ??
          readString(lowEnergyReflection, "reflection") ??
          readString(lowEnergyReflection, "note") ??
          "low energy"
      }`,
    ]);
  }

  const todayEvents = calendarEvents.filter((event) => {
    const start = readString(event, "start_time") ?? readString(event, "start");
    return Boolean(start?.startsWith(currentDate));
  });
  const openTodayTasks = todayTasks.filter((task) =>
    readBoolean(task, "completed") !== true
  );
  const estimatedMinutes = openTodayTasks.reduce((total, task) => {
    const estimated = readNumber(task, "estimated_duration");
    return total + (estimated ?? 0);
  }, 0);
  if (
    openTodayTasks.length + todayEvents.length >= 4 || estimatedMinutes >= 240
  ) {
    return buildSignal("busy_day", [
      `${openTodayTasks.length} open task${
        openTodayTasks.length === 1 ? "" : "s"
      } today`,
      `${todayEvents.length} calendar event${
        todayEvents.length === 1 ? "" : "s"
      } today`,
      estimatedMinutes > 0 ? `${estimatedMinutes} estimated task minutes` : "",
    ]);
  }

  const profileStreak = readNumber(profile, "current_habit_streak") ?? 0;
  const strongestRitual = rituals
    .map((ritual) => ({
      title: titleOf(ritual),
      streak: readNumber(ritual, "current_streak") ?? 0,
    }))
    .sort((left, right) => right.streak - left.streak)[0];
  const strongestStreak = Math.max(profileStreak, strongestRitual?.streak ?? 0);
  if (strongestStreak >= 3) {
    return buildSignal("streak", [
      profileStreak >= strongestStreak
        ? `${profileStreak}-day habit streak`
        : `${strongestRitual?.title ?? "A ritual"} has a ${
          strongestRitual?.streak ?? strongestStreak
        }-day streak`,
    ]);
  }

  const driftingCampaign = campaigns.find((campaign) => {
    const progress = readNumber(campaign, "progress_percentage");
    const remaining = daysUntil(readString(campaign, "end_date"), currentDate);
    return (progress !== null && progress < 35) ||
      (remaining !== null && remaining >= 0 && remaining <= 7);
  });
  if (driftingCampaign) {
    const progress = readNumber(driftingCampaign, "progress_percentage");
    const remaining = daysUntil(
      readString(driftingCampaign, "end_date"),
      currentDate,
    );
    return buildSignal("campaign_drift", [
      `Campaign: ${titleOf(driftingCampaign)}`,
      progress !== null ? `${progress}% progress` : "",
      remaining !== null && remaining >= 0
        ? `${remaining} day${remaining === 1 ? "" : "s"} left`
        : "",
    ]);
  }

  return buildSignal("open_context", [
    params.context.goals[0] ? `Current goal: ${params.context.goals[0]}` : "",
    openTodayTasks[0]
      ? `Available next task: ${titleOf(openTodayTasks[0])}`
      : "",
  ]);
}

export function buildCompanionOpenerSnapshot(params: {
  companion: UserCompanionRow;
  context: LoadedCompanionAgentContext;
  currentDateTime: string;
}): CompanionOpenerSnapshot {
  const profile = asRecord(params.context.recentMemory.profile);
  return {
    currentDateTime: params.currentDateTime,
    timezone: params.context.timezone,
    companion: {
      name: resolveCompanionAgentDisplayName(params.companion),
      mood: params.companion.current_mood?.trim() || "steady",
      stage: params.companion.current_stage,
      spiritAnimal: params.companion.spirit_animal,
    },
    primarySignal: selectCompanionOpenerSignal({
      context: params.context,
      currentDateTime: params.currentDateTime,
    }),
    profile,
    goals: params.context.goals.slice(0, 8),
    tasks: params.context.tasks.slice(0, 12).map((task) =>
      compactRecord(task, [
        "id",
        "task_text",
        "task_date",
        "scheduled_time",
        "estimated_duration",
        "completed",
        "priority",
        "category",
      ])
    ),
    recentCompletedTasks: params.context.recentCompletedTasks.slice(0, 8).map((
      task,
    ) =>
      compactRecord(task, [
        "id",
        "task_text",
        "completed_at",
        "actual_duration_minutes",
        "category",
      ])
    ),
    rituals: params.context.rituals.slice(0, 8).map((ritual) =>
      compactRecord(ritual, [
        "id",
        "title",
        "frequency",
        "preferred_time",
        "estimated_minutes",
        "current_streak",
        "longest_streak",
      ])
    ),
    campaigns: params.context.campaigns.slice(0, 6).map((campaign) =>
      compactRecord(campaign, [
        "id",
        "title",
        "description",
        "status",
        "end_date",
        "target_days",
        "progress_percentage",
      ])
    ),
    calendarEvents: params.context.calendarEvents.slice(0, 10).map((event) =>
      compactRecord(event, [
        "id",
        "title",
        "start_time",
        "end_time",
        "is_all_day",
        "source",
      ])
    ),
    reminders: params.context.reminders.slice(0, 8),
    reflections: params.context.reflections.slice(0, 6).map((reflection) =>
      compactRecord(reflection, [
        "id",
        "mood",
        "reflection",
        "intention",
        "note",
        "created_at",
      ])
    ),
    memory: {
      ai_learning_peak_productivity_times:
        params.context.recentMemory.ai_learning_peak_productivity_times,
      ai_preferences: params.context.recentMemory.ai_preferences,
      planner_preferences: params.context.recentMemory.planner_preferences,
      callback_memories:
        Array.isArray(params.context.recentMemory.callback_memories)
          ? params.context.recentMemory.callback_memories.slice(0, 4)
          : [],
    },
  };
}

export function buildCompanionOpenerInstructions(
  _snapshot: CompanionOpenerSnapshot,
) {
  return buildSystemPrompt("conversational", "soft");
}

export function hasUnsafeCompanionOpenerTone(value: string): boolean {
  return UNSAFE_OPENER_TONE_PATTERN.test(value);
}

export function normalizeCompanionOpenerReply(
  value: string | null | undefined,
  options: { fallbackReply?: string } = {},
): string {
  const raw = (value ?? "").trim();
  const fallbackReply = options.fallbackReply?.trim() ||
    getRandomCompanionChatOpeningLine();
  const parsedPlannerReply = parsePlannerStyleReply(raw);
  const stripped = (parsedPlannerReply ?? raw)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#>`[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();

  const source = stripped && !hasUnsafeCompanionOpenerTone(stripped)
    ? stripped
    : fallbackReply;
  const words = source.split(/\s+/);
  return words.length <= MAX_OPENER_WORDS
    ? source
    : `${
      words.slice(0, MAX_OPENER_WORDS).join(" ").replace(/[,.!?;:]*$/, "")
    }.`;
}

const parsePlannerStyleReply = (value: string): string | null => {
  const trimmed = value.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as { reply?: unknown };
    return typeof parsed.reply === "string" && parsed.reply.trim()
      ? parsed.reply.trim()
      : null;
  } catch {
    return null;
  }
};

export const buildCompanionOpenerUserPrompt = (
  snapshot: CompanionOpenerSnapshot,
) =>
  JSON.stringify({
    targetMode: "conversational",
    tonePack: "soft",
    latestUserMessage:
      "Open this new companion chat with one short, natural first message.",
    currentDate: snapshot.currentDateTime.slice(0, 10),
    currentDateTime: snapshot.currentDateTime,
    conversationHistory: [],
    deterministicContext: {
      fallbackReply: buildFallbackCompanionOpener(snapshot).reply,
      availabilityFacts: null,
      planDayContext: null,
      followUpQuestions: [],
      starterIntent: "companion_chat_opener",
      briefingContext: null,
      priorityScores: [],
      proposals: [],
      scheduleSummary: snapshot.primarySignal.facts.join(" | ") || null,
      tasks: snapshot.tasks.slice(0, 8).map((task) => ({
        title: titleOf(task),
        taskDate: readString(task, "task_date"),
        scheduledTime: readString(task, "scheduled_time"),
        completed: readBoolean(task, "completed") ?? false,
        epicTitle: readString(task, "epic_title"),
      })),
      inboxTasks: [],
      calendarEvents: snapshot.calendarEvents.slice(0, 8).map((event) => ({
        title: titleOf(event),
        start: readString(event, "start_time") ?? readString(event, "start"),
        end: readString(event, "end_time") ?? readString(event, "end"),
        isAllDay: readBoolean(event, "is_all_day") ?? false,
        provider: readString(event, "source"),
      })),
      activeEpics: snapshot.campaigns.slice(0, 6).map((campaign) => ({
        title: titleOf(campaign),
        endDate: readString(campaign, "end_date"),
      })),
      validCampaignTitles: snapshot.campaigns
        .map((campaign) => titleOf(campaign))
        .filter((title) => title !== "Untitled"),
      plannerMemory: asRecord(snapshot.memory.planner_preferences),
      openerContext: {
        companionName: snapshot.companion.name,
        companionMood: snapshot.companion.mood,
        primarySignal: snapshot.primarySignal,
        goals: snapshot.goals,
        recentCompletedTasks: snapshot.recentCompletedTasks,
        rituals: snapshot.rituals,
        reflections: snapshot.reflections,
      },
    },
  });

export function buildFallbackCompanionOpener(
  snapshot: CompanionOpenerSnapshot,
  options: { openingLine?: string } = {},
): GeneratedCompanionOpener {
  const firstFact = snapshot.primarySignal.facts[0] ?? null;
  const openingLine = options.openingLine?.trim() ||
    getRandomCompanionChatOpeningLine();
  const reply = normalizeCompanionOpenerReply(
    snapshot.primarySignal.type === "missed_task"
      ? `Looks like ${
        firstFact ?? "one earlier task is still open"
      }. Want to reset with the smallest next move?`
      : snapshot.primarySignal.type === "low_energy"
      ? "Your recent energy looks a little heavy, so let's keep this gentle. What's one small thing we can make easier right now?"
      : snapshot.primarySignal.type === "busy_day"
      ? "Today has a lot of moving pieces. Let's pick the one thing that makes the rest less loud."
      : snapshot.primarySignal.type === "streak"
      ? `That ${
        firstFact ?? "streak"
      } has real momentum. Want to protect it with one simple next move?`
      : snapshot.primarySignal.type === "campaign_drift"
      ? "This campaign could use a clean little push. Want to choose the next move before it gets fuzzy?"
      : openingLine,
    { fallbackReply: openingLine },
  );

  return {
    reply,
    speechText: reply,
    signal: snapshot.primarySignal,
    openaiConversationId: null,
    lastOpenAIResponseId: null,
  };
}

const extractTextFromOpenAIResponse = (response: Record<string, unknown>) => {
  const direct = typeof response.output_text === "string"
    ? response.output_text.trim()
    : "";
  if (direct) return direct;

  const output = Array.isArray(response.output) ? response.output : [];
  const textParts = output.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const content = Array.isArray(record.content) ? record.content : [];
    return content.map((part) => {
      const partRecord = asRecord(part);
      if (!partRecord) return "";
      return typeof partRecord.text === "string"
        ? partRecord.text
        : typeof partRecord.output_text === "string"
        ? partRecord.output_text
        : "";
    });
  });

  return textParts.map((text) => text.trim()).filter(Boolean).join("\n").trim();
};

async function createOpenAIConversation(params: {
  guardedFetch: GuardedFetch;
  openAIApiKey: string;
  userId: string;
  companionId: string;
  sessionId: string;
}) {
  const response = await params.guardedFetch(OPENAI_CONVERSATIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      metadata: {
        scope: "cosmiq_companion_opener",
        user_id: params.userId,
        companion_id: params.companionId,
        session_id: params.sessionId,
        surface: "companion",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI conversation create failed: ${await response.text()}`,
    );
  }

  const body = await response.json() as { id?: string };
  if (!body.id) throw new Error("OpenAI conversation id missing");
  return body.id;
}

export async function generateCompanionOpener(params: {
  guardedFetch: GuardedFetch;
  openAIApiKey: string;
  model?: string;
  userId: string;
  companionId: string;
  sessionId: string;
  snapshot: CompanionOpenerSnapshot;
}): Promise<GeneratedCompanionOpener> {
  const conversationId = await createOpenAIConversation({
    guardedFetch: params.guardedFetch,
    openAIApiKey: params.openAIApiKey,
    userId: params.userId,
    companionId: params.companionId,
    sessionId: params.sessionId,
  });
  const model = params.model ??
    Deno.env.get("OPENAI_COMPANION_OPENER_MODEL") ??
    resolveCompanionAgentModel();
  const response = await params.guardedFetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: buildCompanionOpenerInstructions(params.snapshot),
      input: [
        {
          role: "user",
          content: buildCompanionOpenerUserPrompt(params.snapshot),
        },
      ],
      max_output_tokens: 160,
      store: true,
      conversation: conversationId,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI opener response failed: ${await response.text()}`);
  }

  const body = await response.json() as Record<string, unknown>;
  const reply = normalizeCompanionOpenerReply(
    extractTextFromOpenAIResponse(body),
  );
  return {
    reply,
    speechText: reply,
    signal: params.snapshot.primarySignal,
    openaiConversationId: conversationId,
    lastOpenAIResponseId: typeof body.id === "string" ? body.id : null,
  };
}

export async function archiveActiveCompanionThreads(params: {
  supabase: any;
  userId: string;
  companionId: string;
  surface: "companion";
  archivedAt: string;
  exceptSessionId?: string | null;
}) {
  let query = params.supabase
    .from("companion_chat_threads")
    .update({ archived_at: params.archivedAt })
    .eq("user_id", params.userId)
    .eq("companion_id", params.companionId)
    .eq("surface", params.surface);

  if (params.exceptSessionId) {
    query = query.neq("session_id", params.exceptSessionId);
  }

  const { error } = await query.is("archived_at", null);

  if (error) throw error;
}

async function insertCompanionOpenerMessage(
  params: PersistCompanionOpenerTurnParams,
) {
  const { error } = await params.supabase
    .from("companion_chats")
    .insert({
      user_id: params.userId,
      companion_id: params.companionId,
      role: "assistant",
      content: params.reply,
      input_mode: null,
      session_id: params.sessionId,
      surface: "companion",
      source: "agent",
      created_at: params.createdAt,
      metadata: {
        source: "opener",
        signal: params.signal.type,
        signalFacts: params.signal.facts,
        currentDateTime: params.currentDateTime,
        mode: "conversation",
        intent: "unknown",
        opener: {
          signal: params.signal.type,
          facts: params.signal.facts,
          currentDateTime: params.currentDateTime,
        },
        agentDecision: {
          understandingState: "enough_to_discuss",
          followUp: null,
          proposedActions: [],
          assumptions: [],
          evidenceIds: [],
        },
      },
    });

  if (error) throw error;
}

async function ensureCompanionOpenerThread(
  params: PersistCompanionOpenerTurnParams,
) {
  await ensureThreadRow({
    supabase: params.supabase,
    userId: params.userId,
    companionId: params.companionId,
    sessionId: params.sessionId,
    surface: "companion",
    firstUserMessage: params.reply,
    previewText: buildCompanionChatThreadPreview(params.reply),
    lastMessageAt: params.createdAt,
    openaiConversationId: params.openaiConversationId ?? null,
    lastOpenAIResponseId: params.lastOpenAIResponseId ?? null,
  });
}

export async function persistCompanionOpenerTurn(
  params: PersistCompanionOpenerTurnParams,
) {
  await insertCompanionOpenerMessage(params);
  await ensureCompanionOpenerThread(params);

  await archiveActiveCompanionThreads({
    supabase: params.supabase,
    userId: params.userId,
    companionId: params.companionId,
    surface: "companion",
    archivedAt: params.createdAt,
    exceptSessionId: params.sessionId,
  });
}

export async function persistCompanionOpenerTurnBestEffort(
  params: PersistCompanionOpenerTurnParams & { requestId?: string | null },
) {
  try {
    await insertCompanionOpenerMessage(params);
    await ensureCompanionOpenerThread(params);
  } catch (error) {
    console.warn("[companion-chat-opener] persistence failed", {
      requestId: params.requestId ?? null,
      sessionId: params.sessionId,
      error,
    });
    return false;
  }

  try {
    await archiveActiveCompanionThreads({
      supabase: params.supabase,
      userId: params.userId,
      companionId: params.companionId,
      surface: "companion",
      archivedAt: params.createdAt,
      exceptSessionId: params.sessionId,
    });
  } catch (error) {
    console.warn("[companion-chat-opener] archive cleanup failed", {
      requestId: params.requestId ?? null,
      sessionId: params.sessionId,
      error,
    });
  }

  return true;
}

export function buildCompanionOpenerThreadSummary(params: {
  companionId: string;
  sessionId: string;
  reply: string;
  createdAt: string;
}) {
  return {
    sessionId: params.sessionId,
    companionId: params.companionId,
    surface: "companion" as const,
    title: buildCompanionChatThreadTitle(params.reply),
    previewText: buildCompanionChatThreadPreview(params.reply),
    createdAt: params.createdAt,
    lastMessageAt: params.createdAt,
    archivedAt: null,
    messageCount: 1,
  };
}
