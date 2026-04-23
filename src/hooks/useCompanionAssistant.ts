import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionDialogue } from "@/hooks/useCompanionDialogue";
import type { PermissionStatus } from "@/hooks/useMicrophonePermission";
import { useCompanionVoiceSettings } from "@/hooks/useCompanionVoiceSettings";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { supabase } from "@/integrations/supabase/client";
import { stripMarkdown } from "@/lib/utils";
import { invalidateCompanionChatThreadsQuery } from "@/lib/companionConversationQueryCache";
import {
  buildCompanionThreadPreview,
  buildCompanionThreadTitle,
  generateCompanionThreadSessionId,
  getCompanionChatThreadsQueryKey,
  listCompanionChatThreads,
  loadCompanionChatThreadMessages,
  loadCompanionPendingAction,
  setCompanionChatThreadArchived,
} from "@/services/companionChatThreads";
import {
  speakCompanionReply,
  stopCompanionSpeech,
  type CompanionSpeechProvider,
} from "@/services/companionSpeech";
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
import type {
  CompanionPlannerLaunchIntent,
  CompanionPlannerPendingNotice,
} from "@/types/companionPlanner";
import {
  COMPANION_PENDING_ACTIONS_DISABLED_REASON,
  COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON,
  COMPANION_CHAT_THREAD_HISTORY_EMPTY_STATE,
  isCompanionChatSetupError,
} from "@/utils/companionChatSetup";
import { formatCurrentDateTimeWithOffset } from "@/utils/currentDateTime";
import { stripLegacyJourneysPlannerOpeners } from "@/utils/legacyJourneysPlannerOpener";

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

export interface CompanionAssistantFailedMessage {
  text: string;
  inputMode: CompanionChatInputMode;
  optimisticMessageId: string;
}

type CompanionAssistantSubmitMessage = (
  rawMessage: string,
  inputMode?: CompanionChatInputMode,
) => Promise<void>;

type CompanionAssistantAsyncAction = () => Promise<void>;

type CompanionAssistantAcceptSuggestedQuest = (
  proposalId: string,
) => Promise<void | undefined>;

export interface CompanionAssistantState {
  todayLabel: string;
  placeholder: string;
  messages: CompanionAssistantMessage[];
  structuredResponse: CompanionAgentResponse["structuredResponse"];
  pendingAction: PendingActionView | null;
  unsupportedPendingProposalNotice: CompanionPlannerPendingNotice | null;
  error: string | null;
  lastFailedMessage: CompanionAssistantFailedMessage | null;
  draftInput: string;
  setDraftInput: Dispatch<SetStateAction<string>>;
  interimText: string;
  isSubmitting: boolean;
  isResolvingAction: boolean;
  submitMessage: CompanionAssistantSubmitMessage;
  submitTypedMessage: CompanionAssistantAsyncAction;
  acceptSuggestedQuest: CompanionAssistantAcceptSuggestedQuest;
  canAcceptSuggestedQuests: boolean;
  suggestedQuestDisabledReason: string | null;
  retryLastMessage: CompanionAssistantAsyncAction;
  confirmPendingAction: CompanionAssistantAsyncAction;
  cancelPendingAction: CompanionAssistantAsyncAction;
  isRecording: boolean;
  isAutoStopping: boolean;
  isVoiceSupported: boolean;
  permissionStatus: PermissionStatus;
  showPermissionDialog: boolean;
  setShowPermissionDialog: Dispatch<SetStateAction<boolean>>;
  isRequestingPermission: boolean;
  toggleRecording: () => void;
  requestMicrophonePermission: CompanionAssistantAsyncAction;
  isSpeaking: boolean;
  speechProvider: CompanionSpeechProvider;
  stopSpeaking: () => void;
  activeThread: CompanionChatThreadSummary | null;
  historyThreads: CompanionChatThreadSummary[];
  isLoadingThreads: boolean;
  hasPersistedActiveThread: boolean;
  canOpenThreadPicker: boolean;
  threadPickerDisabledReason: string | null;
  threadHistoryEmptyStateMessage: string;
  resumeThread: (sessionId: string) => Promise<void>;
  archiveCurrentThread: CompanionAssistantAsyncAction;
  canArchiveThread: boolean;
  archiveDisabledReason: string | null;
  startNewChat: CompanionAssistantAsyncAction;
  canStartNewChat: boolean;
  newChatDisabledReason: string | null;
}

