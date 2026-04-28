import {
  buildPlanDayCampaignGoalsAtRiskLine,
  buildPlanDayLoadReason,
  buildProposalFromDayPlanBlock,
  formatScheduleReference,
  getPlanDayAtRiskCampaignFacts,
  getPlanDayLoadBreakdown,
  getPlanDayLoadFacts,
  getPlanDayTargetDate,
  normalizePlannerBuildResultText,
  synthesizeDayPlanFromProposals,
} from "./planner.ts";
import {
  buildPlanDayToolSystemPrompt,
  buildPlanDayToolUserPrompt,
  executePlanDayToolCall,
  initializePlanDayToolState,
  PLAN_DAY_TOOL_DEFINITIONS,
} from "./planDayTools.ts";
import type {
  PlannerBuildInput,
  PlannerBuildResult,
  PlannerProposal,
  PlannerQuestion,
  PlannerResponseMode,
  PlannerTonePack,
} from "./planner.ts";
import {
  buildConfirmReadyPlannerReply,
  getReadyQuestPlannerProposals,
  isQuestionLikePlannerReply,
} from "../../../src/shared/companionPlannerReadyProposal.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

type PlannerLLMReply = {
  reply: string;
  mode: PlannerResponseMode;
};

const addDaysToDateKey = (dateKey: string, days: number): string => {
  const next = new Date(`${dateKey}T00:00:00`);
  next.setDate(next.getDate() + days);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const WEEKDAY_INDEX_BY_NAME = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
} as const;

const inferTargetDate = (
  input: PlannerBuildInput,
  mode: PlannerResponseMode,
): string => {
  const selectedDate = input.plannerContext.scheduleInsights?.selectedDate;
  if (selectedDate) return selectedDate;

  const lowerMessage = input.message.toLowerCase();
  if (mode !== "schedule_read") return input.currentDate;
  if (/\btomorrow\b/.test(lowerMessage)) {
    return addDaysToDateKey(input.currentDate, 1);
  }
  if (/\btoday\b/.test(lowerMessage)) {
    return input.currentDate;
  }

  const weekdayMatch = lowerMessage.match(
    /\b(?:this|next|upcoming)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
  );
  if (!weekdayMatch) return input.currentDate;

  const targetWeekday = WEEKDAY_INDEX_BY_NAME[
    weekdayMatch[1] as keyof typeof WEEKDAY_INDEX_BY_NAME
  ];
  const currentDate = new Date(`${input.currentDate}T00:00:00`);
  const currentWeekday = currentDate.getDay();
  let delta = (targetWeekday - currentWeekday + 7) % 7;
  if (delta === 0 && /\b(?:next|upcoming)\b/.test(lowerMessage)) {
    delta = 7;
  }

  return addDaysToDateKey(input.currentDate, delta);
};

const countScheduledItemsForDate = (
  input: PlannerBuildInput,
  targetDate: string,
): number => {
  const dayStart = new Date(`${targetDate}T00:00:00`);
  const dayEnd = new Date(`${addDaysToDateKey(targetDate, 1)}T00:00:00`);

  const taskCount =
    input.plannerContext.tasks.filter((task) =>
      task.completed !== true && task.taskDate === targetDate
    ).length;
  const inboxCount =
    input.plannerContext.inboxTasks.filter((task) =>
      task.completed !== true && task.taskDate === targetDate
    ).length;
  const calendarEventCount =
    input.plannerContext.calendarEvents.filter((event) => {
      const start = new Date(event.start);
      const end = new Date(event.end);
      return end > dayStart && start < dayEnd;
    }).length;

  return taskCount + inboxCount + calendarEventCount;
};

const buildAvailabilityFacts = (
  input: PlannerBuildInput,
  mode: PlannerResponseMode,
) => {
  const targetDate = inferTargetDate(input, mode);
  const scheduleInsights = input.plannerContext.scheduleInsights;
  const scheduledItemCount = countScheduledItemsForDate(input, targetDate);
  const remainingItemCount = countScheduledItemsForDate(
    input,
    input.currentDate,
  );
  const dayStatus =
    scheduleInsights?.dayLoads.find((day) => day.date === targetDate)?.status ??
      (scheduleInsights?.emptyDates.includes(targetDate) ? "open" : null) ??
      (scheduledItemCount === 0 ? "open" : null);
  const openings = scheduleInsights?.suggestedSlots
    .filter((slot) => slot.date === targetDate)
    .slice(0, 3)
    .map((slot) => `${slot.time}-${slot.endTime}`) ?? [];

  return {
    targetDate,
    dayStatus,
    scheduledItemCount,
    remainingScheduledItemCountToday: remainingItemCount,
    hasOpenings: dayStatus === "open" || dayStatus === "balanced" ||
      openings.length > 0,
    openings,
  };
};

