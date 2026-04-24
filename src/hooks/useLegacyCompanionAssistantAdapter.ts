import { useCallback, useMemo } from "react";

import { toast } from "@/components/ui/sonner";
import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionChat } from "@/hooks/useCompanionChat";
import { useCompanionDialogue } from "@/hooks/useCompanionDialogue";
import { useCompanionPlanner } from "@/hooks/useCompanionPlanner";
import { useJourneysCompanionConversation } from "@/hooks/useJourneysCompanionConversation";
import { useJourneysCompanionThreads } from "@/hooks/useJourneysCompanionThreads";
import { stripMarkdown } from "@/lib/utils";
import type { CompanionPlanningMode } from "@/shared/companionPlanningMode";
import {
  analyzeSchedulingIntent,
  shouldRouteMessageToPlanner,
} from "@/shared/schedulingIntent";
import {
  isGoalBreakdownStarterMessage,
  looksLikeBigGoal,
} from "@/shared/bigGoalIntent";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";
import type { PendingActionView } from "@/types/companionAgent";
import type {
  CompanionChatInputMode,
  CompanionChatMessage,
  CompanionChatThreadMessage,
  CompanionChatThreadSummary,
} from "@/types/companionConversation";
import type {
  CompanionPlannerLaunchIntent,
  CompanionPlannerProposal,
  CompanionPlannerSessionState,
  CompanionPlannerStarterIntent,
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
  structuredResponse?: CompanionStructuredResponse | null;
};

type CompanionAssistantSurface = "companion" | "journeys";

type UseLegacyCompanionAssistantAdapterOptions = {
  enabled: boolean;
  surface: CompanionAssistantSurface;
  conversationEnabled?: boolean;
  onOpenCampaignBuilder?: (message: string) => void;
};

type LegacyFallbackHydrationMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode;
  source: "chat" | "plan" | "agent";
  isSeed?: boolean;
  structuredResponse?: CompanionStructuredResponse | null;
  pendingAction?: PendingActionView | null;
  receipt?: { proposalId?: string | null; status?: string | null } | null;
};

type LegacyFallbackHydrationInput = {
  sessionId: string;
  messages: LegacyFallbackHydrationMessage[];
  savedSuggestionProposalIds?: string[];
  pendingSuggestionProposalId?: string | null;
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
    structuredResponse?: CompanionStructuredResponse | null;
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
    structuredResponse: message.structuredResponse ?? null,
  }));

const sortMessages = (messages: LegacyCompanionAssistantMessage[]) =>
  messages
    .slice()
    .sort((left, right) => (
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id)
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

const isExactPlanWeekStarterMessage = (message: string): boolean =>
  message.trim().toLowerCase() === "plan my week";

const isExactUpcomingStarterMessage = (message: string): boolean =>
  message.trim().toLowerCase() === "what do i have coming up?";

const isExactRightNowStarterMessage = (message: string): boolean =>
  message.trim().toLowerCase() === "what should i do right now?";

const isExactAdjustDayStarterMessage = (message: string): boolean =>
  message.trim().toLowerCase() === "adjust my day";

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
    proposalId: proposal.id,
    summary: proposal.summary,
    confirmationMessage: proposal.reasoning ?? "Want me to lock that in?",
    normalizedPayload: proposal.payload,
    affectedEntities: null,
    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 12)).toISOString(),
    createdAt: new Date().toISOString(),
  };
};

const DEFAULT_FALLBACK_PLANNER_SESSION_STATE: CompanionPlannerSessionState = {
  draft: {},
  openQuestionIds: [],
  preferredTimeOfDay: null,
  preferredTimeReason: null,
  reminderPreference: null,
  pendingStarterIntent: null,
  lastClassification: null,
};

const inferPlannerStarterIntentFromStructuredResponse = (
  response: CompanionStructuredResponse | null | undefined,
): CompanionPlannerStarterIntent | null => {
  if (response?.planDay) return "plan_day";
  if (response?.campaignMomentum) return "advance_campaign_start";
  if (response?.dayAdjust) return "adjust_today";
  if (response?.rightNow) return "right_now_start";
  if (response?.comingUp) return "upcoming_start";
  return null;
};

