import { buildTaskBreakdownSuggestions } from "../_shared/taskDecomposition.ts";
import type {
  PlannerBuildInput,
  PlannerBuildResult,
  PlannerProposal,
  PlannerQuestion,
  PlannerQuestSubtaskPlan,
} from "./planner.ts";

const ENRICHMENT_PREFERENCE_QUESTION_ID = "quest_enrichment_preference";
const ENRICHMENT_DETAILS_QUESTION_ID = "quest_enrichment_details";
const ENRICHMENT_BREAKDOWN_QUESTION_ID = "quest_enrichment_breakdown";

const KEEP_SIMPLE_OPTION = "Keep it simple";
const ADD_NOTES_OPTION = "Add notes";
const BREAK_IT_DOWN_OPTION = "Break it into steps";

const DETAIL_REQUEST_REGEX =
  /\b(add|save|include|capture|put)\b.*\b(details?|info|information|notes?|description)\b|\b(details?|info|information|notes?|description)\b/i;
const BREAKDOWN_REQUEST_REGEX =
  /\b(break(?:\s+it)?\s+down|steps?|subtasks?|checklist|split it up)\b/i;
const KEEP_SIMPLE_REGEX =
  /\b(keep it simple|basic is fine|just save it|no thanks|skip that|leave it simple)\b/i;
const REPLACE_BREAKDOWN_REGEX =
  /\b(replace|redo|rebuild|rewrite|from scratch|overwrite|swap out)\b/i;

type QuestProposalKind = "create_quest" | "update_quest";

type QuestCreatePayload = {
  taskText?: unknown;
  notes?: unknown;
  subtasks?: unknown;
};

type QuestUpdatePayload = {
  taskId?: unknown;
  updates?: unknown;
  subtaskPlan?: unknown;
};

const isQuestProposal = (
  proposal: PlannerProposal | null | undefined,
): proposal is PlannerProposal & { kind: QuestProposalKind } =>
  proposal?.kind === "create_quest" || proposal?.kind === "update_quest";

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim())
    : [];

const normalizeQuestDetailText = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const normalizeQuestDetailsCandidate = (value: string | null | undefined): string | null => {
  if (!value) return null;

  const normalized = value
    .trim()
    .replace(/^[:;\-]\s*/, "")
    .replace(/\s+/g, " ");

  return normalized.length > 0 ? normalized : null;
};

