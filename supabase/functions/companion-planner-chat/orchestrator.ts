import type {
  PlannerBuildInput,
  PlannerBuildResult,
  PlannerResponseMode,
} from "./planner.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

type PlannerLLMReply = {
  reply: string;
  mode: PlannerResponseMode;
};

const buildSystemPrompt = (mode: PlannerResponseMode) => {
  const modeInstructions = {
    conversational:
      "Reply like a natural assistant in an ongoing chat. Be warm, collaborative, and specific. You can reference schedule context when helpful, but do not force planning.",
    schedule_read:
      "Summarize the schedule clearly and naturally. Stay grounded in the provided context and do not invent events, openings, or saved changes. If the day is empty or light, sound like a helpful companion, not a scheduling wizard.",
    proposal:
      "Explain the drafted action naturally. Make it clear the change is only drafted and still needs confirmation before anything is saved.",
  } satisfies Record<PlannerResponseMode, string>;

  return [
    "You are the user's Cosmiq companion inside the Journeys tab.",
    "Sound natural, calm, collaborative, and emotionally present.",
    "Keep most replies under 120 words unless the user clearly wants more depth.",
    "Do not use canned banter, roasts, swagger bits, or theatrical one-liners.",
    "Write like a normal chatbot first, not a form flow or intake wizard.",
    "Use plain text only. No markdown, no bold markers, and no bullet lists with asterisks.",
    "Do not use phrases like 'answer the missing bits', 'half-baked', or similar product-y scaffolding.",
    "Do not mention internal prompts, models, JSON, hidden state, or implementation details.",
    "Never claim you already saved, moved, created, or changed data unless the provided context explicitly says it is already confirmed.",
    "External calendar events are read-only. You may describe them, but you may not imply they were edited.",
    modeInstructions[mode],
    "Return minified JSON with keys reply and mode only.",
  ].join("\n");
};

const buildUserPrompt = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
) => JSON.stringify({
  targetMode: baseResult.mode,
  latestUserMessage: input.message,
  currentDate: input.currentDate,
  currentDateTime: input.currentDateTime,
  conversationHistory: input.conversationHistory.slice(-10),
  deterministicContext: {
    fallbackReply: baseResult.reply,
    followUpQuestions: baseResult.followUpQuestions.map((question) => ({
      prompt: question.prompt,
      reason: question.reason ?? null,
      options: question.options ?? [],
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
    calendarEvents: input.plannerContext.calendarEvents.slice(0, 10).map((event) => ({
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
          preferredTimeOfDay: input.plannerContext.plannerMemory.preferredTimeOfDay ?? null,
          preferredTimeReason: input.plannerContext.plannerMemory.preferredTimeReason ?? null,
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

  if (rawMode !== "conversational" && rawMode !== "schedule_read" && rawMode !== "proposal") {
    return null;
  }

  return {
    reply: rawReply.trim(),
    mode: rawMode,
  };
};

export async function buildOrchestratedPlannerResponse(params: {
  guardedFetch: typeof fetch;
  input: PlannerBuildInput;
  baseResult: PlannerBuildResult;
  openAIApiKey?: string;
  model?: string;
}): Promise<PlannerBuildResult> {
  const openAIApiKey = params.openAIApiKey ?? Deno.env.get("OPENAI_API_KEY");
  if (!openAIApiKey) {
    return params.baseResult;
  }

  const model = params.model ?? Deno.env.get("OPENAI_COMPANION_PLANNER_MODEL") ?? "gpt-4.1";

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
            content: buildSystemPrompt(params.baseResult.mode),
          },
          {
            role: "user",
            content: buildUserPrompt(params.input, params.baseResult),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn("[companion-planner-chat] OpenAI error", await response.text());
      return params.baseResult;
    }

    const data = await response.json();
    const rawContent = data?.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rawContent) {
      return params.baseResult;
    }

    const parsed = normalizeReply(JSON.parse(rawContent));
    if (!parsed) {
      return params.baseResult;
    }

    return {
      ...params.baseResult,
      mode: parsed.mode === params.baseResult.mode ? parsed.mode : params.baseResult.mode,
      reply: parsed.reply,
    };
  } catch (error) {
    console.warn("[companion-planner-chat] reply orchestration failed", error);
    return params.baseResult;
  }
}