const collectFallbackStructuredSuggestions = (
  response: CompanionStructuredResponse | null | undefined,
) => {
  const suggestions: Array<{
    proposalId: string;
    title: string;
    estimatedDurationMinutes: number | null;
    reason: string;
    source: string;
  }> = [];
  const collectSuggestion = (suggestion: {
    proposalId?: string | null;
    title: string;
    estimatedDurationMinutes?: number | null;
    reason: string;
    source: string;
  } | null | undefined) => {
    if (!suggestion?.proposalId) return;
    suggestions.push({
      proposalId: suggestion.proposalId,
      title: suggestion.title,
      estimatedDurationMinutes: suggestion.estimatedDurationMinutes ?? null,
      reason: suggestion.reason,
      source: suggestion.source,
    });
  };

  response?.planDay?.suggestedQuests.forEach(collectSuggestion);
  collectSuggestion(response?.rightNow?.recommendedAction);
  collectSuggestion(response?.rightNow?.fallbackAction);
  response?.dayAdjust?.keep.forEach(collectSuggestion);
  response?.dayAdjust?.move.forEach(collectSuggestion);
  response?.dayAdjust?.dropOrShrink.forEach(collectSuggestion);
  collectSuggestion(response?.comingUp?.nextBestAction);
  collectSuggestion(response?.campaignMomentum?.nextStep);
  response?.campaignMomentum?.supportActions.forEach(collectSuggestion);

  return suggestions;
};

const buildFallbackPlannerProposals = (input: {
  response: CompanionStructuredResponse | null | undefined;
  savedSuggestionProposalIds?: string[];
  pendingSuggestionProposalId?: string | null;
}): CompanionPlannerProposal[] =>
  collectFallbackStructuredSuggestions(input.response).map((suggestion) => ({
    id: suggestion.proposalId,
    kind: "create_quest",
    title: suggestion.title,
    summary: suggestion.reason,
    reasoning: suggestion.reason,
    payload: {
      taskText: suggestion.title,
      estimatedDuration: suggestion.estimatedDurationMinutes,
      notes: suggestion.reason,
      questSource: suggestion.source,
      taskDate: null,
      scheduledTime: null,
    },
    status: input.savedSuggestionProposalIds?.includes(suggestion.proposalId)
      ? "confirmed"
      : "pending",
    readyToConfirm: true,
    missingFields: [],
  }));

const mapUnifiedMessagesToLegacyChatMessages = (
  messages: LegacyFallbackHydrationMessage[],
): CompanionChatMessage[] =>
  messages
    .filter((message) =>
      message.source === "chat" ||
      (
        message.source === "agent" &&
        !message.structuredResponse &&
        !message.pendingAction &&
        !message.receipt
      )
    )
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      inputMode: message.inputMode,
    }));

const mapUnifiedMessagesToLegacyPlannerMessages = (
  input: LegacyFallbackHydrationInput,
): CompanionChatThreadMessage[] =>
  input.messages
    .filter((message) =>
      message.source === "plan" ||
      (
        message.source === "agent" &&
        (
          message.structuredResponse !== undefined ||
          Boolean(message.pendingAction) ||
          Boolean(message.receipt)
        )
      )
    )
    .map((message) => {
      const fallbackProposals = buildFallbackPlannerProposals({
        response: message.structuredResponse,
        savedSuggestionProposalIds: input.savedSuggestionProposalIds,
        pendingSuggestionProposalId: input.pendingSuggestionProposalId,
      });
      const fallbackSessionState = {
        ...DEFAULT_FALLBACK_PLANNER_SESSION_STATE,
        pendingStarterIntent: inferPlannerStarterIntentFromStructuredResponse(
          message.structuredResponse,
        ),
      };
      const proposalDecision = message.receipt?.proposalId &&
          (
            message.receipt.status === "executed" ||
            message.receipt.status === "cancelled"
          )
        ? {
          proposalId: message.receipt.proposalId,
          status: message.receipt.status === "executed"
            ? "confirmed"
            : "rejected",
        }
        : null;

      return {
        id: message.id,
        sessionId: input.sessionId,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
        inputMode: message.inputMode,
        source: "agent",
        structuredResponse: message.structuredResponse ?? null,
        pendingAction: message.pendingAction ?? undefined,
        receipt: message.receipt
          ? {
            actionId: message.id,
            status: message.receipt.status === "executed"
              ? "executed"
              : "cancelled",
            proposalId: message.receipt.proposalId ?? null,
            message: message.content,
            summary: null,
            createdAt: message.createdAt,
            executionResult: null,
            executionError: null,
          }
          : undefined,
        metadata: {
          structuredResponse: message.structuredResponse ?? null,
          followUpQuestions: [],
          proposals: fallbackProposals,
          suggestedReminders: [],
          sessionState: fallbackSessionState,
          ...(proposalDecision ? { proposalDecision } : {}),
        },
      };
    });