interface UseCompanionAssistantOptions {
  surface: CompanionAssistantSurface;
  conversationEnabled?: boolean;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
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

const mapLoadedMessage = (
  message: Awaited<ReturnType<typeof loadCompanionChatThreadMessages>>[number],
): CompanionAssistantMessage => ({
  id: message.id,
  role: message.role,
  content: message.content,
  createdAt: message.createdAt,
  inputMode: message.inputMode,
  source: message.source,
});

const getTodayLabel = () =>
  new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

export function useCompanionAssistant({
  surface,
  conversationEnabled = true,
  launchIntent = null,
  onLaunchIntentConsumed,
  onOpenCampaignBuilder,
}: UseCompanionAssistantOptions): CompanionAssistantState {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { greeting, voiceStyle } = useCompanionDialogue();
  const { autoplayVoice, muteSpokenReplies } = useCompanionVoiceSettings();
  const queryClient = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useState(() => generateCompanionThreadSessionId());
  const [messages, setMessages] = useState<CompanionAssistantMessage[]>([]);
  const [structuredResponse, setStructuredResponse] = useState<
    CompanionAgentResponse["structuredResponse"]
  >(null);
  const [pendingAction, setPendingAction] = useState<PendingActionView | null>(null);
  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lastFailedMessage, setLastFailedMessage] = useState<CompanionAssistantFailedMessage | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResolvingAction, setIsResolvingAction] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechProvider, setSpeechProvider] = useState<CompanionSpeechProvider>("none");

  const localThreadCreatedAtRef = useRef(new Date().toISOString());
  const scopeKeyRef = useRef<string | null>(null);
  const bootstrappedScopeRef = useRef<string | null>(null);
  const handledLaunchIntentIdRef = useRef<string | null>(null);

  const scopeKey = `${surface}:${user?.id ?? "anon"}:${companion?.id ?? "none"}`;
  const baseGreeting = surface === "journeys" ? null : greeting;
  const todayLabel = getTodayLabel();
  const placeholder = surface === "journeys"
    ? "chat"
    : pendingAction
      ? "Reply here or confirm the pending action."
      : "Talk to Cosmiq naturally.";

  const threadsQuery = useQuery({
    queryKey: getCompanionChatThreadsQueryKey(user?.id, companion?.id, surface),
    enabled: !!user?.id && !!companion?.id,
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
    const nextSessionId = options?.sessionId ?? generateCompanionThreadSessionId();
    const greetingText = options?.greetingText?.trim();
    localThreadCreatedAtRef.current = new Date().toISOString();
    setActiveSessionId(nextSessionId);
    setDraftInput("");
    setInterimText("");
    setError(null);
    setLastFailedMessage(null);
    setPendingAction(null);
    setStructuredResponse(null);
    setMessages(
      greetingText
        ? [createMessage("assistant", greetingText, { isSeed: true, source: "agent" })]
        : [],
    );

    if (options?.markBootstrapped) {
      bootstrappedScopeRef.current = scopeKey;
    }

    return nextSessionId;
  }, [scopeKey]);

  const loadThreadState = useCallback(async (sessionId: string) => {
    const threadMessages = await loadCompanionChatThreadMessages(sessionId, surface);
    const visibleThreadMessages = surface === "journeys"
      ? stripLegacyJourneysPlannerOpeners(threadMessages)
      : threadMessages;
    let loadedPendingAction: PendingActionView | null = null;
    let pendingActionsSetupUnavailable = false;

    try {
      loadedPendingAction = await loadCompanionPendingAction(sessionId);
    } catch (error) {
      if (!isCompanionChatSetupError(error)) {
        throw error;
      }

      pendingActionsSetupUnavailable = true;
    }

    localThreadCreatedAtRef.current =
      visibleThreadMessages[0]?.createdAt
      ?? threadMessages[0]?.createdAt
      ?? new Date().toISOString();
    setActiveSessionId(sessionId);
    setMessages(visibleThreadMessages.map(mapLoadedMessage));
    setPendingAction(loadedPendingAction);
    setStructuredResponse(null);
    setDraftInput("");
    setInterimText("");
    setError(null);
    setLastFailedMessage(null);

    if (pendingActionsSetupUnavailable) {
      toast.error(COMPANION_PENDING_ACTIONS_DISABLED_REASON, {
        id: `companion-pending-actions-setup:${scopeKey}`,
      });
    }
  }, [scopeKey, surface]);

  useEffect(() => {
    if (scopeKeyRef.current === scopeKey) return;

    scopeKeyRef.current = scopeKey;
    bootstrappedScopeRef.current = null;
    handledLaunchIntentIdRef.current = null;
    openFreshThread({
      greetingText: baseGreeting,
    });
  }, [baseGreeting, openFreshThread, scopeKey]);

  useEffect(() => {
    if (!threadsQuery.isSuccess) return;
    if (bootstrappedScopeRef.current === scopeKey) return;

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
    void loadThreadState(activePersistedThread.sessionId)
      .then(() => {
        if (cancelled) return;
        bootstrappedScopeRef.current = scopeKey;
      })
      .catch((error) => {
        console.error("Failed to hydrate companion thread:", error);
        if (cancelled) return;
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
    openFreshThread,
    scopeKey,
    threadsQuery.data,
    threadsQuery.isSuccess,
  ]);

  const persistedActiveThread = useMemo(
    () => threadsQuery.data?.threads.find((thread) =>
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
    const firstUserMessage = realMessages.find((message) => message.role === "user");
    const latestMessage = realMessages[realMessages.length - 1];

    return {
      sessionId: activeSessionId,
      companionId: companion?.id ?? "",
      surface,
      title: buildCompanionThreadTitle(firstUserMessage?.content ?? "New thread"),
      previewText: buildCompanionThreadPreview(latestMessage?.content ?? ""),
      createdAt: realMessages[0]?.createdAt ?? localThreadCreatedAtRef.current,
      lastMessageAt: latestMessage?.createdAt ?? localThreadCreatedAtRef.current,
      archivedAt: null,
      messageCount: realMessages.length,
    };
  }, [activeSessionId, companion?.id, messages, surface]);

  const activeThread = persistedActiveThread ?? localActiveThread;
  const historyThreads = useMemo(
    () => (threadsQuery.data?.threads ?? []).filter((thread) =>
      thread.sessionId !== persistedActiveThread?.sessionId && thread.messageCount >= 2
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
  }, [autoplayVoice, companion?.id, conversationEnabled, muteSpokenReplies, voiceStyle]);

  useEffect(() => () => {
    stopCompanionSpeech();
  }, []);

  const invalidateThreads = useCallback(() => {
    return invalidateCompanionChatThreadsQuery(queryClient, {
      userId: user?.id,
      companionId: companion?.id,
      surface,
    });
  }, [companion?.id, queryClient, surface, user?.id]);

  const appendAssistantResponse = useCallback((
    response: CompanionAgentResponse,
  ) => {
    setError(null);
    setLastFailedMessage(null);
    setMessages((previous) => [
      ...previous,
        createMessage("assistant", stripMarkdown(response.reply), {
          source: "agent",
          structuredResponse: response.structuredResponse ?? null,
          pendingAction: response.pendingAction,
          receipt: response.receipt,
        }),
    ]);
    setStructuredResponse(response.structuredResponse ?? null);
    setPendingAction(response.pendingAction ?? null);
    void speakAssistantReply(response.reply, response.threadState.sessionId);
  }, [speakAssistantReply]);

  const submitMessageInternal = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode = "text",
    options?: {
      optimisticMessageId?: string;
    },
  ) => {
    const message = rawMessage.trim();
    if (!message || isSubmitting || isResolvingAction) return;

    if (!user?.id || !companion?.id) {
      toast.error("Your companion is still loading. Try again in a moment.");
      return;
    }

    setIsSubmitting(true);
    setDraftInput("");
    setInterimText("");
    setError(null);
    setLastFailedMessage(null);

    const optimisticMessageId = options?.optimisticMessageId ?? generateMessageId();
    const optimisticUserMessage: CompanionAssistantMessage = {
      id: optimisticMessageId,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
      inputMode,
      source: "agent",
    };
    setMessages((previous) => (
      previous.some((entry) => entry.id === optimisticMessageId)
        ? previous
        : [...previous, optimisticUserMessage]
    ));

    try {
      const { data, error } = await supabase.functions.invoke("companion-agent", {
        body: {
          surface,
          sessionId: activeSessionId,
          message,
          inputMode,
          currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
        },
      });

      if (error) throw error;

      const response = data as CompanionAgentResponse;
      setActiveSessionId(response.threadState.sessionId);
      appendAssistantResponse(response);
      void invalidateThreads();
    } catch (error) {
      console.error("Failed to submit companion agent message:", error);
      const nextError = "Cosmiq hit a snag. Try that again.";
      toast.error(nextError);
      setError(nextError);
      setLastFailedMessage({
        text: message,
        inputMode,
        optimisticMessageId,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    activeSessionId,
    appendAssistantResponse,
    companion?.id,
    invalidateThreads,
    isResolvingAction,
    isSubmitting,
    surface,
    user?.id,
  ]);

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode = "text",
  ) => {
    await submitMessageInternal(rawMessage, inputMode);
  }, [submitMessageInternal]);

  const retryLastMessage = useCallback(async () => {
    if (!lastFailedMessage) return;

    await submitMessageInternal(lastFailedMessage.text, lastFailedMessage.inputMode, {
      optimisticMessageId: lastFailedMessage.optimisticMessageId,
    });
  }, [lastFailedMessage, submitMessageInternal]);

  const resolvePendingAction = useCallback(async (mode: "confirm" | "cancel") => {
    if (!pendingAction || isResolvingAction || isSubmitting) return;

    setIsResolvingAction(true);
    try {
      const { data, error } = await supabase.functions.invoke("companion-agent-action", {
        body: {
          sessionId: activeSessionId,
          actionId: pendingAction.id,
          action: mode,
        },
      });

      if (error) throw error;

      const response = data as CompanionAgentResponse;
      setPendingAction(null);
      setMessages((previous) => [
        ...previous,
        createMessage("user", mode === "confirm" ? "Confirm" : "Cancel", {
          source: "agent",
        }),
        createMessage("assistant", stripMarkdown(response.reply), {
          source: "agent",
          structuredResponse: response.structuredResponse ?? null,
          receipt: response.receipt,
        }),
      ]);
      setStructuredResponse(response.structuredResponse ?? null);
      void speakAssistantReply(response.reply, response.threadState.sessionId);
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
  }, [
    activeSessionId,
    invalidateThreads,
    isResolvingAction,
    isSubmitting,
    pendingAction,
    speakAssistantReply,
  ]);

  useEffect(() => {
    if (!launchIntent?.id) return;
    if (handledLaunchIntentIdRef.current === launchIntent.id) return;
    if (launchIntent.starterIntent === "thread_history") return;
    if (!threadsQuery.isSuccess) return;

    handledLaunchIntentIdRef.current = launchIntent.id;

    if (launchIntent.target === "campaign_builder") {
      onOpenCampaignBuilder?.(launchIntent.message);
      onLaunchIntentConsumed?.(launchIntent.id);
      return;
    }

    void submitMessage(launchIntent.message, "text");
    onLaunchIntentConsumed?.(launchIntent.id);
  }, [
    launchIntent,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
    submitMessage,
    threadsQuery.isSuccess,
  ]);

  const { isRecording, isAutoStopping, isSupported, permissionStatus, toggleRecording, requestPermission } = useVoiceInput({
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

  const newChatDisabledReason = pendingAction
    ? "Resolve or cancel the pending action first."
    : isSubmitting || isResolvingAction
      ? "Wait for the current reply to finish."
      : null;
  const archiveDisabledReason = pendingAction
    ? "Resolve or cancel the pending action first."
    : isSubmitting || isResolvingAction
      ? "Wait for the current reply to finish."
      : hasPersistedActiveThread
        ? null
        : "This chat isn't saved yet.";
  const threadPickerDisabledReason = surface !== "journeys"
    ? null
    : pendingAction
      ? "Resolve or cancel the pending action first."
      : isSubmitting || isResolvingAction
        ? "Wait for the current reply to finish."
        : threadsQuery.isLoading
          ? "Loading thread history."
          : threadsQuery.data?.setupUnavailable
            ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
            : null;
  const canStartNewChat = newChatDisabledReason === null;
  const canArchiveThread = archiveDisabledReason === null;
  const canOpenThreadPicker = threadPickerDisabledReason === null;

  const archiveCurrentThread = useCallback(async () => {
    if (archiveDisabledReason || !persistedActiveThread) return;

    await setCompanionChatThreadArchived(persistedActiveThread.sessionId, true);
    await invalidateThreads();
    openFreshThread({
      greetingText: baseGreeting,
    });
  }, [
    archiveDisabledReason,
    baseGreeting,
    invalidateThreads,
    openFreshThread,
    persistedActiveThread,
  ]);

  const startNewChat = useCallback(async () => {
    if (newChatDisabledReason) return;

    if (persistedActiveThread) {
      await setCompanionChatThreadArchived(persistedActiveThread.sessionId, true);
      await invalidateThreads();
    }

    openFreshThread({
      greetingText: baseGreeting,
    });
  }, [
    baseGreeting,
    invalidateThreads,
    newChatDisabledReason,
    openFreshThread,
    persistedActiveThread,
  ]);

  const resumeThread = useCallback(async (sessionId: string) => {
    if (threadPickerDisabledReason || sessionId === activeSessionId) return;
    await loadThreadState(sessionId);
  }, [activeSessionId, loadThreadState, threadPickerDisabledReason]);

  const threadHistoryEmptyStateMessage = threadsQuery.data?.setupUnavailable
    ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
    : COMPANION_CHAT_THREAD_HISTORY_EMPTY_STATE;

  return {
    todayLabel,
    placeholder,
    messages,
    structuredResponse,
    pendingAction,
    unsupportedPendingProposalNotice: null,
    error,
    lastFailedMessage,
    draftInput,
    setDraftInput,
    interimText,
    isSubmitting,
    isResolvingAction,
    submitMessage,
    submitTypedMessage: () => submitMessage(draftInput, "text"),
    acceptSuggestedQuest: async (_proposalId: string) => undefined,
    canAcceptSuggestedQuests: false,
    suggestedQuestDisabledReason:
      "Tap-to-add for suggested day-plan quests isn't available in this mode yet. Ask me to add it directly instead.",
    retryLastMessage,
    confirmPendingAction: () => resolvePendingAction("confirm"),
    cancelPendingAction: () => resolvePendingAction("cancel"),
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
    canOpenThreadPicker,
    threadPickerDisabledReason,
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
