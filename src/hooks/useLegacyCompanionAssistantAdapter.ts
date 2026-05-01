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
import {
  analyzeSchedulingIntent,
  isUpcomingScheduleDigestMessage,
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
type CompanionTemplateThreadOptions = {
  greetingText?: string | null;
  visibleAssistantOpening?: boolean;
};

type UseLegacyCompanionAssistantAdapterOptions = {
  enabled: boolean;
  surface: CompanionAssistantSurface;
  conversationEnabled?: boolean;
  onOpenCampaignBuilder?: (message: string) => void;
  plannerFallbackMode?: "interactive" | "read_only";
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

const emitPlanDayAiAnsweredEvent = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("companion-plan-my-day-ai-answered"));
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

const isExactPrepareTomorrowStarterMessage = (message: string): boolean =>
  message.trim().toLowerCase() === "prepare me for tomorrow";

const isExactUpcomingStarterMessage = (message: string): boolean =>
  isUpcomingScheduleDigestMessage(message);

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
    : proposal.kind === "adjust_campaign_plan"
    ? "campaign_adjust"
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
    normalizedPayload: proposal.payload as PendingActionView["normalizedPayload"],
    affectedEntities: null,
    expiresAt: new Date(Date.now() + (1000 * 60 * 60 * 12)).toISOString(),
    createdAt: new Date().toISOString(),
  };
};

const toReadOnlySuggestion = <T extends { proposalId?: string | null }>(
  suggestion: T | null | undefined,
): T | null => suggestion ? { ...suggestion, proposalId: null } : null;

const toReadOnlySuggestions = <T extends { proposalId?: string | null }>(
  suggestions: T[] | null | undefined,
): T[] => (suggestions ?? []).map((suggestion) => ({
  ...suggestion,
  proposalId: null,
}));

const buildReadOnlyStructuredResponse = (
  response: CompanionStructuredResponse | null | undefined,
): CompanionStructuredResponse | null => {
  if (!response) return null;

  return {
    ...response,
    planDay: response.planDay
      ? {
        ...response.planDay,
        suggestedQuests: toReadOnlySuggestions(response.planDay.suggestedQuests),
      }
      : null,
    weeklyPlan: response.weeklyPlan
      ? {
        ...response.weeklyPlan,
        topPriorities: toReadOnlySuggestions(response.weeklyPlan.topPriorities),
      }
      : null,
    priorityOverview: response.priorityOverview
      ? {
        ...response.priorityOverview,
        topPriorities: toReadOnlySuggestions(
          response.priorityOverview.topPriorities,
        ),
      }
      : null,
    reflectionBridge: response.reflectionBridge
      ? {
        ...response.reflectionBridge,
        firstAction: toReadOnlySuggestion(response.reflectionBridge.firstAction),
      }
      : null,
    comingUp: response.comingUp
      ? {
        ...response.comingUp,
        nextBestAction: toReadOnlySuggestion(response.comingUp.nextBestAction),
      }
      : null,
    campaignMomentum: response.campaignMomentum
      ? {
        ...response.campaignMomentum,
        nextStep: toReadOnlySuggestion(response.campaignMomentum.nextStep),
        supportActions: toReadOnlySuggestions(
          response.campaignMomentum.supportActions,
        ),
      }
      : null,
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
        } as unknown as CompanionChatThreadMessage["metadata"],
      };
    });

