import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import {
  buildCompanionThreadPreview,
  buildCompanionThreadTitle,
  generateCompanionThreadSessionId,
  getCompanionChatThreadsQueryKey,
  listCompanionChatThreads,
  loadCompanionChatThreadMessages,
  setCompanionChatThreadArchived,
} from "@/services/companionChatThreads";
import type {
  CompanionChatThreadMessage,
  CompanionChatThreadSummary,
} from "@/types/companionConversation";
import {
  COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON,
  COMPANION_CHAT_THREAD_HISTORY_EMPTY_STATE,
  isCompanionChatSetupError,
} from "@/utils/companionChatSetup";
import { stripLegacyJourneysPlannerOpeners } from "@/utils/legacyJourneysPlannerOpener";

type JourneysAssistantMessage = {
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  source: "chat" | "plan";
};

interface UseJourneysCompanionThreadsOptions {
  enabled: boolean;
  userId: string | null | undefined;
  companionId: string | null | undefined;
  messages: JourneysAssistantMessage[];
  persistenceReady: boolean;
  persistenceUnavailableReason: string | null;
  hasPendingPlannerWork: boolean;
  isBusy: boolean;
  conversation: {
    resetThread: (options?: { sessionId?: string }) => void;
    hydrateThread: (options: {
      sessionId: string;
      messages: Array<{
        id: string;
        role: "assistant" | "user";
        content: string;
        createdAt: string;
        inputMode?: "text" | "voice";
      }>;
    }) => void;
  };
  planner: {
    resetThread: (options?: { sessionId?: string }) => void;
    hydrateThread: (options: {
      sessionId: string;
      messages: CompanionChatThreadMessage[];
    }) => void;
  };
}

type JourneysThreadsQueryResult = {
  threads: CompanionChatThreadSummary[];
  setupUnavailable: boolean;
};

const getActivePersistedThread = (
  threads: CompanionChatThreadSummary[] | undefined,
) =>
  threads?.find((thread) => thread.archivedAt === null) ?? null;

const mapChatMessages = (messages: CompanionChatThreadMessage[]) =>
  messages
    .filter((message) => message.source === "chat")
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
      inputMode: message.inputMode,
    }));

const mapPlannerMessages = (messages: CompanionChatThreadMessage[]) =>
  messages.filter((message) => message.source === "plan");

