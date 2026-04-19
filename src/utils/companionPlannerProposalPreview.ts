import type { CompanionPlannerProposal } from "@/types/companionPlanner";

type QuestSubtaskPlanMode = "append" | "replace";

export interface CompanionPlannerQuestProposalPreview {
  notes: string | null;
  subtasks: string[];
  subtaskPlanMode: QuestSubtaskPlanMode | null;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const asString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim())
    : [];

const asQuestSubtaskPlanMode = (value: unknown): QuestSubtaskPlanMode | null =>
  value === "append" || value === "replace" ? value : null;

export const getCompanionPlannerQuestProposalPreview = (
  proposal: CompanionPlannerProposal,
): CompanionPlannerQuestProposalPreview | null => {
  if (proposal.kind === "create_quest") {
    const payload = asRecord(proposal.payload);
    if (!payload) return null;

    const notes = asString(payload.notes);
    const subtasks = asStringArray(payload.subtasks);

    if (!notes && subtasks.length === 0) {
      return null;
    }

    return {
      notes,
      subtasks,
      subtaskPlanMode: null,
    };
  }

  if (proposal.kind === "update_quest") {
    const payload = asRecord(proposal.payload);
    const updates = asRecord(payload?.updates);
    const subtaskPlan = asRecord(payload?.subtaskPlan);
    const notes = asString(updates?.notes);
    const subtasks = asStringArray(subtaskPlan?.titles);
    const subtaskPlanMode = asQuestSubtaskPlanMode(subtaskPlan?.mode);

    if (!notes && subtasks.length === 0) {
      return null;
    }

    return {
      notes,
      subtasks,
      subtaskPlanMode,
    };
  }

  return null;
};
