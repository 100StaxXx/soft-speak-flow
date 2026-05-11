import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSafeErrorResponse, requireProtectedRequest } from "../_shared/abuseProtection.ts";
import {
  buildCostGuardrailBlockedResponse,
  createCostGuardrailSession,
  createCostGuardrailSupabaseClient,
  isCostGuardrailBlockedError,
} from "../_shared/costGuardrails.ts";
import {
  normalizeCompanionChatSurface,
  surfaceRequiresPremiumAccess,
} from "./surfaceAccess.ts";
import { withCompanionChatPersistenceCapability } from "./persistenceCapability.ts";
import { persistCompanionChatTurn } from "./threadPersistence.ts";
import { shouldHandoffToPlanner } from "./handoff.ts";
import {
  buildCompanionChatCompletionBody,
  resolveCompanionChatModel,
  type CompanionChatSurface,
} from "./requestBody.ts";
import {
  buildAssistantEventScheduleLabel,
  buildAssistantTaskScheduleLabel,
  classifyEventTemporalStatus,
  classifyTaskTemporalStatus,
  formatAssistantTime,
  normalizeAssistantTimeText,
} from "../_shared/assistantScheduleCopy.ts";
import {
  buildAccessStateResponse,
  fetchAccountEntitlementForUser,
} from "../_shared/accountEntitlements.ts";

const JourneysTaskSchema = z.object({
  title: z.string(),
  taskDate: z.string().nullable(),
  scheduledTime: z.string().nullable(),
  estimatedDuration: z.number().nullable().optional(),
  completed: z.boolean().nullable().optional(),
  epicTitle: z.string().nullable().optional(),
});

const JourneysCalendarEventSchema = z.object({
  title: z.string(),
  start: z.string(),
  end: z.string(),
  isAllDay: z.boolean(),
  provider: z.string(),
});

const JourneysEpicSchema = z.object({
  title: z.string(),
  endDate: z.string().nullable(),
});

const JourneysScheduleInsightsSchema = z.object({
  horizon: z.enum(["day", "week", "month"]),
  selectedDate: z.string(),
  summary: z.string(),
  dayLoads: z.array(z.object({
    date: z.string(),
    totalMinutes: z.number(),
    taskCount: z.number(),
    status: z.enum(["open", "balanced", "busy", "overloaded"]),
  })).default([]),
  suggestedSlots: z.array(z.object({
    date: z.string(),
    time: z.string(),
    endTime: z.string(),
    reason: z.string(),
  })).default([]),
  moveSuggestions: z.array(z.object({
    fromDate: z.string(),
    toDate: z.string(),
    taskTitle: z.string().nullable().optional(),
    suggestedTime: z.string().nullable().optional(),
    reason: z.string(),
  })).default([]),
}).optional();

const JourneysContextSchema = z.object({
  tasks: z.array(JourneysTaskSchema).default([]),
  inboxTasks: z.array(JourneysTaskSchema).default([]),
  activeEpics: z.array(JourneysEpicSchema).default([]),
  calendarEvents: z.array(JourneysCalendarEventSchema).default([]),
  scheduleInsights: JourneysScheduleInsightsSchema,
  plannerMemory: z.object({
    preferredTimeOfDay: z.string().nullable().optional(),
    preferredTimeReason: z.string().nullable().optional(),
    wakeTime: z.string().nullable().optional(),
    windDownTime: z.string().nullable().optional(),
  }).optional(),
}).optional();

const RequestSchema = z.object({
  message: z.string().min(1).max(4000).trim(),
  conversationHistory: z.array(z.object({
    role: z.enum(["assistant", "user"]),
    content: z.string().min(1).max(4000),
  })).max(24).default([]),
  companionId: z.string().uuid(),
  inputMode: z.enum(["text", "voice"]),
  surface: z.enum(["companion", "journeys"]).optional().default("companion"),
  sessionId: z.string().min(1).max(200).optional(),
  currentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currentDateTime: z.string().datetime({ offset: true }).optional(),
  journeysContext: JourneysContextSchema,
});

