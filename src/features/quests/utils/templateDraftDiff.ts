import type { QuestDifficulty, QuestTemplatePrefill } from "@/features/quests/types";
import {
  normalizeQuestTemplateSubtasks,
  normalizeQuestTemplateTextField,
  normalizeQuestTemplateTitleForDisplay,
} from "@/features/quests/utils/questTemplateNormalization";

export interface QuestTemplateDraftSnapshot {
  title: string;
  difficulty: QuestDifficulty;
  estimatedDuration: number | null;
  notes: string | null;
  subtasks: string[];
}

const normalizeDraftSnapshot = (draft: QuestTemplateDraftSnapshot) => ({
  title: normalizeQuestTemplateTitleForDisplay(draft.title),
  difficulty: draft.difficulty,
  estimatedDuration: draft.estimatedDuration ?? null,
  notes: normalizeQuestTemplateTextField(draft.notes),
  subtasks: normalizeQuestTemplateSubtasks(draft.subtasks),
});

export const hasQuestTemplateCustomization = (
  template: QuestTemplatePrefill,
  draft: QuestTemplateDraftSnapshot,
) => {
  const normalizedTemplate = normalizeDraftSnapshot(template);
  const normalizedDraft = normalizeDraftSnapshot(draft);

  return normalizedTemplate.title !== normalizedDraft.title
    || normalizedTemplate.difficulty !== normalizedDraft.difficulty
    || normalizedTemplate.estimatedDuration !== normalizedDraft.estimatedDuration
    || normalizedTemplate.notes !== normalizedDraft.notes
    || normalizedTemplate.subtasks.length !== normalizedDraft.subtasks.length
    || normalizedTemplate.subtasks.some((subtask, index) => subtask !== normalizedDraft.subtasks[index]);
};
