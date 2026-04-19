import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "@/components/ui/sonner";
import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionChat } from "@/hooks/useCompanionChat";
import { useCompanionDialogue } from "@/hooks/useCompanionDialogue";
import { useCompanionPlanner } from "@/hooks/useCompanionPlanner";
import { useJourneysCompanionConversation } from "@/hooks/useJourneysCompanionConversation";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import {
  speakCompanionReply,
  stopCompanionSpeech,
  type CompanionSpeechProvider,
} from "@/services/companionSpeech";
import type { CompanionChatInputMode } from "@/types/companionConversation";

export type CompanionAssistantSurface = "companion" | "journeys";

export interface CompanionAssistantMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  inputMode?: CompanionChatInputMode;
  source: "chat" | "plan";
}

interface UseCompanionAssistantOptions {
  surface: CompanionAssistantSurface;
  conversationEnabled?: boolean;
}

const PLANNING_SIGNAL_REGEX =
  /\b(schedule|scheduled|calendar|free|availability|openings|plan|replan|reschedule|move|shift|push|pull|adjust|edit|update|rename|campaign|ritual|habit|quest|quests|task|tasks|remind|repeat|tomorrow|today|tonight|this afternoon|this morning|this evening)\b/i;

const SCHEDULE_QUESTION_REGEX =
  /\b(what do i have scheduled|what(?:'s| is) on my calendar|when am i free|am i free|what do i have today|what do i have tomorrow|where do i have room)\b/i;

const normalizeConversationMessages = (
  messages: Array<{
    id: string;
    role: "assistant" | "user";
    content: string;
    createdAt: string;
    inputMode?: CompanionChatInputMode;
  }>,
): CompanionAssistantMessage[] =>
  messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    inputMode: message.inputMode,
    source: "chat",
  }));

const normalizePlannerMessages = (
  messages: Array<{
    id: string;
    role: "companion" | "user";
    content: string;
    createdAt: string;
    inputMode?: CompanionChatInputMode;
  }>,
): CompanionAssistantMessage[] =>
  messages.map((message) => ({
    id: message.id,
    role: message.role === "companion" ? "assistant" : "user",
    content: message.content,
    createdAt: message.createdAt,
    inputMode: message.inputMode,
    source: "plan",
  }));

const sortMessages = (messages: CompanionAssistantMessage[]) =>
  messages
    .slice()
    .sort((left, right) => (
      left.createdAt.localeCompare(right.createdAt)
      || left.id.localeCompare(right.id)
    ));

const shouldRouteToPlanner = (
  message: string,
  hasOpenPlannerThread: boolean,
): boolean => {
  if (hasOpenPlannerThread) return true;

  const parsed = parseNaturalLanguage(message);
  if (
    parsed.scheduledDate
    || parsed.scheduledTime
    || parsed.recurrencePattern
    || parsed.newTitle
    || parsed.reminderMinutesBefore
  ) {
    return true;
  }

  return SCHEDULE_QUESTION_REGEX.test(message) || PLANNING_SIGNAL_REGEX.test(message);
};