export function useLegacyCompanionAssistantAdapter({
  enabled,
  surface,
  conversationEnabled = true,
  onOpenCampaignBuilder,
}: UseLegacyCompanionAssistantAdapterOptions) {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { greeting } = useCompanionDialogue();
  const companionChat = useCompanionChat({
    enabled: enabled && surface === "companion" && conversationEnabled,
  });
  const journeysConversation = useJourneysCompanionConversation({
    enabled,
  });
  const planner = useCompanionPlanner({
    enabled,
    bootstrapGreeting: false,
    threadPersistence: surface === "journeys"
      ? {
        enabled: true,
        surface: "journeys",
      }
      : undefined,
  });
  const conversation = surface === "journeys"
    ? journeysConversation
    : companionChat;

  const messages = useMemo(() => (
    sortMessages([
      ...normalizeConversationMessages(conversation.messages),
      ...normalizePlannerMessages(planner.messages),
    ])
  ), [conversation.messages, planner.messages]);

  const hasOpenPlannerThread = planner.questions.length > 0 ||
    planner.pendingProposals.some((proposal) =>
      proposal.status === "pending"
    ) ||
    Boolean(planner.sessionState.pendingStarterIntent);

  const journeysThreads = useJourneysCompanionThreads({
    enabled: enabled && surface === "journeys",
    userId: user?.id,
    companionId: companion?.id,
    messages: surface === "journeys" ? messages : [],
    persistenceReady: journeysConversation.threadPersistenceReady,
    persistenceUnavailableReason:
      journeysConversation.threadPersistenceUnavailableReason,
    hasPendingPlannerWork: hasOpenPlannerThread,
    isBusy: planner.isSubmitting || planner.isClassifying ||
      conversation.isSubmitting,
    conversation: {
      sessionId: journeysConversation.sessionId,
      resetThread: journeysConversation.resetThread,
      hydrateThread: journeysConversation.hydrateThread,
    },
    planner: {
      sessionId: planner.sessionId,
      resetThread: planner.resetThread,
      hydrateThread: planner.hydrateThread,
    },
  });

  const activePendingProposal = useMemo(
    () =>
      planner.pendingProposals.find((proposal) =>
        proposal.status === "pending"
      ) ?? null,
    [planner.pendingProposals],
  );
  const pendingActionCount = planner.pendingProposals.length;
  const readyPendingActionCount = planner.readyProposalCount;
  const pendingAction = useMemo(
    () => mapLegacyProposalToPendingAction(activePendingProposal),
    [activePendingProposal],
  );
  const savedSuggestionProposalIds = useMemo(
    () =>
      planner.proposals
        .filter((proposal) =>
          proposal.status === "confirmed" || proposal.status === "modified"
        )
        .map((proposal) => proposal.id),
    [planner.proposals],
  );
  const pendingSuggestionProposalId = activePendingProposal?.id ?? null;

  const placeholder = hasOpenPlannerThread
    ? "Reply here..."
    : surface === "journeys"
    ? "Talk to Cosmiq"
    : "Talk to Cosmiq naturally.";

  const hydrateFromUnifiedState = useCallback((
    input: LegacyFallbackHydrationInput,
  ) => {
    const nextChatMessages = mapUnifiedMessagesToLegacyChatMessages(
      input.messages,
    );
    const nextPlannerMessages = mapUnifiedMessagesToLegacyPlannerMessages(
      input,
    );

    if (surface === "journeys") {
      journeysConversation.hydrateThread({
        sessionId: input.sessionId,
        messages: nextChatMessages,
      });
    } else {
      companionChat.hydrateThread({
        sessionId: input.sessionId,
        messages: nextChatMessages,
      });
    }

    planner.hydrateThread({
      sessionId: input.sessionId,
      messages: nextPlannerMessages,
    });
  }, [
    companionChat,
    journeysConversation,
    planner,
    surface,
  ]);

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode = "text",
    options?: {
      starterIntent?: CompanionPlannerLaunchIntent["starterIntent"];
      planningMode?: CompanionPlanningMode | null;
    },
  ) => {
    const message = rawMessage.trim();
    if (!enabled || !message) return;
    const starterIntent = options?.starterIntent;

    const parsed = parseNaturalLanguage(message);
    const shouldOpenCampaignBuilder = surface === "journeys" &&
      Boolean(onOpenCampaignBuilder) &&
      (
        isGoalBreakdownStarterMessage(message) ||
        looksLikeBigGoal(
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

    if (starterIntent === "goal_breakdown_start" && onOpenCampaignBuilder) {
      onOpenCampaignBuilder(message);
      return;
    }

    if (
      starterIntent &&
      starterIntent !== "general" &&
      starterIntent !== "free_talk_start" &&
      starterIntent !== "thread_history"
    ) {
      await planner.submitMessage(message, inputMode, {
        starterIntent,
        planningMode: options?.planningMode ?? null,
      });
      return;
    }

    if (isExactQuestCaptureStarterMessage(message)) {
      planner.primeQuestCapture(message);
      return;
    }

    if (isExactPlanDayStarterMessage(message)) {
      await planner.submitMessage(message, inputMode);
      return;
    }

    if (isExactPlanWeekStarterMessage(message)) {
      await planner.submitMessage(message, inputMode, {
        starterIntent: "plan_week",
        planningMode: options?.planningMode ?? null,
      });
      return;
    }

    if (isExactUpcomingStarterMessage(message)) {
      await planner.submitMessage(message, inputMode, {
        starterIntent: "upcoming_start",
        planningMode: options?.planningMode ?? null,
      });
      return;
    }

    if (isExactRightNowStarterMessage(message)) {
      await planner.submitMessage(message, inputMode, {
        starterIntent: "right_now_start",
        planningMode: options?.planningMode ?? null,
      });
      return;
    }

    if (isExactAdjustDayStarterMessage(message)) {
      await planner.submitMessage(message, inputMode, {
        starterIntent: "adjust_today",
        planningMode: options?.planningMode ?? null,
      });
      return;
    }

    if (!routeToPlanner && surface === "companion" && !conversationEnabled) {
      toast.error(
        "Companion Talk is a Premium feature. Planning and scheduling still work here.",
      );
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
    greeting: surface === "journeys"
      ? journeysConversation.greeting
      : companionChat.greeting ?? greeting,
    messages,
    structuredResponse: planner.structuredResponse,
    planningMode: planner.planningMode,
    setPlanningMode: planner.setPlanningMode,
    pendingAction,
    savedSuggestionProposalIds,
    pendingSuggestionProposalId,
    pendingActionCount,
    readyPendingActionCount,
    placeholder,
    todayLabel: planner.todayLabel,
    isSubmitting: planner.isSubmitting || conversation.isSubmitting,
    isResolvingAction: planner.isSubmitting,
    submitMessage,
    confirmPendingAction: activePendingProposal
      ? () => planner.confirmProposal(activePendingProposal.id)
      : async () => undefined,
    cancelPendingAction: activePendingProposal
      ? () => planner.rejectProposal(activePendingProposal.id)
      : async () => undefined,
    confirmSuggestedQuest: (proposalId: string) =>
      planner.confirmProposal(proposalId),
    confirmAllPendingActions: readyPendingActionCount > 0
      ? planner.confirmAll
      : async () => undefined,
    isSpeaking: companionChat.isSpeaking,
    speechProvider: companionChat.speechProvider,
    stopSpeaking: companionChat.stopSpeaking ?? (() => undefined),
    activeThread: surface === "journeys" ? journeysThreads.activeThread : null,
    historyThreads: surface === "journeys"
      ? journeysThreads.historyThreads
      : [],
    isLoadingThreads: surface === "journeys"
      ? journeysThreads.isLoadingThreads
      : false,
    hasPersistedActiveThread: surface === "journeys"
      ? journeysThreads.hasPersistedActiveThread
      : false,
    canOpenThreadPicker: surface === "journeys"
      ? journeysThreads.canOpenThreadPicker
      : false,
    threadHistoryEmptyStateMessage: surface === "journeys"
      ? journeysThreads.threadHistoryEmptyStateMessage
      : "Past chats will show up here after at least one real exchange.",
    resumeThread: surface === "journeys"
      ? journeysThreads.resumeThread
      : (async () => undefined),
    archiveCurrentThread: surface === "journeys"
      ? journeysThreads.archiveCurrentThread
      : (async () => undefined),
    canArchiveThread: surface === "journeys"
      ? journeysThreads.canArchiveThread
      : false,
    archiveDisabledReason: surface === "journeys"
      ? journeysThreads.archiveDisabledReason
      : null,
    startNewChat: surface === "journeys"
      ? journeysThreads.startNewChat
      : (async () => undefined),
    canStartNewChat: surface === "journeys"
      ? journeysThreads.canStartNewChat
      : false,
    newChatDisabledReason: surface === "journeys"
      ? journeysThreads.newChatDisabledReason
      : null,
    startTemplateThread: surface === "journeys"
      ? journeysThreads.startTemplateThread
      : () => "",
    hydrateFromUnifiedState,
  };
}
