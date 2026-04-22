import { useCallback, useMemo } from "react";

import { toast } from "@/components/ui/sonner";
import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionChat } from "@/hooks/useCompanionChat";
import { useCompanionPlanner } from "@/hooks/useCompanionPlanner";
import { useJourneysCompanionConversation } from "@/hooks/useJourneysCompanionConversation";
import { useJourneysCompanionThreads } from "@/hooks/useJourneysCompanionThreads";
import { stripMarkdown } from "@/lib/utils";
import {
  analyzeSchedulingIntent,
  shouldRouteMessageToPlanner,
} from "@/shared/schedulingIntent";
import {
  isGoalBreakdownStarterMessage,
  looksLikeBigGoal,
} from "@/shared/bigGoalIntent";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";
import { getPlannerProposalPendingActionMetadata } from "@/shared/companionPlannerPendingAction";
import type { Json } from "@/integrations/supabase/types";
import type { PendingActionView } from "@/types/companionAgent";
import type {
  CompanionChatInputMode,
  CompanionChatThreadSummary,
} from "@/types/companionConversation";
import type {
  CompanionPlannerLaunchIntent,
  CompanionPlannerPendingNotice,
} from "@/types/companionPlanner";
import { formatCurrentDateTimeWithOffset } from "@/utils/currentDateTime";

export type LegacyCompanionAssistantMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode;
  source: "chat" | "plan";
  isSeed?: boolean;
};

type LegacyCompanionAssistantAsyncAction = () => Promise<void>;

type LegacyCompanionAssistantAcceptSuggestedQuest = (
  proposalId: string,
) => Promise<void | undefined>;

export interface LegacyCompanionAssistantState {
  messages: LegacyCompanionAssistantMessage[];
  structuredResponse: CompanionStructuredResponse | null;
  pendingAction: PendingActionView | null;
  unsupportedPendingProposalNotice: CompanionPlannerPendingNotice | null;
  placeholder: string;
  todayLabel: string;
  isSubmitting: boolean;
  isResolvingAction: boolean;
  submitMessage: (
    rawMessage: string,
    inputMode?: CompanionChatInputMode,
  ) => Promise<void>;
  acceptSuggestedQuest: LegacyCompanionAssistantAcceptSuggestedQuest;
  canAcceptSuggestedQuests: boolean;
  suggestedQuestDisabledReason: string | null;
  confirmPendingAction: LegacyCompanionAssistantAsyncAction;
  cancelPendingAction: LegacyCompanionAssistantAsyncAction;
  isSpeaking: boolean;
  speechProvider: "device" | "cloud" | "none";
  stopSpeaking: () => void;
  activeThread: CompanionChatThreadSummary | null;
  historyThreads: CompanionChatThreadSummary[];
  isLoadingThreads: boolean;
  hasPersistedActiveThread: boolean;
  canOpenThreadPicker: boolean;
  threadPickerDisabledReason: string | null;
  threadHistoryEmptyStateMessage: string;
  resumeThread: (sessionId: string) => Promise<void>;
  archiveCurrentThread: LegacyCompanionAssistantAsyncAction;
  canArchiveThread: boolean;
  archiveDisabledReason: string | null;
  startNewChat: LegacyCompanionAssistantAsyncAction;
  canStartNewChat: boolean;
  newChatDisabledReason: string | null;
}

type CompanionAssistantSurface = "companion" | "journeys";

type UseLegacyCompanionAssistantAdapterOptions = {
  enabled: boolean;
  surface: CompanionAssistantSurface;
  conversationEnabled?: boolean;
  onOpenCampaignBuilder?: (message: string) => void;
};

const normalizeConversationMessages = (
  messages: Array<{
    id: string;
    role: "assistant" | "user";
    content: string;
    createdAt: string;
    inputMode?: CompanionChatInputMode;
    isSeed?: boolean;
  }>,
): LegacyCompanionAssistantMessage[] =>
  messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.role === "assistant"
      ? stripMarkdown(message.content)
      : message.content,
    createdAt: message.createdAt,
    inputMode: message.inputMode,
    source: "chat",
    isSeed: message.isSeed,
  }));

const normalizePlannerMessages = (
  messages: Array<{
    id: string;
    role: "companion" | "user";
    content: string;
    createdAt: string;
    inputMode?: CompanionChatInputMode;
  }>,
): LegacyCompanionAssistantMessage[] =>
  messages.map((message) => ({
    id: message.id,
    role: message.role === "companion" ? "assistant" : "user",
    content: message.role === "companion"
      ? stripMarkdown(message.content)
      : message.content,
    createdAt: message.createdAt,
    inputMode: message.inputMode,
    source: "plan",
    isSeed: false,
  }));

const sortMessages = (messages: LegacyCompanionAssistantMessage[]) =>
  messages
    .slice()
    .sort((left, right) => (
      left.createdAt.localeCompare(right.createdAt)
      || left.id.localeCompare(right.id)
    ));

