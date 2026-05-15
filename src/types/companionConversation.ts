import type { Json } from "@/integrations/supabase/types";
import type {
  ActionReceiptView,
  CompanionAgentIntent,
  CompanionAgentMode,
  PendingActionView,
} from "@/types/companionAgent";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";
import type {
  PlannerContextCalendarEvent,
  PlannerContextEpic,
  PlannerContextTask,
  PlannerMemoryProfile,
  PlannerScheduleInsights,
} from "@/types/companionPlanner";

export type CompanionConversationMode = "talk" | "plan";
export type CompanionChatSurface = "companion" | "journeys";
export type CompanionChatSource = "chat" | "plan" | "agent";

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

export interface CompanionChatJourneysContext {
  tasks: PlannerContextTask[];
  inboxTasks: PlannerContextTask[];
  activeEpics: PlannerContextEpic[];
  calendarEvents: PlannerContextCalendarEvent[];
  scheduleInsights?: PlannerScheduleInsights;
  plannerMemory?: Pick<
    PlannerMemoryProfile,
    | "preferredTimeOfDay"
    | "preferredTimeReason"
    | "wakeTime"
    | "windDownTime"
  >;
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
  currentDate?: string;
  currentDateTime?: string;
  journeysContext?: CompanionChatJourneysContext;
}

export interface CompanionChatResponse {
  reply: string;
  speechText: string;
  handoffToPlanner: boolean;
  memoryUpdateApplied: boolean;
  persistenceReady: boolean;
  postResponseWorkStatus?: "scheduled" | "completed" | "skipped";
  sessionId?: string;
}

export interface CompanionChatOpenerResponse {
  sessionId: string;
  reply: string;
  speechText: string;
  createdAt: string;
  persistenceReady: boolean;
  thread: CompanionChatThreadSummary;
}

export interface CompanionChatThreadSummary {
  sessionId: string;
  companionId: string;
  surface: CompanionChatSurface;
  title: string;
  previewText: string;
  createdAt: string;
  lastMessageAt: string;
  archivedAt: string | null;
  messageCount: number;
}

export interface CompanionChatThreadMessage {
  id: string;
  sessionId: string;
  role: CompanionChatRole;
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode;
  source: CompanionChatSource;
  metadata?: Json | null;
  mode?: CompanionAgentMode | null;
  intent?: CompanionAgentIntent | null;
  structuredResponse?: CompanionStructuredResponse | null;
  pendingAction?: PendingActionView;
  receipt?: ActionReceiptView;
}
