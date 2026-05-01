import {
  buildOptimizerQuestProposal,
  buildPlanDayCampaignGoalsAtRiskLine,
  buildPlanDayLoadReason,
  formatScheduleReference,
  getActiveCampaignIdSet,
  getPlanDayAtRiskCampaignFacts,
  getPlanDayLoadBreakdown,
  getPlanDayLoadFacts,
  getPlanDayTargetDate,
  inferEnergyTypeFromTitle,
  scopePlannerRitualsToActiveCampaigns,
  scopePlannerTasksToActiveCampaigns,
} from "./planner.ts";
import type {
  OptimizerDraftCandidate,
  PlannerBuildInput,
  PlannerProposal,
} from "./planner.ts";

export const PLAN_DAY_TOOL_NAMES = {
  propose: "propose_quest",
  move: "move_quest",
  drop: "drop_quest",
  clarify: "ask_clarification",
} as const;

export const PLAN_DAY_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: PLAN_DAY_TOOL_NAMES.propose,
      description:
        "Add a new draft quest to today's plan. Call this for each quest you want to suggest. Use the schedule context to pick a realistic time and duration that doesn't collide with calendar blocks or existing quests.",
      parameters: {
        type: "object",
        properties: {
          title: {
            type: "string",
            description:
              "Short, action-oriented quest title (3-6 words). Example: 'Outline launch email'.",
          },
          startTime: {
            type: ["string", "null"],
            description:
              "HH:MM in 24-hour format. Use null if the quest is flexible and should land in the inbox.",
          },
          durationMinutes: {
            type: "integer",
            description:
              "Estimated duration in minutes (typically 15-90).",
          },
          energyType: {
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
            description: "Best-fit energy type for this work.",
          },
          source: {
            type: "string",
            enum: ["campaign", "habit", "recovery", "optimization"],
            description:
              "Why the quest exists: campaign work, a recurring habit, recovery/movement, or general optimization.",
          },
          reasoning: {
            type: "string",
            description:
              "One short sentence explaining why this quest fits today, grounded in planDayContext.",
          },
        },
        required: [
          "title",
          "durationMinutes",
          "energyType",
          "source",
          "reasoning",
        ],
      },
    },
  },
  {
    type: "function",
    function: {
      name: PLAN_DAY_TOOL_NAMES.move,
      description:
        "Update the start time of an existing draft proposal. Use this to resolve a conflict or sequence the day better.",
      parameters: {
        type: "object",
        properties: {
          proposalId: {
            type: "string",
            description:
              "The id of an existing proposal from candidatePlan.proposals.",
          },
          startTime: {
            type: ["string", "null"],
            description: "New HH:MM time, or null to make it flexible.",
          },
        },
        required: ["proposalId", "startTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: PLAN_DAY_TOOL_NAMES.drop,
      description:
        "Remove a candidate proposal from the day. Use this to cut crowding or duplicates.",
      parameters: {
        type: "object",
        properties: {
          proposalId: {
            type: "string",
            description:
              "The id of an existing proposal from candidatePlan.proposals.",
          },
          reason: {
            type: "string",
            description: "Short rationale for dropping it.",
          },
        },
        required: ["proposalId", "reason"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: PLAN_DAY_TOOL_NAMES.clarify,
      description:
        "When the user's direction is too thin to plan against, ask one focused clarifying question instead of guessing. This ends the planning turn.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "The single clarifying question to ask the user.",
          },
          reason: {
            type: ["string", "null"],
            description:
              "Optional one-line rationale explaining why this question is needed.",
          },
          options: {
            type: "array",
            items: { type: "string" },
            description:
              "Optional list of suggested answers (2-4 short options).",
          },
        },
        required: ["prompt"],
      },
    },
  },
] as const;

export type PlanDayToolCall = {
  id: string;
  name: string;
  argumentsJson: string;
};

export type PlanDayClarification = {
  prompt: string;
  reason: string | null;
  options: string[];
};

export type PlanDayToolState = {
  proposals: PlannerProposal[];
  clarification: PlanDayClarification | null;
  toolEvents: Array<{
    name: string;
    success: boolean;
    detail: string;
  }>;
};

const HHMM_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

const sanitizeTime = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!HHMM_PATTERN.test(trimmed)) return null;
  const [hh, mm] = trimmed.split(":");
  return `${hh.padStart(2, "0")}:${mm}`;
};

const sanitizeTitle = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 80) return null;
  return trimmed;
};

const sanitizeDuration = (value: unknown): number | null => {
  const n = typeof value === "number"
    ? value
    : typeof value === "string"
    ? Number.parseInt(value, 10)
    : NaN;
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return Math.min(Math.max(Math.round(n), 5), 240);
};

const ENERGY_TYPES = new Set([
  "deep",
  "admin",
  "physical",
  "errand",
  "social",
  "creative",
  "recovery",
]);

