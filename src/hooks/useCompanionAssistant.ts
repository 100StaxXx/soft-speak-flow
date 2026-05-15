import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionDialogue } from "@/hooks/useCompanionDialogue";
import { useCompanionVoiceSettings } from "@/hooks/useCompanionVoiceSettings";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { supabase } from "@/integrations/supabase/client";
import { stripMarkdown } from "@/lib/utils";
import {
  buildCompanionThreadPreview,
  buildCompanionThreadTitle,
  generateCompanionThreadSessionId,
  getCompanionChatThreadsQueryKey,
  listCompanionChatThreads,
  loadCompanionChatThreadMessages,
  setCompanionChatThreadArchived,
} from "@/services/companionChatThreads";
import { hasActiveSupabaseFunctionSession } from "@/services/supabaseFunctionSession";
import {
  type CompanionSpeechProvider,
  speakCompanionReply,
  stopCompanionSpeech,
} from "@/services/companionSpeech";
import { getCompanionPlannerOpener } from "@/shared/companionPlannerCopy";
import { getRandomCompanionChatOpeningLine } from "@/shared/companionChatOpeners";
import {
  resolveCompanionDisplayLabel,
} from "@/lib/companionDisplayLabel";
import type {
  CompanionChatRequest,
  CompanionChatInputMode,
  CompanionChatOpenerResponse,
  CompanionChatResponse,
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
  toUserFacingFunctionError,
} from "@/utils/supabaseFunctionErrors";
import { resolveCompanionChatError } from "@/utils/companionChatErrors";

export type CompanionAssistantSurface = "companion" | "journeys";

export interface CompanionAssistantMessage {
  [key: string]: any;
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode;
  source: CompanionChatSource;
  isSeed?: boolean;
}

interface UseCompanionAssistantOptions {
  [key: string]: unknown;
  surface: CompanionAssistantSurface;
  conversationEnabled?: boolean;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
}

interface CachedCompanionThreadUiState {
  messages: CompanionAssistantMessage[];
  lastStarterIntent: CompanionPlannerLaunchIntent["starterIntent"] | null;
}

type ThreadsQueryResult = {
  threads: CompanionChatThreadSummary[];
  setupUnavailable: boolean;
};

const MAX_DIRECT_CHAT_HISTORY_MESSAGES = 8;

type CompanionChatSubmitOptions = {
  [key: string]: unknown;
  starterIntent?: CompanionPlannerLaunchIntent["starterIntent"];
};

type CompanionTemplateThreadOptions = {
  greetingText?: string | null;
  visibleAssistantOpening?: boolean;
};

