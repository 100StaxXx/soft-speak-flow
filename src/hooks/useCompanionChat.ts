import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionDialogue } from "@/hooks/useCompanionDialogue";
import { useCompanionVoiceSettings } from "@/hooks/useCompanionVoiceSettings";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import {
  type CompanionSpeechProvider,
  speakCompanionReply,
  stopCompanionSpeech,
} from "@/services/companionSpeech";
import type { Tables } from "@/integrations/supabase/types";
import type {
  CompanionChatInputMode,
  CompanionChatMessage,
  CompanionChatRequest,
  CompanionChatResponse,
} from "@/types/companionConversation";
import { isCompanionChatSetupError } from "@/utils/companionChatSetup";
import { resolveCompanionChatError } from "@/utils/companionChatErrors";
import { parseFunctionInvokeError } from "@/utils/supabaseFunctionErrors";
import { safeLocalStorage } from "@/utils/storage";

const SPOKEN_REPLY_COUNT_KEY = "companion-chat-spoken-replies-v1";
const MAX_HISTORY_MESSAGES = 8;
const DEFAULT_SPOKEN_REPLY_LIMIT = Number(import.meta.env.VITE_COMPANION_SPOKEN_REPLY_LIMIT ?? 60);

type CompanionChatRow = Tables<"companion_chats">;

const generateId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createMessage = (
  role: CompanionChatMessage["role"],
  content: string,
  extras: Partial<CompanionChatMessage> = {},
): CompanionChatMessage => ({
  id: generateId(),
  role,
  content,
  createdAt: new Date().toISOString(),
  ...extras,
});

const mapChatHistory = (rows: CompanionChatRow[]): CompanionChatMessage[] =>
  rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    inputMode: (row.input_mode as CompanionChatInputMode | null) ?? undefined,
  }));

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const readSpokenReplyCount = () => {
  const raw = safeLocalStorage.getItem(SPOKEN_REPLY_COUNT_KEY);
  if (!raw) {
    return { date: getTodayKey(), count: 0 };
  }

  try {
    const parsed = JSON.parse(raw) as { date?: string; count?: number };
    if (parsed.date !== getTodayKey()) {
      return { date: getTodayKey(), count: 0 };
    }
    return {
      date: parsed.date ?? getTodayKey(),
      count: Number.isFinite(parsed.count) ? parsed.count : 0,
    };
  } catch {
    return { date: getTodayKey(), count: 0 };
  }
};

const incrementSpokenReplyCount = () => {
  const current = readSpokenReplyCount();
  safeLocalStorage.setItem(SPOKEN_REPLY_COUNT_KEY, JSON.stringify({
    date: getTodayKey(),
    count: current.count + 1,
  }));
};

interface UseCompanionChatOptions {
  enabled?: boolean;
}

