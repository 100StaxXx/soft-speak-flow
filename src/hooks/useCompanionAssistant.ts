import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { isCompanionAgentSurfaceEnabled } from "@/config/companionAgentRollout";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionDialogue } from "@/hooks/useCompanionDialogue";
import { useLegacyCompanionAssistantAdapter } from "@/hooks/useLegacyCompanionAssistantAdapter";
import { useCompanionVoiceSettings } from "@/hooks/useCompanionVoiceSettings";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { stripMarkdown } from "@/lib/utils";
import {
  buildCompanionThreadPreview,
  buildCompanionThreadTitle,
  generateCompanionThreadSessionId,
  getCompanionChatThreadsQueryKey,
  listCompanionChatThreads,
  loadCompanionChatThreadMessages,
  loadCompanionPendingAction,
  readCompanionThreadReceiptProposalId,
  setCompanionChatThreadArchived,
} from "@/services/companionChatThreads";
import {
  type CompanionSpeechProvider,
  speakCompanionReply,
  stopCompanionSpeech,
} from "@/services/companionSpeech";
import { getCompanionPlannerOpener } from "@/shared/companionPlannerCopy";
import {
  type CompanionPlanningMode,
  DEFAULT_COMPANION_PLANNING_MODE,
} from "@/shared/companionPlanningMode";
import type {
  ActionReceiptView,
  CompanionAgentResponse,
  PendingActionView,
} from "@/types/companionAgent";
import type {
  CompanionChatInputMode,
  CompanionChatSource,
  CompanionChatSurface,
  CompanionChatThreadSummary,
} from "@/types/companionConversation";
import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";
import {
  COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON,
  COMPANION_CHAT_THREAD_HISTORY_EMPTY_STATE,
  isCompanionChatSetupError,
} from "@/utils/companionChatSetup";
import { formatCurrentDateTimeWithOffset } from "@/utils/currentDateTime";
import {
  parseFunctionInvokeError,
  type ParsedFunctionInvokeError,
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";

export type CompanionAssistantSurface = "companion" | "journeys";

export interface CompanionAssistantMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode;
  source: CompanionChatSource;
  isSeed?: boolean;
  structuredResponse?: CompanionAgentResponse["structuredResponse"];
  pendingAction?: PendingActionView;
  receipt?: ActionReceiptView;
}

interface UseCompanionAssistantOptions {
  surface: CompanionAssistantSurface;
  conversationEnabled?: boolean;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
}

interface CachedCompanionThreadUiState {
  messages: CompanionAssistantMessage[];
  structuredResponse: CompanionAgentResponse["structuredResponse"];
  savedSuggestionProposalIds: string[];
  lastStarterIntent: CompanionPlannerLaunchIntent["starterIntent"] | null;
  lastReplayablePlannerMessage: string | null;
}

type ThreadsQueryResult = {
  threads: CompanionChatThreadSummary[];
  setupUnavailable: boolean;
};

const generateMessageId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createMessage = (
  role: CompanionAssistantMessage["role"],
  content: string,
  extras: Partial<CompanionAssistantMessage> = {},
): CompanionAssistantMessage => ({
  id: generateMessageId(),
  role,
  content,
  createdAt: new Date().toISOString(),
  source: "agent",
  ...extras,
});

const isJsonValue = (value: unknown): value is Json => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isJsonValue(entry));
  }

  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      return false;
    }

    return Object.values(value).every((entry) => isJsonValue(entry));
  }

  return false;
};

const mapLoadedMessage = (
  message: Awaited<ReturnType<typeof loadCompanionChatThreadMessages>>[number],
): CompanionAssistantMessage => {
  const metadata = message.metadata && typeof message.metadata === "object" &&
      !Array.isArray(message.metadata)
    ? message.metadata as Record<string, unknown>
    : null;

  const parsePendingAction = (value: unknown): PendingActionView | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const pendingAction = value as Record<string, unknown>;
    if (
      typeof pendingAction.id !== "string" ||
      typeof pendingAction.status !== "string" ||
      typeof pendingAction.intent !== "string" ||
      typeof pendingAction.actionType !== "string" ||
      typeof pendingAction.summary !== "string" ||
      typeof pendingAction.createdAt !== "string" ||
      typeof pendingAction.expiresAt !== "string"
    ) {
      return undefined;
    }

    return {
      id: pendingAction.id,
      status: pendingAction.status as PendingActionView["status"],
      intent: pendingAction.intent as PendingActionView["intent"],
      actionType: pendingAction.actionType as PendingActionView["actionType"],
      proposalId: typeof pendingAction.proposalId === "string"
        ? pendingAction.proposalId
        : null,
      summary: pendingAction.summary,
      confirmationMessage: typeof pendingAction.confirmationMessage === "string"
        ? pendingAction.confirmationMessage
        : null,
      normalizedPayload: isJsonValue(pendingAction.normalizedPayload)
        ? pendingAction.normalizedPayload
        : {},
      affectedEntities: isJsonValue(pendingAction.affectedEntities)
        ? pendingAction.affectedEntities
        : null,
      expiresAt: pendingAction.expiresAt,
      createdAt: pendingAction.createdAt,
    };
  };

  const parseReceipt = (value: unknown): ActionReceiptView | undefined => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const receipt = value as Record<string, unknown>;
    if (
      typeof receipt.actionId !== "string" ||
      typeof receipt.status !== "string" ||
      typeof receipt.message !== "string" ||
      typeof receipt.createdAt !== "string"
    ) {
      return undefined;
    }

    return {
      actionId: receipt.actionId,
      status: receipt.status as ActionReceiptView["status"],
      proposalId: typeof receipt.proposalId === "string"
        ? receipt.proposalId
        : null,
      message: receipt.message,
      summary: typeof receipt.summary === "string" ? receipt.summary : null,
      createdAt: receipt.createdAt,
      executionResult: isJsonValue(receipt.executionResult)
        ? receipt.executionResult
        : null,
      executionError: isJsonValue(receipt.executionError)
        ? receipt.executionError
        : null,
    };
  };

  const structuredResponse = metadata && "structuredResponse" in metadata
    ? (metadata.structuredResponse as CompanionAgentResponse["structuredResponse"] ?? null)
    : undefined;

  return {
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    inputMode: message.inputMode,
    source: message.source,
    structuredResponse,
    pendingAction: parsePendingAction(metadata?.pendingAction),
    receipt: parseReceipt(metadata?.receipt),
  };
};