export function useJourneysCompanionThreads({
  enabled,
  userId,
  companionId,
  messages,
  persistenceReady,
  persistenceUnavailableReason,
  hasPendingPlannerWork,
  isBusy,
  conversation,
  planner,
}: UseJourneysCompanionThreadsOptions) {
  const queryClient = useQueryClient();
  const { resetThread: resetConversationThread, hydrateThread: hydrateConversationThread } = conversation;
  const { resetThread: resetPlannerThread, hydrateThread: hydratePlannerThread } = planner;
  const [activeSessionId, setActiveSessionId] = useState("");
  const [isHydratingThread, setIsHydratingThread] = useState(false);
  const [locallyArchivedSessionId, setLocallyArchivedSessionId] = useState<string | null>(null);
  const localThreadCreatedAtRef = useRef(new Date().toISOString());
  const scopeKeyRef = useRef<string | null>(null);
  const bootstrappedScopeKeyRef = useRef<string | null>(null);
  const threadMutationVersionRef = useRef(0);
  const hasRealThreadMessages = useMemo(() => messages.length > 0, [messages]);

  const scopeKey = `${userId ?? "anon"}:${companionId ?? "none"}`;
  const threadsQueryKey = getCompanionChatThreadsQueryKey(
    userId,
    companionId,
    "journeys",
  );

  const threadsQuery = useQuery({
    queryKey: threadsQueryKey,
    enabled: enabled && !!userId && !!companionId,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<JourneysThreadsQueryResult> => {
      if (!companionId) {
        return {
          threads: [],
          setupUnavailable: false,
        };
      }

      try {
        return {
          threads: await listCompanionChatThreads(companionId, "journeys"),
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
    markBootstrapped?: boolean;
  }) => {
    const nextSessionId = options?.sessionId ?? generateCompanionThreadSessionId();
    threadMutationVersionRef.current += 1;
    localThreadCreatedAtRef.current = new Date().toISOString();
    setIsHydratingThread(false);
    setLocallyArchivedSessionId(null);
    setActiveSessionId(nextSessionId);
    if (options?.markBootstrapped) {
      bootstrappedScopeKeyRef.current = scopeKey;
    }
    resetConversationThread({
      sessionId: nextSessionId,
    });
    resetPlannerThread({
      sessionId: nextSessionId,
    });
    return nextSessionId;
  }, [resetConversationThread, resetPlannerThread, scopeKey]);

  useEffect(() => {
    if (!enabled) return;
    if (scopeKeyRef.current === scopeKey) return;

    scopeKeyRef.current = scopeKey;
    bootstrappedScopeKeyRef.current = null;
    openFreshThread();
  }, [enabled, openFreshThread, scopeKey]);

  useEffect(() => {
    if (!enabled) return;
    if (!userId || !companionId) {
      bootstrappedScopeKeyRef.current = scopeKey;
      return;
    }
    if (!threadsQuery.isSuccess) return;
    if (bootstrappedScopeKeyRef.current === scopeKey) return;

    const activePersistedThread = getActivePersistedThread(threadsQuery.data.threads);

    if (!activePersistedThread) {
      if (!hasRealThreadMessages) {
        openFreshThread({
          sessionId: activeSessionId || undefined,
          markBootstrapped: true,
        });
      } else {
        bootstrappedScopeKeyRef.current = scopeKey;
      }
      return;
    }

    let cancelled = false;
    const hydrationVersion = threadMutationVersionRef.current;
    setIsHydratingThread(true);

    void loadCompanionChatThreadMessages(activePersistedThread.sessionId, "journeys")
      .then((threadMessages) => {
        if (cancelled || threadMutationVersionRef.current !== hydrationVersion) return;
        const visibleThreadMessages = stripLegacyJourneysPlannerOpeners(threadMessages);

        localThreadCreatedAtRef.current =
          visibleThreadMessages[0]?.createdAt
          ?? threadMessages[0]?.createdAt
          ?? activePersistedThread.createdAt;
        setLocallyArchivedSessionId(null);
        setActiveSessionId(activePersistedThread.sessionId);
        hydrateConversationThread({
          sessionId: activePersistedThread.sessionId,
          messages: mapChatMessages(visibleThreadMessages),
        });
        hydratePlannerThread({
          sessionId: activePersistedThread.sessionId,
          messages: mapPlannerMessages(visibleThreadMessages),
        });
        bootstrappedScopeKeyRef.current = scopeKey;
      })
      .catch((error) => {
        console.error("Failed to load journeys companion thread:", error);
        if (!cancelled && threadMutationVersionRef.current === hydrationVersion) {
          toast.error(
            isCompanionChatSetupError(error)
              ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
              : "I couldn't reopen the latest thread, so I started a fresh one.",
          );
          openFreshThread();
          bootstrappedScopeKeyRef.current = scopeKey;
        }
      })
      .finally(() => {
        if (!cancelled && threadMutationVersionRef.current === hydrationVersion) {
          setIsHydratingThread(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSessionId,
    companionId,
    enabled,
    hasRealThreadMessages,
    hydrateConversationThread,
    hydratePlannerThread,
    openFreshThread,
    scopeKey,
    threadsQuery.data,
    threadsQuery.isSuccess,
    userId,
  ]);

  useEffect(() => {
    if (enabled) return;

    setActiveSessionId("");
    setIsHydratingThread(false);
    setLocallyArchivedSessionId(null);
    bootstrappedScopeKeyRef.current = null;
  }, [enabled]);

  const persistedActiveThread = useMemo(
    () =>
      threadsQuery.data?.threads.find(
        (thread) =>
          thread.sessionId === activeSessionId
          && thread.archivedAt === null
          && thread.sessionId !== locallyArchivedSessionId,
      ) ?? null,
    [activeSessionId, locallyArchivedSessionId, threadsQuery.data],
  );

  const localActiveThread = useMemo<CompanionChatThreadSummary>(() => {
    const firstUserMessage = messages.find((message) => message.role === "user");
    const latestMessage = messages[messages.length - 1];

    return {
      sessionId: activeSessionId,
      companionId: companionId ?? "",
      surface: "journeys",
      title: buildCompanionThreadTitle(firstUserMessage?.content ?? "New thread"),
      previewText: buildCompanionThreadPreview(latestMessage?.content ?? ""),
      createdAt: messages[0]?.createdAt ?? localThreadCreatedAtRef.current,
      lastMessageAt: latestMessage?.createdAt ?? localThreadCreatedAtRef.current,
      archivedAt: null,
      messageCount: messages.length,
    };
  }, [activeSessionId, companionId, messages]);

  const activeThread = persistedActiveThread ?? localActiveThread;
  const historyThreads = useMemo(
    () =>
      (threadsQuery.data?.threads ?? []).filter(
        (thread) =>
          thread.sessionId !== persistedActiveThread?.sessionId
          && thread.messageCount >= 2,
      ),
    [persistedActiveThread?.sessionId, threadsQuery.data],
  );

  const threadPickerDisabledReason = useMemo(() => {
    if (!persistenceReady) {
      return persistenceUnavailableReason ?? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON;
    }
    if (threadsQuery.data?.setupUnavailable) {
      return COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON;
    }
    if (isHydratingThread) {
      return "Loading thread history.";
    }
    if (hasPendingPlannerWork) {
      return "Finish or dismiss the current plan before switching chats.";
    }
    return null;
  }, [
    hasPendingPlannerWork,
    isHydratingThread,
    persistenceReady,
    persistenceUnavailableReason,
    threadsQuery.data?.setupUnavailable,
  ]);
  const isLoadingThreads = threadsQuery.isLoading || isHydratingThread;

  const archiveDisabledReason = useMemo(() => {
    if (threadPickerDisabledReason) {
      return threadPickerDisabledReason;
    }
    if (!persistedActiveThread) {
      return "Start the conversation before archiving this thread.";
    }
    if (isBusy) {
      return "Wait for the current reply to finish.";
    }
    if (hasPendingPlannerWork) {
      return "Finish or dismiss the current plan before archiving this thread.";
    }
    return null;
  }, [hasPendingPlannerWork, isBusy, persistedActiveThread, threadPickerDisabledReason]);

  const newChatDisabledReason = useMemo(() => {
    if (isLoadingThreads) {
      return "Loading thread history.";
    }
    if (isBusy) {
      return "Wait for the current reply to finish.";
    }
    if (hasPendingPlannerWork) {
      return "Finish or dismiss the current plan before starting a new chat.";
    }
    return null;
  }, [hasPendingPlannerWork, isBusy, isLoadingThreads]);

  const archiveCurrentThread = useCallback(async () => {
    if (archiveDisabledReason || !persistedActiveThread) return;

    try {
      setLocallyArchivedSessionId(persistedActiveThread.sessionId);
      await setCompanionChatThreadArchived(persistedActiveThread.sessionId, true);
      await queryClient.invalidateQueries({ queryKey: threadsQueryKey });
    } catch (error) {
      setLocallyArchivedSessionId(null);
      console.error("Failed to archive journeys companion thread:", error);
      toast.error(
        isCompanionChatSetupError(error)
          ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
          : "I couldn't archive that thread yet.",
      );
    }
  }, [archiveDisabledReason, persistedActiveThread, queryClient, threadsQueryKey]);

  const startNewChat = useCallback(async () => {
    if (newChatDisabledReason) return;

    try {
      if (persistedActiveThread) {
        setLocallyArchivedSessionId(persistedActiveThread.sessionId);
        await setCompanionChatThreadArchived(persistedActiveThread.sessionId, true);
      }

      openFreshThread();
      await queryClient.invalidateQueries({ queryKey: threadsQueryKey });
    } catch (error) {
      setLocallyArchivedSessionId(null);
      console.error("Failed to start a fresh journeys companion thread:", error);
      toast.error(
        isCompanionChatSetupError(error)
          ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
          : "I couldn't start a new chat yet.",
      );
    }
  }, [
    newChatDisabledReason,
    openFreshThread,
    persistedActiveThread,
    queryClient,
    threadsQueryKey,
  ]);

  const startTemplateThread = useCallback(() => {
    const nextSessionId = openFreshThread({ markBootstrapped: true });

    void (async () => {
      try {
        const threadToArchive =
          persistedActiveThread
          ?? getActivePersistedThread(threadsQuery.data?.threads)
          ?? (
            companionId
              ? getActivePersistedThread(
                await listCompanionChatThreads(companionId, "journeys"),
              )
              : null
          );

        if (!threadToArchive) return;

        setLocallyArchivedSessionId(threadToArchive.sessionId);
        await setCompanionChatThreadArchived(threadToArchive.sessionId, true);
        await queryClient.invalidateQueries({ queryKey: threadsQueryKey });
      } catch (error) {
        setLocallyArchivedSessionId(null);
        console.warn("Failed to archive the previous journeys template thread:", error);
      }
    })();

    return nextSessionId;
  }, [
    companionId,
    openFreshThread,
    persistedActiveThread,
    queryClient,
    threadsQuery.data?.threads,
    threadsQueryKey,
  ]);

  const resumeThread = useCallback(async (sessionId: string) => {
    if (threadPickerDisabledReason) return;
    if (sessionId === activeSessionId) return;

    const hydrationVersion = threadMutationVersionRef.current + 1;
    threadMutationVersionRef.current = hydrationVersion;
    setIsHydratingThread(true);
    try {
      if (persistedActiveThread) {
        await setCompanionChatThreadArchived(persistedActiveThread.sessionId, true);
      }

      await setCompanionChatThreadArchived(sessionId, false);
      const threadMessages = await loadCompanionChatThreadMessages(sessionId, "journeys");
      const visibleThreadMessages = stripLegacyJourneysPlannerOpeners(threadMessages);
      if (threadMutationVersionRef.current !== hydrationVersion) return;

      localThreadCreatedAtRef.current =
        visibleThreadMessages[0]?.createdAt
        ?? threadMessages[0]?.createdAt
        ?? new Date().toISOString();
      setLocallyArchivedSessionId(null);
      setActiveSessionId(sessionId);
      hydrateConversationThread({
        sessionId,
        messages: mapChatMessages(visibleThreadMessages),
      });
      hydratePlannerThread({
        sessionId,
        messages: mapPlannerMessages(visibleThreadMessages),
      });

      await queryClient.invalidateQueries({ queryKey: threadsQueryKey });
    } catch (error) {
      if (threadMutationVersionRef.current !== hydrationVersion) return;
      console.error("Failed to resume journeys companion thread:", error);
      toast.error(
        isCompanionChatSetupError(error)
          ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
          : "I couldn't reopen that thread yet.",
      );
    } finally {
      if (threadMutationVersionRef.current === hydrationVersion) {
        setIsHydratingThread(false);
      }
    }
  }, [
    activeSessionId,
    hydrateConversationThread,
    hydratePlannerThread,
    persistedActiveThread,
    queryClient,
    threadPickerDisabledReason,
    threadsQueryKey,
  ]);

  if (!enabled) {
    return {
      activeSessionId: "",
      activeThread: null,
      historyThreads: [],
      hasPersistedActiveThread: false,
      canStartNewChat: false,
      newChatDisabledReason: null,
      canArchiveThread: false,
      archiveDisabledReason: null,
      canOpenThreadPicker: false,
      threadPickerDisabledReason: null,
      threadHistoryEmptyStateMessage:
        "Past chats will show up here after at least one real exchange.",
      startNewChat: async () => undefined,
      startTemplateThread: () => undefined,
      archiveCurrentThread: async () => undefined,
      resumeThread: async () => undefined,
      isLoadingThreads: false,
    };
  }

  return {
    activeSessionId,
    activeThread,
    historyThreads,
    hasPersistedActiveThread: persistedActiveThread !== null,
    canStartNewChat: newChatDisabledReason === null,
    newChatDisabledReason,
    canArchiveThread: archiveDisabledReason === null,
    archiveDisabledReason,
    canOpenThreadPicker: threadPickerDisabledReason === null,
    threadPickerDisabledReason,
    threadHistoryEmptyStateMessage:
      threadPickerDisabledReason
        ? COMPANION_CHAT_THREAD_HISTORY_EMPTY_STATE
        : "Past chats will show up here after at least one real exchange.",
    startNewChat,
    startTemplateThread,
    archiveCurrentThread,
    resumeThread,
    isLoadingThreads,
  };
}