export function useCompanionChat({ enabled = true }: UseCompanionChatOptions = {}) {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { greeting, voiceStyle } = useCompanionDialogue();
  const { trackInteraction } = useAIInteractionTracker();
  const queryClient = useQueryClient();
  const initialisedRef = useRef(false);
  const hydratedExternallyRef = useRef(false);
  const sessionIdRef = useRef<string>(generateId());
  const {
    autoplayVoice,
    setAutoplayVoice,
    muteSpokenReplies,
    setMuteSpokenReplies,
  } = useCompanionVoiceSettings();

  const [messages, setMessages] = useState<CompanionChatMessage[]>([]);
  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechProvider, setSpeechProvider] = useState<CompanionSpeechProvider>("none");
  const [handoffToPlanner, setHandoffToPlanner] = useState(false);

  const historyQuery = useQuery({
    queryKey: ["companion-chat-history", user?.id, companion?.id],
    enabled: enabled && !!user?.id && !!companion?.id,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<CompanionChatRow[]> => {
      if (!user?.id || !companion?.id) return [];

      try {
        const { data, error } = await supabase
          .from("companion_chats")
          .select("id, role, content, input_mode, created_at")
          .eq("user_id", user.id)
          .eq("companion_id", companion.id)
          .eq("surface", "companion")
          .eq("source", "chat")
          .order("created_at", { ascending: true })
          .limit(40);

        if (error) {
          throw error;
        }

        return (data ?? []) as CompanionChatRow[];
      } catch (error) {
        if (isCompanionChatSetupError(error)) {
          return [];
        }

        throw error;
      }
    },
  });

  useEffect(() => {
    initialisedRef.current = false;
    hydratedExternallyRef.current = false;
    setMessages([]);
    sessionIdRef.current = generateId();
  }, [companion?.id]);

  useEffect(() => {
    if (!enabled) {
      initialisedRef.current = false;
      if (!hydratedExternallyRef.current) {
        setMessages([]);
      }
      return;
    }

    if (initialisedRef.current) return;
    if (!historyQuery.isSuccess) return;

    const historyMessages = mapChatHistory(historyQuery.data ?? []);
    if (historyMessages.length > 0) {
      setMessages(historyMessages);
      initialisedRef.current = true;
      return;
    }

    if (greeting) {
      setMessages([createMessage("assistant", greeting)]);
      initialisedRef.current = true;
    }
  }, [enabled, greeting, historyQuery.data, historyQuery.isSuccess]);

  useEffect(() => {
    if (!muteSpokenReplies && autoplayVoice) return;
    stopCompanionSpeech();
    setIsSpeaking(false);
    setSpeechProvider("none");
  }, [autoplayVoice, muteSpokenReplies]);

  useEffect(() => () => {
    stopCompanionSpeech();
  }, []);

  const resetThread = useCallback((options?: {
    sessionId?: string;
    greetingText?: string;
  }) => {
    initialisedRef.current = true;
    hydratedExternallyRef.current = true;
    sessionIdRef.current = options?.sessionId ?? generateId();
    setMessages(
      options?.greetingText
        ? [createMessage("assistant", options.greetingText)]
        : [],
    );
    setDraftInput("");
    setInterimText("");
    setShowPermissionDialog(false);
    setIsRequestingPermission(false);
    setIsSubmitting(false);
    setIsSpeaking(false);
    setSpeechProvider("none");
    setHandoffToPlanner(false);
  }, []);

  const hydrateThread = useCallback((options: {
    sessionId: string;
    messages: CompanionChatMessage[];
  }) => {
    initialisedRef.current = true;
    hydratedExternallyRef.current = true;
    sessionIdRef.current = options.sessionId;
    setMessages(options.messages);
    setDraftInput("");
    setInterimText("");
    setShowPermissionDialog(false);
    setIsRequestingPermission(false);
    setIsSubmitting(false);
    setIsSpeaking(false);
    setSpeechProvider("none");
    setHandoffToPlanner(false);
  }, []);

  const speakReplyIfNeeded = useCallback(async (response: CompanionChatResponse) => {
    if (!enabled || !response.speechText.trim()) return;
    if (!autoplayVoice || muteSpokenReplies) return;

    const spokenReplyCount = readSpokenReplyCount();
    if (spokenReplyCount.count >= DEFAULT_SPOKEN_REPLY_LIMIT) {
      return;
    }

    if (!companion?.id) return;

    setIsSpeaking(true);
    try {
      const provider = await speakCompanionReply({
        text: response.speechText,
        companionId: companion.id,
        voiceStyle,
        sessionId: response.sessionId ?? sessionIdRef.current,
      });
      setSpeechProvider(provider);
      incrementSpokenReplyCount();
    } catch (error) {
      console.error("Failed to speak companion reply:", error);
      setSpeechProvider("none");
    } finally {
      setIsSpeaking(false);
    }
  }, [autoplayVoice, companion?.id, enabled, muteSpokenReplies, voiceStyle]);

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode,
  ) => {
    if (!enabled || !companion?.id) {
      toast.error("Your companion is still loading. Try again in a moment.");
      return;
    }

    const message = rawMessage.trim();
    if (!message || isSubmitting) return;

    setHandoffToPlanner(false);
    setIsSubmitting(true);
    setDraftInput("");
    setInterimText("");

    const optimisticUserMessage = createMessage("user", message, { inputMode });
    const priorMessages = messages.slice(-MAX_HISTORY_MESSAGES);
    setMessages((previous) => [...previous, optimisticUserMessage]);

    try {
      const { data, error } = await supabase.functions.invoke("companion-chat", {
        body: {
          message,
          conversationHistory: priorMessages.map((entry) => ({
            role: entry.role,
            content: entry.content,
          })),
          companionId: companion.id,
          inputMode,
          sessionId: sessionIdRef.current,
        } satisfies CompanionChatRequest,
      });

      if (error) {
        throw error;
      }

      const response = data as CompanionChatResponse;
      if (response.sessionId) {
        sessionIdRef.current = response.sessionId;
      }

      setMessages((previous) => [
        ...previous,
        createMessage("assistant", response.reply, {
          handoffToPlanner: response.handoffToPlanner,
        }),
      ]);

      if (response.handoffToPlanner) {
        setHandoffToPlanner(true);
      }

      void trackInteraction({
        interactionType: "companion_chat",
        inputText: message,
        detectedIntent: response.handoffToPlanner ? "planning_handoff" : "conversation",
        aiResponse: {
          reply: response.reply,
          speechText: response.speechText,
          memoryUpdateApplied: response.memoryUpdateApplied,
          handoffToPlanner: response.handoffToPlanner,
        },
        userAction: "accepted",
      });

      queryClient.invalidateQueries({
        queryKey: ["companion-chat-history", user?.id, companion.id],
      });

      void speakReplyIfNeeded(response);
    } catch (error) {
      const parsedError = await parseFunctionInvokeError(error);
      console.error("Failed to submit companion chat message:", {
        status: parsedError.status ?? null,
        code: parsedError.code ?? parsedError.responsePayload?.code ?? null,
        requestId: parsedError.requestId ?? null,
        stage: parsedError.stage ?? parsedError.responsePayload?.stage ?? null,
        failureReason:
          parsedError.failureReason ??
          parsedError.responsePayload?.failureReason ??
          null,
        category: parsedError.category ?? "unknown",
        sessionId: sessionIdRef.current,
      });
      toast.error(await resolveCompanionChatError(error));
      setMessages((previous) => [
        ...previous,
        createMessage(
          "assistant",
          "I drifted for a second there. Ask again and I’ll pick the conversation back up with you.",
        ),
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }, [companion?.id, enabled, isSubmitting, messages, queryClient, speakReplyIfNeeded, trackInteraction, user?.id]);

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

  const clearPlannerHandoff = useCallback(() => {
    setHandoffToPlanner(false);
  }, []);

  const stopSpeaking = useCallback(() => {
    stopCompanionSpeech();
    setIsSpeaking(false);
    setSpeechProvider("none");
  }, []);

  return {
    greeting,
    sessionId: sessionIdRef.current,
    messages,
    draftInput,
    setDraftInput,
    interimText,
    isSubmitting,
    isLoadingHistory: historyQuery.isLoading,
    autoplayVoice,
    setAutoplayVoice,
    muteSpokenReplies,
    setMuteSpokenReplies,
    isSpeaking,
    speechProvider,
    handoffToPlanner,
    clearPlannerHandoff,
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
    stopSpeaking,
  };
}