const buildDirectChatHistory = (
  messages: CompanionAssistantMessage[],
): CompanionChatRequest["conversationHistory"] =>
  messages
    .filter((message) => !message.isSeed)
    .slice(-MAX_DIRECT_CHAT_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

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

const createMissingFunctionSessionError = () =>
  Object.assign(new Error("Missing active Supabase session."), {
    status: 401,
  });

export function useCompanionAssistant({
  surface,
  conversationEnabled = true,
  launchIntent = null,
  onLaunchIntentConsumed,
  onOpenCampaignBuilder,
}: UseCompanionAssistantOptions) {
  const { user, refreshSession } = useAuth();
  const { companion } = useCompanion();
  const { greeting, voiceStyle } = useCompanionDialogue();
  const { trackInteraction } = useAIInteractionTracker();
  const { autoplayVoice, muteSpokenReplies } = useCompanionVoiceSettings();
  const queryClient = useQueryClient();

  const [activeSessionId, setActiveSessionId] = useState(() =>
    generateCompanionThreadSessionId(),
  );
  const activeSessionIdRef = useRef(activeSessionId);
  const applyActiveSessionId = useCallback((nextSessionId: string) => {
    activeSessionIdRef.current = nextSessionId;
    setActiveSessionId(nextSessionId);
  }, []);
  const [messages, setMessages] = useState<CompanionAssistantMessage[]>([]);
  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isOpeningThread, setIsOpeningThread] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechProvider, setSpeechProvider] =
    useState<CompanionSpeechProvider>("none");

  const localThreadCreatedAtRef = useRef(new Date().toISOString());
  const scopeKeyRef = useRef<string | null>(null);
  const bootstrappedScopeRef = useRef<string | null>(null);
  const companionOpenCycleKeyRef = useRef<string | null>(null);
  const threadMutationVersionRef = useRef(0);
  const handledLaunchIntentIdRef = useRef<string | null>(null);
  const threadUiStateCacheRef = useRef<
    Map<string, CachedCompanionThreadUiState>
  >(new Map());
  const lastStarterIntentRef = useRef<
    CompanionPlannerLaunchIntent["starterIntent"] | null
  >(null);
  const pendingStarterIntentRef = useRef<
    CompanionPlannerLaunchIntent["starterIntent"] | null
  >(null);

  const scopeKey = `${surface}:${user?.id ?? "anon"}:${
    companion?.id ?? "none"
  }`;
  const baseGreeting =
    surface === "journeys"
      ? getCompanionPlannerOpener({ userId: user?.id ?? null })
      : greeting;
  const companionLabel = useMemo(
    () => resolveCompanionDisplayLabel(companion, "Cosmiq"),
    [companion],
  );
  const todayLabel = getTodayLabel();
  const placeholder =
    surface === "journeys"
      ? `Talk to ${companionLabel}`
      : `Talk to ${companionLabel} naturally.`;

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

  const openFreshThread = useCallback(
    (options?: {
      sessionId?: string;
      greetingText?: string;
      markBootstrapped?: boolean;
      visibleAssistantOpening?: boolean;
    }) => {
      threadMutationVersionRef.current += 1;
      const nextSessionId =
        options?.sessionId ?? generateCompanionThreadSessionId();
      const greetingText = options?.greetingText?.trim();
      localThreadCreatedAtRef.current = new Date().toISOString();
      applyActiveSessionId(nextSessionId);
      setDraftInput("");
      setInterimText("");
      lastStarterIntentRef.current = null;
      pendingStarterIntentRef.current = null;
      setMessages(
        greetingText
          ? [
              createMessage("assistant", greetingText, {
                ...(options?.visibleAssistantOpening ? {} : { isSeed: true }),
                source: "agent",
              }),
            ]
          : [],
      );

      if (options?.markBootstrapped) {
        bootstrappedScopeRef.current = scopeKey;
      }

      return nextSessionId;
    },
    [applyActiveSessionId, scopeKey],
  );

  useEffect(() => {
    if (!activeSessionIdRef.current) return;

    threadUiStateCacheRef.current.set(activeSessionIdRef.current, {
      messages,
      lastStarterIntent: lastStarterIntentRef.current,
    });
  }, [messages]);

  const loadThreadState = useCallback(
    async (
      sessionId: string,
      options?: {
        expectedMutationVersion?: number;
      },
    ) => {
      const threadMessages = await loadCompanionChatThreadMessages(
        sessionId,
        surface,
      );

      if (
        options?.expectedMutationVersion !== undefined &&
        threadMutationVersionRef.current !== options.expectedMutationVersion
      ) {
        return false;
      }

      const cachedThreadUiState =
        threadUiStateCacheRef.current.get(sessionId) ?? null;
      const mappedThreadMessages =
        cachedThreadUiState?.messages ?? threadMessages.map(mapLoadedMessage);

      localThreadCreatedAtRef.current =
        threadMessages[0]?.createdAt ?? new Date().toISOString();
      applyActiveSessionId(sessionId);
      setMessages(mappedThreadMessages);
      setDraftInput("");
      setInterimText("");
      lastStarterIntentRef.current =
        cachedThreadUiState?.lastStarterIntent ?? null;
      pendingStarterIntentRef.current = null;
      return true;
    },
    [applyActiveSessionId, surface],
  );

  useEffect(() => {
    if (scopeKeyRef.current === scopeKey) return;

    scopeKeyRef.current = scopeKey;
    bootstrappedScopeRef.current = null;
    companionOpenCycleKeyRef.current = null;
    handledLaunchIntentIdRef.current = null;
    threadUiStateCacheRef.current.clear();
    if (surface === "companion") {
      openFreshThread();
      return;
    }
    openFreshThread({
      greetingText: baseGreeting,
    });
  }, [baseGreeting, openFreshThread, scopeKey, surface]);

  useEffect(() => {
    if (surface === "companion") return;
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

    const activePersistedThread = threadsQuery.data.threads.find(
      (thread) => thread.archivedAt === null,
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
        if (
          cancelled ||
          threadMutationVersionRef.current !== hydrationVersion
        ) {
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
    surface,
  ]);

  const persistedActiveThread = useMemo(
    () =>
      threadsQuery.data?.threads.find(
        (thread) =>
          thread.sessionId === activeSessionId && thread.archivedAt === null,
      ) ?? null,
    [activeSessionId, threadsQuery.data],
  );

  const hasRealMessages = useMemo(
    () => messages.some((message) => !message.isSeed),
    [messages],
  );

  const localActiveThread = useMemo<CompanionChatThreadSummary>(() => {
    const realMessages = messages.filter((message) => !message.isSeed);
    const firstUserMessage = realMessages.find(
      (message) => message.role === "user",
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
      lastMessageAt:
        latestMessage?.createdAt ?? localThreadCreatedAtRef.current,
      archivedAt: null,
      messageCount: realMessages.length,
    };
  }, [activeSessionId, companion?.id, messages, surface]);

  const activeThread = persistedActiveThread ?? localActiveThread;
  const historyThreads = useMemo(
    () =>
      (threadsQuery.data?.threads ?? []).filter(
        (thread) =>
          thread.sessionId !== persistedActiveThread?.sessionId &&
          thread.messageCount >= 2,
      ),
    [persistedActiveThread?.sessionId, threadsQuery.data],
  );
  const hasPersistedActiveThread = Boolean(persistedActiveThread);

  const speakAssistantReply = useCallback(
    async (text: string, sessionId: string) => {
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
    },
    [
      autoplayVoice,
      companion?.id,
      conversationEnabled,
      muteSpokenReplies,
      voiceStyle,
    ],
  );

  useEffect(
    () => () => {
      stopCompanionSpeech();
    },
    [],
  );

  const invalidateThreads = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: getCompanionChatThreadsQueryKey(
        user?.id,
        companion?.id,
        surface,
      ),
    });
  }, [companion?.id, queryClient, surface, user?.id]);

  const startGeneratedCompanionOpener = useCallback(async () => {
    if (surface !== "companion") return null;

    const fallbackOpening = getRandomCompanionChatOpeningLine();

    if (!user?.id || !companion?.id) {
      return openFreshThread({
        greetingText: fallbackOpening,
        markBootstrapped: true,
        visibleAssistantOpening: true,
      });
    }

    openFreshThread({
      markBootstrapped: true,
    });
    const openerMutationVersion = threadMutationVersionRef.current;
    setIsOpeningThread(true);

    try {
      const hasActiveSession = await hasActiveSupabaseFunctionSession(
        refreshSession,
      );

      if (!hasActiveSession) {
        if (threadMutationVersionRef.current !== openerMutationVersion) {
          return null;
        }

        setIsOpeningThread(false);
        return openFreshThread({
          greetingText: fallbackOpening,
          markBootstrapped: true,
          visibleAssistantOpening: true,
        });
      }

      const { data, error } = await supabase.functions.invoke(
        "companion-chat-opener",
        {
          body: {
            companionId: companion.id,
            surface: "companion",
            currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
          },
        },
      );

      if (error) throw error;
      if (threadMutationVersionRef.current !== openerMutationVersion) {
        return null;
      }

      const response = data as CompanionChatOpenerResponse;
      if (!response?.sessionId || !response?.reply) {
        throw new Error("Companion opener returned an empty response.");
      }

      const createdAt = response.createdAt || new Date().toISOString();
      localThreadCreatedAtRef.current = createdAt;
      applyActiveSessionId(response.sessionId);
      setDraftInput("");
      setInterimText("");
      lastStarterIntentRef.current = null;
      pendingStarterIntentRef.current = null;
      setMessages([
        createMessage("assistant", stripMarkdown(response.reply), {
          createdAt,
          source: "agent",
        }),
      ]);
      if (!response.persistenceReady) {
        console.warn(
          "Companion opener was not persisted; continuing with local opener.",
        );
      }
      void invalidateThreads();
      return response.sessionId;
    } catch (error) {
      if (threadMutationVersionRef.current !== openerMutationVersion) {
        return null;
      }
      console.error("Failed to start companion opener thread:", error);
      setIsOpeningThread(false);
      void invalidateThreads();
      return openFreshThread({
        greetingText: fallbackOpening,
        markBootstrapped: true,
        visibleAssistantOpening: true,
      });
    } finally {
      if (threadMutationVersionRef.current === openerMutationVersion) {
        setIsOpeningThread(false);
      }
    }
  }, [
    applyActiveSessionId,
    companion?.id,
    invalidateThreads,
    openFreshThread,
    refreshSession,
    surface,
    user?.id,
  ]);

  useEffect(() => {
    if (surface !== "companion") return;
    if (!conversationEnabled) {
      companionOpenCycleKeyRef.current = null;
      return;
    }

    const openCycleKey = `${scopeKey}:${Date.now()}`;
    if (companionOpenCycleKeyRef.current) return;
    companionOpenCycleKeyRef.current = openCycleKey;
    void startGeneratedCompanionOpener();
  }, [
    conversationEnabled,
    companion?.id,
    scopeKey,
    startGeneratedCompanionOpener,
    surface,
    user?.id,
  ]);

  const submitMessage = useCallback(
    async (
      rawMessage: string,
      inputMode: CompanionChatInputMode = "text",
      options?: CompanionChatSubmitOptions,
    ) => {
      const message = rawMessage.trim();
      if (
        !message ||
        isOpeningThread ||
        isSubmitting
      ) {
        return false;
      }
      const pendingStarterIntent = pendingStarterIntentRef.current;
      const starterIntent =
        options?.starterIntent ??
        pendingStarterIntent;
      const shouldConsumePendingStarterIntent = pendingStarterIntent !== null;

      if (!user?.id || !companion?.id) {
        toast.error("Your companion is still loading. Try again in a moment.");
        return false;
      }

      setIsSubmitting(true);

      try {
        const hasActiveSession = await hasActiveSupabaseFunctionSession(
          refreshSession,
        );

        if (!hasActiveSession) {
          toast.error(
            await resolveCompanionChatError(createMissingFunctionSessionError()),
          );
          return false;
        }

        setDraftInput("");
        setInterimText("");

        const directChatHistory = buildDirectChatHistory(messages);
        const optimisticUserMessage = createMessage("user", message, {
          inputMode,
          source: "chat",
        });
        setMessages((previous) => [...previous, optimisticUserMessage]);

        lastStarterIntentRef.current = starterIntent ?? null;
        const currentDateTime = formatCurrentDateTimeWithOffset(new Date());

        const { data, error } = await supabase.functions.invoke(
          "companion-chat",
          {
            body: {
              message,
              conversationHistory: directChatHistory,
              companionId: companion.id,
              inputMode,
              surface,
              sessionId: activeSessionIdRef.current,
              currentDateTime,
            } satisfies CompanionChatRequest,
          },
        );

        if (error) throw error;

        const response = data as CompanionChatResponse;
        const nextSessionId = response.sessionId ?? activeSessionIdRef.current;
        if (response.sessionId) {
          applyActiveSessionId(response.sessionId);
        }
        if (response.persistenceReady === false) {
          console.warn(
            "Companion chat reply was not persisted; continuing locally.",
          );
        }

        const reply = response.reply?.trim() || "I'm here with you.";
        setMessages((previous) => [
          ...previous,
          createMessage("assistant", stripMarkdown(reply), {
            source: "chat",
          }),
        ]);

        await trackInteraction({
          interactionType:
            surface === "journeys"
              ? "journeys_companion_chat"
              : "companion_chat",
          inputText: message,
          detectedIntent: response.handoffToPlanner
            ? "planning_handoff"
            : "conversation",
          aiResponse: {
            reply,
            speechText: response.speechText,
            memoryUpdateApplied: response.memoryUpdateApplied,
            handoffToPlanner: response.handoffToPlanner,
            surface,
          },
          userAction: "accepted",
        });

        if (
          shouldConsumePendingStarterIntent &&
          pendingStarterIntentRef.current === pendingStarterIntent
        ) {
          pendingStarterIntentRef.current = null;
        }
        void invalidateThreads();
        void speakAssistantReply(
          response.speechText?.trim() || reply,
          nextSessionId,
        );
        return true;
      } catch (error) {
        console.error("Failed to submit companion chat message:", error);
        toast.error(await resolveCompanionChatError(error));
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      applyActiveSessionId,
      companion?.id,
      invalidateThreads,
      isOpeningThread,
      isSubmitting,
      messages,
      refreshSession,
      speakAssistantReply,
      trackInteraction,
      surface,
      user?.id,
    ],
  );

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
    async (options?: CompanionTemplateThreadOptions) => {
      if (surface === "companion") {
        return startGeneratedCompanionOpener();
      }

      const threadToArchive =
        persistedActiveThread ??
        threadsQuery.data?.threads.find(
          (thread) => thread.archivedAt === null,
        ) ??
        null;

      if (threadToArchive) {
        await setCompanionChatThreadArchived(threadToArchive.sessionId, true);
        await invalidateThreads();
      }

      const greetingText =
        options?.greetingText === null
          ? undefined
          : (options?.greetingText ?? baseGreeting);

      return openFreshThread({
        greetingText,
        markBootstrapped: true,
        visibleAssistantOpening: options?.visibleAssistantOpening,
      });
    },
    [
      baseGreeting,
      invalidateThreads,
      openFreshThread,
      persistedActiveThread,
      startGeneratedCompanionOpener,
      surface,
      threadsQuery.data?.threads,
    ],
  );

  const startTemplateThread = useCallback(
    (options?: CompanionTemplateThreadOptions) => {
      const threadToArchive =
        persistedActiveThread ??
        threadsQuery.data?.threads.find(
          (thread) => thread.archivedAt === null,
        ) ??
        null;
      const greetingText =
        options?.greetingText === null ? undefined : options?.greetingText;
      const nextSessionId = openFreshThread({
        greetingText,
        markBootstrapped: true,
        visibleAssistantOpening: options?.visibleAssistantOpening,
      });

      void (async () => {
        try {
          const resolvedThreadToArchive =
            threadToArchive ??
            (companion?.id
              ? ((await listCompanionChatThreads(companion.id, surface)).find(
                  (thread) => thread.archivedAt === null,
                ) ?? null)
              : null);

          if (!resolvedThreadToArchive) return;
          if (resolvedThreadToArchive.sessionId === nextSessionId) return;

          await setCompanionChatThreadArchived(
            resolvedThreadToArchive.sessionId,
            true,
          );
          await invalidateThreads();
        } catch (error) {
          console.warn(
            "Failed to archive the previous companion template thread:",
            error,
          );
        }
      })();

      return nextSessionId;
    },
    [
      companion?.id,
      invalidateThreads,
      openFreshThread,
      persistedActiveThread,
      surface,
      threadsQuery.data?.threads,
    ],
  );

  const resumeThread = useCallback(
    async (sessionId: string) => {
      const hydrationVersion = threadMutationVersionRef.current + 1;
      threadMutationVersionRef.current = hydrationVersion;
      await loadThreadState(sessionId, {
        expectedMutationVersion: hydrationVersion,
      });
    },
    [loadThreadState],
  );

  useEffect(() => {
    if (!launchIntent?.id) return;
    if (handledLaunchIntentIdRef.current === launchIntent.id) return;
    pendingStarterIntentRef.current = null;
    if (launchIntent.starterIntent === "thread_history") return;
    if (!threadsQuery.isSuccess) {
      return;
    }

    handledLaunchIntentIdRef.current = launchIntent.id;

    if (launchIntent.target === "campaign_builder") {
      onOpenCampaignBuilder?.(launchIntent.message);
      onLaunchIntentConsumed?.(launchIntent.id);
      return;
    }

    const launchMessage = launchIntent.message;
    const intentId = launchIntent.id;
    const isCompanionAuthoredConversationStarter =
      launchIntent.target === "conversation" &&
      launchIntent.starterIntent === "free_talk_start";

    void (async () => {
      threadMutationVersionRef.current += 1;

      try {
        if (isCompanionAuthoredConversationStarter) {
          const greetingText = launchMessage.trim() || null;
          startTemplateThread({
            greetingText,
            visibleAssistantOpening: true,
          });
          return;
        }

        await startNewChat({ greetingText: null });
        await submitMessage(launchMessage);
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
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
    startNewChat,
    startTemplateThread,
    submitMessage,
    threadsQuery.isSuccess,
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

  const canSubmitMessage = !isOpeningThread && !isSubmitting;
  const canStartNewChat = !isOpeningThread && !isSubmitting;
  const canArchiveThread = canStartNewChat && hasPersistedActiveThread;
  const newChatDisabledReason = isOpeningThread
    ? "Starting a fresh chat."
    : null;
  const archiveDisabledReason = isOpeningThread
    ? "Starting a fresh chat."
    : hasPersistedActiveThread
      ? null
      : "This chat isn't saved yet.";
  const threadHistoryEmptyStateMessage = threadsQuery.data?.setupUnavailable
    ? COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON
    : COMPANION_CHAT_THREAD_HISTORY_EMPTY_STATE;

  const assistant = {
    todayLabel,
    placeholder,
    messages,
    draftInput,
    setDraftInput,
    interimText,
    isSubmitting,
    isOpeningThread,
    canSubmitMessage,
    submitMessage,
    submitTypedMessage: () => submitMessage(draftInput),
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
    isLoadingThreads: threadsQuery.isLoading || isOpeningThread,
    hasPersistedActiveThread,
    canOpenThreadPicker: !threadsQuery.data?.setupUnavailable,
    threadHistoryEmptyStateMessage,
    resumeThread,
    archiveCurrentThread,
    canArchiveThread,
    archiveDisabledReason,
    startNewChat,
    startTemplateThread,
    canStartNewChat,
    newChatDisabledReason,
  };

  return assistant as typeof assistant & Record<string, any>;
}
