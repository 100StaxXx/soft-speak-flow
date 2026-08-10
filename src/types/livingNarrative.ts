export type LivingNarrativeSourceType = "story" | "postcard";
export type LivingNarrativeMemoryType =
  | "choice"
  | "discovery"
  | "promise"
  | "reflection"
  | "item"
  | "relationship";

export interface LivingNarrativeOption {
  key: string;
  label: string;
  detail: string;
  memoryType: LivingNarrativeMemoryType;
  memorySummary: string;
  consequenceTags: string[];
  companionReply: string;
  sideQuestTitle?: string;
}

export interface LivingNarrativePrompt {
  promptKey: string;
  question: string;
  contextLabel: string;
  options: LivingNarrativeOption[];
}

export interface CompanionNarrativeChoice {
  id: string;
  user_id: string;
  companion_id: string;
  epic_id: string | null;
  source_type: LivingNarrativeSourceType;
  source_id: string;
  stage: number | null;
  chapter_number: number | null;
  prompt_key: string;
  prompt_text: string;
  option_key: string;
  option_label: string;
  response_note: string | null;
  consequence_tags: string[];
  companion_reply: string | null;
  side_quest_title: string | null;
  side_quest_status: "proposed" | "accepted" | "dismissed";
  side_quest_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanionNarrativeMemory {
  id: string;
  user_id: string;
  companion_id: string;
  epic_id: string | null;
  source_choice_id: string | null;
  memory_type: LivingNarrativeMemoryType;
  memory_key: string;
  summary: string;
  details: Record<string, unknown>;
  salience: number;
  status: "active" | "resolved" | "retired";
  created_at: string;
  updated_at: string;
}
