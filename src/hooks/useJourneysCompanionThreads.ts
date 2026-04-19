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

type JourneysAssistantMessage = {
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  source: "chat" | "plan";
  isSeed?: boolean;
};

interface UseJourneysCompanionThreadsOptions {
  enabled: boolean;
  userId: string | null | undefined;
  companionId: string | null | undefined;
  greeting: string;
  messages: JourneysAssistantMessage[];
  hasPendingPlannerWork: boolean;
  isBusy: boolean;
  conversation: {
    resetThread: (options?: { sessionId?: string; greetingText?: string }) => void;
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

const isRealThreadMessage = (message: JourneysAssistantMessage) => !message.isSeed;

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
  greeting,
  messages,
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
  const localThreadCreatedAtRef = useRef(new Date().toISOString());
  const scopeKeyRef = useRef<string | null>(null);
  const bootstrappedScopeKeyRef = useRef<string | null>(null);

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
    queryFn: async (): Promise<CompanionChatThreadSummary[]> => {
      if (!companionId) return [];
      return listCompanionChatThreads(companionId, "journeys");
    },
  });

  const startFreshThread = useCallback((sessionId?: string) => {
    const nextSessionId = sessionId ?? generateCompanionThreadSessionId();
    localThreadCreatedAtRef.current = new Date().toISOString();
    setActiveSessionId(nextSessionId);
    resetConversationThread({
      sessionId: nextSessionId,
      greetingText: greeting,
    });
    resetPlannerThread({
      sessionId: nextSessionId,
    });
    return nextSessionId;
  }, [greeting, resetConversationThread, resetPlannerThread]);

  useEffect(() => {
    if (!enabled) return;
    if (scopeKeyRef.current === scopeKey) return;

    scopeKeyRef.current = scopeKey;
    bootstrappedScopeKeyRef.current = null;
    startFreshThread();
  }, [enabled, scopeKey, startFreshThread]);

  useEffect(() => {
    if (!enabled) return;
    if (!userId || !companionId) {
      bootstrappedScopeKeyRef.current = scopeKey;
      return;
    }
    if (!threadsQuery.isSuccess) return;
    if (bootstrappedScopeKeyRef.current === scopeKey) return;

    const activePersistedThread = threadsQuery.data.find((thread) => thread.archivedAt === null) ?? null;
    if (!activePersistedThread) {
      bootstrappedScopeKeyRef.current = scopeKey;
      return;
    }

    let cancelled = false;
    setIsHydratingThread(true);

    void loadCompanionChatThreadMessages(activePersistedThread.sessionId, "journeys")
      .then((threadMessages) => {
        if (cancelled) return;

        localThreadCreatedAtRef.current =
          threadMessages[0]?.createdAt
          ?? activePersistedThread.createdAt;
        setActiveSessionId(activePersistedThread.sessionId);
        hydrateConversationThread({
          sessionId: activePersistedThread.sessionId,
          messages: mapChatMessages(threadMessages),
        });
        hydratePlannerThread({
          sessionId: activePersistedThread.sessionId,
          messages: mapPlannerMessages(threadMessages),
        });
        bootstrappedScopeKeyRef.current = scopeKey;
      })
      .catch((error) => {
        console.error("Failed to load journeys companion thread:", error);
        if (!cancelled) {
          toast.error("I couldn't reopen the latest thread, so I started a fresh one.");
          startFreshThread();
          bootstrappedScopeKeyRef.current = scopeKey;
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsHydratingThread(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    companionId,
    enabled,
    hydrateConversationThread,
    hydratePlannerThread,
    scopeKey,
    startFreshThread,
    threadsQuery.data,
    threadsQuery.isSuccess,
    userId,
  ]);

  const persistedActiveThread = useMemo(
    () =>
      threadsQuery.data?.find(
        (thread) => thread.sessionId === activeSessionId && thread.archivedAt === null,
      ) ?? null,
    [activeSessionId, threadsQuery.data],
  );

  const localActiveThread = useMemo<CompanionChatThreadSummary>(() => {
    const realMessages = messages.filter(isRealThreadMessage);
    const firstUserMessage = realMessages.find((message) => message.role === "user");
    const latestMessage = realMessages[realMessages.length - 1];

    return {
      sessionId: activeSessionId,
      companionId: companionId ?? "",
      surface: "journeys",
      title: buildCompanionThreadTitle(firstUserMessage?.content ?? "New thread"),
      previewText: buildCompanionThreadPreview(latestMessage?.content ?? greeting),
      createdAt: realMessages[0]?.createdAt ?? localThreadCreatedAtRef.current,
      lastMessageAt: latestMessage?.createdAt ?? localThreadCreatedAtRef.current,
      archivedAt: null,
    };
  }, [activeSessionId, companionId, greeting, messages]);

  const activeThread = persistedActiveThread ?? localActiveThread;
  const archivedThreads = useMemo(
    () => (threadsQuery.data ?? []).filter((thread) => thread.archivedAt !== null),
    [threadsQuery.data],
  );

  const hasRealMessages = useMemo(
    () => messages.some(isRealThreadMessage),
    [messages],
  );

  const archiveDisabledReason = useMemo(() => {
    if (isHydratingThread) {
      return "Loading thread history.";
    }
    if (isBusy) {
      return "Wait for the current reply to finish.";
    }
    if (hasPendingPlannerWork) {
      return "Finish or dismiss the current plan before archiving this thread.";
    }
    if (!hasRealMessages) {
      return "Start the conversation before archiving this thread.";
    }
    return null;
  }, [hasPendingPlannerWork, hasRealMessages, isBusy, isHydratingThread]);

  const archiveCurrentThread = useCallback(async () => {
    if (archiveDisabledReason) return;

    try {
      if (persistedActiveThread) {
        await setCompanionChatThreadArchived(persistedActiveThread.sessionId, true);
      }

      startFreshThread();
      await queryClient.invalidateQueries({ queryKey: threadsQueryKey });
    } catch (error) {
      console.error("Failed to archive journeys companion thread:", error);
      toast.error("I couldn't archive that thread yet.");
    }
  }, [archiveDisabledReason, persistedActiveThread, queryClient, startFreshThread, threadsQueryKey]);

  const resumeThread = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) return;

    setIsHydratingThread(true);
    try {
      if (hasRealMessages && persistedActiveThread) {
        await setCompanionChatThreadArchived(persistedActiveThread.sessionId, true);
      }

      await setCompanionChatThreadArchived(sessionId, false);
      const threadMessages = await loadCompanionChatThreadMessages(sessionId, "journeys");

      localThreadCreatedAtRef.current =
        threadMessages[0]?.createdAt
        ?? new Date().toISOString();
      setActiveSessionId(sessionId);
      hydrateConversationThread({
        sessionId,
        messages: mapChatMessages(threadMessages),
      });
      hydratePlannerThread({
        sessionId,
        messages: mapPlannerMessages(threadMessages),
      });

      await queryClient.invalidateQueries({ queryKey: threadsQueryKey });
    } catch (error) {
      console.error("Failed to resume journeys companion thread:", error);
      toast.error("I couldn't reopen that thread yet.");
    } finally {
      setIsHydratingThread(false);
    }
  }, [
    activeSessionId,
    hasRealMessages,
    hydrateConversationThread,
    hydratePlannerThread,
    persistedActiveThread,
    queryClient,
    threadsQueryKey,
  ]);

  return {
    activeSessionId,
    activeThread,
    archivedThreads,
    canArchiveThread: archiveDisabledReason === null,
    archiveDisabledReason,
    archiveCurrentThread,
    resumeThread,
    isLoadingThreads: threadsQuery.isLoading || isHydratingThread,
  };
}