export function useCompanionAssistant({
  surface,
  conversationEnabled = true,
}: UseCompanionAssistantOptions) {
  const { companion } = useCompanion();
  const { voiceStyle, greeting } = useCompanionDialogue();
  const companionChat = useCompanionChat({
    enabled: surface === "companion" && conversationEnabled,
  });
  const journeysConversation = useJourneysCompanionConversation();
  const planner = useCompanionPlanner({ bootstrapGreeting: false });
  const conversation = surface === "journeys" ? journeysConversation : companionChat;

  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [plannerSpeechProvider, setPlannerSpeechProvider] = useState<CompanionSpeechProvider>("none");
  const [plannerIsSpeaking, setPlannerIsSpeaking] = useState(false);
  const lastSpokenPlannerMessageIdRef = useRef<string | null>(null);

  const messages = useMemo(() => sortMessages([
    ...normalizeConversationMessages(conversation.messages),
    ...normalizePlannerMessages(planner.messages),
  ]), [conversation.messages, planner.messages]);

  const hasOpenPlannerThread = planner.questions.length > 0
    || planner.pendingProposals.some((proposal) => proposal.status === "pending");

  const activePlaceholder = hasOpenPlannerThread
    ? "Answer or refine the plan..."
    : surface === "journeys"
      ? "Pick a starter or tell me what's stuck..."
      : "Talk, ask about your schedule, or tell me what to adjust...";

  const submitPlannerMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode = "text",
  ) => {
    const message = rawMessage.trim();
    if (!message) return;

    setDraftInput("");
    setInterimText("");
    await planner.submitMessage(message, inputMode);
  }, [planner]);

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode = "text",
  ) => {
    const message = rawMessage.trim();
    if (!message) return;

    const routeToPlanner = shouldRouteToPlanner(message, hasOpenPlannerThread);
    setDraftInput("");
    setInterimText("");

    if (!routeToPlanner && surface === "companion" && !conversationEnabled) {
      toast.error("Companion Talk is a Premium feature. Planning and scheduling still work here.");
      return;
    }

    if (routeToPlanner) {
      await planner.submitMessage(message, inputMode);
      return;
    }

    await conversation.submitMessage(message, inputMode);
  }, [
    conversation,
    conversationEnabled,
    hasOpenPlannerThread,
    planner,
    surface,
  ]);

  const latestPlannerAssistantMessage = useMemo(
    () => [...planner.messages].reverse().find((message) => message.role === "companion") ?? null,
    [planner.messages],
  );

  useEffect(() => {
    if (surface !== "companion" || !conversationEnabled) return;
    if (!companion?.id || !latestPlannerAssistantMessage) return;
    if (!companionChat.autoplayVoice || companionChat.muteSpokenReplies) return;
    if (lastSpokenPlannerMessageIdRef.current === latestPlannerAssistantMessage.id) return;

    lastSpokenPlannerMessageIdRef.current = latestPlannerAssistantMessage.id;
    setPlannerIsSpeaking(true);

    void speakCompanionReply({
      text: latestPlannerAssistantMessage.content,
      companionId: companion.id,
      voiceStyle,
    })
      .then((provider) => {
        setPlannerSpeechProvider(provider);
      })
      .catch((error) => {
        console.error("Failed to speak planner reply:", error);
        setPlannerSpeechProvider("none");
      })
      .finally(() => {
        setPlannerIsSpeaking(false);
      });
  }, [
    companion?.id,
    companionChat.autoplayVoice,
    companionChat.muteSpokenReplies,
    conversationEnabled,
    latestPlannerAssistantMessage,
    surface,
    voiceStyle,
  ]);

  useEffect(() => {
    if (surface !== "companion") return;
    if (!companionChat.autoplayVoice || companionChat.muteSpokenReplies) {
      stopCompanionSpeech();
      setPlannerIsSpeaking(false);
      setPlannerSpeechProvider("none");
    }
  }, [companionChat.autoplayVoice, companionChat.muteSpokenReplies, surface]);

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

  const stopSpeaking = useCallback(() => {
    stopCompanionSpeech();
    companionChat.stopSpeaking?.();
    setPlannerIsSpeaking(false);
    setPlannerSpeechProvider("none");
  }, [companionChat]);

  return {
    greeting: surface === "journeys" ? journeysConversation.greeting : companionChat.greeting ?? greeting,
    messages,
    questions: planner.questions,
    proposals: planner.proposals,
    pendingProposals: planner.pendingProposals,
    readyProposalCount: planner.readyProposalCount,
    plannerMemory: planner.plannerMemory,
    scheduleInsights: planner.scheduleInsights,
    todayLabel: planner.todayLabel,
    isLoadingContext: planner.isLoadingContext,
    horizon: planner.horizon,
    setHorizon: planner.setHorizon,
    draftInput,
    setDraftInput,
    interimText,
    placeholder: activePlaceholder,
    isSubmitting: planner.isSubmitting || conversation.isSubmitting,
    isClassifying: planner.isClassifying,
    isRecording,
    isAutoStopping,
    isVoiceSupported: isSupported,
    permissionStatus,
    showPermissionDialog,
    setShowPermissionDialog,
    isRequestingPermission,
    submitTypedMessage: () => submitMessage(draftInput, "text"),
    submitMessage,
    submitPlannerMessage,
    toggleRecording,
    requestMicrophonePermission,
    confirmProposal: planner.confirmProposal,
    rejectProposal: planner.rejectProposal,
    confirmAll: planner.confirmAll,
    autoplayVoice: surface === "companion" ? companionChat.autoplayVoice : false,
    setAutoplayVoice: surface === "companion" ? companionChat.setAutoplayVoice : (() => undefined),
    muteSpokenReplies: surface === "companion" ? companionChat.muteSpokenReplies : false,
    setMuteSpokenReplies: surface === "companion" ? companionChat.setMuteSpokenReplies : (() => undefined),
    isSpeaking: plannerIsSpeaking || companionChat.isSpeaking,
    speechProvider: plannerIsSpeaking ? plannerSpeechProvider : companionChat.speechProvider,
    stopSpeaking,
  };
}