const sanitizeEnergyType = (
  value: unknown,
): OptimizerDraftCandidate["energyType"] | null => {
  if (typeof value !== "string" || !ENERGY_TYPES.has(value)) return null;
  return value as OptimizerDraftCandidate["energyType"];
};

const mapSourceToPriority = (source: unknown): number => {
  switch (source) {
    case "campaign":
      return 5;
    case "habit":
      return 4;
    case "recovery":
      return 3;
    case "optimization":
      return 2;
    default:
      return 2;
  }
};

const createCandidateId = (): string =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `cand_${Math.random().toString(36).slice(2)}`;

export const initializePlanDayToolState = (
  baseProposals: PlannerProposal[],
): PlanDayToolState => ({
  proposals: baseProposals.slice(),
  clarification: null,
  toolEvents: [],
});

const recordEvent = (
  state: PlanDayToolState,
  name: string,
  success: boolean,
  detail: string,
): void => {
  state.toolEvents.push({ name, success, detail });
};

const handlePropose = (
  input: PlannerBuildInput,
  state: PlanDayToolState,
  args: Record<string, unknown>,
): string => {
  const title = sanitizeTitle(args.title);
  const duration = sanitizeDuration(args.durationMinutes);
  const energyType = sanitizeEnergyType(args.energyType);
  const startTime = sanitizeTime(args.startTime);
  const reasoning = typeof args.reasoning === "string"
    ? args.reasoning.trim()
    : "";
  const source = typeof args.source === "string" ? args.source : "optimization";
  if (!title) {
    recordEvent(state, "propose_quest", false, "missing or invalid title");
    return JSON.stringify({ ok: false, error: "invalid_title" });
  }
  if (!duration) {
    recordEvent(state, "propose_quest", false, "missing duration");
    return JSON.stringify({ ok: false, error: "invalid_duration" });
  }
  if (!reasoning) {
    recordEvent(state, "propose_quest", false, "missing reasoning");
    return JSON.stringify({ ok: false, error: "missing_reasoning" });
  }

  const targetDate = getPlanDayTargetDate(input);
  const candidate: OptimizerDraftCandidate = {
    id: createCandidateId(),
    dedupeKey: title.toLowerCase(),
    title,
    scheduledDate: targetDate,
    scheduledTime: startTime,
    estimatedDuration: duration,
    reasoning,
    energyType: energyType ?? inferEnergyTypeFromTitle(title),
    confidence: 0.85,
    derivedFromMessage: input.message,
    priority: mapSourceToPriority(source),
  };
  const proposal = buildOptimizerQuestProposal(input, candidate);
  state.proposals.push(proposal);
  recordEvent(state, "propose_quest", true, `added ${title}`);
  return JSON.stringify({
    ok: true,
    proposalId: proposal.id,
    title,
    startTime,
    durationMinutes: duration,
  });
};

const handleMove = (
  state: PlanDayToolState,
  args: Record<string, unknown>,
): string => {
  const proposalId = typeof args.proposalId === "string"
    ? args.proposalId
    : null;
  const startTime = sanitizeTime(args.startTime);
  if (!proposalId) {
    recordEvent(state, "move_quest", false, "missing proposalId");
    return JSON.stringify({ ok: false, error: "missing_proposal_id" });
  }
  const index = state.proposals.findIndex((p) => p.id === proposalId);
  if (index === -1) {
    recordEvent(state, "move_quest", false, `unknown id ${proposalId}`);
    return JSON.stringify({ ok: false, error: "proposal_not_found" });
  }
  const existing = state.proposals[index];
  const payload = (existing.payload ?? {}) as Record<string, unknown>;
  state.proposals[index] = {
    ...existing,
    payload: { ...payload, scheduledTime: startTime },
  };
  recordEvent(state, "move_quest", true, `${proposalId} -> ${startTime}`);
  return JSON.stringify({ ok: true, proposalId, startTime });
};

const handleDrop = (
  state: PlanDayToolState,
  args: Record<string, unknown>,
): string => {
  const proposalId = typeof args.proposalId === "string"
    ? args.proposalId
    : null;
  if (!proposalId) {
    recordEvent(state, "drop_quest", false, "missing proposalId");
    return JSON.stringify({ ok: false, error: "missing_proposal_id" });
  }
  const before = state.proposals.length;
  state.proposals = state.proposals.filter((p) => p.id !== proposalId);
  if (state.proposals.length === before) {
    recordEvent(state, "drop_quest", false, `unknown id ${proposalId}`);
    return JSON.stringify({ ok: false, error: "proposal_not_found" });
  }
  recordEvent(state, "drop_quest", true, `removed ${proposalId}`);
  return JSON.stringify({ ok: true, proposalId });
};

