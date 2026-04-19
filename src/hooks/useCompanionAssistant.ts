import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "@/components/ui/sonner";
import { parseNaturalLanguage } from "@/features/tasks/hooks/useNaturalLanguageParser";
import { useAuth } from "@/hooks/useAuth";
import { useCompanion } from "@/hooks/useCompanion";
import { useCompanionChat } from "@/hooks/useCompanionChat";
import { useCompanionDialogue } from "@/hooks/useCompanionDialogue";
import { useCompanionPlanner } from "@/hooks/useCompanionPlanner";
import { useJourneysCompanionConversation } from "@/hooks/useJourneysCompanionConversation";
import { useJourneysCompanionThreads } from "@/hooks/useJourneysCompanionThreads";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { stripMarkdown } from "@/lib/utils";
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
  isSeed?: boolean;
}

interface UseCompanionAssistantOptions {
  surface: CompanionAssistantSurface;
  conversationEnabled?: boolean;
}

const SCHEDULE_QUESTION_REGEX =
  /\b(what do i have scheduled|what(?:'s| is) on my calendar|when am i free|am i free|what do i have today|what do i have tomorrow|where do i have room|show me today(?:'s)? route|show me tomorrow(?:'s)? route|how does (?:today|tomorrow|my day) look)\b/i;
const SCHEDULE_DAY_REFERENCE_REGEX =
  /\b(?:today|tomorrow|my day|(?:my\s+)?(?:this\s+|next\s+|upcoming\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;

const DIRECT_DAY_PLANNING_REGEX =
  /\b(plan(?: my)? (?:day|today|tomorrow|week)|organize(?: my)? (?:day|today|week)|prioritize(?: my)? (?:day|today|week)|build (?:me )?(?:a )?(?:day|week) plan)\b/i;

const PLANNER_ACTION_REGEX =
  /\b(schedule|scheduled|replan|reschedule|move|shift|push|pull|adjust|edit|update|rename|repeat|remind|create|add|set up|turn .+ into)\b/i;

const PLANNER_ENTITY_REGEX =
  /\b(calendar|campaign|ritual|habit|quest|quests|task|tasks|reminder|reminders)\b/i;

const isScheduleReadMessage = (message: string): boolean => {
  if (SCHEDULE_QUESTION_REGEX.test(message)) return true;
  if (!SCHEDULE_DAY_REFERENCE_REGEX.test(message)) return false;

  if (
    /\b(when am i free|am i free|where do i have room|what(?:'s| is) open|what openings do i have|what time do i have free)\b/i
      .test(message)
  ) {
    return true;
  }

  return /\b(show me|how does|how(?:'s| is)|what does)\b/i.test(message) &&
    /\b(route|look|looking|schedule)\b/i.test(message);
};

const normalizeConversationMessages = (
  messages: Array<{
    id: string;
    role: "assistant" | "user";
    content: string;
    createdAt: string;
    inputMode?: CompanionChatInputMode;
    isSeed?: boolean;
  }>,
): CompanionAssistantMessage[] =>
  messages.map((message) => ({
    id: message.id,
    role: message.role,
    content: message.role === "assistant"
      ? stripMarkdown(message.content)
      : message.content,
    createdAt: message.createdAt,
    inputMode: message.inputMode,
    source: "chat",
    isSeed: message.isSeed,
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
    content: message.role === "companion"
      ? stripMarkdown(message.content)
      : message.content,
    createdAt: message.createdAt,
    inputMode: message.inputMode,
    source: "plan",
    isSeed: false,
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

  if (isScheduleReadMessage(message)) return true;
  if (DIRECT_DAY_PLANNING_REGEX.test(message)) return true;

  return PLANNER_ACTION_REGEX.test(message) && PLANNER_ENTITY_REGEX.test(message);
};

export function useCompanionAssistant({
  surface,
  conversationEnabled = true,
}: UseCompanionAssistantOptions) {
  const { user } = useAuth();
  const { companion } = useCompanion();
  const { voiceStyle, greeting } = useCompanionDialogue();
  const companionChat = useCompanionChat({
    enabled: surface === "companion" && conversationEnabled,
  });
  const journeysConversation = useJourneysCompanionConversation();
  const planner = useCompanionPlanner({
    bootstrapGreeting: false,
    threadPersistence: surface === "journeys"
      ? {
          enabled: true,
          surface: "journeys",
        }
      : undefined,
  });
  const conversation = surface === "journeys" ? journeysConversation : companionChat;

  const [draftInput, setDraftInput] = useState("");
  const [interimText, setInterimText] = useState("");
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [plannerSpeechProvider, setPlannerSpeechProvider] = useState<CompanionSpeechProvider>("none");
  const [plannerIsSpeaking, setPlannerIsSpeaking] = useState(false);
  const lastSpokenPlannerMessageIdRef = useRef<string | null>(null);
  const pendingPlannerHandoffRef = useRef<string | null>(null);

  const messages = useMemo(() => (
    surface === "journeys"
      ? sortMessages([
        ...normalizeConversationMessages(conversation.messages),
        ...normalizePlannerMessages(planner.messages),
      ])
      : sortMessages([
        ...normalizeConversationMessages(conversation.messages),
        ...normalizePlannerMessages(planner.messages),
      ])
  ), [conversation.messages, planner.messages, surface]);

  const hasOpenPlannerThread = planner.questions.length > 0
    || planner.pendingProposals.some((proposal) => proposal.status === "pending");

  const journeysThreads = useJourneysCompanionThreads({
    enabled: surface === "journeys",
    userId: user?.id,
    companionId: companion?.id,
    greeting: journeysConversation.greeting,
    messages: surface === "journeys" ? messages : [],
    hasPendingPlannerWork: hasOpenPlannerThread,
    isBusy: planner.isSubmitting || planner.isClassifying || conversation.isSubmitting,
    conversation: {
      resetThread: journeysConversation.resetThread,
      hydrateThread: journeysConversation.hydrateThread,
    },
    planner: {
      resetThread: planner.resetThread,
      hydrateThread: planner.hydrateThread,
    },
  });

  const activePlaceholder = hasOpenPlannerThread
    ? "Reply here..."
    : surface === "journeys"
      ? "Talk to me, or ask how today looks."
      : "Talk to me, or ask what your day looks like.";

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

  useEffect(() => {
    if (surface !== "journeys") return;
    const pendingMessage = journeysConversation.pendingPlannerHandoffMessage;
    if (!pendingMessage) {
      pendingPlannerHandoffRef.current = null;
      return;
    }
    if (pendingPlannerHandoffRef.current === pendingMessage) return;

    pendingPlannerHandoffRef.current = pendingMessage;

    void planner.submitMessage(
      pendingMessage,
      "text",
      { skipUserEcho: true },
    ).finally(() => {
      journeysConversation.clearPlannerHandoff();
    });
  }, [
    journeysConversation.clearPlannerHandoff,
    journeysConversation.pendingPlannerHandoffMessage,
    planner.submitMessage,
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
    greeting: surface === "journeys"
      ? journeysConversation.greeting
      : companionChat.greeting ?? greeting,
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
    activeThread: surface === "journeys"
      ? journeysThreads.activeThread
      : null,
    archivedThreads: surface === "journeys"
      ? journeysThreads.archivedThreads
      : [],
    canArchiveThread: surface === "journeys"
      ? journeysThreads.canArchiveThread
      : false,
    archiveDisabledReason: surface === "journeys"
      ? journeysThreads.archiveDisabledReason
      : null,
    archiveCurrentThread: surface === "journeys"
      ? journeysThreads.archiveCurrentThread
      : (async () => undefined),
    resumeThread: surface === "journeys"
      ? journeysThreads.resumeThread
      : (async () => undefined),
    isLoadingThreads: surface === "journeys"
      ? journeysThreads.isLoadingThreads
      : false,
  };
}
