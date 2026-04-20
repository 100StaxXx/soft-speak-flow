import { normalizePlannerBuildResultText } from "./planner.ts";
import type {
  PlannerBuildInput,
  PlannerBuildResult,
  PlannerResponseMode,
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
) => {
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
    modeInstructions[mode],
    "Return minified JSON with keys reply and mode only.",
  ].join("\n");
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

const isPlanDayDeterministicResponse = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
) =>
  (input.plannerContext.starterIntent === "plan_day" ||
    input.sessionState.pendingStarterIntent === "plan_day") &&
  baseResult.followUpQuestions.length === 0 &&
  (
    baseResult.mode === "proposal" ||
    (
      baseResult.mode === "conversational" &&
      baseResult.proposals.length === 0 &&
      baseResult.suggestedReminders.length === 0
    )
  );

const getReadyQuestProposalDrafts = (
  baseResult: PlannerBuildResult,
) =>
  getReadyQuestPlannerProposals([
    ...baseResult.proposals,
    ...baseResult.suggestedReminders,
  ]);

const hasReadyQuestProposalResponse = (
  baseResult: PlannerBuildResult,
) => baseResult.mode === "proposal" && getReadyQuestProposalDrafts(baseResult).length > 0;

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

  return normalizePlannerBuildResultText({
    ...baseResult,
    reply: shouldReplaceReply
      ? buildConfirmReadyPlannerReply(readyQuestProposals[0]?.kind ?? "")
      : baseResult.reply,
    followUpQuestions: [],
    sessionState: {
      ...baseResult.sessionState,
      openQuestionIds: [],
    },
  });
};

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

  if (isPlanDayDeterministicResponse(params.input, params.baseResult)) {
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
    Deno.env.get("OPENAI_COMPANION_PLANNER_MODEL") ?? "gpt-4.1";

  try {
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