const getTodayLabel = () =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

const inferStarterIntentFromStructuredResponse = (
  response: CompanionAgentResponse["structuredResponse"],
): CompanionPlannerLaunchIntent["starterIntent"] | null => {
  if (response?.planDay) return "plan_day";
  if (response?.weeklyPlan) return "plan_week";
  if (response?.priorityOverview) {
    return response.priorityOverview.title.toLowerCase().includes("make room")
      ? "make_room"
      : "what_matters";
  }
  if (response?.reflectionBridge) return "briefing_followup";
  if (response?.campaignMomentum) return "advance_campaign_start";
  if (response?.dayAdjust) return "adjust_today";
  if (response?.rightNow) return "right_now_start";
  if (response?.comingUp) return "upcoming_start";
  return null;
};

const collectStructuredResponseSectionKeys = (
  response: CompanionAgentResponse["structuredResponse"],
) => {
  if (!response) return [] as string[];

  return [
    response.planDay ? "planDay" : null,
    response.weeklyPlan ? "weeklyPlan" : null,
    response.priorityOverview ? "priorityOverview" : null,
    response.reflectionBridge ? "reflectionBridge" : null,
    response.comingUp ? "comingUp" : null,
    response.rightNow ? "rightNow" : null,
    response.dayAdjust ? "dayAdjust" : null,
    response.campaignMomentum ? "campaignMomentum" : null,
  ].filter((section): section is string => Boolean(section));
};

const collectProposalIdsFromStructuredResponse = (
  response: CompanionAgentResponse["structuredResponse"],
) => {
  const proposalIds = new Set<string>();
  const collectQuest = (quest: { proposalId?: string | null }) => {
    if (typeof quest.proposalId === "string" && quest.proposalId.length > 0) {
      proposalIds.add(quest.proposalId);
    }
  };

  response?.planDay?.suggestedQuests.forEach(collectQuest);
  response?.weeklyPlan?.topPriorities.forEach(collectQuest);
  response?.priorityOverview?.topPriorities.forEach(collectQuest);
  if (response?.reflectionBridge?.firstAction) {
    collectQuest(response.reflectionBridge.firstAction);
  }
  if (response?.rightNow?.recommendedAction) {
    collectQuest(response.rightNow.recommendedAction);
  }
  if (response?.rightNow?.fallbackAction) {
    collectQuest(response.rightNow.fallbackAction);
  }
  response?.dayAdjust?.keep.forEach(collectQuest);
  response?.dayAdjust?.move.forEach(collectQuest);
  response?.dayAdjust?.dropOrShrink.forEach(collectQuest);
  if (response?.comingUp?.nextBestAction) {
    collectQuest(response.comingUp.nextBestAction);
  }
  if (response?.campaignMomentum?.nextStep) {
    collectQuest(response.campaignMomentum.nextStep);
  }
  response?.campaignMomentum?.supportActions.forEach(collectQuest);

  return proposalIds;
};

const pruneProposalIdsToStructuredResponse = (
  proposalIds: string[],
  response: CompanionAgentResponse["structuredResponse"],
) => {
  if (!response) return [];
  const visibleProposalIds = collectProposalIdsFromStructuredResponse(response);
  return proposalIds.filter((proposalId) => visibleProposalIds.has(proposalId));
};

const deriveStructuredResponseFromMessages = (
  messages: CompanionAssistantMessage[],
) => {
  let currentStructuredResponse: CompanionAgentResponse["structuredResponse"] = null;

  for (const message of messages) {
    if (message.role !== "assistant" || message.structuredResponse === undefined) {
      continue;
    }

    currentStructuredResponse = message.structuredResponse ?? null;
  }

  return currentStructuredResponse;
};

const collectSavedProposalIdsFromMessages = (
  messages: CompanionAssistantMessage[],
) => {
  const proposalIds = new Set<string>();

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const proposalId = readCompanionThreadReceiptProposalId(message.receipt);
    if (!proposalId) continue;
    if (message.receipt?.status !== "executed") continue;
    proposalIds.add(proposalId);
  }

  return [...proposalIds];
};

const isSyntheticResolutionMessage = (message: string) => {
  const normalized = message.trim().toLowerCase();
  return normalized === "confirm" || normalized === "cancel";
};

