import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { useAIInteractionTracker } from "@/hooks/useAIInteractionTracker";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { supabase } from "@/integrations/supabase/client";
import type {
  CompanionChatInputMode,
  CompanionChatRequest,
  CompanionChatResponse,
} from "@/types/companionConversation";

const MAX_HISTORY_MESSAGES = 8;

export const JOURNEYS_COMPANION_OPENER = "What's gucci fam?";

type JourneysCompanionMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
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

const createInitialMessages = () => [
  createMessage("assistant", JOURNEYS_COMPANION_OPENER, { isSeed: true }),
];

export function useJourneysCompanionConversation() {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { trackInteraction } = useAIInteractionTracker();
  const sessionIdRef = useRef<string>(generateId());

  const [messages, setMessages] = useState<JourneysCompanionMessage[]>(() => createInitialMessages());
  const [draftInput, setDraftInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingPlannerHandoffMessage, setPendingPlannerHandoffMessage] = useState<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = generateId();
    setMessages(createInitialMessages());
    setDraftInput("");
    setIsSubmitting(false);
    setPendingPlannerHandoffMessage(null);
  }, [companion?.id]);

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

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode = "text",
  ) => {
    const message = rawMessage.trim();
    if (!message || isSubmitting) return;

    if (!user?.id || !companion?.id) {
      toast.error("Your companion is still loading. Try again in a moment.");
      return;
    }

    setIsSubmitting(true);
    setDraftInput("");
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
        } satisfies CompanionChatRequest,
      });

      if (error) throw error;

      const response = data as CompanionChatResponse;
      if (response.sessionId) {
        sessionIdRef.current = response.sessionId;
      }

      if (response.handoffToPlanner) {
        setPendingPlannerHandoffMessage(message);
      } else {
        setMessages((previous) => [
          ...previous,
          createMessage("assistant", response.reply),
        ]);
      }

      void trackInteraction({
        interactionType: "journeys_companion_chat",
        inputText: message,
        detectedIntent: response.handoffToPlanner ? "planning_handoff" : "conversation",
        aiResponse: {
          reply: response.reply,
          handoffToPlanner: response.handoffToPlanner,
          surface: "journeys",
        },
        userAction: "accepted",
      });
    } catch (error) {
      console.error("Failed to submit journeys companion message:", error);
      toast.error("Your companion lost the thread for a moment. Try again.");
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
  }, [companion?.id, conversationHistory, isSubmitting, trackInteraction, user?.id]);

  return {
    messages,
    draftInput,
    setDraftInput,
    isSubmitting,
    pendingPlannerHandoffMessage,
    clearPlannerHandoff,
    submitTypedMessage: () => submitMessage(draftInput, "text"),
    submitMessage,
  };
}
