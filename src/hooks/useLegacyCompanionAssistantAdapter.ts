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
import type { PendingActionView } from "@/types/companionAgent";
import type {
  CompanionChatInputMode,
  CompanionChatThreadSummary,
} from "@/types/companionConversation";
import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";
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

  const actionType = proposal.kind === "create_quest"
    ? "task_create"
    : proposal.kind === "update_quest"
      ? "task_update"
      : proposal.kind === "create_ritual"
        ? "ritual_create"
        : proposal.kind === "suggest_reminder"
          ? "reminder_create"
          : "campaign_update";
  const intent = proposal.kind === "create_quest"
    ? "schedule_task"
    : proposal.kind === "update_quest" || proposal.kind === "suggest_reminder"
      ? "update_existing_plan"
      : "goal_setting";

  return {
    id: proposal.id,
    status: "pending",
    intent,
    actionType,
    summary: proposal.summary,
    confirmationMessage: proposal.reasoning ?? "Want me to lock that in?",
    normalizedPayload: proposal.payload,
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
}: UseLegacyCompanionAssistantAdapterOptions) {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const companionChat = useCompanionChat({
    enabled: enabled && surface === "companion" && conversationEnabled,
  });
  const journeysConversation = useJourneysCompanionConversation();
  const planner = useCompanionPlanner({
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
    () => planner.pendingProposals.find((proposal) => proposal.status === "pending") ?? null,
    [planner.pendingProposals],
  );
  const pendingAction = useMemo(
    () => mapLegacyProposalToPendingAction(activePendingProposal),
    [activePendingProposal],
  );

  const placeholder = hasOpenPlannerThread
    ? "Reply here..."
    : surface === "journeys"
      ? "Talk to Cosmiq"
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

  return {
    messages,
    structuredResponse: planner.structuredResponse,
    pendingAction,
    placeholder,
    todayLabel: planner.todayLabel,
    isSubmitting: planner.isSubmitting || conversation.isSubmitting,
    isResolvingAction: planner.isSubmitting,
    submitMessage,
    acceptSuggestedQuest: (proposalId: string) =>
      planner.acceptSuggestedQuest(proposalId),
    confirmPendingAction: activePendingProposal
      ? () => planner.confirmProposal(activePendingProposal.id)
      : async () => undefined,
    cancelPendingAction: activePendingProposal
      ? () => planner.rejectProposal(activePendingProposal.id)
      : async () => undefined,
    isSpeaking: companionChat.isSpeaking,
    speechProvider: companionChat.speechProvider,
    stopSpeaking: companionChat.stopSpeaking ?? (() => undefined),
    activeThread: surface === "journeys" ? journeysThreads.activeThread : null,
    historyThreads: surface === "journeys" ? journeysThreads.historyThreads : [],
    isLoadingThreads: surface === "journeys" ? journeysThreads.isLoadingThreads : false,
    hasPersistedActiveThread: surface === "journeys" ? journeysThreads.hasPersistedActiveThread : false,
    canOpenThreadPicker: surface === "journeys" ? journeysThreads.canOpenThreadPicker : false,
    threadHistoryEmptyStateMessage: surface === "journeys"
      ? journeysThreads.threadHistoryEmptyStateMessage
      : "Past chats will show up here after at least one real exchange.",
    resumeThread: surface === "journeys" ? journeysThreads.resumeThread : (async () => undefined),
    archiveCurrentThread: surface === "journeys" ? journeysThreads.archiveCurrentThread : (async () => undefined),
    canArchiveThread: surface === "journeys" ? journeysThreads.canArchiveThread : false,
    archiveDisabledReason: surface === "journeys" ? journeysThreads.archiveDisabledReason : null,
    startNewChat: surface === "journeys" ? journeysThreads.startNewChat : (async () => undefined),
    canStartNewChat: surface === "journeys" ? journeysThreads.canStartNewChat : false,
    newChatDisabledReason: surface === "journeys" ? journeysThreads.newChatDisabledReason : null,
  };
}