const buildSystemPrompt = (
  mode: PlannerResponseMode,
  tonePack: PlannerBuildInput["tonePack"],
  options?: {
    isPlanDayClarification?: boolean;
  },
) => {
  if (options?.isPlanDayClarification) {
    return [
      "You are an intelligent companion whose only job in this step is to understand what the user wants to focus on.",
      "You do NOT schedule, suggest time slots, or create plans in this step.",
      "You are only responsible for clarifying the user's direction.",
      "Before responding, internally consider the current time of day and the user's recent activity, habits, or goals when available.",
      "Use that context only to guide your question, and do not mention it unless it helps the question feel natural.",
      "Ask a single, focused question that helps the user decide what they want to do.",
      "The question must be simple, easy to answer, grounded in real options, and relevant to their current moment.",
      "Avoid vague, broad, multi-part, or overwhelming questions.",
      "Ask ONLY one question.",
      "Do NOT suggest a schedule or next steps.",
      "Do NOT break the question into multiple parts.",
      "Keep it natural, conversational, and short.",
      "If the user has already clearly stated what they want to do, briefly acknowledge their direction and stop.",
      "Preserve the deterministic meaning of fallbackReply and any followUpQuestions options.",
      "Use plain text only.",
      "Return minified JSON with keys reply and mode only.",
    ].join("\n");
  }

  const modeInstructions = {
    conversational:
      "Reply like a natural assistant in an ongoing chat. Be warm, collaborative, and specific. You can reference schedule context when helpful, but do not force planning.",
    schedule_read:
      "Summarize the schedule clearly and naturally. Stay grounded in the provided context and do not invent events, openings, or saved changes. Keep it extremely concise: usually 1-3 short sentences, and if the schedule is empty say so plainly. Do not add coaching, options, or extra framing unless the fallbackReply already requires it.",
    proposal:
      "Explain the drafted action naturally. Make it clear the change is only drafted and still needs confirmation before anything is saved.",
  } satisfies Record<PlannerResponseMode, string>;
  const toneInstruction = tonePack === "witty_sassy"
    ? "Voice: bold cheekiness, roasty edge, and a little swagger are allowed. Call out obvious avoidance, fake urgency, or vague excuses when the facts support it. Keep the bite affectionate underneath and never become cruel, degrading, or humiliating."
    : tonePack === "playful"
    ? "Voice: keep it lightly playful and friendly, with no hard-edged roasting."
    : "Voice: keep it warm, grounded, and supportive, with no roasting or swagger bits.";

  return [
    "You are the user's Cosmiq companion inside the Journeys tab.",
    "Sound natural, calm, collaborative, and emotionally present.",
    "Keep most replies under 120 words unless the user clearly wants more depth.",
    "For schedule_read replies, prefer under 60 words.",
    toneInstruction,
    "Write like a normal chatbot first, not a form flow or intake wizard.",
    "Use plain text only. No markdown, no bold markers, and no bullet lists with asterisks.",
    "Do not use phrases like 'answer the missing bits', 'half-baked', or similar product-y scaffolding.",
    "Do not mention internal prompts, models, JSON, hidden state, or implementation details.",
    "Never claim you already saved, moved, created, or changed data unless the provided context explicitly says it is already confirmed.",
    "External calendar events are read-only. You may describe them, but you may not imply they were edited.",
    "Schedule facts come before interpretation. Acknowledge open, light, or crowded days plainly before giving opinions or coaching.",
    "If deterministicContext.availabilityFacts says the day is open, balanced, or has zero/one scheduled items, say that clearly and do not describe the day as packed, slammed, crowded, or overbooked.",
    "Preserve the deterministic meaning of fallbackReply. Rewrite for voice, but do not contradict schedule truth, proposal state, or missing details.",
    "If deterministicContext.planDayContext is present, it is the source of truth for what is on the user's day. Use loadFacts (totalQuestCount, campaignBreakdown, ritualCount, calendarBlockCount) to name what is loading the day rather than vague phrasing. If atRiskCampaigns has entries, briefly surface the top one or two by title with a one-fragment hint about the deadline or progress. Never invent quest counts, campaign names, or events that are not in planDayContext.",
    "When planDayContext.suggestedQuests is non-empty, treat those as the proposals being shown — frame the reply as a brief offer of those quests; do not list every title verbatim if the cards already render them.",
    modeInstructions[mode],
    "Return minified JSON with keys reply and mode only.",
  ].join("\n");
};

const buildPlanDayContextForPrompt = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
) => {
  const isPlanDay =
    input.plannerContext.starterIntent === "plan_day" ||
    input.sessionState.pendingStarterIntent === "plan_day";
  if (!isPlanDay) return null;
  const targetDate = getPlanDayTargetDate(input);
  const loadBreakdown = getPlanDayLoadBreakdown(input, targetDate);
  const dateLabel = formatScheduleReference(input.currentDate, targetDate);
  return {
    targetDate,
    dateLabel,
    loadFacts: getPlanDayLoadFacts(input, loadBreakdown),
    atRiskCampaigns: getPlanDayAtRiskCampaignFacts(input),
    loadReason: buildPlanDayLoadReason(input, dateLabel, loadBreakdown),
    atRiskLine: buildPlanDayCampaignGoalsAtRiskLine(input, baseResult.proposals),
    plannedEnergy: input.sessionState.planDayEnergy ?? null,
    suggestedQuests: baseResult.proposals.map((proposal) => ({
      title: proposal.title,
      summary: proposal.summary,
      reasoning: proposal.reasoning ?? null,
    })),
  };
};

