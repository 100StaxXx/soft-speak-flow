export type CompletionCompanionTone =
  | "proud"
  | "locked_in"
  | "recovery"
  | "calm"
  | "hype";

export type CompletionFeedbackGenerationSource = "fallback" | "ai";

export interface CompletionFeedbackResponse {
  companion: {
    message: string;
    tone: CompletionCompanionTone;
  };
  mentor?: {
    show: boolean;
    personality: string;
    message: string;
  };
  followUp?: {
    label: string;
    action: string;
  };
  generationSource?: CompletionFeedbackGenerationSource;
}

export type CompletionFeedbackSource = "quest" | "ritual" | "inbox";

export interface CompletionFeedbackEvent {
  taskId: string;
  taskTitle: string;
  completionSource?: CompletionFeedbackSource;
  completedAt?: string;
  taskDate?: string | null;
  scheduledTime?: string | null;
  difficulty?: string | null;
  category?: string | null;
  habitSourceId?: string | null;
  epicId?: string | null;
  epicTitle?: string | null;
  completedAllRituals?: boolean;
  firstRitualToday?: boolean;
  firstCompletionToday?: boolean;
  isBuildingMomentum?: boolean;
  isOverloaded?: boolean;
}
