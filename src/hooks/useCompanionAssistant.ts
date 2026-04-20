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
  analyzeSchedulingIntent,
  shouldRouteMessageToPlanner,
} from "@/shared/schedulingIntent";
import {
  isGoalBreakdownStarterMessage,
  looksLikeBigGoal,
} from "@/shared/bigGoalIntent";
import {
  speakCompanionReply,
  stopCompanionSpeech,
  type CompanionSpeechProvider,
} from "@/services/companionSpeech";
import type { CompanionChatInputMode } from "@/types/companionConversation";
import type {
  CompanionPlannerLaunchIntent,
  CompanionPlannerLaunchTarget,
} from "@/types/companionPlanner";
import { formatCurrentDateTimeWithOffset } from "@/utils/currentDateTime";

export type CompanionAssistantSurface = "companion" | "journeys";

export interface CompanionAssistantMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  speechText?: string;
  inputMode?: CompanionChatInputMode;
  source: "chat" | "plan";
  isSeed?: boolean;
}

interface UseCompanionAssistantOptions {
  surface: CompanionAssistantSurface;
  conversationEnabled?: boolean;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
}

const ASSISTANT_LED_LAUNCHER_STARTER_INTENTS = new Set<CompanionPlannerLaunchIntent["starterIntent"]>([
  "free_talk_start",
  "quest_capture",
  "goal_breakdown_start",
]);