export function useLegacyCompanionAssistantAdapter({
  enabled,
  surface,
  conversationEnabled = true,
  onOpenCampaignBuilder,
  plannerFallbackMode = "interactive",
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
  const plannerSuggestionsReadOnly = plannerFallbackMode === "read_only";
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
  const structuredResponse = plannerSuggestionsReadOnly
    ? buildReadOnlyStructuredResponse(planner.structuredResponse)
    : planner.structuredResponse;
  const dayPlan = plannerSuggestionsReadOnly ? null : planner.dayPlan ?? null;
  const committingDayPlan = plannerSuggestionsReadOnly
    ? false
    : Boolean(planner.committingDayPlan);
  const committedDayPlanId = plannerSuggestionsReadOnly
    ? null
    : planner.committedDayPlanId ?? null;
  const commitDayPlan = plannerSuggestionsReadOnly
    ? async () => {
      toastPlannerFallbackReadOnly();
    }
    : planner.commitDayPlan;

  const toastPlannerFallbackReadOnly = useCallback(() => {
    toast.error(
      "Cosmiq is in read-only fallback right now. Nothing will change until the main assistant path is back.",
    );
  }, []);

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
    },
  ) => {
    const message = rawMessage.trim();
    if (!enabled || !message) return;
    const starterIntent = options?.starterIntent;
    const shouldEmitPlanDayAiAnswered =
      !starterIntent &&
      planner.sessionState.pendingStarterIntent === "plan_day" &&
      planner.questions.length > 0;

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

    if (isExactPrepareTomorrowStarterMessage(message)) {
      await planner.submitMessage(message, inputMode, {
        starterIntent: "briefing_followup",
      });
      return;
    }

    if (isExactUpcomingStarterMessage(message)) {
      await planner.submitMessage(message, inputMode, {
        starterIntent: "upcoming_start",
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
      if (shouldEmitPlanDayAiAnswered) {
        emitPlanDayAiAnsweredEvent();
      }
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

  const startTemplateThread = useCallback((
    options?: CompanionTemplateThreadOptions,
  ) => {
    if (surface !== "journeys") return "";

    const nextSessionId = journeysThreads.startTemplateThread({
      greetingText: options?.visibleAssistantOpening
        ? null
        : options?.greetingText,
    });
    const greetingText = options?.greetingText?.trim();

    if (options?.visibleAssistantOpening && greetingText) {
      journeysConversation.injectAssistantOpening(greetingText, {
        visibleAssistantOpening: true,
      });
    }

    return nextSessionId;
  }, [journeysConversation, journeysThreads, surface]);

  return {
    greeting: surface === "journeys"
      ? journeysConversation.greeting
      : companionChat.greeting ?? greeting,
    messages,
    structuredResponse,
    dayPlan,
    committingDayPlan,
    committedDayPlanId,
    commitDayPlan,
    pendingAction: plannerSuggestionsReadOnly ? null : pendingAction,
    savedSuggestionProposalIds,
    pendingSuggestionProposalId,
    pendingActionCount: plannerSuggestionsReadOnly ? 0 : pendingActionCount,
    readyPendingActionCount: plannerSuggestionsReadOnly
      ? 0
      : readyPendingActionCount,
    placeholder,
    todayLabel: planner.todayLabel,
    isSubmitting: planner.isSubmitting || conversation.isSubmitting,
    isResolvingAction: planner.isSubmitting,
    submitMessage,
    confirmPendingAction: plannerSuggestionsReadOnly
      ? async () => {
        toastPlannerFallbackReadOnly();
      }
      : activePendingProposal
      ? () => planner.confirmProposal(activePendingProposal.id)
      : async () => undefined,
    cancelPendingAction: plannerSuggestionsReadOnly
      ? async () => {
        toastPlannerFallbackReadOnly();
      }
      : activePendingProposal
      ? () => planner.rejectProposal(activePendingProposal.id)
      : async () => undefined,
    confirmSuggestedQuest: plannerSuggestionsReadOnly
      ? async () => {
        toastPlannerFallbackReadOnly();
      }
      : (proposalId: string) =>
        planner.confirmProposal(proposalId),
    confirmAllPendingActions: plannerSuggestionsReadOnly
      ? async () => {
        toastPlannerFallbackReadOnly();
      }
      : readyPendingActionCount > 0
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
      ? startTemplateThread
      : () => "",
    hydrateFromUnifiedState,
  };
}