type JsonObject = Record<string, unknown>;
type JourneysContext = z.infer<typeof JourneysContextSchema>;

interface ConversationProfile {
  preferences: string[];
  goals: string[];
  interests: string[];
  selfDescription: string[];
  conversationStyle: string[];
  lastUpdatedAt: string | null;
}

interface MemoryExtractionResult {
  preferences: string[];
  goals: string[];
  interests: string[];
  selfDescription: string[];
  conversationStyle: string[];
  memorableMoment: string | null;
  shouldRemember: boolean;
}

const DEFAULT_PROFILE: ConversationProfile = {
  preferences: [],
  goals: [],
  interests: [],
  selfDescription: [],
  conversationStyle: [],
  lastUpdatedAt: null,
};

const DAILY_CHAT_LIMIT = Number(Deno.env.get("COMPANION_CHAT_DAILY_TURN_LIMIT") ?? "40");

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];

const normalizeProfile = (value: unknown): ConversationProfile => {
  const source = asObject(value);
  return {
    preferences: asStringArray(source.preferences).slice(0, 8),
    goals: asStringArray(source.goals).slice(0, 8),
    interests: asStringArray(source.interests).slice(0, 8),
    selfDescription: asStringArray(source.selfDescription).slice(0, 8),
    conversationStyle: asStringArray(source.conversationStyle).slice(0, 8),
    lastUpdatedAt: typeof source.lastUpdatedAt === "string" ? source.lastUpdatedAt : null,
  };
};

const mergeStringLists = (existing: string[], next: string[]) => {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const item of [...existing, ...next]) {
    const normalized = item.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(normalized);
  }

  return merged.slice(0, 8);
};

const mergeConversationProfile = (
  existing: ConversationProfile,
  updates: MemoryExtractionResult,
): ConversationProfile => ({
  preferences: mergeStringLists(existing.preferences, updates.preferences),
  goals: mergeStringLists(existing.goals, updates.goals),
  interests: mergeStringLists(existing.interests, updates.interests),
  selfDescription: mergeStringLists(existing.selfDescription, updates.selfDescription),
  conversationStyle: mergeStringLists(existing.conversationStyle, updates.conversationStyle),
  lastUpdatedAt: new Date().toISOString(),
});

const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
};

const shouldExtractConversationMemory = (message: string) =>
  /remember this|don't forget|important to me|i like|i love|i prefer|my goal|i want to|i am|i'm|my favorite/i.test(
    message.toLowerCase(),
  ) || message.trim().split(/\s+/).length >= 20;

const chooseBridgeReply = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("campaign") || normalized.includes("ritual")) {
    return "I can help with that best in Plan, where I can turn it into a confirmable campaign or ritual instead of guessing. Let’s switch there together.";
  }

  return "That sounds like planning work. I’m switching us to Plan so I can shape it into confirmable changes without saving anything automatically.";
};

async function ensurePremiumAccess(supabase: any, userId: string) {
  const entitlement = await fetchAccountEntitlementForUser(supabase, userId);
  if (buildAccessStateResponse(entitlement).has_access) {
    return true;
  }

  const nowIso = new Date().toISOString();
  const { count, error } = await supabase
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .gte("current_period_end", nowIso);

  if (error) throw error;
  return (count ?? 0) > 0;
}

async function enforceDailyTurnCap(supabase: any, userId: string) {
  const { count, error } = await supabase
    .from("companion_chats")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", startOfTodayUtc());

  if (error) throw error;
  return (count ?? 0) < DAILY_CHAT_LIMIT;
}

