import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { PersonalQuestTemplate, QuestDifficulty, QuestTemplateOrigin } from "@/features/quests/types";
import {
  normalizeQuestTemplateSubtasks,
  normalizeQuestTemplateTextField,
  normalizeQuestTemplateTitleForDisplay,
  normalizeQuestTemplateTitleForIdentity,
} from "@/features/quests/utils/questTemplateNormalization";
import { isValidDifficulty } from "@/types/quest";

type PersonalQuestTemplateRow = Tables<"personal_quest_templates">;
type PersonalQuestTemplateInsert = TablesInsert<"personal_quest_templates">;
type PersonalQuestTemplateUpdate = TablesUpdate<"personal_quest_templates">;

export interface UpsertPersonalQuestTemplateInput {
  userId: string;
  templateId?: string;
  sourceCommonTemplateId?: string | null;
  title: string;
  difficulty: QuestDifficulty;
  estimatedDuration: number | null;
  notes: string | null;
  subtasks: string[];
}

const normalizeDifficulty = (difficulty: string | null): QuestDifficulty =>
  isValidDifficulty(difficulty) ? difficulty : "medium";

export const mapExplicitPersonalQuestTemplate = (
  row: PersonalQuestTemplateRow,
  overrides: Partial<Pick<PersonalQuestTemplate, "frequency" | "lastUsedAt">> = {},
): PersonalQuestTemplate => ({
  id: row.id,
  title: row.title,
  difficulty: normalizeDifficulty(row.difficulty),
  estimatedDuration: row.estimated_duration,
  notes: row.notes,
  subtasks: normalizeQuestTemplateSubtasks(row.subtasks ?? []),
  templateOrigin: "personal_explicit",
  sourceCommonTemplateId: row.source_common_template_id,
  frequency: overrides.frequency ?? 1,
  lastUsedAt: overrides.lastUsedAt ?? row.updated_at ?? row.created_at,
});

const buildTemplatePayload = ({
  userId,
  sourceCommonTemplateId = null,
  title,
  difficulty,
  estimatedDuration,
  notes,
  subtasks,
}: UpsertPersonalQuestTemplateInput): PersonalQuestTemplateInsert => ({
  user_id: userId,
  source_common_template_id: sourceCommonTemplateId,
  normalized_title: normalizeQuestTemplateTitleForIdentity(title),
  title: normalizeQuestTemplateTitleForDisplay(title),
  difficulty,
  estimated_duration: estimatedDuration,
  notes: normalizeQuestTemplateTextField(notes),
  subtasks: normalizeQuestTemplateSubtasks(subtasks),
  updated_at: new Date().toISOString(),
});

export async function fetchExplicitPersonalQuestTemplates(userId: string): Promise<PersonalQuestTemplateRow[]> {
  const { data, error } = await supabase
    .from("personal_quest_templates")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function savePersonalQuestTemplate({
  templateId,
  ...input
}: UpsertPersonalQuestTemplateInput): Promise<PersonalQuestTemplateRow> {
  if (templateId) {
    const updatePayload: PersonalQuestTemplateUpdate = buildTemplatePayload(input);

    const { data, error } = await supabase
      .from("personal_quest_templates")
      .update(updatePayload)
      .eq("id", templateId)
      .eq("user_id", input.userId)
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  const insertPayload = buildTemplatePayload(input);
  const { data, error } = await supabase
    .from("personal_quest_templates")
    .upsert(insertPayload, {
      onConflict: "user_id,normalized_title",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export const isExplicitPersonalQuestTemplate = (origin: QuestTemplateOrigin) =>
  origin === "personal_explicit";