const buildUserPrompt = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
) =>
  JSON.stringify({
    targetMode: baseResult.mode,
    tonePack: input.tonePack,
    latestUserMessage: input.message,
    currentDate: input.currentDate,
    currentDateTime: input.currentDateTime,
    conversationHistory: input.conversationHistory.slice(-10),
    deterministicContext: {
      fallbackReply: baseResult.reply,
      availabilityFacts: buildAvailabilityFacts(input, baseResult.mode),
      planDayContext: buildPlanDayContextForPrompt(input, baseResult),
      followUpQuestions: baseResult.followUpQuestions.map((question) => ({
        prompt: question.prompt,
        reason: question.reason ?? null,
        options: question.options ?? [],
      })),
      starterIntent: input.plannerContext.starterIntent ?? null,
      briefingContext: input.plannerContext.briefingContext
        ? {
          focus: input.plannerContext.briefingContext.focus ?? null,
          actionPrompt: input.plannerContext.briefingContext.actionPrompt ??
            null,
          inferredGoals: input.plannerContext.briefingContext.inferredGoals ??
            [],
        }
        : null,
      priorityScores: (input.plannerContext.priorityScores ?? []).slice(0, 6)
        .map((score) => ({
          kind: score.kind,
          title: score.title,
          score: score.score,
          reasons: score.reasons,
          targetDate: score.targetDate ?? null,
          suggestedTime: score.suggestedTime ?? null,
        })),
      proposals: baseResult.proposals.map((proposal) => ({
        kind: proposal.kind,
        title: proposal.title,
        summary: proposal.summary,
        status: proposal.status,
        readyToConfirm: proposal.readyToConfirm,
        missingFields: proposal.missingFields ?? [],
      })),
      scheduleSummary: input.plannerContext.scheduleInsights?.summary ?? null,
      tasks: input.plannerContext.tasks.slice(0, 12).map((task) => ({
        title: task.title,
        taskDate: task.taskDate,
        scheduledTime: task.scheduledTime,
        completed: task.completed ?? false,
        epicTitle: task.epicTitle ?? null,
      })),
      inboxTasks: input.plannerContext.inboxTasks.slice(0, 8).map((task) => ({
        title: task.title,
        taskDate: task.taskDate,
        scheduledTime: task.scheduledTime,
      })),
      calendarEvents: input.plannerContext.calendarEvents.slice(0, 10).map((
        event,
      ) => ({
        title: event.title,
        start: event.start,
        end: event.end,
        isAllDay: event.isAllDay,
        provider: event.provider,
      })),
      activeEpics: input.plannerContext.activeEpics.slice(0, 8).map((epic) => ({
        title: epic.title,
        endDate: epic.endDate,
      })),
      plannerMemory: input.plannerContext.plannerMemory
        ? {
          preferredTimeOfDay:
            input.plannerContext.plannerMemory.preferredTimeOfDay ?? null,
          preferredTimeReason:
            input.plannerContext.plannerMemory.preferredTimeReason ?? null,
        }
        : null,
    },
  });

const normalizeReply = (value: unknown): PlannerLLMReply | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const rawReply = (value as { reply?: unknown }).reply;
  const rawMode = (value as { mode?: unknown }).mode;

  if (typeof rawReply !== "string" || rawReply.trim().length === 0) {
    return null;
  }

  if (
    rawMode !== "conversational" && rawMode !== "schedule_read" &&
    rawMode !== "proposal"
  ) {
    return null;
  }

  return {
    reply: rawReply.trim(),
    mode: rawMode,
  };
};

const isQuestCaptureStarterResponse = (baseResult: PlannerBuildResult) =>
  baseResult.mode === "conversational" &&
  baseResult.reply.trim() === "Quest?" &&
  baseResult.sessionState.pendingStarterIntent === "quest_capture" &&
  baseResult.followUpQuestions.length === 0 &&
  baseResult.proposals.length === 0 &&
  baseResult.suggestedReminders.length === 0;

const isPlanDayClarificationResponse = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
) =>
  input.plannerContext.starterIntent === "plan_day" &&
  baseResult.mode === "conversational" &&
  baseResult.followUpQuestions.length > 0 &&
  baseResult.proposals.length === 0 &&
  baseResult.suggestedReminders.length === 0;

const isPhaseADeterministicStarterResponse = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
) => {
  const starterIntent = input.plannerContext.starterIntent ??
    input.sessionState.pendingStarterIntent ??
    null;
  if (starterIntent === "advance_campaign_start") {
    return baseResult.followUpQuestions.length === 0 &&
      (
        baseResult.mode === "proposal" ||
        baseResult.mode === "schedule_read"
      );
  }
  if (starterIntent === "plan_week") {
    return baseResult.mode === "schedule_read" &&
      baseResult.followUpQuestions.length === 0;
  }
  if (starterIntent === "briefing_followup") {
    return baseResult.mode === "schedule_read" &&
      baseResult.followUpQuestions.length === 0;
  }
  if (starterIntent === "right_now_start") {
    return baseResult.mode === "schedule_read" &&
      baseResult.followUpQuestions.length === 0;
  }

  if (
    starterIntent === "adjust_today" ||
    starterIntent === "low_energy_adjust"
  ) {
    return baseResult.followUpQuestions.length === 0 &&
      (
        baseResult.mode === "proposal" ||
        baseResult.mode === "schedule_read"
      );
  }

  return false;
};