async function fetchEnrichedContext(req: Request): Promise<JsonObject | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const authHeader = req.headers.get("Authorization");
  if (!supabaseUrl || !authHeader) return null;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/enrich-user-context`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return asObject(data);
  } catch (error) {
    console.warn("[companion-chat] enrich-user-context fallback failed", error);
    return null;
  }
}

async function fetchConversationContext(
  req: Request,
  supabase: any,
  userId: string,
  companionId: string,
) {
  const [
    { data: companionRow, error: companionError },
    { data: learningRow, error: learningError },
    { data: memories, error: memoriesError },
    { data: voiceTemplate, error: voiceTemplateError },
    enrichedContext,
  ] = await Promise.all([
    supabase
      .from("user_companion")
      .select("id, spirit_animal, current_stage, current_mood, bond_level, total_interactions, last_interaction_at, care_consistency, care_responsiveness, care_balance, care_intent, care_recovery")
      .eq("id", companionId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("user_ai_learning")
      .select("conversation_profile, last_companion_chat_at, preferred_epic_duration, preferred_habit_difficulty, preferred_habit_frequency, common_contexts, peak_productivity_times, preference_weights, successful_patterns, failed_patterns")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("companion_memories")
      .select("memory_type, memory_date, memory_context, referenced_count")
      .eq("user_id", userId)
      .eq("companion_id", companionId)
      .order("memory_date", { ascending: false })
      .limit(6),
    supabase
      .from("companion_voice_templates")
      .select("voice_style, personality_traits, encouragement_templates")
      .eq("species", "universal")
      .maybeSingle(),
    fetchEnrichedContext(req),
  ]);

  if (companionError) throw companionError;
  if (learningError) throw learningError;
  if (memoriesError) throw memoriesError;
  if (voiceTemplateError) throw voiceTemplateError;

  return {
    companion: companionRow,
    learning: learningRow,
    memories: Array.isArray(memories) ? memories : [],
    voiceTemplate,
    enrichedContext,
  };
}

const buildJourneysContextSnapshot = (
  journeysContext: JourneysContext | undefined,
  currentDate?: string,
  currentDateTime?: string,
) => {
  if (!journeysContext) return null;

  return JSON.stringify({
    currentDate: currentDate ?? null,
    currentDateTime: currentDateTime ?? null,
    scheduleSummary: journeysContext.scheduleInsights?.summary
      ? normalizeAssistantTimeText(journeysContext.scheduleInsights.summary)
      : null,
    selectedDate: journeysContext.scheduleInsights?.selectedDate ?? null,
    tasks: journeysContext.tasks.slice(0, 12).map((task) => ({
      title: task.title,
      taskDate: task.taskDate,
      displayTime: formatAssistantTime(task.scheduledTime),
      temporalStatus: classifyTaskTemporalStatus({
        taskDate: task.taskDate,
        scheduledTime: task.scheduledTime,
        estimatedDuration: task.estimatedDuration,
        currentDate,
        currentDateTime,
      }),
      scheduleLabel: buildAssistantTaskScheduleLabel({
        title: task.title,
        taskDate: task.taskDate,
        scheduledTime: task.scheduledTime,
        estimatedDuration: task.estimatedDuration,
        currentDate,
        currentDateTime,
      }),
      completed: task.completed ?? false,
      epicTitle: task.epicTitle ?? null,
    })),
    inboxTasks: journeysContext.inboxTasks.slice(0, 8).map((task) => ({
      title: task.title,
      taskDate: task.taskDate,
      displayTime: formatAssistantTime(task.scheduledTime),
      temporalStatus: classifyTaskTemporalStatus({
        taskDate: task.taskDate,
        scheduledTime: task.scheduledTime,
        estimatedDuration: task.estimatedDuration,
        currentDate,
        currentDateTime,
      }),
      scheduleLabel: buildAssistantTaskScheduleLabel({
        title: task.title,
        taskDate: task.taskDate,
        scheduledTime: task.scheduledTime,
        estimatedDuration: task.estimatedDuration,
        currentDate,
        currentDateTime,
      }),
    })),
    calendarEvents: journeysContext.calendarEvents.slice(0, 10).map((event) => ({
      title: event.title,
      temporalStatus: classifyEventTemporalStatus({
        start: event.start,
        end: event.end,
        currentDate,
        currentDateTime,
      }),
      scheduleLabel: buildAssistantEventScheduleLabel({
        title: event.title,
        start: event.start,
        end: event.end,
        isAllDay: event.isAllDay,
        currentDate,
        currentDateTime,
      }),
      isAllDay: event.isAllDay,
      provider: event.provider,
    })),
    activeEpics: journeysContext.activeEpics.slice(0, 8).map((epic) => ({
      title: epic.title,
      endDate: epic.endDate,
    })),
    plannerMemory: journeysContext.plannerMemory ?? null,
  }).slice(0, 2400);
};

const buildSystemPrompt = (context: {
  companion: any;
  learning: any;
  memories: any[];
  voiceTemplate: any;
  enrichedContext: JsonObject | null;
  surface: "companion" | "journeys";
  currentDate?: string;
  currentDateTime?: string;
  journeysContext?: JourneysContext;
}) => {
  const isJourneysSurface = context.surface === "journeys";
  const voiceStyle = isJourneysSurface
    ? "Calm, direct, low-drama companion. Plainspoken, concise, grounded, and helpful."
    : typeof context.voiceTemplate?.voice_style === "string"
    ? context.voiceTemplate.voice_style
    : "Original gritty chaos sidekick. Deep-voiced, streetwise shoulder commentator. Fast-talking, irreverent, dryly funny, fearless, secretly loyal, and always pushing the human toward action.";
  const traits = asStringArray(context.voiceTemplate?.personality_traits).join(", ");
  const memories = context.memories
    .map((memory) => {
      const memoryContext = asObject(memory.memory_context);
      const title = typeof memoryContext.title === "string" ? memoryContext.title : memory.memory_type;
      const description = typeof memoryContext.description === "string" ? memoryContext.description : "";
      return `${memory.memory_date}: ${title}${description ? ` - ${description}` : ""}`;
    })
    .join("\n");
  const profile = normalizeProfile(context.learning?.conversation_profile);
  const journeysSnapshot = buildJourneysContextSnapshot(
    context.journeysContext,
    context.currentDate,
    context.currentDateTime,
  );

  return [
    "You are the user's premium Cosmiq companion.",
    `Voice style: ${voiceStyle}.`,
    traits ? `Personality traits: ${traits}.` : "",
    context.companion
      ? `Current stage: ${context.companion.current_stage}. Mood: ${context.companion.current_mood ?? "steady"}. Bond level: ${context.companion.bond_level ?? 0}.`
      : "",
    profile.preferences.length ? `Known preferences: ${profile.preferences.join(", ")}.` : "",
    profile.goals.length ? `Known goals: ${profile.goals.join(", ")}.` : "",
    profile.interests.length ? `Known interests: ${profile.interests.join(", ")}.` : "",
    memories ? `Recent memorable moments:\n${memories || "none recorded yet"}` : "",
    context.enrichedContext
      ? `App context snapshot: ${JSON.stringify(context.enrichedContext).slice(0, 1400)}`
      : "",
    context.learning
      ? `Learning hints: ${JSON.stringify({
          preferredEpicDuration: context.learning.preferred_epic_duration,
          preferredHabitDifficulty: context.learning.preferred_habit_difficulty,
          preferredHabitFrequency: context.learning.preferred_habit_frequency,
          commonContexts: context.learning.common_contexts,
          peakProductivityTimes: context.learning.peak_productivity_times,
        }).slice(0, 700)}`
      : "",
    isJourneysSurface
      ? "In Journeys, behave like a normal chatbot first. Answer directly and naturally before suggesting any scheduling workflow."
      : "",
    isJourneysSurface
      ? "In Journeys, keep the tone plain and restrained. No roasting, swagger, teasing, bits, pop-quiz framing, or rhetorical challenges."
      : "",
    isJourneysSurface
      ? "If the user makes a clear request, confirm it directly instead of asking them to justify why it matters."
      : "",
    isJourneysSurface
      ? "Do not auto-switch into planner mode for schedule reads, day overviews, prioritization, brainstorming, or emotional check-ins."
      : "",
    isJourneysSurface
      ? "Only treat it as planner work when the user explicitly wants a concrete saved change, like scheduling, moving, repeating, reminding, renaming, or creating something."
      : "",
    isJourneysSurface
      ? "For Journeys schedule reads, use past tense for items marked past, present tense for items marked in_progress, and future tense for items marked upcoming."
      : "",
    isJourneysSurface
      ? "Prefer the provided scheduleLabel/displayTime wording and keep time mentions in lowercase am/pm."
      : "",
    isJourneysSurface
      ? "If an item already passed today, it can still be mentioned, but do not describe it like it is still ahead."
      : "",
    journeysSnapshot
      ? `Journeys schedule context: ${journeysSnapshot}`
      : "",
    "Be concise, emotionally present, and natural.",
    "Keep the performance original. Do not imitate or name any real actor, celebrity, or copyrighted character, even if the user asks.",
    "Reply in plain text only. No markdown, no bold markers, and no bullet lists with asterisks. Keep most answers under 120 words unless the user asks for more.",
    "Do not mention internal context, models, memory extraction, or implementation details.",
    "If the user asks for planning, scheduling, reminders, campaigns, rituals, or saving changes, steer them to the planning surface instead of inventing saved changes yourself.",
  ].filter(Boolean).join("\n");
};

async function generateCompanionReply(params: {
  guardedFetch: typeof fetch;
  systemPrompt: string;
  conversationHistory: Array<{ role: "assistant" | "user"; content: string }>;
  message: string;
  surface: CompanionChatSurface;
}) {
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const model = resolveCompanionChatModel((name) => Deno.env.get(name));
  const requestBody = buildCompanionChatCompletionBody({
    model,
    systemPrompt: params.systemPrompt,
    conversationHistory: params.conversationHistory,
    message: params.message,
    surface: params.surface,
  });
  const response = await params.guardedFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    console.error("[companion-chat] OpenAI error", await response.text());
    throw new Error("Failed to generate companion reply");
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("Companion reply was empty");
  }

  return reply as string;
}

async function maybeExtractConversationMemory(params: {
  guardedFetch: typeof fetch;
  message: string;
  existingProfile: ConversationProfile;
}) {
  if (!shouldExtractConversationMemory(params.message)) {
    return {
      profile: params.existingProfile,
      memorableMoment: null,
      shouldRemember: false,
      updated: false,
    };
  }

  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  const model = Deno.env.get("OPENAI_COMPANION_MEMORY_MODEL") ?? "gpt-4.1-mini";
  const response = await params.guardedFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAIApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 220,
      messages: [
        {
          role: "system",
          content:
            "Extract only durable user facts worth remembering. " +
            "Return minified JSON with keys preferences, goals, interests, selfDescription, conversationStyle, memorableMoment, shouldRemember. " +
            "Each list should contain short strings. Use empty arrays if nothing durable is present.",
        },
        {
          role: "user",
          content: params.message,
        },
      ],
    }),
  });

  if (!response.ok) {
    console.warn("[companion-chat] memory extraction failed", await response.text());
    return {
      profile: params.existingProfile,
      memorableMoment: null,
      shouldRemember: false,
      updated: false,
    };
  }

  const data = await response.json();
  const rawContent = data.choices?.[0]?.message?.content?.trim() ?? "{}";
  let parsed: MemoryExtractionResult;

  try {
    const source = asObject(JSON.parse(rawContent));
    parsed = {
      preferences: asStringArray(source.preferences),
      goals: asStringArray(source.goals),
      interests: asStringArray(source.interests),
      selfDescription: asStringArray(source.selfDescription),
      conversationStyle: asStringArray(source.conversationStyle),
      memorableMoment: typeof source.memorableMoment === "string" ? source.memorableMoment : null,
      shouldRemember: source.shouldRemember === true,
    };
  } catch (error) {
    console.warn("[companion-chat] could not parse memory extraction", error);
    return {
      profile: params.existingProfile,
      memorableMoment: null,
      shouldRemember: false,
      updated: false,
    };
  }

  const mergedProfile = mergeConversationProfile(params.existingProfile, parsed);
  const updated = JSON.stringify(mergedProfile) !== JSON.stringify(params.existingProfile);

  return {
    profile: mergedProfile,
    memorableMoment: parsed.memorableMoment,
    shouldRemember: parsed.shouldRemember,
    updated,
  };
}

async function persistConversation(params: {
  supabase: any;
  userId: string;
  companionId: string;
  sessionId: string;
  surface: "companion" | "journeys";
  message: string;
  reply: string;
  inputMode: "text" | "voice";
  conversationProfile: ConversationProfile;
  profileUpdated: boolean;
  memorableMoment: string | null;
  shouldRemember: boolean;
}) {
  const nowIso = new Date().toISOString();

  await persistCompanionChatTurn({
    supabase: params.supabase,
    userId: params.userId,
    companionId: params.companionId,
    sessionId: params.sessionId,
    surface: params.surface,
    message: params.message,
    reply: params.reply,
    inputMode: params.inputMode,
    createdAt: nowIso,
  });

  const learningUpdate: JsonObject = {
    user_id: params.userId,
    last_companion_chat_at: nowIso,
    updated_at: nowIso,
  };

  if (params.profileUpdated) {
    learningUpdate.conversation_profile = params.conversationProfile;
  }

  const { error: learningError } = await params.supabase
    .from("user_ai_learning")
    .upsert(learningUpdate, { onConflict: "user_id" });

  if (learningError) throw learningError;

  if (params.shouldRemember && params.memorableMoment) {
    await params.supabase
      .from("companion_memories")
      .insert({
        user_id: params.userId,
        companion_id: params.companionId,
        memory_type: "special_moment",
        memory_date: new Date().toISOString().slice(0, 10),
        memory_context: {
          title: params.memorableMoment,
          description: params.message,
          details: {
            source: "companion_chat",
            sessionId: params.sessionId,
          },
        },
        referenced_count: 0,
      });
  }
}

export const handleCompanionChatRequest = async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let requestId: string = crypto.randomUUID();

  try {
    if ((Deno.env.get("COMPANION_CHAT_DISABLED") ?? "").toLowerCase() === "true") {
      return new Response(
        JSON.stringify({ error: "Companion Talk is temporarily unavailable." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const protectedRequest = await requireProtectedRequest(req, {
      profileKey: "ai.standard",
      endpointName: "companion-chat",
      blockedMessage: "Too many companion conversation requests. Please try again shortly.",
      metadata: {
        flow: "companion_chat",
      },
    });

    if (protectedRequest instanceof Response) {
      return protectedRequest;
    }

    requestId = protectedRequest.requestId;
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return createSafeErrorResponse(req, {
        status: 400,
        code: "INVALID_INPUT",
        error: "Invalid companion chat request",
        requestId,
      });
    }

    const userId = protectedRequest.auth.userId;
    const sessionId = parsed.data.sessionId ?? crypto.randomUUID();
    const surface = normalizeCompanionChatSurface(parsed.data.surface);

    if (surfaceRequiresPremiumAccess(surface)) {
      const hasPremiumAccess = await ensurePremiumAccess(protectedRequest.supabase, userId);

      if (!hasPremiumAccess) {
        return createSafeErrorResponse(req, {
          status: 403,
          code: "PREMIUM_REQUIRED",
          error: "Companion Talk requires Premium access",
          requestId,
        });
      }
    }

    const underTurnCap = await enforceDailyTurnCap(protectedRequest.supabase, userId);
    if (!underTurnCap) {
      return createSafeErrorResponse(req, {
        status: 429,
        code: "DAILY_LIMIT_REACHED",
        error: "You reached today's companion conversation limit.",
        requestId,
      });
    }

    const context = await fetchConversationContext(
      req,
      protectedRequest.supabase,
      userId,
      parsed.data.companionId,
    );

    if (!context.companion) {
      return createSafeErrorResponse(req, {
        status: 404,
        code: "COMPANION_NOT_FOUND",
        error: "Companion not found",
        requestId,
      });
    }

    const existingProfile = normalizeProfile(context.learning?.conversation_profile ?? DEFAULT_PROFILE);
    const planningIntent = shouldHandoffToPlanner(parsed.data.message, surface);
    const costGuardrails = createCostGuardrailSession({
      supabase: createCostGuardrailSupabaseClient(),
      endpointKey: "companion-chat",
      featureKey: "ai_companion_conversation",
      userId,
      requestId,
    });
    const guardedFetch = costGuardrails.wrapFetch(fetch);
    const needsModelAccess = !planningIntent || shouldExtractConversationMemory(parsed.data.message);

    if (needsModelAccess) {
      await costGuardrails.enforceAccess({
        capabilities: ["text"],
        providers: ["openai"],
      });
    }

    const memoryExtractionPromise = maybeExtractConversationMemory({
      guardedFetch,
      message: parsed.data.message,
      existingProfile,
    });

    let reply = planningIntent
      ? surface === "journeys"
        ? "Switching into planning for that."
        : chooseBridgeReply(parsed.data.message)
      : "";
    let profileUpdated = false;
    let memorableMoment: string | null = null;
    let shouldRemember = false;

    if (!planningIntent) {
      reply = await generateCompanionReply({
        guardedFetch,
        systemPrompt: buildSystemPrompt({
          ...context,
          surface,
          currentDate: parsed.data.currentDate,
          currentDateTime: parsed.data.currentDateTime,
          journeysContext: parsed.data.journeysContext,
        }),
        conversationHistory: parsed.data.conversationHistory,
        message: parsed.data.message,
        surface,
      });
    }

    const memoryExtraction = await memoryExtractionPromise;
    profileUpdated = memoryExtraction.updated;
    memorableMoment = memoryExtraction.memorableMoment;
    shouldRemember = memoryExtraction.shouldRemember
      || /remember this|don't forget/i.test(parsed.data.message.toLowerCase());

    const persistenceReady = await withCompanionChatPersistenceCapability(() => (
      persistConversation({
        supabase: protectedRequest.supabase,
        userId,
        companionId: parsed.data.companionId,
        sessionId,
        surface,
        message: parsed.data.message,
        reply,
        inputMode: parsed.data.inputMode,
        conversationProfile: memoryExtraction.profile,
        profileUpdated,
        memorableMoment,
        shouldRemember,
      })
    ));

    return new Response(
      JSON.stringify({
        reply,
        speechText: reply,
        handoffToPlanner: planningIntent,
        memoryUpdateApplied: profileUpdated || Boolean(memorableMoment && shouldRemember),
        persistenceReady,
        sessionId,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (error) {
    if (isCostGuardrailBlockedError(error)) {
      return buildCostGuardrailBlockedResponse(error, corsHeaders);
    }

    console.error("[companion-chat] unhandled error", error);
    return createSafeErrorResponse(req, {
      status: 500,
      code: "COMPANION_CHAT_FAILED",
      error: "Companion Talk hit a snag. Please try again.",
      requestId,
    });
  }
};

if (Deno.env.get("SUPABASE_FUNCTIONS_TEST") !== "1") {
  serve(handleCompanionChatRequest);
}