const normalizeSubtaskTitles = (titles: string[]): string[] => {
  const seen = new Set<string>();

  return titles
    .map((title) => title.trim().replace(/\s+/g, " "))
    .filter((title) => title.length > 0)
    .filter((title) => {
      const key = title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const resolveOpenAIApiKey = (provided?: string): string | undefined => {
  if (provided) return provided;

  try {
    return Deno.env.get("OPENAI_API_KEY") ?? undefined;
  } catch {
    return undefined;
  }
};

const buildQuestion = (input: {
  id: string;
  prompt: string;
  reason?: string | null;
  required: boolean;
  options?: string[];
}): PlannerQuestion => ({
  id: input.id,
  field: "details",
  prompt: input.prompt,
  reason: input.reason ?? null,
  required: input.required,
  options: input.options,
});

const extractPreservedPlannerReplyNotes = (reply: string): string[] =>
  reply
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .filter((segment) =>
      /saved calendar event/i.test(segment) ||
      /external calendar events are read-only/i.test(segment)
    );

const getPrimaryProposal = (
  result: PlannerBuildResult,
): (PlannerProposal & { kind: QuestProposalKind }) | null => {
  const proposal = result.proposals[0];
  return isQuestProposal(proposal) ? proposal : null;
};

const getQuestTitle = (
  proposal: PlannerProposal & { kind: QuestProposalKind },
  input: PlannerBuildInput,
): string => {
  if (proposal.kind === "create_quest") {
    const payload = proposal.payload as QuestCreatePayload;
    return asString(payload.taskText) ??
      input.sessionState.draft.title?.trim() ??
      "this quest";
  }

  const payload = proposal.payload as QuestUpdatePayload;
  const taskId = asString(payload.taskId);
  return input.plannerContext.tasks.find((task) => task.id === taskId)?.title
    ?? input.plannerContext.inboxTasks.find((task) => task.id === taskId)?.title
    ?? input.sessionState.draft.title?.trim()
    ?? "this quest";
};

const getExistingQuestContext = (
  proposal: PlannerProposal & { kind: QuestProposalKind },
  input: PlannerBuildInput,
) => {
  if (proposal.kind !== "update_quest") {
    return {
      notes: null,
      subtaskTitles: [] as string[],
    };
  }

  const payload = proposal.payload as QuestUpdatePayload;
  const taskId = asString(payload.taskId);
  const existingTask = [
    ...input.plannerContext.tasks,
    ...input.plannerContext.inboxTasks,
  ].find((task) => task.id === taskId);

  return {
    notes: existingTask?.notes?.trim() ?? null,
    subtaskTitles: existingTask?.subtaskTitles ?? [],
  };
};

const isPureScheduleOrReminderUpdate = (
  proposal: PlannerProposal & { kind: QuestProposalKind },
): boolean => {
  if (proposal.kind !== "update_quest") return false;

  const payload = proposal.payload as QuestUpdatePayload;
  const updates = payload.updates && typeof payload.updates === "object" && !Array.isArray(payload.updates)
    ? payload.updates as Record<string, unknown>
    : {};

  const updateKeys = Object.keys(updates);
  if (updateKeys.length === 0) return false;

  return updateKeys.every((key) =>
    [
      "task_date",
      "scheduled_time",
      "estimated_duration",
      "reminder_enabled",
      "reminder_minutes_before",
      "recurrence_pattern",
      "recurrence_days",
      "recurrence_month_days",
      "recurrence_custom_period",
      "recurrence_end_date",
    ].includes(key)
  );
};

const isRenameOnlyUpdate = (
  proposal: PlannerProposal & { kind: QuestProposalKind },
): boolean => {
  if (proposal.kind !== "update_quest") return false;

  const payload = proposal.payload as QuestUpdatePayload;
  const updates = payload.updates && typeof payload.updates === "object" && !Array.isArray(payload.updates)
    ? payload.updates as Record<string, unknown>
    : {};

  return Object.keys(updates).length === 1 && typeof updates.task_text === "string";
};

const extractInlineQuestDetails = (
  input: PlannerBuildInput,
): string | null => {
  if (input.parsedInput?.notes) return input.parsedInput.notes.trim();

  const colonMatch = input.message.match(/:\s*(.+)$/);
  if (colonMatch?.[1]) {
    return normalizeQuestDetailsCandidate(colonMatch[1]);
  }

  const withMatch = input.message.match(/\b(?:with|including|for)\b\s+(.+)$/i);
  if (withMatch?.[1]) {
    return normalizeQuestDetailsCandidate(withMatch[1]);
  }

  return null;
};

const wantsBreakdown = (message: string): boolean => BREAKDOWN_REQUEST_REGEX.test(message);

const wantsNotes = (message: string): boolean => DETAIL_REQUEST_REGEX.test(message);

const wantsKeepSimple = (message: string): boolean => KEEP_SIMPLE_REGEX.test(message);

const wantsReplaceBreakdown = (message: string): boolean => REPLACE_BREAKDOWN_REGEX.test(message);

const isQuestCaptureFlow = (input: PlannerBuildInput): boolean =>
  input.sessionState.pendingStarterIntent === "quest_capture";

const shouldOfferQuestEnrichment = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
  proposal: PlannerProposal & { kind: QuestProposalKind },
): boolean => {
  if (baseResult.followUpQuestions.length > 0) return false;
  if (!proposal.readyToConfirm) return false;
  if (input.sessionState.openQuestionIds.length > 0) return false;
  if (isPureScheduleOrReminderUpdate(proposal) || isRenameOnlyUpdate(proposal)) return false;
  if (isQuestCaptureFlow(input)) return false;

  if (wantsBreakdown(input.message) || wantsNotes(input.message)) {
    return true;
  }

  if (proposal.kind !== "create_quest") return false;

  // Default quest creation should go straight to confirm instead of asking
  // whether to add notes or a breakdown.
  return false;
};

const buildQuestEnrichmentSummary = (
  proposal: PlannerProposal & { kind: QuestProposalKind },
  questTitle: string,
  notes: string | null,
  subtasks: string[],
  subtaskPlanMode: PlannerQuestSubtaskPlan["mode"] | null,
): string => {
  if (proposal.kind === "create_quest") {
    if (notes && subtasks.length > 0) {
      return `Create a quest for "${questTitle}" with a short note and ${subtasks.length} subtasks.`;
    }
    if (notes) {
      return `Create a quest for "${questTitle}" with a short note.`;
    }
    if (subtasks.length > 0) {
      return `Create a quest for "${questTitle}" with ${subtasks.length} subtasks.`;
    }
    return proposal.summary;
  }

  if (subtasks.length > 0) {
    return `Update "${questTitle}" and ${subtaskPlanMode === "replace" ? "replace" : "append"} ${subtasks.length} subtasks.`;
  }
  if (notes) {
    return `Update "${questTitle}" with a short note.`;
  }
  return proposal.summary;
};

const withQuestDraftUpdates = (
  input: PlannerBuildInput,
  updates: Partial<PlannerBuildInput["sessionState"]["draft"]>,
): PlannerBuildInput["sessionState"]["draft"] => ({
  ...input.sessionState.draft,
  ...updates,
});

const buildQuestResponse = (
  input: PlannerBuildInput,
  baseResult: PlannerBuildResult,
  proposal: PlannerProposal & { kind: QuestProposalKind },
  options: {
    reply: string;
    followUpQuestions?: PlannerQuestion[];
    missingFields?: string[];
    draftUpdates?: Partial<PlannerBuildInput["sessionState"]["draft"]>;
  },
): PlannerBuildResult => {
  const followUpQuestions = options.followUpQuestions ?? [];
  const missingFields = options.missingFields ?? [];
  const readyToConfirm = followUpQuestions.length === 0 && missingFields.length === 0;
  const preservedNotes = extractPreservedPlannerReplyNotes(baseResult.reply);

  return {
    ...baseResult,
    mode: "proposal",
    reply: [options.reply, ...preservedNotes].filter(Boolean).join("\n\n"),
    followUpQuestions,
    proposals: [
      {
        ...proposal,
        readyToConfirm,
        missingFields,
      },
    ],
    sessionState: {
      ...baseResult.sessionState,
      draft: options.draftUpdates
        ? withQuestDraftUpdates(input, options.draftUpdates)
        : baseResult.sessionState.draft,
      openQuestionIds: followUpQuestions.map((question) => question.id),
    },
  };
};

const buildPreferenceQuestion = (
  questTitle: string,
): PlannerQuestion =>
  buildQuestion({
    id: ENRICHMENT_PREFERENCE_QUESTION_ID,
    prompt:
      `Want me to flesh out "${questTitle}" a bit before I save it? I can keep it simple, save quick notes, or break it into steps.`,
    reason: "A little extra detail can make the quest easier to follow through on.",
    required: true,
    options: [ADD_NOTES_OPTION, BREAK_IT_DOWN_OPTION, KEEP_SIMPLE_OPTION],
  });

const buildDetailsQuestion = (
  questTitle: string,
  wantsBreakdownFlow: boolean,
): PlannerQuestion =>
  buildQuestion({
    id: wantsBreakdownFlow
      ? ENRICHMENT_BREAKDOWN_QUESTION_ID
      : ENRICHMENT_DETAILS_QUESTION_ID,
    prompt: wantsBreakdownFlow
      ? `What details should I use for "${questTitle}" so I can turn it into clear steps?`
      : `What details should I save with "${questTitle}"?`,
    reason: wantsBreakdownFlow
      ? "A little context helps me make the steps more useful."
      : "I want the note to be useful without dumping the whole chat transcript in there.",
    required: true,
  });

const extractAnswerPreference = (
  message: string,
): "simple" | "notes" | "subtasks" | null => {
  if (wantsKeepSimple(message)) return "simple";
  if (wantsBreakdown(message)) return "subtasks";
  if (wantsNotes(message)) return "notes";

  const normalized = message.trim().toLowerCase();
  if (normalized === ADD_NOTES_OPTION.toLowerCase()) return "notes";
  if (normalized === BREAK_IT_DOWN_OPTION.toLowerCase()) return "subtasks";
  if (normalized === KEEP_SIMPLE_OPTION.toLowerCase()) return "simple";
  return null;
};

const buildBreakdownContext = (
  notes: string | null,
  existingNotes: string | null,
  existingSubtaskTitles: string[],
): string | null => {
  const sections = [
    notes ? `Fresh details: ${notes}` : null,
    existingNotes ? `Existing note: ${existingNotes}` : null,
    existingSubtaskTitles.length > 0
      ? `Current subtasks: ${existingSubtaskTitles.join("; ")}`
      : null,
  ].filter((section): section is string => Boolean(section));

  return sections.length > 0 ? sections.join("\n") : null;
};

const buildQuestEnrichmentProposal = async (
  input: PlannerBuildInput,
  proposal: PlannerProposal & { kind: QuestProposalKind },
  params: {
    fetchImpl: typeof fetch;
    openAIApiKey?: string;
    notes: string | null;
    wantsSubtasks: boolean;
    subtaskPlanMode: PlannerQuestSubtaskPlan["mode"];
  },
): Promise<PlannerProposal & { kind: QuestProposalKind }> => {
  const questTitle = getQuestTitle(proposal, input);
  const existingQuestContext = getExistingQuestContext(proposal, input);
  const nextNotes = params.notes
    ? normalizeQuestDetailText(params.notes)
    : proposal.kind === "create_quest"
    ? asString((proposal.payload as QuestCreatePayload).notes)
    : asString(
      (proposal.payload as QuestUpdatePayload).updates &&
        typeof (proposal.payload as QuestUpdatePayload).updates === "object" &&
        !Array.isArray((proposal.payload as QuestUpdatePayload).updates)
        ? ((proposal.payload as QuestUpdatePayload).updates as Record<string, unknown>).notes
        : null,
    );

  let subtasks: string[] = [];
  if (params.wantsSubtasks && params.openAIApiKey) {
    try {
      const suggestions = await buildTaskBreakdownSuggestions({
        fetchImpl: params.fetchImpl,
        openAIApiKey: params.openAIApiKey,
        taskTitle: questTitle,
        taskDescription: buildBreakdownContext(
          nextNotes,
          existingQuestContext.notes,
          existingQuestContext.subtaskTitles,
        ),
      });
      subtasks = normalizeSubtaskTitles(suggestions.map((suggestion) => suggestion.title));
    } catch (error) {
      console.warn("[companion-planner-chat] quest breakdown generation failed", error);
    }
  }

  if (proposal.kind === "create_quest") {
    const payload = proposal.payload as QuestCreatePayload & {
      taskText?: string;
      notes?: string;
      subtasks?: string[];
    };

    return {
      ...proposal,
      summary: buildQuestEnrichmentSummary(
        proposal,
        questTitle,
        nextNotes,
        subtasks,
        null,
      ),
      payload: {
        ...payload,
        ...(nextNotes ? { notes: nextNotes } : {}),
        ...(subtasks.length > 0 ? { subtasks } : {}),
      },
    };
  }

  const payload = proposal.payload as QuestUpdatePayload & {
    taskId?: string;
    updates?: Record<string, unknown>;
    subtaskPlan?: PlannerQuestSubtaskPlan;
  };
  const updates = payload.updates && typeof payload.updates === "object" && !Array.isArray(payload.updates)
    ? payload.updates as Record<string, unknown>
    : {};

  return {
    ...proposal,
    summary: buildQuestEnrichmentSummary(
      proposal,
      questTitle,
      nextNotes,
      subtasks,
      params.subtaskPlanMode,
    ),
    payload: {
      ...payload,
      updates: {
        ...updates,
        ...(nextNotes ? { notes: nextNotes } : {}),
      },
      ...(subtasks.length > 0
        ? {
          subtaskPlan: {
            mode: params.subtaskPlanMode,
            titles: subtasks,
          } satisfies PlannerQuestSubtaskPlan,
        }
        : {}),
    },
  };
};

export async function enrichQuestPlannerResult(params: {
  fetchImpl: typeof fetch;
  input: PlannerBuildInput;
  baseResult: PlannerBuildResult;
  openAIApiKey?: string;
}): Promise<PlannerBuildResult> {
  const openAIApiKey = resolveOpenAIApiKey(params.openAIApiKey);
  const proposal = getPrimaryProposal(params.baseResult);
  if (!proposal) return params.baseResult;

  const questTitle = getQuestTitle(proposal, params.input);
  const stageIds = params.input.sessionState.openQuestionIds;
  const answerPreference = extractAnswerPreference(params.input.message);
  const inlineDetails = normalizeQuestDetailsCandidate(extractInlineQuestDetails(params.input));
  const defaultSubtaskMode = wantsReplaceBreakdown(params.input.message)
    ? "replace"
    : (params.input.sessionState.draft.questSubtaskPlanMode ?? "append");

  if (stageIds.includes(ENRICHMENT_PREFERENCE_QUESTION_ID)) {
    if (answerPreference === "simple") {
      return buildQuestResponse(params.input, params.baseResult, proposal, {
        reply: `Okay. I'll keep "${questTitle}" simple and ready to save.`,
        draftUpdates: {
          questNotes: null,
          questSubtasks: [],
          questSubtaskPlanMode: defaultSubtaskMode,
        },
      });
    }

    if (answerPreference === "notes") {
      if (inlineDetails) {
        const enrichedProposal = await buildQuestEnrichmentProposal(
          params.input,
          proposal,
          {
            fetchImpl: params.fetchImpl,
            openAIApiKey,
            notes: inlineDetails,
            wantsSubtasks: false,
            subtaskPlanMode: defaultSubtaskMode,
          },
        );

        return buildQuestResponse(params.input, params.baseResult, enrichedProposal, {
          reply: `I added a short note to "${questTitle}". Give it a quick look and confirm if it feels right.`,
          draftUpdates: {
            questNotes: inlineDetails,
            questSubtasks: [],
            questSubtaskPlanMode: defaultSubtaskMode,
          },
        });
      }

      return params.baseResult;
    }

    if (answerPreference === "subtasks") {
      if (inlineDetails) {
        const enrichedProposal = await buildQuestEnrichmentProposal(
          params.input,
          proposal,
          {
            fetchImpl: params.fetchImpl,
            openAIApiKey,
            notes: inlineDetails,
            wantsSubtasks: true,
            subtaskPlanMode: defaultSubtaskMode,
          },
        );

        return buildQuestResponse(params.input, params.baseResult, enrichedProposal, {
          reply: `I turned "${questTitle}" into a more detailed draft with steps. Review it and confirm if you want to save it.`,
          draftUpdates: {
            questNotes: inlineDetails,
            questSubtasks: asStringArray(
              proposal.kind === "create_quest"
                ? (enrichedProposal.payload as QuestCreatePayload).subtasks
                : (enrichedProposal.payload as QuestUpdatePayload & { subtaskPlan?: PlannerQuestSubtaskPlan })
                  .subtaskPlan?.titles,
            ),
            questSubtaskPlanMode: defaultSubtaskMode,
          },
        });
      }

      return params.baseResult;
    }
  }

  if (
    stageIds.includes(ENRICHMENT_DETAILS_QUESTION_ID) ||
    stageIds.includes(ENRICHMENT_BREAKDOWN_QUESTION_ID)
  ) {
    if (answerPreference === "simple" || wantsKeepSimple(params.input.message)) {
      return buildQuestResponse(params.input, params.baseResult, proposal, {
        reply: `All right. I'll keep "${questTitle}" simple and ready to save.`,
        draftUpdates: {
          questNotes: null,
          questSubtasks: [],
          questSubtaskPlanMode: defaultSubtaskMode,
        },
      });
    }

    const noteDetails = normalizeQuestDetailsCandidate(
      params.input.parsedInput?.notes ?? params.input.message,
    );

    if (!noteDetails) {
      return params.baseResult;
    }

    const wantsSubtasksFromStage = stageIds.includes(ENRICHMENT_BREAKDOWN_QUESTION_ID);
    const enrichedProposal = await buildQuestEnrichmentProposal(
      params.input,
      proposal,
      {
        fetchImpl: params.fetchImpl,
        openAIApiKey,
        notes: noteDetails,
        wantsSubtasks: wantsSubtasksFromStage,
        subtaskPlanMode: defaultSubtaskMode,
      },
    );

    return buildQuestResponse(params.input, params.baseResult, enrichedProposal, {
      reply: wantsSubtasksFromStage
        ? `I added the details and turned "${questTitle}" into steps. Review the draft and confirm if it looks right.`
        : `I added the details for "${questTitle}". Review the draft and confirm if it looks right.`,
      draftUpdates: {
        questNotes: noteDetails,
        questSubtasks: asStringArray(
          proposal.kind === "create_quest"
            ? (enrichedProposal.payload as QuestCreatePayload).subtasks
            : (enrichedProposal.payload as QuestUpdatePayload & { subtaskPlan?: PlannerQuestSubtaskPlan })
              .subtaskPlan?.titles,
        ),
        questSubtaskPlanMode: defaultSubtaskMode,
      },
    });
  }

  if (wantsBreakdown(params.input.message)) {
    if (!inlineDetails) {
      return params.baseResult;
    }

    const enrichedProposal = await buildQuestEnrichmentProposal(
      params.input,
      proposal,
      {
        fetchImpl: params.fetchImpl,
        openAIApiKey,
        notes: inlineDetails,
        wantsSubtasks: true,
        subtaskPlanMode: defaultSubtaskMode,
      },
    );

    return buildQuestResponse(params.input, params.baseResult, enrichedProposal, {
      reply: `I turned "${questTitle}" into a more detailed draft with steps. Review it and confirm if you want to save it.`,
      draftUpdates: {
        questNotes: inlineDetails,
        questSubtasks: asStringArray(
          proposal.kind === "create_quest"
            ? (enrichedProposal.payload as QuestCreatePayload).subtasks
            : (enrichedProposal.payload as QuestUpdatePayload & { subtaskPlan?: PlannerQuestSubtaskPlan })
              .subtaskPlan?.titles,
        ),
        questSubtaskPlanMode: defaultSubtaskMode,
      },
    });
  }

  if (wantsNotes(params.input.message)) {
    if (!inlineDetails) {
      return params.baseResult;
    }

    const enrichedProposal = await buildQuestEnrichmentProposal(
      params.input,
      proposal,
      {
        fetchImpl: params.fetchImpl,
        openAIApiKey,
        notes: inlineDetails,
        wantsSubtasks: false,
        subtaskPlanMode: defaultSubtaskMode,
      },
    );

    return buildQuestResponse(params.input, params.baseResult, enrichedProposal, {
      reply: `I added a short note to "${questTitle}". Give it a quick look and confirm if it feels right.`,
      draftUpdates: {
        questNotes: inlineDetails,
        questSubtasks: [],
        questSubtaskPlanMode: defaultSubtaskMode,
      },
    });
  }

  if (!shouldOfferQuestEnrichment(params.input, params.baseResult, proposal)) {
    return params.baseResult;
  }

  return buildQuestResponse(params.input, params.baseResult, proposal, {
    reply: `I can make "${questTitle}" more useful before I save it. Want quick notes, a step breakdown, or the basic quest?`,
    followUpQuestions: [buildPreferenceQuestion(questTitle)],
    missingFields: ["whether to keep it simple or add detail"],
    draftUpdates: {
      questSubtaskPlanMode: defaultSubtaskMode,
    },
  });
}