const getReadyQuestProposalDrafts = (
  baseResult: PlannerBuildResult,
) =>
  getReadyQuestPlannerProposals([
    ...baseResult.proposals,
    ...baseResult.suggestedReminders,
  ]);

const hasReadyQuestProposalResponse = (
  baseResult: PlannerBuildResult,
) =>
  baseResult.mode === "proposal" &&
  getReadyQuestProposalDrafts(baseResult).length > 0;

const extractPreservedProposalReplyNotes = (
  reply: string,
): string[] =>
  reply
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .filter((segment) =>
      /saved calendar event/i.test(segment) ||
      /external calendar events are read-only/i.test(segment)
    );

// ─── AI-first handlers ────────────────────────────────────────────────────────

type PlanDayQuestSuggestion = {
  title: string;
  type: "must" | "should" | "nice";
  estimated_duration: string;
  source: "campaign" | "habit" | "recovery" | "optimization";
  reason: string;
};

type PlanDayAIOutput = {
  mode: "clarify" | "suggest";
  message: string;
  day_assessment: string;
  follow_up_question?: string | null;
  suggested_quests: PlanDayQuestSuggestion[];
};

const buildPlanDaySystemPrompt = (tonePack: PlannerTonePack): string => {
  const toneInstruction = tonePack === "witty_sassy"
    ? "Voice: bold and a bit cheeky, but always supportive underneath."
    : tonePack === "playful"
    ? "Voice: lightly playful and friendly."
    : "Voice: warm, grounded, and supportive.";

  return [
    "You are Cosmiq, a context-aware AI companion inside an app called Cosmiq.",
    "Your job: analyze the user's full day context and either ask one useful clarifying question or suggest smart, realistic quests for the remaining part of their day.",
    toneInstruction,
    "Rules:",
    "- If the user's direction or saved context is too thin, ask exactly one natural question instead of inventing quests",
    "- If you suggest quests, suggest 1–4; each quest must be small, actionable, and fit within remaining time",
    "- Ground every suggestion in real context: missed tasks → recovery, habits → consistency, campaigns → alignment",
    "- Do NOT suggest hour-by-hour schedules or vague goals like 'be productive'",
    "- Do NOT invent quests unrelated to the user's actual context",
    "- message must be under 80 words, plain text, no markdown",
    "Return minified JSON only with keys: mode, message, day_assessment, follow_up_question, suggested_quests",
    "mode must be clarify or suggest",
    "follow_up_question is required when mode is clarify and null otherwise",
    "day_assessment must be one of: behind | open | productive | low_energy | busy",
    "Each quest: { title, type (must|should|nice), estimated_duration (e.g. '45 min'), source (campaign|habit|recovery|optimization), reason }",
  ].join("\n");
};

const buildPlanDayUserPrompt = (input: PlannerBuildInput): string => {
  const ctx = input.plannerContext;
  const now = new Date(input.currentDateTime);

  const completedToday = ctx.tasks
    .filter((t) => t.completed === true)
    .slice(0, 8)
    .map((t) => ({ title: t.title }));

  const pendingToday = ctx.tasks
    .filter((t) => t.completed !== true && t.taskDate === input.currentDate)
    .slice(0, 10)
    .map((t) => ({
      title: t.title,
      scheduledTime: t.scheduledTime,
      estimatedDuration: t.estimatedDuration,
      epicTitle: t.epicTitle ?? null,
    }));

  const missedTasks = ctx.tasks
    .filter(
      (t) =>
        t.completed !== true &&
        t.taskDate !== null &&
        t.taskDate < input.currentDate,
    )
    .slice(0, 6)
    .map((t) => ({ title: t.title, taskDate: t.taskDate }));

  const remainingEvents = ctx.calendarEvents
    .filter((e) => new Date(e.start) > now)
    .slice(0, 5)
    .map((e) => ({ title: e.title, start: e.start, end: e.end }));

  return JSON.stringify({
    currentTime: input.currentDateTime,
    userMessage: input.message,
    conversationHistory: input.conversationHistory.slice(-6),
    completedToday,
    pendingToday,
    missedTasks,
    remainingEventsToday: remainingEvents,
    inboxQuests: ctx.inboxTasks.slice(0, 8).map((t) => ({
      title: t.title,
      epicTitle: t.epicTitle ?? null,
    })),
    activeCampaigns: ctx.activeEpics.slice(0, 5).map((e) => ({
      title: e.title,
      endDate: e.endDate,
      progressPercentage: e.progressPercentage ?? null,
    })),
    habits: ctx.rituals.slice(0, 6).map((r) => ({
      title: r.title,
      epicTitle: r.epicTitle,
      frequency: r.frequency,
      currentStreak: r.currentStreak ?? null,
    })),
    recentReflections: (ctx.reflectionSignals ?? []).slice(-2).map((s) => ({
      mood: s.mood,
      energy: s.energy ?? null,
      wins: s.wins ?? null,
    })),
    briefingContext: ctx.briefingContext
      ? {
        focus: ctx.briefingContext.focus ?? null,
        inferredGoals: (ctx.briefingContext.inferredGoals ?? []).slice(0, 5),
      }
      : null,
    behaviorSignals: ctx.statInterpretation
      ? {
        momentumState: ctx.statInterpretation.momentumState,
        recentMissInterpretation:
          ctx.statInterpretation.recentMissInterpretation,
        narrativeBrief: ctx.statInterpretation.narrativeBrief,
      }
      : null,
    scheduleLoad: ctx.scheduleInsights?.dayLoads.find(
      (d) => d.date === input.currentDate,
    ) ?? null,
  });
};