const shouldFallbackToLegacyAgent = (parsed: ParsedFunctionInvokeError) => {
  const source = [
    parsed.name,
    parsed.message,
    parsed.backendMessage,
    parsed.responsePayload?.error,
    parsed.responsePayload?.message,
    parsed.responsePayload?.code,
  ]
    .filter((value): value is string =>
      typeof value === "string" && value.length > 0
    )
    .join(" ")
    .toLowerCase();

  const hasSchemaSignal = source.includes("does not exist") ||
    source.includes("undefined_table") ||
    source.includes("undefined_column") ||
    source.includes("schema cache") ||
    source.includes("relation") ||
    source.includes("column");

  return source.includes("function not found") ||
    source.includes("no route matched") ||
    source.includes("could not find function") ||
    source.includes("could not find the function") ||
    (parsed.status === 404 && !parsed.backendMessage) ||
    (hasSchemaSignal && (
      source.includes("companion_pending_actions") ||
      source.includes("openai_conversation_id") ||
      source.includes("last_openai_response_id") ||
      source.includes("companion_mode") ||
      source.includes("companion_mode_adaptation_enabled")
    ));
};

export function useCompanionAssistant({
  surface,
  conversationEnabled = true,
  launchIntent = null,
  onLaunchIntentConsumed,
  onOpenCampaignBuilder,
}: UseCompanionAssistantOptions) {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { greeting, voiceStyle } = useCompanionDialogue();
  const { trackInteraction } = useAIInteractionTracker();
  const { autoplayVoice, muteSpokenReplies } = useCompanionVoiceSettings();
  const queryClient = useQueryClient();
  const agentSurfaceEnabled = isCompanionAgentSurfaceEnabled(surface);
  const [useLegacyFallback, setUseLegacyFallback] = useState(
    !agentSurfaceEnabled,
  );
  const unifiedAgentActive = !useLegacyFallback;

  const legacyAssistant = useLegacyCompanionAssistantAdapter({
    enabled: useLegacyFallback,
    surface,
    conversationEnabled,
    onOpenCampaignBuilder,
    plannerFallbackMode: "read_only",
  });

  const [activeSessionId, setActiveSessionId] = useState(() =>
    generateCompanionThreadSessionId()
  );
  const activeSessionIdRef = useRef(activeSessionId);
  const applyActiveSessionId = useCallback((nextSessionId: string) => {
    activeSessionIdRef.current = nextSessionId;
    setActiveSessionId(nextSessionId);
  }, []);
  const [messages, setMessages] = useState<CompanionAssistantMessage[]>([]);
  const [structuredResponse, setStructuredResponse] = useState<
    CompanionAgentResponse["structuredResponse"]
  >(null);
  const [planningModeOverride, setPlanningModeOverride] = useState<
    CompanionPlanningMode | null
  >(null);
  const [pendingAction, setPendingAction] = useState<PendingActionView | null>(
    null,
  );
  const [savedSuggestionProposalIds, setSavedSuggestionProposalIds] = useState<
    string[]
  >([]);
  const [pendingSuggestionProposalId, setPendingSuggestionProposalId] =
    useState<string | null>(null);
  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingAction, setIsResolvingAction] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechProvider, setSpeechProvider] = useState<CompanionSpeechProvider>(
    "none",
  );

  const localThreadCreatedAtRef = useRef(new Date().toISOString());
  const scopeKeyRef = useRef<string | null>(null);
  const bootstrappedScopeRef = useRef<string | null>(null);
  const threadMutationVersionRef = useRef(0);
  const handledLaunchIntentIdRef = useRef<string | null>(null);
  const threadUiStateCacheRef = useRef<
    Map<string, CachedCompanionThreadUiState>
  >(new Map());
  const lastStarterIntentRef = useRef<
    CompanionPlannerLaunchIntent["starterIntent"] | null
  >(null);
  const lastReplayablePlannerMessageRef = useRef<string | null>(null);

  const scopeKey = `${surface}:${user?.id ?? "anon"}:${
    companion?.id ?? "none"
  }`;
  const baseGreeting = surface === "journeys"
    ? getCompanionPlannerOpener({ userId: user?.id ?? null })
    : greeting;
  const todayLabel = getTodayLabel();
  const placeholder = pendingAction
    ? "Reply here or confirm the pending action."
    : surface === "journeys"
    ? "Talk to Cosmiq"
    : "Talk to Cosmiq naturally.";
  const planningMode = planningModeOverride ??
    legacyAssistant.planningMode ??
    DEFAULT_COMPANION_PLANNING_MODE;
  const setPlanningMode = useCallback((nextMode: CompanionPlanningMode) => {
    setPlanningModeOverride(nextMode);
    legacyAssistant.setPlanningMode?.(nextMode);
  }, [legacyAssistant]);

  const threadsQuery = useQuery({
    queryKey: getCompanionChatThreadsQueryKey(user?.id, companion?.id, surface),
    enabled: unifiedAgentActive && !!user?.id && !!companion?.id,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ThreadsQueryResult> => {
      if (!companion?.id) {
        return {
          threads: [],
          setupUnavailable: false,
        };
      }

      try {
        return {
          threads: await listCompanionChatThreads(companion.id, surface),
          setupUnavailable: false,
        };
      } catch (error) {
        if (!isCompanionChatSetupError(error)) {
          throw error;
        }

        return {
          threads: [],
          setupUnavailable: true,
        };
      }
    },
  });

  const openFreshThread = useCallback((options?: {
    sessionId?: string;
    greetingText?: string;
    markBootstrapped?: boolean;
  }) => {
    threadMutationVersionRef.current += 1;
    const nextSessionId = options?.sessionId ??
      generateCompanionThreadSessionId();
    const greetingText = options?.greetingText?.trim();
    localThreadCreatedAtRef.current = new Date().toISOString();
    applyActiveSessionId(nextSessionId);
    setDraftInput("");
    setInterimText("");
    setStructuredResponse(null);
    setPendingAction(null);
    setSavedSuggestionProposalIds([]);
    setPendingSuggestionProposalId(null);
    lastStarterIntentRef.current = null;
    lastReplayablePlannerMessageRef.current = null;
    setMessages(
      greetingText
        ? [
          createMessage("assistant", greetingText, {
            isSeed: true,
            source: "agent",
          }),
        ]
        : [],
    );

    if (options?.markBootstrapped) {
      bootstrappedScopeRef.current = scopeKey;
    }

    return nextSessionId;
  }, [applyActiveSessionId, scopeKey]);

  useEffect(() => {
    if (!activeSessionIdRef.current) return;

    threadUiStateCacheRef.current.set(activeSessionIdRef.current, {
      messages,
      structuredResponse,
      savedSuggestionProposalIds,
      lastStarterIntent: lastStarterIntentRef.current,
      lastReplayablePlannerMessage: lastReplayablePlannerMessageRef.current,
    });
  }, [
    messages,
    savedSuggestionProposalIds,
    structuredResponse,
  ]);

  const loadThreadState = useCallback(async (
    sessionId: string,
    options?: {
      expectedMutationVersion?: number;
    },
  ) => {
    const [threadMessages, loadedPendingAction] = await Promise.all([
      loadCompanionChatThreadMessages(sessionId, surface),
      loadCompanionPendingAction(sessionId),
    ]);

    if (
      options?.expectedMutationVersion !== undefined &&
      threadMutationVersionRef.current !== options.expectedMutationVersion
    ) {
      return false;
    }

    const cachedThreadUiState = threadUiStateCacheRef.current.get(sessionId) ??
      null;
    const mappedThreadMessages = cachedThreadUiState?.messages ??
      threadMessages.map(mapLoadedMessage);
    const restoredStructuredResponse = cachedThreadUiState?.structuredResponse ??
      deriveStructuredResponseFromMessages(mappedThreadMessages);
    const restoredSavedProposalIds = cachedThreadUiState?.savedSuggestionProposalIds ??
      collectSavedProposalIdsFromMessages(mappedThreadMessages);

    localThreadCreatedAtRef.current = threadMessages[0]?.createdAt ??
      new Date().toISOString();
    applyActiveSessionId(sessionId);
    setMessages(mappedThreadMessages);
    setStructuredResponse(restoredStructuredResponse);
    setPendingAction(loadedPendingAction);
    setSavedSuggestionProposalIds(
      pruneProposalIdsToStructuredResponse(
        restoredSavedProposalIds,
        restoredStructuredResponse,
      ),
    );
    setPendingSuggestionProposalId(loadedPendingAction?.proposalId ?? null);
    setDraftInput("");
    setInterimText("");
    lastStarterIntentRef.current = cachedThreadUiState?.lastStarterIntent ??
      null;
    lastReplayablePlannerMessageRef.current =
      cachedThreadUiState?.lastReplayablePlannerMessage ?? null;
    return true;
  }, [applyActiveSessionId, surface]);

  useEffect(() => {
    if (scopeKeyRef.current === scopeKey) return;

    scopeKeyRef.current = scopeKey;
    setUseLegacyFallback(!agentSurfaceEnabled);
    bootstrappedScopeRef.current = null;
    handledLaunchIntentIdRef.current = null;
    threadUiStateCacheRef.current.clear();
    openFreshThread({
      greetingText: baseGreeting,
    });
  }, [agentSurfaceEnabled, baseGreeting, openFreshThread, scopeKey]);

  useEffect(() => {
    if (!unifiedAgentActive) return;
    if (!threadsQuery.isSuccess) return;
    if (bootstrappedScopeRef.current === scopeKey) return;
    if (
      launchIntent?.id &&
      launchIntent.id !== handledLaunchIntentIdRef.current &&
      launchIntent.starterIntent !== "thread_history" &&
      launchIntent.target !== "campaign_builder"
    ) {
      return;
    }

    const activePersistedThread = threadsQuery.data.threads.find((thread) =>
      thread.archivedAt === null
    );

    if (!activePersistedThread) {
      openFreshThread({
        sessionId: activeSessionId || undefined,
        greetingText: baseGreeting,
        markBootstrapped: true,
      });
      return;
    }

    let cancelled = false;
    const hydrationVersion = threadMutationVersionRef.current;

    void loadThreadState(activePersistedThread.sessionId, {
      expectedMutationVersion: hydrationVersion,
    })
      .then((hydrated) => {
        if (cancelled) return;
        if (!hydrated) return;
        bootstrappedScopeRef.current = scopeKey;
      })
      .catch((error) => {
        console.error("Failed to hydrate companion thread:", error);
        if (cancelled || threadMutationVersionRef.current !== hydrationVersion) {
          return;
        }
        toast.error(
          isCompanionChatSetupError(error)
            ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
            : "I couldn't reopen the last thread, so I started a fresh one.",
        );
        openFreshThread({
          greetingText: baseGreeting,
          markBootstrapped: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSessionId,
    baseGreeting,
    loadThreadState,
    launchIntent,
    openFreshThread,
    scopeKey,
    threadsQuery.data,
    threadsQuery.isSuccess,
    unifiedAgentActive,
  ]);

  const persistedActiveThread = useMemo(
    () =>
      threadsQuery.data?.threads.find((thread) =>
        thread.sessionId === activeSessionId && thread.archivedAt === null
      ) ?? null,
    [activeSessionId, threadsQuery.data],
  );

  const hasRealMessages = useMemo(
    () => messages.some((message) => !message.isSeed),
    [messages],
  );

  const localActiveThread = useMemo<CompanionChatThreadSummary>(() => {
    const realMessages = messages.filter((message) => !message.isSeed);
    const firstUserMessage = realMessages.find((message) =>
      message.role === "user"
    );
    const latestMessage = realMessages[realMessages.length - 1];

    return {
      sessionId: activeSessionId,
      companionId: companion?.id ?? "",
      surface,
      title: buildCompanionThreadTitle(
        firstUserMessage?.content ?? "New thread",
      ),
      previewText: buildCompanionThreadPreview(latestMessage?.content ?? ""),
      createdAt: realMessages[0]?.createdAt ?? localThreadCreatedAtRef.current,
      lastMessageAt: latestMessage?.createdAt ??
        localThreadCreatedAtRef.current,
      archivedAt: null,
      messageCount: realMessages.length,
    };
  }, [activeSessionId, companion?.id, messages, surface]);

  const activeThread = persistedActiveThread ?? localActiveThread;
  const historyThreads = useMemo(
    () =>
      (threadsQuery.data?.threads ?? []).filter((thread) =>
        thread.sessionId !== persistedActiveThread?.sessionId &&
        thread.messageCount >= 2
      ),
    [persistedActiveThread?.sessionId, threadsQuery.data],
  );
  const hasPersistedActiveThread = Boolean(persistedActiveThread);

  const speakAssistantReply = useCallback(async (
    text: string,
    sessionId: string,
  ) => {
    if (!conversationEnabled || !companion?.id) return;
    if (!autoplayVoice || muteSpokenReplies) return;
    const trimmedText = text.trim();
    if (!trimmedText) return;

    setIsSpeaking(true);
    try {
      const provider = await speakCompanionReply({
        text: trimmedText,
        companionId: companion.id,
        voiceStyle,
        sessionId,
      });
      setSpeechProvider(provider);
    } catch (error) {
      console.error("Failed to speak companion reply:", error);
      setSpeechProvider("none");
    } finally {
      setIsSpeaking(false);
    }
  }, [
    autoplayVoice,
    companion?.id,
    conversationEnabled,
    muteSpokenReplies,
    voiceStyle,
  ]);

  useEffect(() => () => {
    stopCompanionSpeech();
  }, []);

  const invalidateThreads = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: getCompanionChatThreadsQueryKey(
        user?.id,
        companion?.id,
        surface,
      ),
    });
  }, [companion?.id, queryClient, surface, user?.id]);

  const appendAssistantResponse = useCallback((
    response: CompanionAgentResponse,
    options?: {
      pendingProposalId?: string | null;
    },
  ) => {
    const nextStructuredResponse = response.structuredResponse === undefined
      ? structuredResponse ?? null
      : response.structuredResponse ?? null;
    setMessages((previous) => [
      ...previous,
      createMessage("assistant", stripMarkdown(response.reply), {
        source: "agent",
        structuredResponse: nextStructuredResponse,
        pendingAction: response.pendingAction,
        receipt: response.receipt,
      }),
    ]);
    setStructuredResponse(nextStructuredResponse);
    setPendingAction(response.pendingAction ?? null);
    setSavedSuggestionProposalIds((previous) =>
      pruneProposalIdsToStructuredResponse(previous, nextStructuredResponse)
    );
    setPendingSuggestionProposalId(
      response.pendingAction
        ? response.pendingAction.proposalId ?? options?.pendingProposalId ?? null
        : null,
    );
    void speakAssistantReply(response.reply, response.threadState.sessionId);
  }, [speakAssistantReply, structuredResponse]);

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode = "text",
    options?: {
      starterIntent?: CompanionPlannerLaunchIntent["starterIntent"];
      planningMode?: CompanionPlanningMode | null;
    },
  ) => {
    const message = rawMessage.trim();
    if (!message || isSubmitting || isResolvingAction) return false;

    if (useLegacyFallback) {
      await legacyAssistant.submitMessage(message, inputMode, options);
      return true;
    }

    if (!user?.id || !companion?.id) {
      toast.error("Your companion is still loading. Try again in a moment.");
      return false;
    }

    setIsSubmitting(true);
    setDraftInput("");
    setInterimText("");

    const optimisticUserMessage = createMessage("user", message, {
      inputMode,
      source: "agent",
    });
    setMessages((previous) => [...previous, optimisticUserMessage]);
    const nextUnifiedMessages = [...messages, optimisticUserMessage];

    try {
      lastStarterIntentRef.current = options?.starterIntent ?? null;
      lastReplayablePlannerMessageRef.current = message;
      const { data, error } = await supabase.functions.invoke(
        "companion-agent",
        {
          body: {
            surface,
            sessionId: activeSessionIdRef.current,
            message,
            inputMode,
            currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
            starterIntent: options?.starterIntent,
            planningMode: options?.planningMode ?? planningMode,
          },
        },
      );

      if (error) throw error;

      const response = data as CompanionAgentResponse;
      applyActiveSessionId(response.threadState.sessionId);
      appendAssistantResponse(response);
      await trackInteraction({
        interactionType: "companion_agent",
        inputText: message,
        detectedIntent: response.intent,
        aiResponse: {
          mode: response.mode,
          structuredSections: collectStructuredResponseSectionKeys(
            response.structuredResponse ?? null,
          ),
          hasPendingAction: Boolean(response.pendingAction),
          pendingActionType: response.pendingAction?.actionType ?? null,
          hasReceipt: Boolean(response.receipt),
        },
        userAction: "accepted",
        modifications: {
          surface,
          starterIntent: options?.starterIntent ?? null,
          planningMode: options?.planningMode ?? planningMode,
          proposalId: response.pendingAction?.proposalId ?? null,
        },
      });
      void invalidateThreads();
      return true;
    } catch (error) {
      console.error("Failed to submit companion agent message:", error);
      const parsed = await parseFunctionInvokeError(error);
      if (shouldFallbackToLegacyAgent(parsed)) {
        legacyAssistant.hydrateFromUnifiedState?.({
          sessionId: activeSessionIdRef.current,
          messages: nextUnifiedMessages,
          savedSuggestionProposalIds,
          pendingSuggestionProposalId,
        });
        setUseLegacyFallback(true);
        await legacyAssistant.submitMessage(message, inputMode, options);
        return true;
      }

      toast.error(
        toUserFacingFunctionError(parsed, { action: "send your message" }),
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [
    applyActiveSessionId,
    appendAssistantResponse,
    companion?.id,
    invalidateThreads,
    isResolvingAction,
    isSubmitting,
    legacyAssistant,
    planningMode,
    trackInteraction,
    pendingSuggestionProposalId,
    savedSuggestionProposalIds,
    surface,
    useLegacyFallback,
    user?.id,
  ]);

  const resolvePendingAction = useCallback(
    async (mode: "confirm" | "cancel") => {
      if (useLegacyFallback) {
        if (mode === "confirm") {
          await legacyAssistant.confirmPendingAction();
        } else {
          await legacyAssistant.cancelPendingAction();
        }
        return;
      }

      if (!pendingAction || isResolvingAction || isSubmitting) return;

      setIsResolvingAction(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "companion-agent-action",
          {
            body: {
              sessionId: activeSessionIdRef.current,
              actionId: pendingAction.id,
              action: mode,
            },
          },
        );

        if (error) throw error;

        const response = data as CompanionAgentResponse;
        const nextStructuredResponse = response.structuredResponse === undefined
          ? structuredResponse ?? null
          : response.structuredResponse ?? null;
        const resolvedProposalId = pendingAction?.proposalId ??
          pendingSuggestionProposalId;
        setPendingAction(null);
        setMessages((previous) => [
          ...previous,
          createMessage("user", mode === "confirm" ? "Confirm" : "Cancel", {
            source: "agent",
          }),
          createMessage("assistant", stripMarkdown(response.reply), {
            source: "agent",
            structuredResponse: nextStructuredResponse,
            receipt: response.receipt,
          }),
        ]);
        setStructuredResponse(nextStructuredResponse);
        setSavedSuggestionProposalIds((previous) => {
          const nextProposalIds = mode === "confirm" &&
              response.receipt?.status === "executed" &&
              resolvedProposalId
            ? [...new Set([...previous, resolvedProposalId])]
            : previous;

          return pruneProposalIdsToStructuredResponse(
            nextProposalIds,
            nextStructuredResponse,
          );
        });
        setPendingSuggestionProposalId(null);
        await trackInteraction({
          interactionType: "companion_agent_confirmation",
          inputText: pendingAction.summary,
          detectedIntent: pendingAction.actionType,
          aiResponse: {
            mode: response.mode,
            receiptStatus: response.receipt?.status ?? null,
            actionType: pendingAction.actionType,
          },
          userAction: mode === "confirm" ? "accepted" : "rejected",
          modifications: {
            actionId: pendingAction.id,
            proposalId: resolvedProposalId ?? null,
            confirmationMode: mode,
            surface,
            planningMode,
            starterIntent: lastStarterIntentRef.current,
          },
        });
        void speakAssistantReply(
          response.reply,
          response.threadState.sessionId,
        );
        void invalidateThreads();
      } catch (error) {
        console.error(`Failed to ${mode} pending action:`, error);
        toast.error(
          mode === "confirm"
            ? "I couldn't confirm that action right now."
            : "I couldn't cancel that action right now.",
        );
      } finally {
        setIsResolvingAction(false);
      }
    },
    [
      invalidateThreads,
      isResolvingAction,
      isSubmitting,
      legacyAssistant,
      pendingAction,
      pendingSuggestionProposalId,
      planningMode,
      speakAssistantReply,
      structuredResponse,
      surface,
      trackInteraction,
      useLegacyFallback,
    ],
  );

  const confirmSuggestedQuest = useCallback(async (proposalId: string) => {
    if (useLegacyFallback) {
      await legacyAssistant.confirmSuggestedQuest(proposalId);
      return;
    }

    if (!proposalId || pendingAction || isSubmitting || isResolvingAction) {
      return;
    }

    const latestUserMessage = lastReplayablePlannerMessageRef.current?.trim() ||
      [...messages]
        .reverse()
        .find((message) =>
          message.role === "user" &&
          !message.isSeed &&
          !isSyntheticResolutionMessage(message.content)
        )
        ?.content
        ?.trim() ||
      (structuredResponse?.planDay
        ? "Plan my day"
        : structuredResponse?.weeklyPlan
        ? "Plan my week"
        : structuredResponse?.priorityOverview
        ? structuredResponse.priorityOverview.title.toLowerCase().includes(
            "make room",
          )
          ? "Help me make room for what matters."
          : "What matters most today?"
        : structuredResponse?.reflectionBridge
        ? "Prepare me for tomorrow"
        : structuredResponse?.campaignMomentum
        ? "Advance my campaign"
        : structuredResponse?.dayAdjust
        ? "Adjust my day"
        : structuredResponse?.rightNow
        ? "What should I do right now?"
        : structuredResponse?.comingUp
        ? "What do I have coming up?"
        : null);

    if (!latestUserMessage) {
      toast.error(
        "I couldn't recover that planner suggestion. Try asking again.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const starterIntent = lastStarterIntentRef.current ??
        inferStarterIntentFromStructuredResponse(structuredResponse) ??
        undefined;
      lastReplayablePlannerMessageRef.current = latestUserMessage;
      const { data, error } = await supabase.functions.invoke(
        "companion-agent",
        {
          body: {
            surface,
            sessionId: activeSessionIdRef.current,
            message: latestUserMessage,
            inputMode: "text",
            currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
            starterIntent,
            planningMode,
            selectedProposalId: proposalId,
          },
        },
      );

      if (error) throw error;

      const response = data as CompanionAgentResponse;
      applyActiveSessionId(response.threadState.sessionId);
      appendAssistantResponse(response, {
        pendingProposalId: proposalId,
      });
      await trackInteraction({
        interactionType: "companion_agent_suggestion_prepare",
        inputText: latestUserMessage,
        detectedIntent: response.intent,
        aiResponse: {
          mode: response.mode,
          actionType: response.pendingAction?.actionType ?? null,
          proposalId: response.pendingAction?.proposalId ?? proposalId,
        },
        userAction: "accepted",
        modifications: {
          proposalId,
          starterIntent: starterIntent ?? null,
          planningMode,
          surface,
        },
      });
      void invalidateThreads();
    } catch (error) {
      console.error("Failed to prepare planner suggestion:", error);
      toast.error("I couldn't prepare that suggestion right now.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    appendAssistantResponse,
    applyActiveSessionId,
    invalidateThreads,
    isResolvingAction,
    isSubmitting,
    legacyAssistant,
    messages,
    pendingAction,
    planningMode,
    structuredResponse,
    surface,
    trackInteraction,
    useLegacyFallback,
  ]);

  const archiveCurrentThread = useCallback(async () => {
    if (!persistedActiveThread) {
      openFreshThread({
        greetingText: baseGreeting,
        markBootstrapped: true,
      });
      return;
    }

    await setCompanionChatThreadArchived(persistedActiveThread.sessionId, true);
    await invalidateThreads();
    openFreshThread({
      greetingText: baseGreeting,
      markBootstrapped: true,
    });
  }, [baseGreeting, invalidateThreads, openFreshThread, persistedActiveThread]);

  const startNewChat = useCallback(
    async (options?: { greetingText?: string | null }) => {
      const threadToArchive = persistedActiveThread ??
        threadsQuery.data?.threads.find((thread) => thread.archivedAt === null) ??
        null;

      if (threadToArchive) {
        await setCompanionChatThreadArchived(
          threadToArchive.sessionId,
          true,
        );
        await invalidateThreads();
      }

      const greetingText = options?.greetingText === null
        ? undefined
        : options?.greetingText ?? baseGreeting;

      return openFreshThread({
        greetingText,
        markBootstrapped: true,
      });
    },
    [
      baseGreeting,
      invalidateThreads,
      openFreshThread,
      persistedActiveThread,
      threadsQuery.data?.threads,
    ],
  );

  const resumeThread = useCallback(async (sessionId: string) => {
    const hydrationVersion = threadMutationVersionRef.current + 1;
    threadMutationVersionRef.current = hydrationVersion;
    await loadThreadState(sessionId, {
      expectedMutationVersion: hydrationVersion,
    });
  }, [loadThreadState]);

  useEffect(() => {
    if (!launchIntent?.id) return;
    if (handledLaunchIntentIdRef.current === launchIntent.id) return;
    if (launchIntent.starterIntent === "thread_history") return;
    if (!useLegacyFallback && !threadsQuery.isSuccess) return;

    handledLaunchIntentIdRef.current = launchIntent.id;

    if (launchIntent.target === "campaign_builder") {
      onOpenCampaignBuilder?.(launchIntent.message);
      onLaunchIntentConsumed?.(launchIntent.id);
      return;
    }

    const launchMessage = launchIntent.message;
    const intentId = launchIntent.id;

    void (async () => {
      threadMutationVersionRef.current += 1;

      try {
        if (launchIntent.planningMode) {
          setPlanningMode(launchIntent.planningMode);
        }

        if (useLegacyFallback) {
          legacyAssistant.startTemplateThread?.();
        } else {
          await startNewChat({ greetingText: null });
        }

        const submitted = await submitMessage(launchMessage, "text", {
          starterIntent: launchIntent.starterIntent,
          planningMode: launchIntent.planningMode,
        });
        if (submitted && launchIntent.starterIntent === "plan_day") {
          window.dispatchEvent(new CustomEvent("companion-plan-my-day-started"));
        }
      } catch (error) {
        console.error("Failed to handle launch intent:", error);
        const parsed = await parseFunctionInvokeError(error);
        toast.error(
          toUserFacingFunctionError(parsed, { action: "start this chat" }),
        );
      } finally {
        onLaunchIntentConsumed?.(intentId);
      }
    })();
  }, [
    launchIntent,
    legacyAssistant,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
    startNewChat,
    submitMessage,
    threadsQuery.isSuccess,
    useLegacyFallback,
  ]);

  const {
    isRecording,
    isAutoStopping,
    isSupported,
    permissionStatus,
    toggleRecording,
    requestPermission,
  } = useVoiceInput({
    onInterimResult: (text) => {
      setInterimText(text);
    },
    onFinalResult: (text) => {
      const nextMessage = text.trim();
      if (!nextMessage) return;
      void submitMessage(nextMessage, "voice");
    },
    onError: (message) => {
      toast.error(message);
    },
    onPermissionNeeded: () => {
      setShowPermissionDialog(true);
    },
  });

  const requestMicrophonePermission = useCallback(async () => {
    setIsRequestingPermission(true);
    try {
      const status = await requestPermission();
      if (status === "granted") {
        setShowPermissionDialog(false);
        toggleRecording();
      }
    } finally {
      setIsRequestingPermission(false);
    }
  }, [requestPermission, toggleRecording]);

  const canStartNewChat = !isSubmitting && !isResolvingAction && !pendingAction;
  const canArchiveThread = canStartNewChat && hasPersistedActiveThread;
  const newChatDisabledReason = pendingAction
    ? "Resolve or cancel the pending action first."
    : null;
  const archiveDisabledReason = pendingAction
    ? "Resolve or cancel the pending action first."
    : hasPersistedActiveThread
    ? null
    : "This chat isn't saved yet.";
  const threadHistoryEmptyStateMessage = threadsQuery.data?.setupUnavailable
    ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
    : COMPANION_CHAT_THREAD_HISTORY_EMPTY_STATE;

  if (useLegacyFallback) {
    return {
      todayLabel: legacyAssistant.todayLabel,
      placeholder: legacyAssistant.placeholder,
      messages: legacyAssistant.messages,
      structuredResponse: legacyAssistant.structuredResponse,
      planningMode: legacyAssistant.planningMode,
      setPlanningMode: legacyAssistant.setPlanningMode,
      pendingAction: legacyAssistant.pendingAction,
      savedSuggestionProposalIds:
        legacyAssistant.savedSuggestionProposalIds ?? [],
      pendingSuggestionProposalId:
        legacyAssistant.pendingSuggestionProposalId ??
          legacyAssistant.pendingAction?.proposalId ??
          null,
      pendingActionCount: legacyAssistant.pendingActionCount,
      readyPendingActionCount: legacyAssistant.readyPendingActionCount,
      draftInput,
      setDraftInput,
      interimText,
      isSubmitting: legacyAssistant.isSubmitting,
      isResolvingAction: legacyAssistant.isResolvingAction,
      submitMessage,
      submitTypedMessage: () => submitMessage(draftInput, "text"),
      confirmPendingAction: () => resolvePendingAction("confirm"),
      cancelPendingAction: () => resolvePendingAction("cancel"),
      confirmSuggestedQuest,
      confirmAllPendingActions: legacyAssistant.confirmAllPendingActions,
      isRecording,
      isAutoStopping,
      isVoiceSupported: isSupported,
      permissionStatus,
      showPermissionDialog,
      setShowPermissionDialog,
      isRequestingPermission,
      toggleRecording,
      requestMicrophonePermission,
      isSpeaking: legacyAssistant.isSpeaking,
      speechProvider: legacyAssistant.speechProvider,
      stopSpeaking: legacyAssistant.stopSpeaking,
      activeThread: legacyAssistant.activeThread,
      historyThreads: legacyAssistant.historyThreads,
      isLoadingThreads: legacyAssistant.isLoadingThreads,
      hasPersistedActiveThread: legacyAssistant.hasPersistedActiveThread,
      canOpenThreadPicker: legacyAssistant.canOpenThreadPicker,
      threadHistoryEmptyStateMessage:
        legacyAssistant.threadHistoryEmptyStateMessage,
      resumeThread: legacyAssistant.resumeThread,
      archiveCurrentThread: legacyAssistant.archiveCurrentThread,
      canArchiveThread: legacyAssistant.canArchiveThread,
      archiveDisabledReason: legacyAssistant.archiveDisabledReason,
      startNewChat: legacyAssistant.startNewChat,
      canStartNewChat: legacyAssistant.canStartNewChat,
      newChatDisabledReason: legacyAssistant.newChatDisabledReason,
    };
  }

  return {
    todayLabel,
    placeholder,
    messages,
    structuredResponse,
    planningMode,
    setPlanningMode,
    pendingAction,
    savedSuggestionProposalIds,
    pendingSuggestionProposalId,
    pendingActionCount: pendingAction ? 1 : 0,
    readyPendingActionCount: pendingAction ? 1 : 0,
    draftInput,
    setDraftInput,
    interimText,
    isSubmitting,
    isResolvingAction,
    submitMessage,
    submitTypedMessage: () => submitMessage(draftInput, "text"),
    confirmPendingAction: () => resolvePendingAction("confirm"),
    cancelPendingAction: () => resolvePendingAction("cancel"),
    confirmSuggestedQuest,
    confirmAllPendingActions: () => resolvePendingAction("confirm"),
    isRecording,
    isAutoStopping,
    isVoiceSupported: isSupported,
    permissionStatus,
    showPermissionDialog,
    setShowPermissionDialog,
    isRequestingPermission,
    toggleRecording,
    requestMicrophonePermission,
    isSpeaking,
    speechProvider,
    stopSpeaking: () => {
      stopCompanionSpeech();
      setIsSpeaking(false);
      setSpeechProvider("none");
    },
    activeThread,
    historyThreads,
    isLoadingThreads: threadsQuery.isLoading,
    hasPersistedActiveThread,
    canOpenThreadPicker: !threadsQuery.data?.setupUnavailable,
    threadHistoryEmptyStateMessage,
    resumeThread,
    archiveCurrentThread,
    canArchiveThread,
    archiveDisabledReason,
    startNewChat,
    canStartNewChat,
    newChatDisabledReason,
  };
}