const shouldRouteToLegacyPlanner = (
  surface: CompanionAssistantSurface,
  message: string,
  hasOpenPlannerThread: boolean,
): boolean => {
  const parsed = parseNaturalLanguage(message);
  const analysis = analyzeSchedulingIntent(message, parsed);

  return shouldRouteMessageToPlanner({
    surface,
    analysis,
    hasOpenPlannerThread,
  });
};

const isExactQuestCaptureStarterMessage = (message: string): boolean =>
  message.trim().toLowerCase() === "quest?";

const isExactPlanDayStarterMessage = (message: string): boolean =>
  message.trim().toLowerCase() === "plan my day";

const mapLegacyProposalToPendingAction = (
  proposal: {
    id: string;
    kind: string;
    summary: string;
    reasoning?: string | null;
    payload: Record<string, unknown>;
  } | null,
): PendingActionView | null => {
  if (!proposal) return null;

  const metadata = getPlannerProposalPendingActionMetadata(proposal.kind);
  if (!metadata) return null;

  return {
    id: proposal.id,
    status: "pending",
    intent: metadata.intent,
    actionType: metadata.actionType,
    summary: proposal.summary,
    confirmationMessage: proposal.reasoning ?? "Want me to lock that in?",
    normalizedPayload: proposal.payload as unknown as Json,
    affectedEntities: null,
    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 12)).toISOString(),
    createdAt: new Date().toISOString(),
  };
};