const parseEstimatedDurationMinutes = (value: string): number => {
  const match = value.match(/(\d+)/);
  if (!match) return 30;
  const num = Number.parseInt(match[1] ?? "30", 10);
  return /hour/i.test(value) ? num * 60 : num;
};

const normalizePlanDayOutput = (value: unknown): PlanDayAIOutput | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const obj = value as Record<string, unknown>;

  const message =
    typeof obj.message === "string" && obj.message.trim().length > 0
      ? obj.message.trim()
      : null;
  if (!message) return null;

  const rawQuests = Array.isArray(obj.suggested_quests)
    ? obj.suggested_quests
    : [];

  const suggested_quests: PlanDayQuestSuggestion[] = rawQuests
    .filter(
      (q): q is Record<string, unknown> =>
        typeof q === "object" && q !== null && !Array.isArray(q),
    )
    .map((q): PlanDayQuestSuggestion => {
      const type: PlanDayQuestSuggestion["type"] =
        q.type === "must" || q.type === "should" || q.type === "nice"
          ? q.type
          : "should";
      const source: PlanDayQuestSuggestion["source"] =
        q.source === "campaign" ||
          q.source === "habit" ||
          q.source === "recovery" ||
          q.source === "optimization"
          ? q.source
          : "optimization";

      return {
        title: typeof q.title === "string" ? q.title.trim() : "",
        type,
        estimated_duration: typeof q.estimated_duration === "string"
          ? q.estimated_duration
          : "30 min",
        source,
        reason: typeof q.reason === "string" ? q.reason.trim() : "",
      };
    })
    .filter((q) => q.title.length > 0);

  return {
    mode: obj.mode === "clarify" ? "clarify" : "suggest",
    message,
    day_assessment: typeof obj.day_assessment === "string"
      ? obj.day_assessment
      : "open",
    follow_up_question: typeof obj.follow_up_question === "string"
      ? obj.follow_up_question.trim()
      : null,
    suggested_quests,
  };
};

const mapPlanDayOutputToResult = (
  input: PlannerBuildInput,
  aiOutput: PlanDayAIOutput,
  baseResult: PlannerBuildResult,
): PlannerBuildResult => {
  if (
    aiOutput.mode === "clarify" ||
    (aiOutput.suggested_quests.length === 0 && /\?\s*$/.test(aiOutput.message))
  ) {
    const prompt = aiOutput.follow_up_question?.trim() || aiOutput.message;
    const followUpQuestion: PlannerQuestion = {
      id: "details",
      field: "details",
      prompt,
      reason:
        "A little more direction will keep the plan grounded in the user's actual day.",
      required: true,
      options: [],
    };

    return {
      ...baseResult,
      mode: "conversational",
      reply: aiOutput.message,
      proposals: [],
      suggestedReminders: [],
      followUpQuestions: [followUpQuestion],
      structuredResponse: null,
      sessionState: {
        ...baseResult.sessionState,
        draft: {},
        openQuestionIds: [followUpQuestion.id],
        pendingStarterIntent: "plan_day",
      },
    };
  }

  const proposals: PlannerProposal[] = aiOutput.suggested_quests.map(
    (quest) => ({
      id: crypto.randomUUID(),
      kind: "create_quest" as const,
      title: quest.title,
      summary: quest.reason
        ? `Create a quest for "${quest.title}" — ${quest.reason}.`
        : `Create a quest for "${quest.title}".`,
      reasoning: quest.reason || null,
      payload: {
        taskText: quest.title,
        questSource: "inbox",
        source: "optimizer",
        estimatedDuration: parseEstimatedDurationMinutes(
          quest.estimated_duration,
        ),
        suggestedType: quest.type,
        aiSource: quest.source,
        taskDate: input.currentDate,
        scheduledTime: null,
      },
      status: "pending" as const,
      readyToConfirm: true,
      missingFields: [],
    }),
  );

  return {
    ...baseResult,
    mode: proposals.length > 0 ? "proposal" : "conversational",
    reply: aiOutput.message,
    proposals,
    suggestedReminders: [],
    followUpQuestions: [],
    sessionState: {
      ...baseResult.sessionState,
      openQuestionIds: [],
    },
  };
};

