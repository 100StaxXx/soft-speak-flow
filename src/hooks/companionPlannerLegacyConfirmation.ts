import type { QueryClient } from "@tanstack/react-query";

import { toast } from "@/components/ui/sonner";
import type { CreateQuestParams } from "@/hooks/useQuestMutations";
import {
  applySubtaskTitlePlan,
  type QueueSubtaskAction,
} from "@/features/tasks/lib/subtaskWrites";
import { supabase } from "@/integrations/supabase/client";
import {
  invalidateTaskQueryFamilies,
  invalidateTaskSubtasksQuery,
} from "@/lib/taskQueryCache";
import {
  getPlannerProposalPendingActionMetadata,
  type PlannerPendingActionSupportedProposalKind,
} from "@/shared/companionPlannerPendingAction";
import type {
  CompanionPlannerProposal,
  CompanionPlannerQuestSubtaskPlan,
} from "@/types/companionPlanner";

type CampaignsHookResult =
  ReturnType<typeof import("@/hooks/useCampaigns")["useCampaigns"]>;
type QuestMutationsHookResult =
  ReturnType<typeof import("@/hooks/useQuestMutations")["useQuestMutations"]>;
type RitualUpdateHookResult =
  ReturnType<typeof import("@/hooks/useRitualUpdate")["useRitualUpdate"]>;
type SchedulingLearnerHookResult =
  ReturnType<typeof import("@/hooks/useSchedulingLearner")["useSchedulingLearner"]>;
type ResilienceHookResult =
  ReturnType<typeof import("@/contexts/ResilienceContext")["useResilience"]>;

export type LegacyPlannerConfirmationResult = {
  confirmationContent: string;
  localTaskId: string | null;
  mutationResult: { queued?: boolean } | null;
};

type LegacyPlannerConfirmationHandler = (
  proposal: CompanionPlannerProposal,
) => Promise<LegacyPlannerConfirmationResult>;

type LegacyPlannerTaskSnapshot = {
  id: string;
  scheduled_time?: string | null;
  difficulty?: string | null;
};

type LegacyUpdateQuestProposalPayload = {
  taskId?: unknown;
  updates?: unknown;
  subtaskPlan?: unknown;
};

type LegacyAdjustCampaignPlanPayload = {
  epicId: string;
  adjustmentType?:
    | "extend_deadline"
    | "reduce_scope"
    | "add_habits"
    | "remove_habits"
    | "reschedule"
    | "custom";
  reason?: string | null;
};

type LegacyTrackedCreationInput = {
  preferredTime: string | null | undefined;
  difficulty: string | null | undefined;
  category: string | undefined;
  title: string;
};

export type LegacyPlannerConfirmationHandlers = Record<
  PlannerPendingActionSupportedProposalKind,
  LegacyPlannerConfirmationHandler
>;

export interface CreateLegacyPlannerConfirmationHandlersInput {
  activeTasks: LegacyPlannerTaskSnapshot[];
  inboxTasks: LegacyPlannerTaskSnapshot[];
  userId: string | null | undefined;
  createQuest: QuestMutationsHookResult["createQuest"];
  updateQuest: QuestMutationsHookResult["updateQuest"];
  createCampaign: CampaignsHookResult["createCampaign"];
  renameCampaign: CampaignsHookResult["renameCampaign"];
  createCampaignRitual: CampaignsHookResult["createCampaignRitual"];
  saveRitual: RitualUpdateHookResult["saveRitual"];
  trackTaskCreation: SchedulingLearnerHookResult["trackTaskCreation"];
  trackScheduleModification: SchedulingLearnerHookResult["trackScheduleModification"];
  queueAction: ResilienceHookResult["queueAction"];
  shouldQueueWrites: boolean;
  retryNow: () => Promise<void>;
  queryClient: QueryClient;
}

const createLegacyPlannerConfirmationResult = (
  proposal: Pick<CompanionPlannerProposal, "title">,
  overrides: Partial<LegacyPlannerConfirmationResult> = {},
): LegacyPlannerConfirmationResult => ({
  confirmationContent: `Saved: ${proposal.title}.`,
  localTaskId: null,
  mutationResult: null,
  ...overrides,
});

const asUnknownRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asUnknownStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
      .filter((entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0
      )
      .map((entry) => entry.trim())
    : [];

const extractQuestSubtaskPlan = (
  payload: Record<string, unknown>,
): CompanionPlannerQuestSubtaskPlan | null => {
  const subtaskPlan = asUnknownRecord(payload.subtaskPlan);
  const mode = subtaskPlan?.mode === "append" || subtaskPlan?.mode === "replace"
    ? subtaskPlan.mode
    : null;

  if (!mode) return null;

  return {
    mode,
    titles: asUnknownStringArray(subtaskPlan.titles),
  };
};

const sanitizeCreateQuestProposalPayload = (
  payload: Record<string, unknown>,
): CreateQuestParams => {
  const reminderMinutesBefore =
    typeof payload.reminderMinutesBefore === "number"
      ? payload.reminderMinutesBefore
      : 15;

  return {
    taskText: typeof payload.taskText === "string" ? payload.taskText : "Quest",
    difficulty: payload.difficulty === "easy" || payload.difficulty === "hard"
      ? payload.difficulty
      : "medium",
    source: typeof payload.questSource === "string"
      ? payload.questSource
      : typeof payload.taskDate === "string"
      ? "manual"
      : "inbox",
    taskDate: typeof payload.taskDate === "string" ? payload.taskDate : null,
    scheduledTime: typeof payload.scheduledTime === "string"
      ? payload.scheduledTime
      : null,
    estimatedDuration: typeof payload.estimatedDuration === "number"
      ? payload.estimatedDuration
      : null,
    recurrencePattern: typeof payload.recurrencePattern === "string"
      ? payload.recurrencePattern
      : null,
    recurrenceDays: Array.isArray(payload.recurrenceDays)
      ? payload.recurrenceDays.filter((day): day is number =>
        typeof day === "number" && Number.isInteger(day)
      )
      : null,
    recurrenceMonthDays: Array.isArray(payload.recurrenceMonthDays)
      ? payload.recurrenceMonthDays.filter((day): day is number =>
        typeof day === "number" && Number.isInteger(day)
      )
      : null,
    recurrenceCustomPeriod:
      payload.recurrenceCustomPeriod === "week" ||
        payload.recurrenceCustomPeriod === "month"
        ? payload.recurrenceCustomPeriod
        : null,
    recurrenceEndDate: typeof payload.recurrenceEndDate === "string"
      ? payload.recurrenceEndDate
      : null,
    reminderEnabled: Boolean(payload.reminderEnabled),
    reminderMinutesBefore,
    category: typeof payload.category === "string"
      ? payload.category
      : undefined,
    notes: typeof payload.notes === "string" ? payload.notes : null,
    contactId: typeof payload.contactId === "string" ? payload.contactId : null,
    autoLogInteraction: typeof payload.autoLogInteraction === "boolean"
      ? payload.autoLogInteraction
      : true,
    imageUrl: typeof payload.imageUrl === "string" ? payload.imageUrl : null,
    location: typeof payload.location === "string" ? payload.location : null,
    subtasks: asUnknownStringArray(payload.subtasks),
  };
};

const applyLegacyCampaignPlanAdjustment = async (
  payload: LegacyAdjustCampaignPlanPayload,
) => {
  const { data: adjustmentResult, error: adjustmentError } =
    await supabase.functions.invoke("adjust-epic-plan", {
      body: {
        epicId: payload.epicId,
        adjustmentType: payload.adjustmentType ?? "custom",
        reason: payload.reason ?? undefined,
        customRequest: payload.reason ?? undefined,
      },
    });

  if (adjustmentError) throw adjustmentError;

  const suggestions = Array.isArray(
      (adjustmentResult as { suggestions?: unknown[] } | null)
        ?.suggestions,
    )
    ? (adjustmentResult as { suggestions: unknown[] }).suggestions
    : [];

  if (suggestions.length === 0) {
    throw new Error("No campaign adjustments were generated.");
  }

  const { error: applyError } = await supabase.functions.invoke(
    "apply-epic-adjustments",
    {
      body: {
        epicId: payload.epicId,
        adjustments: suggestions,
        adjustmentType: payload.adjustmentType ?? "custom",
        reason: payload.reason ?? undefined,
      },
    },
  );

  if (applyError) throw applyError;
};

const trackLegacyScheduledCreation = async (
  input: LegacyTrackedCreationInput,
  trackTaskCreation: SchedulingLearnerHookResult["trackTaskCreation"],
) => {
  if (!input.preferredTime) return;

  await trackTaskCreation(
    input.preferredTime,
    input.difficulty ?? "medium",
    input.category,
    input.title,
  );
};

const applyQuestSubtaskPlan = async (
  input: CreateLegacyPlannerConfirmationHandlersInput,
  taskId: string,
  subtaskPlan: CompanionPlannerQuestSubtaskPlan,
) => {
  if (!input.userId) {
    throw new Error("User not authenticated");
  }

  await applySubtaskTitlePlan({
    mode: subtaskPlan.mode,
    taskId,
    userId: input.userId,
    titles: subtaskPlan.titles,
    shouldQueueWrites: input.shouldQueueWrites,
    queueAction: input.queueAction as QueueSubtaskAction,
    retryNow: input.retryNow,
  });

  await Promise.all([
    invalidateTaskSubtasksQuery(input.queryClient, taskId),
    invalidateTaskQueryFamilies(input.queryClient, ["daily", "calendar", "inboxTasks"]),
  ]);
};

export const createLegacyPlannerConfirmationHandlers = (
  input: CreateLegacyPlannerConfirmationHandlersInput,
): LegacyPlannerConfirmationHandlers => ({
  create_quest: async (proposal) => {
    const payload = sanitizeCreateQuestProposalPayload(proposal.payload);
    const createResult = await input.createQuest(payload);
    const localTaskId = typeof createResult?.id === "string"
      ? createResult.id
      : null;
    const mutationResult = createResult as { queued?: boolean } | null;

    await input.trackTaskCreation(
      payload.scheduledTime ?? null,
      payload.difficulty ?? "medium",
      payload.category,
      payload.taskText,
    );

    return createLegacyPlannerConfirmationResult(proposal, {
      localTaskId,
      mutationResult,
    });
  },
  update_quest: async (proposal) => {
    const payload = proposal.payload as LegacyUpdateQuestProposalPayload;
    const taskId = typeof payload.taskId === "string"
      ? payload.taskId
      : null;
    if (!taskId) {
      throw new Error("Missing quest id for update proposal");
    }

    const updates = asUnknownRecord(payload.updates) as
      | Parameters<typeof input.updateQuest>[0]["updates"]
      | null;
    const taskUpdatePayload = {
      taskId,
      updates: updates ?? {},
    } satisfies Parameters<typeof input.updateQuest>[0];
    const subtaskPlan = extractQuestSubtaskPlan(proposal.payload);
    const previousTask = input.activeTasks.find((task) => task.id === taskId) ??
      input.inboxTasks.find((task) => task.id === taskId);

    let confirmationResult = createLegacyPlannerConfirmationResult(proposal, {
      localTaskId: taskId,
      mutationResult: await input.updateQuest(taskUpdatePayload) as {
        queued?: boolean;
      } | null,
    });

    const nextScheduledTime = typeof updates?.scheduled_time === "string"
      ? updates.scheduled_time
      : null;
    if (
      previousTask?.scheduled_time && nextScheduledTime &&
      previousTask.scheduled_time !== nextScheduledTime
    ) {
      await input.trackScheduleModification(
        previousTask.scheduled_time,
        nextScheduledTime,
        previousTask.difficulty ?? "medium",
      );
    }

    if (subtaskPlan) {
      try {
        await applyQuestSubtaskPlan(input, taskId, subtaskPlan);
      } catch (subtaskError) {
        console.error(
          "Failed to apply quest subtask plan:",
          subtaskError,
        );
        confirmationResult = {
          ...confirmationResult,
          confirmationContent:
            `Saved: ${proposal.title}. I couldn't finish the step breakdown yet.`,
        };
        toast(
          "Quest updated, but I couldn't finish the step breakdown yet.",
        );
      }
    }

    return confirmationResult;
  },
  create_campaign: async (proposal) => {
    const payload = proposal.payload as Parameters<typeof input.createCampaign>[0];
    await input.createCampaign(payload);

    await trackLegacyScheduledCreation({
      preferredTime: payload.habits?.[0]?.preferred_time,
      difficulty: payload.habits?.[0]?.difficulty ?? "medium",
      category: payload.habits?.[0]?.category ?? undefined,
      title: payload.habits?.[0]?.title ?? proposal.title,
    }, input.trackTaskCreation);

    return createLegacyPlannerConfirmationResult(proposal);
  },
  update_campaign: async (proposal) => {
    const payload = proposal.payload as Parameters<typeof input.renameCampaign>[0];
    await input.renameCampaign(payload);

    return createLegacyPlannerConfirmationResult(proposal);
  },
  adjust_campaign_plan: async (proposal) => {
    await applyLegacyCampaignPlanAdjustment(
      proposal.payload as LegacyAdjustCampaignPlanPayload,
    );

    return createLegacyPlannerConfirmationResult(proposal);
  },
  create_ritual: async (proposal) => {
    const payload = proposal.payload as unknown as Parameters<
      typeof input.createCampaignRitual
    >[0];
    await input.createCampaignRitual(payload);

    await trackLegacyScheduledCreation({
      preferredTime: payload.preferredTime,
      difficulty: payload.difficulty ?? "medium",
      category: payload.category ?? undefined,
      title: payload.title,
    }, input.trackTaskCreation);

    return createLegacyPlannerConfirmationResult(proposal);
  },
  update_ritual: async (proposal) => {
    const payload = proposal.payload as unknown as Parameters<
      typeof input.saveRitual
    >[0];
    await input.saveRitual(payload);

    await trackLegacyScheduledCreation({
      preferredTime: payload.preferredTime,
      difficulty: payload.difficulty ?? "medium",
      category: payload.category ?? undefined,
      title: payload.title,
    }, input.trackTaskCreation);

    return createLegacyPlannerConfirmationResult(proposal);
  },
  suggest_reminder: async (proposal) => {
    const payload = proposal.payload as unknown as Parameters<
      typeof input.updateQuest
    >[0];
    const mutationResult = await input.updateQuest(payload) as
      | { queued?: boolean }
      | null;

    return createLegacyPlannerConfirmationResult(proposal, {
      localTaskId: payload.taskId,
      mutationResult,
    });
  },
});

export const executeLegacyPlannerProposalConfirmation = async (
  proposal: CompanionPlannerProposal,
  handlers: LegacyPlannerConfirmationHandlers,
) => {
  const metadata = getPlannerProposalPendingActionMetadata(proposal.kind);
  if (!metadata) {
    throw new Error(
      `Unsupported legacy planner confirmation proposal kind: ${proposal.kind}`,
    );
  }

  return handlers[proposal.kind as PlannerPendingActionSupportedProposalKind](
    proposal,
  );
};