const handleClarify = (
  state: PlanDayToolState,
  args: Record<string, unknown>,
): string => {
  const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
  if (!prompt) {
    recordEvent(state, "ask_clarification", false, "missing prompt");
    return JSON.stringify({ ok: false, error: "missing_prompt" });
  }
  const reason = typeof args.reason === "string" && args.reason.trim().length > 0
    ? args.reason.trim()
    : null;
  const options = Array.isArray(args.options)
    ? args.options
      .filter((opt): opt is string => typeof opt === "string")
      .map((opt) => opt.trim())
      .filter((opt) => opt.length > 0)
      .slice(0, 4)
    : [];
  state.clarification = { prompt, reason, options };
  state.proposals = [];
  recordEvent(state, "ask_clarification", true, prompt);
  return JSON.stringify({ ok: true });
};

export const executePlanDayToolCall = (
  input: PlannerBuildInput,
  state: PlanDayToolState,
  toolCall: PlanDayToolCall,
): string => {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(toolCall.argumentsJson || "{}");
    if (typeof args !== "object" || args === null || Array.isArray(args)) {
      args = {};
    }
  } catch {
    recordEvent(state, toolCall.name, false, "invalid json arguments");
    return JSON.stringify({ ok: false, error: "invalid_arguments" });
  }
  switch (toolCall.name) {
    case PLAN_DAY_TOOL_NAMES.propose:
      return handlePropose(input, state, args);
    case PLAN_DAY_TOOL_NAMES.move:
      return handleMove(state, args);
    case PLAN_DAY_TOOL_NAMES.drop:
      return handleDrop(state, args);
    case PLAN_DAY_TOOL_NAMES.clarify:
      return handleClarify(state, args);
    default:
      recordEvent(state, toolCall.name, false, "unknown tool");
      return JSON.stringify({ ok: false, error: "unknown_tool" });
  }
};

export const buildPlanDayToolSystemPrompt = (
  tonePack: PlannerBuildInput["tonePack"],
  options?: { isRefining?: boolean },
): string => {
  const isRefining = Boolean(options?.isRefining);
  const toneInstruction = tonePack === "witty_sassy"
    ? "Voice: bold cheekiness, roasty edge, and a little swagger are allowed. Keep it affectionate underneath."
    : tonePack === "playful"
    ? "Voice: lightly playful and friendly."
    : "Voice: warm, grounded, and supportive.";

  const planningRules = isRefining
    ? [
      "How to refine:",
      "1. candidatePlan.proposals is the user's CURRENT draft plan that they want to adjust. Treat it as load-bearing and only change what they ask for.",
      "2. Use move_quest to retime an existing block, drop_quest to remove one they don't want, and propose_quest only when they ask to add something new.",
      "3. Don't reset or rewrite the plan unless the user explicitly says start over.",
      "4. If the user's request is unrelated to the plan, send a short reply with no tool calls. The existing plan will stay as is.",
      "5. If the request is ambiguous (e.g. 'shift it later' with no time), call ask_clarification with one focused question.",
    ].join("\n")
    : [
      "How to plan:",
      "1. candidatePlan.proposals is the deterministic starting plan. Keep what fits, call move_quest to retime, drop_quest to remove crowding or duplicates, and propose_quest to add anything missing. Each call mutates the working plan.",
      "2. A balanced day is usually three to five quests. Honor existing scheduled tasks and calendar events. Do not double-book.",
      "3. Place 'deep' energy work in peakProductivityTimes when known; 'admin' or 'errand' in dips; 'recovery' near windDownTime.",
      "4. If the user's direction is genuinely too thin (no concrete focus, no anchors, no useful context) call ask_clarification with one focused question and stop. Otherwise commit to a plan.",
    ].join("\n");

  return [
    "You are Cosmiq, an AI day-planning companion. Your job is to shape the user's day using the structured tools provided, then write one short message explaining what you did.",
    toneInstruction,
    "planDayContext is your read-only world model. loadFacts, atRiskCampaigns, calendar events, suggestedSlots, plannerMemory, and candidatePlan.proposals are facts. Do not invent anything outside it.",
    planningRules,
    "After you finish all tool calls, send one final assistant message (no further tool calls) with a short, conversational reply: 1-3 sentences, plain text, no markdown. Acknowledge the user's direction, briefly say what changed, and call out at-risk campaigns when atRiskCampaigns is non-empty. If you called ask_clarification, your final text should match the prompt you passed to it.",
    "Do not use dash punctuation as a separator in user facing copy. Use commas, periods, or short sentences instead. Preserve real dates, time ranges, IDs, and user provided titles.",
    "Do not mention internal tools, JSON, or your own reasoning steps in the user-facing reply.",
  ].join("\n");
};