export async function buildPlanDayAIResponse(params: {
  guardedFetch: typeof fetch;
  input: PlannerBuildInput;
  baseResult: PlannerBuildResult;
  openAIApiKey?: string;
  model?: string;
}): Promise<PlannerBuildResult | null> {
  const openAIApiKey = params.openAIApiKey ?? Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) return null;

  const model = params.model ??
    Deno.env.get("OPENAI_COMPANION_PLANNER_MODEL") ??
    "gpt-5";

  try {
    const response = await params.guardedFetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 600,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: buildPlanDaySystemPrompt(params.input.tonePack),
          },
          {
            role: "user",
            content: buildPlanDayUserPrompt(params.input),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(
        "[companion-planner-chat] plan_day AI error",
        response.status,
      );
      return null;
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rawContent) return null;

    const aiOutput = normalizePlanDayOutput(JSON.parse(rawContent));
    if (!aiOutput) return null;

    return mapPlanDayOutputToResult(params.input, aiOutput, params.baseResult);
  } catch (error) {
    console.warn("[companion-planner-chat] plan_day AI failed", error);
    return null;
  }
}

const buildUpcomingSystemPrompt = (): string =>
  [
    "You are Cosmiq, a context-aware AI companion.",
    "Your job: give a clean, concise summary of what the user has coming up today and tomorrow.",
    "Rules:",
    "- Keep message under 80 words, plain text, no markdown",
    "- Only reference real events and tasks from the provided context — never invent",
    "- If nothing is coming up, say so plainly",
    "- tomorrow_summary must be exactly: busy | light | open",
    "- message must NOT end with a question mark",
    "Return minified JSON only with keys: message, next_event, remaining_today, tomorrow_summary, missed_items",
    "next_event: { title, start } or null",
    "remaining_today: array of { title, start? }",
    "missed_items: array of title strings",
  ].join("\n");

const buildUpcomingUserPrompt = (input: PlannerBuildInput): string => {
  const ctx = input.plannerContext;
  const now = new Date(input.currentDateTime);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowDateKey = tomorrowDate.toISOString().slice(0, 10);

  const remainingEvents = ctx.calendarEvents
    .filter((e) => new Date(e.start) > now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const tomorrowEvents = ctx.calendarEvents.filter((e) =>
    e.start.startsWith(tomorrowDateKey)
  );

  const remainingTasks = ctx.tasks
    .filter((t) => t.completed !== true && t.taskDate === input.currentDate)
    .slice(0, 6)
    .map((t) => ({ title: t.title, scheduledTime: t.scheduledTime }));

  const missedTasks = ctx.tasks
    .filter(
      (t) =>
        t.completed !== true &&
        t.taskDate !== null &&
        t.taskDate < input.currentDate,
    )
    .slice(0, 4)
    .map((t) => ({ title: t.title }));

  return JSON.stringify({
    currentTime: input.currentDateTime,
    userMessage: input.message,
    remainingEventsToday: remainingEvents
      .slice(0, 6)
      .map((e) => ({ title: e.title, start: e.start, end: e.end })),
    remainingTasksToday: remainingTasks,
    tomorrowEvents: tomorrowEvents
      .slice(0, 6)
      .map((e) => ({ title: e.title, start: e.start })),
    missedToday: missedTasks,
    scheduleLoad: ctx.scheduleInsights?.dayLoads.find(
      (d) => d.date === input.currentDate,
    ) ?? null,
  });
};

export async function buildUpcomingAIResponse(params: {
  guardedFetch: typeof fetch;
  input: PlannerBuildInput;
  baseResult: PlannerBuildResult;
  openAIApiKey?: string;
  model?: string;
}): Promise<PlannerBuildResult | null> {
  const openAIApiKey = params.openAIApiKey ?? Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) return null;

  const model = params.model ??
    Deno.env.get("OPENAI_COMPANION_PLANNER_MODEL") ??
    "gpt-5";

  try {
    const response = await params.guardedFetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: 300,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildUpcomingSystemPrompt() },
          { role: "user", content: buildUpcomingUserPrompt(params.input) },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(
        "[companion-planner-chat] upcoming AI error",
        response.status,
      );
      return null;
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rawContent) return null;

    const parsed = JSON.parse(rawContent);
    const message =
      typeof parsed?.message === "string" && parsed.message.trim().length > 0
        ? parsed.message.trim()
        : null;
    if (!message) return null;

    return {
      ...params.baseResult,
      mode: "schedule_read",
      reply: message,
      proposals: [],
      suggestedReminders: [],
      followUpQuestions: [],
      sessionState: {
        ...params.baseResult.sessionState,
        openQuestionIds: [],
      },
    };
  } catch (error) {
    console.warn("[companion-planner-chat] upcoming AI failed", error);
    return null;
  }
}

// ─── Orchestrated reply (existing flow) ───────────────────────────────────────

export const sanitizeReadyQuestProposalResponse = (
  baseResult: PlannerBuildResult,
): PlannerBuildResult => {
  const readyQuestProposals = getReadyQuestProposalDrafts(baseResult);
  if (readyQuestProposals.length === 0) {
    return normalizePlannerBuildResultText(baseResult);
  }

  const shouldReplaceReply = baseResult.followUpQuestions.length > 0 ||
    baseResult.sessionState.openQuestionIds.length > 0 ||
    isQuestionLikePlannerReply(baseResult.reply);
  const preservedNotes = extractPreservedProposalReplyNotes(baseResult.reply);

  return normalizePlannerBuildResultText({
    ...baseResult,
    reply: shouldReplaceReply
      ? [
        buildConfirmReadyPlannerReply(readyQuestProposals[0]?.kind ?? ""),
        ...preservedNotes,
      ].join("\n\n")
      : baseResult.reply,
    followUpQuestions: [],
    sessionState: {
      ...baseResult.sessionState,
      openQuestionIds: [],
    },
  });
};

