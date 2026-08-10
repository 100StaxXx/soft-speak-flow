import type { CompletionCompanionTone } from "@/types/completionFeedback";

export interface CompanionTalkPopupAction {
  label: string;
  ariaLabel?: string;
  onSelect: () => void | Promise<void>;
}

export interface CompanionTalkPopupShowOptions {
  message: string;
  tone?: CompletionCompanionTone;
  mentor?: {
    personality: string;
    message: string;
  };
  action?: CompanionTalkPopupAction | null;
  companionName?: string | null;
  companionImageUrl?: string;
  companionImageFocalX?: number | null;
  companionImageFocalY?: number | null;
}
