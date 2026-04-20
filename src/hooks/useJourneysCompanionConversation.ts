import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { supabase } from "@/integrations/supabase/client";
import { stripMarkdown } from "@/lib/utils";
import { getCompanionChatThreadsQueryKey } from "@/services/companionChatThreads";
import {
  COMPANION_PLANNER_OPENER_TEMPLATES,
  getCompanionPlannerOpener,
} from "@/shared/companionPlannerCopy";
import type {
  CompanionChatJourneysContext,
  CompanionChatInputMode,
  CompanionChatRequest,
  CompanionChatResponse,
} from "@/types/companionConversation";
import { COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON } from "@/utils/companionChatSetup";
import { resolveCompanionChatError } from "@/utils/companionChatErrors";

const MAX_HISTORY_MESSAGES = 8;

export const JOURNEYS_COMPANION_OPENERS = COMPANION_PLANNER_OPENER_TEMPLATES;

type JourneysCompanionMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  speechText?: string;
  isSeed?: boolean;
  inputMode?: CompanionChatInputMode;
};

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createMessage = (
  role: JourneysCompanionMessage["role"],
  content: string,
  extras: Partial<JourneysCompanionMessage> = {},
): JourneysCompanionMessage => ({
  id: generateId(),
  role,
  content,
  createdAt: new Date().toISOString(),
  ...extras,
});

const createSeedAssistantMessage = (content: string) =>
  createMessage("assistant", content, { isSeed: true });

export function useJourneysCompanionConversation() {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { trackInteraction } = useAIInteractionTracker();
  const queryClient = useQueryClient();
  const sessionIdRef = useRef<string>(generateId());
  const greeting = useMemo(
    () => getCompanionPlannerOpener({ userId: user?.id ?? null }),
    [user?.id],
  );

  const [messages, setMessages] = useState<JourneysCompanionMessage[]>([]);
  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPlannerHandoffMessage, setPendingPlannerHandoffMessage] = useState<string | null>(null);
  const [threadPersistenceReady, setThreadPersistenceReady] = useState(true);
  const [threadPersistenceUnavailableReason, setThreadPersistenceUnavailableReason] = useState<string | null>(null);

  const conversationHistory = useMemo(
    () =>
      messages
        .filter((message) => !message.isSeed)
        .slice(-MAX_HISTORY_MESSAGES)
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    [messages],
  );

  const clearPlannerHandoff = useCallback(() => {
    setPendingPlannerHandoffMessage(null);
  }, []);

  const injectAssistantOpening = useCallback((content: string) => {
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    setMessages((previous) => {
      const hasRealMessages = previous.some((message) => !message.isSeed);

      if (!hasRealMessages) {
        return [createSeedAssistantMessage(trimmedContent)];
      }

      return [...previous, createMessage("assistant", trimmedContent)];
    });
    setPendingPlannerHandoffMessage(null);
    setDraftInput("");
    setInterimText("");
  }, []);

  const resetThread = useCallback((options?: {
    sessionId?: string;
    greetingText?: string;
  }) => {
    const greetingText = options?.greetingText?.trim();
    sessionIdRef.current = options?.sessionId ?? generateId();
    setMessages(greetingText ? [createSeedAssistantMessage(greetingText)] : []);
    setDraftInput("");
    setInterimText("");
    setShowPermissionDialog(false);
    setIsRequestingPermission(false);
    setIsSubmitting(false);
    setPendingPlannerHandoffMessage(null);
  }, []);

  const hydrateThread = useCallback((options: {
    sessionId: string;
    messages: JourneysCompanionMessage[];
  }) => {
    sessionIdRef.current = options.sessionId;
    setMessages(options.messages);
    setDraftInput("");
    setInterimText("");
    setShowPermissionDialog(false);
    setIsRequestingPermission(false);
    setIsSubmitting(false);
    setPendingPlannerHandoffMessage(null);
  }, []);

  useEffect(() => {
    resetThread();
  }, [companion?.id, resetThread]);

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode = "text",
    options?: {
      currentDate?: string;
      currentDateTime?: string;
      journeysContext?: CompanionChatJourneysContext | null;
    },
  ) => {
    const message = rawMessage.trim();
    if (!message || isSubmitting) return;

    if (!user?.id || !companion?.id) {
      toast.error("Your companion is still loading. Try again in a moment.");
      return;
    }

    setIsSubmitting(true);
    setDraftInput("");
    setInterimText("");
    setPendingPlannerHandoffMessage(null);

    const optimisticUserMessage = createMessage("user", message, { inputMode });
    setMessages((previous) => [...previous, optimisticUserMessage]);

    try {
      const { data, error } = await supabase.functions.invoke("companion-chat", {
        body: {
          message,
          conversationHistory,
          companionId: companion.id,
          inputMode,
          surface: "journeys",
          sessionId: sessionIdRef.current,
          currentDate: options?.currentDate,
          currentDateTime: options?.currentDateTime,
          journeysContext: options?.journeysContext ?? undefined,
        } satisfies CompanionChatRequest,
      });

      if (error) throw error;

      const response = data as CompanionChatResponse;
      if (response.sessionId) {
        sessionIdRef.current = response.sessionId;
      }

      const nextPersistenceReady = response.persistenceReady !== false;
      setThreadPersistenceReady(nextPersistenceReady);
      setThreadPersistenceUnavailableReason(
        nextPersistenceReady
          ? null
          : COMPANION_CHAT_THREAD_HISTORY_DISABLED_REASON,
      );

      if (response.handoffToPlanner) {
        setPendingPlannerHandoffMessage(message);
      } else {
        setMessages((previous) => [
          ...previous,
          createMessage("assistant", stripMarkdown(response.reply), {
            speechText: response.speechText.trim() || undefined,
          }),
        ]);
      }

      void trackInteraction({
        interactionType: "journeys_companion_chat",
        inputText: message,
        detectedIntent: response.handoffToPlanner ? "planning_handoff" : "conversation",
        aiResponse: {
          reply: response.reply,
          speechText: response.speechText,
          handoffToPlanner: response.handoffToPlanner,
          surface: "journeys",
        },
        userAction: "accepted",
      });

      void queryClient.invalidateQueries({
        queryKey: getCompanionChatThreadsQueryKey(user.id, companion.id, "journeys"),
      });
    } catch (error) {
      console.error("Failed to submit journeys companion message:", error);
      toast.error(await resolveCompanionChatError(error));
      setMessages((previous) => [
        ...previous,
        createMessage(
          "assistant",
          "Cosmic static. Say that again and I’ll pick it right back up.",
        ),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }, [companion?.id, conversationHistory, isSubmitting, queryClient, trackInteraction, user?.id]);

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

  return {
    greeting,
    sessionId: sessionIdRef.current,
    messages,
    hasRealMessages: messages.some((message) => !message.isSeed),
    draftInput,
    setDraftInput,
    interimText,
    isSubmitting,
    pendingPlannerHandoffMessage,
    threadPersistenceReady,
    threadPersistenceUnavailableReason,
    clearPlannerHandoff,
    injectAssistantOpening,
    resetThread,
    hydrateThread,
    isRecording,
    isAutoStopping,
    isVoiceSupported: isSupported,
    permissionStatus,
    showPermissionDialog,
    setShowPermissionDialog,
    isRequestingPermission,
    submitTypedMessage: () => submitMessage(draftInput, "text"),
    submitMessage,
    toggleRecording,
    requestMicrophonePermission,
  };
}