const MAX_PLAN_DAY_TOOL_ITERATIONS = 4;

type PlanDayToolFallbackReason =
  | "openai_error"
  | "openai_empty_choice"
  | "max_iterations"
  | "empty_state"
  | "exception";

interface PlanDayToolTelemetryContext {
  reason: PlanDayToolFallbackReason;
  model: string;
  refining: boolean;
  iteration: number;
  proposalCount: number;
  hasClarification: boolean;
  detail?: string;
}

const recordPlanDayToolFallback = (
  context: PlanDayToolTelemetryContext,
): void => {
  console.warn(
    "[companion-planner-chat] plan_day_tool_fallback",
    {
      reason: context.reason,
      model: context.model,
      refining: context.refining,
      iteration: context.iteration,
      proposalCount: context.proposalCount,
      hasClarification: context.hasClarification,
      ...(context.detail ? { detail: context.detail } : {}),
    },
  );
};

const hasRefinableDayPlan = (input: PlannerBuildInput): boolean =>
  Boolean(
    input.activeDayPlan &&
      input.activeDayPlan.status === "draft" &&
      input.activeDayPlan.blocks.length > 0,
  );

const isPlanDayRefinementTurn = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
): boolean => {
  if (!hasRefinableDayPlan(input)) return false;
  if (baseResult.followUpQuestions.length > 0) return false;
  if (input.plannerContext.starterIntent === "plan_day") return false;
  return true;
};

const isPlanDayDraftTurn = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
): boolean => {
  const isPlanDay = input.plannerContext.starterIntent === "plan_day" ||
    input.sessionState.pendingStarterIntent === "plan_day";
  if (!isPlanDay) return false;
  if (baseResult.followUpQuestions.length > 0) return false;
  return baseResult.mode === "conversational" || baseResult.mode === "proposal";
};

const shouldUsePlanDayToolLoop = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
): boolean =>
  isPlanDayDraftTurn(input, baseResult) ||
  isPlanDayRefinementTurn(input, baseResult);

type PlanDayToolMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

async function runPlanDayToolLoop(params: {
  guardedFetch: typeof fetch;
  input: PlannerBuildInput;
  baseResult: PlannerBuildResult;
  openAIApiKey: string;
  model: string;
}): Promise<PlannerBuildResult | null> {
  const { input, baseResult } = params;
  const isRefining = isPlanDayRefinementTurn(input, baseResult);
  const seedProposals = isRefining && input.activeDayPlan
    ? input.activeDayPlan.blocks.map((block) =>
      buildProposalFromDayPlanBlock(input, block)
    )
    : baseResult.proposals;
  const state = initializePlanDayToolState(seedProposals);
  const messages: PlanDayToolMessage[] = [
    {
      role: "system",
      content: buildPlanDayToolSystemPrompt(input.tonePack, { isRefining }),
    },
    {
      role: "user",
      content: buildPlanDayToolUserPrompt(input, seedProposals, { isRefining }),
    },
  ];

  let finalReply: string | null = null;
  let lastIteration = 0;
  let exitedByModelMessage = false;
  for (let iter = 0; iter < MAX_PLAN_DAY_TOOL_ITERATIONS; iter += 1) {
    lastIteration = iter;
    const response = await params.guardedFetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        temperature: 0.5,
        max_tokens: 600,
        parallel_tool_calls: true,
        tools: PLAN_DAY_TOOL_DEFINITIONS,
        tool_choice: state.clarification ? "none" : "auto",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      recordPlanDayToolFallback({
        reason: "openai_error",
        model: params.model,
        refining: isRefining,
        iteration: iter,
        proposalCount: state.proposals.length,
        hasClarification: Boolean(state.clarification),
        detail: `status=${response.status} ${errorText.slice(0, 240)}`,
      });
      return null;
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const message = choice?.message;
    if (!message) {
      recordPlanDayToolFallback({
        reason: "openai_empty_choice",
        model: params.model,
        refining: isRefining,
        iteration: iter,
        proposalCount: state.proposals.length,
        hasClarification: Boolean(state.clarification),
      });
      return null;
    }

    const toolCalls = Array.isArray(message.tool_calls)
      ? message.tool_calls
      : [];

    if (toolCalls.length === 0) {
      finalReply = typeof message.content === "string"
        ? message.content.trim()
        : null;
      exitedByModelMessage = true;
      break;
    }

    messages.push({
      role: "assistant",
      content: typeof message.content === "string" ? message.content : null,
      tool_calls: toolCalls.map((
        call: {
          id: string;
          type: string;
          function: { name: string; arguments: string };
        },
      ) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.function.name,
          arguments: call.function.arguments ?? "{}",
        },
      })),
    });

    for (
      const call of toolCalls as Array<{
        id: string;
        function: { name: string; arguments: string };
      }>
    ) {
      const result = executePlanDayToolCall(input, state, {
        id: call.id,
        name: call.function.name,
        argumentsJson: call.function.arguments ?? "{}",
      });
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
  }

  if (state.clarification) {
    const reply = finalReply && finalReply.length > 0
      ? finalReply
      : state.clarification.prompt;
    const followUpQuestion: PlannerQuestion = {
      id: "details",
      field: "details",
      prompt: state.clarification.prompt,
      reason: state.clarification.reason ?? null,
      required: true,
      options: state.clarification.options,
    };
    return {
      ...baseResult,
      mode: "conversational",
      reply,
      proposals: [],
      suggestedReminders: [],
      followUpQuestions: [followUpQuestion],
      sessionState: {
        ...baseResult.sessionState,
        draft: {},
        openQuestionIds: [followUpQuestion.id],
        pendingStarterIntent: "plan_day",
      },
    };
  }

  if (!exitedByModelMessage) {
    recordPlanDayToolFallback({
      reason: "max_iterations",
      model: params.model,
      refining: isRefining,
      iteration: lastIteration,
      proposalCount: state.proposals.length,
      hasClarification: Boolean(state.clarification),
    });
  }

  if (!finalReply || finalReply.length === 0) {
    if (state.proposals.length === 0) {
      recordPlanDayToolFallback({
        reason: "empty_state",
        model: params.model,
        refining: isRefining,
        iteration: lastIteration,
        proposalCount: 0,
        hasClarification: Boolean(state.clarification),
      });
      return null;
    }
    finalReply = baseResult.reply;
  }

  const proposals = state.proposals.slice(0, 5);
  const targetDate = getPlanDayTargetDate(input);
  const dayPlan = synthesizeDayPlanFromProposals(targetDate, proposals);
  return sanitizeReadyQuestProposalResponse({
    ...baseResult,
    mode: proposals.length > 0 ? "proposal" : "conversational",
    reply: finalReply,
    proposals,
    followUpQuestions: [],
    suggestedReminders: [],
    dayPlan,
    sessionState: {
      ...baseResult.sessionState,
      openQuestionIds: [],
    },
  });
}

