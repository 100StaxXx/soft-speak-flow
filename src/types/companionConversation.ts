export type CompanionConversationMode = "talk" | "plan";
export type CompanionChatSurface = "companion" | "journeys";

export type CompanionChatRole = "assistant" | "user";

export type CompanionChatInputMode = "text" | "voice";

export interface CompanionChatMessage {
  id: string;
  role: CompanionChatRole;
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode;
  handoffToPlanner?: boolean;
}

export interface CompanionConversationProfile {
  preferences: string[];
  goals: string[];
  interests: string[];
  selfDescription: string[];
  conversationStyle: string[];
  lastUpdatedAt: string | null;
}

export interface CompanionChatRequest {
  message: string;
  conversationHistory: Array<{
    role: CompanionChatRole;
    content: string;
  }>;
  companionId: string;
  inputMode: CompanionChatInputMode;
  surface?: CompanionChatSurface;
  sessionId?: string;
}

export interface CompanionChatResponse {
  reply: string;
  speechText: string;
  handoffToPlanner: boolean;
  memoryUpdateApplied: boolean;
  sessionId?: string;
}