const normalizeConversationMessages = (
  messages: Array<{
    id: string;
    role: "assistant" | "user";
    content: string;
    createdAt: string;
    speechText?: string;
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
    speechText: message.role === "assistant" ? message.speechText : undefined,
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
  surface: CompanionAssistantSurface,
  message: string,
  hasOpenPlannerThread: boolean,
): boolean => {
  const parsed = parseNaturalLanguage(message);
  const analysis = analyzeSchedulingIntent(message, parsed);

  return shouldRouteMessageToPlanner({
    surface,
    analysis,
    hasOpenPlannerThread,
  });
};

const isExactQuestCaptureStarterMessage = (message: string): boolean =>
  message.trim().toLowerCase() === "quest?";

const isExactPlanDayStarterMessage = (message: string): boolean =>
  message.trim().toLowerCase() === "plan my day";

export function useCompanionAssistant({
  surface,
  conversationEnabled = true,
  launchIntent = null,
  onLaunchIntentConsumed,
  onOpenCampaignBuilder,
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
  const [assistantSpeechProvider, setAssistantSpeechProvider] = useState<CompanionSpeechProvider>("none");
  const [assistantIsSpeaking, setAssistantIsSpeaking] = useState(false);
  const lastSpokenPlannerMessageIdRef = useRef<string | null>(null);
  const latestJourneysMessagesRef = useRef<CompanionAssistantMessage[]>([]);
  const knownJourneysAssistantMessageIdsRef = useRef<Set<string> | null>(null);
  const pendingPlannerHandoffRef = useRef<string | null>(null);
  const lastLaunchIntentIdRef = useRef<string | null>(null);

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
    || planner.pendingProposals.some((proposal) => proposal.status === "pending")
    || !!planner.sessionState.pendingStarterIntent;

  const journeysThreads = useJourneysCompanionThreads({
    enabled: surface === "journeys",
    userId: user?.id,
    companionId: companion?.id,
    messages: surface === "journeys" ? messages : [],
    persistenceReady: journeysConversation.threadPersistenceReady,
    persistenceUnavailableReason: journeysConversation.threadPersistenceUnavailableReason,
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
      ? "Chat"
      : "Talk to me, or ask what your day looks like.";

  const speakAssistantTurn = useCallback(async ({
    text,
    sessionId,
  }: {
    text: string;
    sessionId?: string | null;
  }) => {
    const trimmedText = text.trim();
    if (!companion?.id || !trimmedText) return;

    setAssistantIsSpeaking(true);
    try {
      const provider = await speakCompanionReply({
        text: trimmedText,
        companionId: companion.id,
        voiceStyle,
        sessionId: sessionId ?? undefined,
      });
      setAssistantSpeechProvider(provider);
    } catch (error) {
      console.error("Failed to speak assistant reply:", error);
      setAssistantSpeechProvider("none");
    } finally {
      setAssistantIsSpeaking(false);
    }
  }, [companion?.id, voiceStyle]);

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

  useEffect(() => {
    latestJourneysMessagesRef.current = messages;
  }, [messages]);

  const submitMessage = useCallback(async (
    rawMessage: string,
    inputMode: CompanionChatInputMode = "text",
  ) => {
    const message = rawMessage.trim();
    if (!message) return;

    const parsed = parseNaturalLanguage(message);
    const shouldOpenCampaignBuilder = surface === "journeys" &&
      !!onOpenCampaignBuilder &&
      (
        isGoalBreakdownStarterMessage(message) ||
        looksLikeBigGoal(
          parsed.text || message,
          parsed.estimatedDuration,
          parsed.scheduledDate,
        )
      );
    const routeToPlanner = shouldRouteToPlanner(
      surface,
      message,
      hasOpenPlannerThread,
    );
    setDraftInput("");
    setInterimText("");

    if (isExactQuestCaptureStarterMessage(message)) {
      planner.primeQuestCapture(message);
      return;
    }

    if (isExactPlanDayStarterMessage(message)) {
      await planner.submitMessage(message, inputMode);
      return;
    }

    if (!routeToPlanner && surface === "companion" && !conversationEnabled) {
      toast.error("Companion Talk is a Premium feature. Planning and scheduling still work here.");
      return;
    }

    if (routeToPlanner) {
      await planner.submitMessage(message, inputMode);
      return;
    }

    if (shouldOpenCampaignBuilder) {
      onOpenCampaignBuilder(message);
      return;
    }

    if (surface === "journeys") {
      await journeysConversation.submitMessage(message, inputMode, {
        currentDate: planner.currentDate,
        currentDateTime: formatCurrentDateTimeWithOffset(new Date()),
        journeysContext: planner.plannerContext,
      });
      return;
    }

    await conversation.submitMessage(message, inputMode);
  }, [
    conversation,
    conversationEnabled,
    hasOpenPlannerThread,
    journeysConversation,
    onOpenCampaignBuilder,
    planner,
    surface,
  ]);

  useEffect(() => {
    if (surface !== "journeys") return;
    knownJourneysAssistantMessageIdsRef.current = new Set(
      latestJourneysMessagesRef.current
        .filter((message) => message.role === "assistant")
        .map((message) => message.id),
    );
  }, [planner.sessionId, journeysConversation.sessionId, surface]);

  useEffect(() => {
    if (surface !== "journeys") return;

    const knownIds = knownJourneysAssistantMessageIdsRef.current;
    if (!knownIds) return;

    const assistantMessages = messages.filter((message) => message.role === "assistant");
    const newAssistantMessages = assistantMessages.filter((message) => !knownIds.has(message.id));

    if (newAssistantMessages.length === 0) return;

    for (const message of newAssistantMessages) {
      knownIds.add(message.id);
    }

    if (!companionChat.autoplayVoice || companionChat.muteSpokenReplies) return;

    const newestSpokenMessage = [...newAssistantMessages]
      .reverse()
      .find((message) => !message.isSeed);

    if (!newestSpokenMessage) return;

    void speakAssistantTurn({
      text: newestSpokenMessage.speechText?.trim() || newestSpokenMessage.content,
      sessionId: newestSpokenMessage.source === "chat"
        ? journeysConversation.sessionId
        : planner.sessionId,
    });
  }, [
    companionChat.autoplayVoice,
    companionChat.muteSpokenReplies,
    messages,
    planner.sessionId,
    journeysConversation.sessionId,
    speakAssistantTurn,
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

  useEffect(() => {
    if (surface !== "journeys") return;
    if (!launchIntent?.id || !launchIntent.message.trim()) return;
    if (lastLaunchIntentIdRef.current === launchIntent.id) return;

    lastLaunchIntentIdRef.current = launchIntent.id;
    const resolvedTarget: CompanionPlannerLaunchTarget = launchIntent.target ?? "auto";

    if ((resolvedTarget === "campaign_builder"
      || (resolvedTarget === "auto" && launchIntent.starterIntent === "goal_breakdown"))
      && onOpenCampaignBuilder) {
      onOpenCampaignBuilder(launchIntent.message);
      onLaunchIntentConsumed?.(launchIntent.id);
      return;
    }

    if (resolvedTarget === "conversation") {
      journeysThreads.startTemplateThread();
      journeysConversation.injectAssistantOpening(launchIntent.message);
      onLaunchIntentConsumed?.(launchIntent.id);
      return;
    }

    journeysThreads.startTemplateThread();
    if (launchIntent.starterIntent === "quest_capture") {
      planner.primeQuestCapture(launchIntent.message);
      onLaunchIntentConsumed?.(launchIntent.id);
      return;
    }

    void planner.submitMessage(
      launchIntent.message,
      "text",
      {
        skipUserEcho: ASSISTANT_LED_LAUNCHER_STARTER_INTENTS.has(launchIntent.starterIntent),
        starterIntent: launchIntent.starterIntent,
        briefingContext: launchIntent.briefingContext ?? null,
      },
    ).finally(() => {
      onLaunchIntentConsumed?.(launchIntent.id);
    });
  }, [
    journeysConversation,
    journeysThreads,
    launchIntent,
    onOpenCampaignBuilder,
    onLaunchIntentConsumed,
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
    void speakAssistantTurn({
      text: latestPlannerAssistantMessage.content,
    });
  }, [
    companion?.id,
    companionChat.autoplayVoice,
    companionChat.muteSpokenReplies,
    conversationEnabled,
    latestPlannerAssistantMessage,
    speakAssistantTurn,
    surface,
  ]);

  useEffect(() => {
    if (!companionChat.autoplayVoice || companionChat.muteSpokenReplies) {
      stopCompanionSpeech();
      setAssistantIsSpeaking(false);
      setAssistantSpeechProvider("none");
    }
  }, [companionChat.autoplayVoice, companionChat.muteSpokenReplies]);

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
    setAssistantIsSpeaking(false);
    setAssistantSpeechProvider("none");
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
    completeProposalEdit: planner.completeProposalEdit,
    confirmAll: planner.confirmAll,
    autoplayVoice: companionChat.autoplayVoice,
    setAutoplayVoice: companionChat.setAutoplayVoice,
    muteSpokenReplies: companionChat.muteSpokenReplies,
    setMuteSpokenReplies: companionChat.setMuteSpokenReplies,
    isSpeaking: assistantIsSpeaking || companionChat.isSpeaking,
    speechProvider: assistantIsSpeaking ? assistantSpeechProvider : companionChat.speechProvider,
    stopSpeaking,
    activeThread: surface === "journeys"
      ? journeysThreads.activeThread
      : null,
    historyThreads: surface === "journeys"
      ? journeysThreads.historyThreads
      : [],
    canOpenThreadPicker: surface === "journeys"
      ? journeysThreads.canOpenThreadPicker
      : false,
    threadPickerDisabledReason: surface === "journeys"
      ? journeysThreads.threadPickerDisabledReason
      : null,
    threadHistoryEmptyStateMessage: surface === "journeys"
      ? journeysThreads.threadHistoryEmptyStateMessage
      : "Past chats will show up here after at least one real exchange.",
    hasPersistedActiveThread: surface === "journeys"
      ? journeysThreads.hasPersistedActiveThread
      : false,
    canStartNewChat: surface === "journeys"
      ? journeysThreads.canStartNewChat
      : false,
    newChatDisabledReason: surface === "journeys"
      ? journeysThreads.newChatDisabledReason
      : null,
    startNewChat: surface === "journeys"
      ? journeysThreads.startNewChat
      : (async () => undefined),
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