export async function buildOrchestratedPlannerResponse(params: {
  guardedFetch: typeof fetch;
  input: PlannerBuildInput;
  baseResult: PlannerBuildResult;
  openAIApiKey?: string;
  model?: string;
}): Promise<PlannerBuildResult> {
  const normalizedBaseResult = sanitizeReadyQuestProposalResponse(
    params.baseResult,
  );

  if (
    params.input.plannerContext.starterIntent === "upcoming_start" &&
    params.baseResult.mode === "schedule_read"
  ) {
    return normalizedBaseResult;
  }

  if (isQuestCaptureStarterResponse(params.baseResult)) {
    return normalizedBaseResult;
  }

  if (
    isPhaseADeterministicStarterResponse(params.input, normalizedBaseResult)
  ) {
    return normalizedBaseResult;
  }

  if (hasReadyQuestProposalResponse(params.baseResult)) {
    return normalizedBaseResult;
  }

  const openAIApiKey = params.openAIApiKey ?? Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) {
    return normalizedBaseResult;
  }

  const model = params.model ??
    Deno.env.get("OPENAI_COMPANION_PLANNER_MODEL") ?? "gpt-5";

  if (shouldUsePlanDayToolLoop(params.input, normalizedBaseResult)) {
    try {
      const toolResult = await runPlanDayToolLoop({
        guardedFetch: params.guardedFetch,
        input: params.input,
        baseResult: normalizedBaseResult,
        openAIApiKey,
        model,
      });
      if (toolResult) return toolResult;
    } catch (error) {
      recordPlanDayToolFallback({
        reason: "exception",
        model,
        refining: isPlanDayRefinementTurn(params.input, normalizedBaseResult),
        iteration: -1,
        proposalCount: normalizedBaseResult.proposals.length,
        hasClarification: false,
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const isPlanDayClarification = isPlanDayClarificationResponse(
      params.input,
      params.baseResult,
    );
    const response = await params.guardedFetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAIApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        max_tokens: 260,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: buildSystemPrompt(
              params.baseResult.mode,
              params.input.tonePack,
              { isPlanDayClarification },
            ),
          },
          {
            role: "user",
            content: buildUserPrompt(params.input, params.baseResult),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn(
        "[companion-planner-chat] OpenAI error",
        await response.text(),
      );
      return normalizedBaseResult;
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rawContent) {
      return normalizedBaseResult;
    }

    const parsed = normalizeReply(JSON.parse(rawContent));
    if (!parsed) {
      return normalizedBaseResult;
    }

    return sanitizeReadyQuestProposalResponse({
      ...normalizedBaseResult,
      mode: parsed.mode === params.baseResult.mode
        ? parsed.mode
        : params.baseResult.mode,
      reply: parsed.reply,
    });
  } catch (error) {
    console.warn("[companion-planner-chat] reply orchestration failed", error);
    return normalizedBaseResult;
  }
}