const summarizeProposalForPrompt = (proposal: PlannerProposal) => {
  const payload = (proposal.payload ?? {}) as Record<string, unknown>;
  return {
    id: proposal.id,
    title: typeof payload.taskText === "string"
      ? payload.taskText
      : proposal.title,
    scheduledTime: payload.scheduledTime ?? null,
    durationMinutes: payload.estimatedDuration ?? null,
    source: payload.source ?? null,
    reasoning: proposal.reasoning ?? null,
  };
};

export const buildPlanDayToolUserPrompt = (
  input: PlannerBuildInput,
  baseProposals: PlannerProposal[],
  options?: { isRefining?: boolean },
): string => {
  const isRefining = Boolean(options?.isRefining);
  const targetDate = getPlanDayTargetDate(input);
  const loadBreakdown = getPlanDayLoadBreakdown(input, targetDate);
  const dateLabel = formatScheduleReference(input.currentDate, targetDate);
  const ctx = input.plannerContext;
  const activeCampaignIds = getActiveCampaignIdSet(input);
  const scopedTasks = scopePlannerTasksToActiveCampaigns(
    ctx.tasks,
    activeCampaignIds,
  );
  const scopedInboxTasks = scopePlannerTasksToActiveCampaigns(
    ctx.inboxTasks,
    activeCampaignIds,
  );
  const scopedRituals = scopePlannerRitualsToActiveCampaigns(
    ctx.rituals,
    activeCampaignIds,
  );
  return JSON.stringify({
    currentDate: input.currentDate,
    currentDateTime: input.currentDateTime,
    targetDate,
    dateLabel,
    tonePack: input.tonePack,
    latestUserMessage: input.message,
    plannedEnergy: input.sessionState.planDayEnergy ?? null,
    conversationHistory: input.conversationHistory.slice(-8),
    refinementMode: isRefining,
    planDayContext: {
      loadFacts: getPlanDayLoadFacts(input, loadBreakdown),
      atRiskCampaigns: getPlanDayAtRiskCampaignFacts(input),
      loadReason: buildPlanDayLoadReason(input, dateLabel, loadBreakdown),
      atRiskLine: buildPlanDayCampaignGoalsAtRiskLine(input, baseProposals),
      candidatePlan: {
        proposals: baseProposals.map(summarizeProposalForPrompt),
      },
      pendingTasksToday: scopedTasks
        .filter((t) =>
          t.completed !== true && t.taskDate === input.currentDate
        )
        .slice(0, 12)
        .map((t) => ({
          title: t.title,
          scheduledTime: t.scheduledTime,
          durationMinutes: t.estimatedDuration,
          epicTitle: t.epicTitle ?? null,
        })),
      missedTasks: scopedTasks
        .filter((t) =>
          t.completed !== true &&
          t.taskDate !== null &&
          t.taskDate < input.currentDate
        )
        .slice(0, 6)
        .map((t) => ({ title: t.title, taskDate: t.taskDate })),
      inboxTasks: scopedInboxTasks.slice(0, 8).map((t) => ({
        title: t.title,
        epicTitle: t.epicTitle ?? null,
      })),
      activeCampaigns: ctx.activeEpics.slice(0, 5).map((e) => ({
        title: e.title,
        endDate: e.endDate,
        progressPercentage: e.progressPercentage ?? null,
      })),
      rituals: scopedRituals.slice(0, 5).map((r) => ({
        title: r.title,
        epicTitle: r.epicTitle,
        frequency: r.frequency,
        preferredTime: r.preferredTime,
      })),
      calendarEvents: ctx.calendarEvents.slice(0, 8).map((e) => ({
        title: e.title,
        start: e.start,
        end: e.end,
      })),
      scheduleInsights: ctx.scheduleInsights
        ? {
          dayLoadStatus: ctx.scheduleInsights.dayLoads.find((d) =>
            d.date === targetDate
          )?.status ?? null,
          suggestedSlots: ctx.scheduleInsights.suggestedSlots
            .filter((slot) => slot.date === targetDate)
            .slice(0, 4)
            .map((slot) => ({
              start: slot.time,
              end: slot.endTime,
              reason: slot.reason ?? null,
            })),
        }
        : null,
      plannerMemory: ctx.plannerMemory
        ? {
          peakProductivityTimes: ctx.plannerMemory.peakProductivityTimes ?? [],
          wakeTime: ctx.plannerMemory.wakeTime ?? null,
          windDownTime: ctx.plannerMemory.windDownTime ?? null,
          workloadTolerance: ctx.plannerMemory.workloadTolerance ?? null,
          preferredTimeOfDay: ctx.plannerMemory.preferredTimeOfDay ?? null,
        }
        : null,
      behaviorSignals: ctx.statInterpretation
        ? {
          momentumState: ctx.statInterpretation.momentumState,
          recentMissInterpretation:
            ctx.statInterpretation.recentMissInterpretation,
        }
        : null,
    },
  });
};
