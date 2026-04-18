import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionDialogue } from "@/hooks/useCompanionDialogue";
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
import { resolveCompanionChatError } from "@/utils/companionChatErrors";
import { safeLocalStorage } from "@/utils/storage";

const STORAGE_KEY = "companion-chat-voice-settings-v1";
const SPOKEN_REPLY_COUNT_KEY = "companion-chat-spoken-replies-v1";
const MAX_HISTORY_MESSAGES = 18;
const DEFAULT_SPOKEN_REPLY_LIMIT = Number(import.meta.env.VITE_COMPANION_SPOKEN_REPLY_LIMIT ?? 60);

type StoredVoiceSettings = {
  autoplayVoice?: boolean;
  muteSpokenReplies?: boolean;
};

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
    inputMode: row.input_mode ?? undefined,
  }));

const readStoredSettings = (): StoredVoiceSettings => {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as StoredVoiceSettings;
  } catch {
    return {};
  }
};

const writeStoredSettings = (settings: StoredVoiceSettings) => {
  safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

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
  const sessionIdRef = useRef<string>(generateId());

  const storedSettings = useMemo(readStoredSettings, []);
  const [messages, setMessages] = useState<CompanionChatMessage[]>([]);
  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoplayVoice, setAutoplayVoiceState] = useState(storedSettings.autoplayVoice ?? true);
  const [muteSpokenReplies, setMuteSpokenRepliesState] = useState(storedSettings.muteSpokenReplies ?? false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechProvider, setSpeechProvider] = useState<CompanionSpeechProvider>("none");
  const [handoffToPlanner, setHandoffToPlanner] = useState(false);

  const historyQuery = useQuery({
    queryKey: ["companion-chat-history", user?.id, companion?.id],
    enabled: enabled && !!user?.id && !!companion?.id,
    staleTime: 60 * 1000,
    queryFn: async (): Promise<CompanionChatRow[]> => {
      if (!user?.id || !companion?.id) return [];

      const { data, error } = await supabase
        .from("companion_chats")
        .select("id, role, content, input_mode, created_at")
        .eq("user_id", user.id)
        .eq("companion_id", companion.id)
        .order("created_at", { ascending: true })
        .limit(40);

      if (error) {
        throw error;
      }

      return (data ?? []) as CompanionChatRow[];
    },
  });

  useEffect(() => {
    initialisedRef.current = false;
    setMessages([]);
    sessionIdRef.current = generateId();
  }, [companion?.id]);

  useEffect(() => {
    if (!enabled) {
      initialisedRef.current = true;
      setMessages([]);
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
    writeStoredSettings({
      autoplayVoice,
      muteSpokenReplies,
    });
  }, [autoplayVoice, muteSpokenReplies]);

  useEffect(() => {
    if (!muteSpokenReplies && autoplayVoice) return;
    stopCompanionSpeech();
    setIsSpeaking(false);
    setSpeechProvider("none");
  }, [autoplayVoice, muteSpokenReplies]);

  useEffect(() => () => {
    stopCompanionSpeech();
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
      toast.error("Companion Talk is available with Premium.");
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
      console.error("Failed to submit companion chat message:", error);
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
    messages,
    draftInput,
    setDraftInput,
    interimText,
    isSubmitting,
    isLoadingHistory: historyQuery.isLoading,
    autoplayVoice,
    setAutoplayVoice: setAutoplayVoiceState,
    muteSpokenReplies,
    setMuteSpokenReplies: setMuteSpokenRepliesState,
    isSpeaking,
    speechProvider,
    handoffToPlanner,
    clearPlannerHandoff,
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