export function useLegacyCompanionAssistantAdapter({
  enabled,
  surface,
  conversationEnabled = true,
  onOpenCampaignBuilder,
}: UseLegacyCompanionAssistantAdapterOptions): LegacyCompanionAssistantState {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const companionChat = useCompanionChat({
    enabled: enabled && surface === "companion" && conversationEnabled,
  });
  const journeysConversation = useJourneysCompanionConversation({
    enabled: enabled && surface === "journeys",
  });
  const planner = useCompanionPlanner({
    enabled,
    legacyExecutionEnabled: enabled,
    threadPersistence: surface === "journeys"
      ? {
        enabled: true,
        surface: "journeys",
      }
      : undefined,
  });
  const conversation = surface === "journeys" ? journeysConversation : companionChat;

  const messages = useMemo(() => (
    sortMessages([
      ...normalizeConversationMessages(conversation.messages),
      ...normalizePlannerMessages(planner.messages),
    ])
  ), [conversation.messages, planner.messages]);

  const hasOpenPlannerThread = planner.questions.length > 0
    || planner.pendingProposals.some((proposal) => proposal.status === "pending")
    || Boolean(planner.sessionState.pendingStarterIntent);

  const journeysThreads = useJourneysCompanionThreads({
    enabled: enabled && surface === "journeys",
    userId: user?.id,
    companionId: companion?.id,
    messages: surface === "journeys" ? messages : [],
    persistenceReady: journeysConversation.threadPersistenceReady,
    persistenceUnavailableReason: journeysConversation.threadPersistenceUnavailableReason,
    hasPendingPlannerWork: hasOpenPlannerThread,
    isBusy: planner.isSubmitting || planner.isClassifying || conversation.isSubmitting,
    conversation: {
      resetThread: journeysConversation.resetThread,
      hydrateThread: journeysConversation.hydrateThread,
    },
    planner: {
      resetThread: planner.resetThread,
      hydrateThread: planner.hydrateThread,
    },
  });

  const activePendingProposal = useMemo(
    () => planner.legacyConfirmation.activePendingProposal,
    [planner.legacyConfirmation.activePendingProposal],
  );
  const pendingAction = useMemo(
    () => mapLegacyProposalToPendingAction(activePendingProposal),
    [activePendingProposal],
  );
  const unsupportedPendingProposalNotice = planner.legacyConfirmation
    .unsupportedPendingProposalNotice;
  const unsupportedJourneysDraftThreadReason = surface === "journeys" && unsupportedPendingProposalNotice
    ? "Keep this thread open while the visible pending draft is still unresolved."
    : null;
  const noopAsync = useCallback(async (..._args: unknown[]) => undefined, []);
  const noopSync = useCallback((..._args: unknown[]) => undefined, []);

  const placeholder = surface === "journeys"
    ? "chat"
    : hasOpenPlannerThread
      ? "Reply here..."
      : "Talk to Cosmiq naturally.";

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode = "text",
  ) => {
    const message = rawMessage.trim();
    if (!enabled || !message) return;

    const parsed = parseNaturalLanguage(message);
    const shouldOpenCampaignBuilder = surface === "journeys"
      && Boolean(onOpenCampaignBuilder)
      && (
        isGoalBreakdownStarterMessage(message)
        || looksLikeBigGoal(
          parsed.text || message,
          parsed.estimatedDuration,
          parsed.scheduledDate,
        )
      );
    const routeToPlanner = shouldRouteToLegacyPlanner(
      surface,
      message,
      hasOpenPlannerThread,
    );

    if (isExactQuestCaptureStarterMessage(message)) {
      planner.primeQuestCapture(message);
      return;
    }

    if (isExactPlanDayStarterMessage(message)) {
      await planner.submitMessage(message, inputMode);
      return;
    }

    if (!routeToPlanner && surface === "companion" && !conversationEnabled) {
      toast.error("Companion Talk is a Premium feature. Planning and scheduling still work here.");
      return;
    }

    if (routeToPlanner) {
      await planner.submitMessage(message, inputMode);
      return;
    }

    if (shouldOpenCampaignBuilder) {
      onOpenCampaignBuilder?.(message);
      return;
    }

    if (surface === "journeys") {
      await journeysConversation.submitMessage(message, inputMode, {
        currentDate: planner.currentDate,
        currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
        journeysContext: planner.plannerContext,
      });
      return;
    }

    await conversation.submitMessage(message, inputMode);
  }, [
    enabled,
    surface,
    onOpenCampaignBuilder,
    hasOpenPlannerThread,
    planner,
    conversationEnabled,
    journeysConversation,
    conversation,
  ]);

  if (!enabled) {
    return {
      messages: [],
      structuredResponse: null,
      pendingAction: null,
      unsupportedPendingProposalNotice: null,
      placeholder: surface === "journeys" ? "chat" : "Talk to Cosmiq naturally.",
      todayLabel: planner.todayLabel,
      isSubmitting: false,
      isResolvingAction: false,
      submitMessage: noopAsync,
      acceptSuggestedQuest: noopAsync,
      canAcceptSuggestedQuests: false,
      suggestedQuestDisabledReason: null,
      confirmPendingAction: noopAsync,
      cancelPendingAction: noopAsync,
      isSpeaking: false,
      speechProvider: "none" as const,
      stopSpeaking: noopSync,
      activeThread: null,
      historyThreads: [],
      isLoadingThreads: false,
      hasPersistedActiveThread: false,
      canOpenThreadPicker: false,
      threadPickerDisabledReason: null,
      threadHistoryEmptyStateMessage: "Past chats will show up here after at least one real exchange.",
      resumeThread: noopAsync,
      archiveCurrentThread: noopAsync,
      canArchiveThread: false,
      archiveDisabledReason: null,
      startNewChat: noopAsync,
      canStartNewChat: false,
      newChatDisabledReason: null,
    };
  }

  return {
    messages,
    structuredResponse: planner.structuredResponse,
    pendingAction,
    unsupportedPendingProposalNotice,
    placeholder,
    todayLabel: planner.todayLabel,
    isSubmitting: planner.isSubmitting || conversation.isSubmitting,
    isResolvingAction: planner.isSubmitting,
    submitMessage,
    acceptSuggestedQuest: (proposalId: string) =>
      planner.acceptSuggestedQuest(proposalId),
    canAcceptSuggestedQuests: true,
    suggestedQuestDisabledReason: null,
    confirmPendingAction:
      planner.legacyExecution.enabled && activePendingProposal && pendingAction
      ? () => planner.legacyExecution.confirmProposal(activePendingProposal.id)
      : async () => undefined,
    cancelPendingAction:
      planner.legacyExecution.enabled && activePendingProposal && pendingAction
      ? () => planner.legacyExecution.rejectProposal(activePendingProposal.id)
      : async () => undefined,
    isSpeaking: companionChat.isSpeaking,
    speechProvider: companionChat.speechProvider,
    stopSpeaking: companionChat.stopSpeaking ?? (() => undefined),
    activeThread: surface === "journeys" ? journeysThreads.activeThread : null,
    historyThreads: surface === "journeys" ? journeysThreads.historyThreads : [],
    isLoadingThreads: surface === "journeys" ? journeysThreads.isLoadingThreads : false,
    hasPersistedActiveThread: surface === "journeys" ? journeysThreads.hasPersistedActiveThread : false,
    canOpenThreadPicker: surface === "journeys"
      ? unsupportedJourneysDraftThreadReason === null && journeysThreads.canOpenThreadPicker
      : false,
    threadPickerDisabledReason: surface === "journeys"
      ? unsupportedJourneysDraftThreadReason ?? journeysThreads.threadPickerDisabledReason
      : null,
    threadHistoryEmptyStateMessage: surface === "journeys"
      ? journeysThreads.threadHistoryEmptyStateMessage
      : "Past chats will show up here after at least one real exchange.",
    resumeThread: surface === "journeys" ? journeysThreads.resumeThread : (async () => undefined),
    archiveCurrentThread: surface === "journeys" ? journeysThreads.archiveCurrentThread : (async () => undefined),
    canArchiveThread: surface === "journeys"
      ? unsupportedJourneysDraftThreadReason === null && journeysThreads.canArchiveThread
      : false,
    archiveDisabledReason: surface === "journeys"
      ? unsupportedJourneysDraftThreadReason ?? journeysThreads.archiveDisabledReason
      : null,
    startNewChat: surface === "journeys" ? journeysThreads.startNewChat : (async () => undefined),
    canStartNewChat: surface === "journeys"
      ? unsupportedJourneysDraftThreadReason === null && journeysThreads.canStartNewChat
      : false,
    newChatDisabledReason: surface === "journeys"
      ? unsupportedJourneysDraftThreadReason ?? journeysThreads.newChatDisabledReason
      : null,
  };
}
