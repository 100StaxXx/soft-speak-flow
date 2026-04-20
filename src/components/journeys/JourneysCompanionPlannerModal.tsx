import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Archive,
  Mic,
  MicOff,
  Check,
  ChevronRight,
  Loader2,
  Plus,
  Send,
  Waves,
  X,
} from "lucide-react";

import { AudioReactiveWaveform } from "@/components/AudioReactiveWaveform";
import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
import { PermissionRequestDialog } from "@/components/PermissionRequestDialog";
import { plannerPathfinderTheme } from "@/components/companion/plannerPathfinderTheme";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCompanionAssistant } from "@/hooks/useCompanionAssistant";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { cn, stripMarkdown } from "@/lib/utils";
import { COMPANION_PLANNER_STARTER_TEMPLATES } from "@/shared/companionPlannerCopy";
import type { CompanionChatThreadSummary } from "@/types/companionConversation";
import type {
  CompanionPlannerLaunchIntent,
  CompanionPlannerProposal,
  CompanionPlannerQuestion,
} from "@/types/companionPlanner";
import { getCompanionPlannerQuestProposalPreview } from "@/utils/companionPlannerProposalPreview";

type JourneysCompanionPlannerModalPresentation = "dialog" | "drawer";

interface JourneysCompanionPlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
}

type DialogueEntry = {
  id: string;
  role: "assistant" | "user";
  content: string;
  isSeed?: boolean;
};

type PlannerQuestionHistoryEntry = {
  id: string;
  prompt: string;
  options: string[];
  threadSessionId: string | null;
};

type JourneysCompanionDrawerLayout = {
  shellHeight: number;
  keyboardInset: number;
};

const STARTER_QUICK_REPLIES = [...COMPANION_PLANNER_STARTER_TEMPLATES];
const MOBILE_DRAWER_HEIGHT_MIN_PX = 320;
const MOBILE_DRAWER_HEIGHT_MAX_PX = 736;
const MOBILE_DRAWER_VIEWPORT_OFFSET_PX = 24;

const questionEntryId = (question: CompanionPlannerQuestion) => `planner-question-${question.id}`;

const proposalKindLabel = (proposal: CompanionPlannerProposal) => ({
  create_quest: "Quest",
  update_quest: "Quest edit",
  create_campaign: "Campaign",
  update_campaign: "Campaign edit",
  adjust_campaign_plan: "Campaign adjust",
  create_ritual: "Ritual",
  update_ritual: "Ritual edit",
  suggest_reminder: "Reminder",
})[proposal.kind];

const getReducedMotionPreference = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getDrawerLayout = (): JourneysCompanionDrawerLayout => {
  if (typeof window === "undefined") {
    return {
      shellHeight: MOBILE_DRAWER_HEIGHT_MIN_PX,
      keyboardInset: 0,
    };
  }

  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const safeViewportHeight = Number.isFinite(viewportHeight) ? viewportHeight : window.innerHeight;
  const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0;
  const keyboardInset = Math.max(0, window.innerHeight - (viewportOffsetTop + safeViewportHeight));

  return {
    shellHeight: Math.max(
      MOBILE_DRAWER_HEIGHT_MIN_PX,
      Math.min(MOBILE_DRAWER_HEIGHT_MAX_PX, safeViewportHeight - MOBILE_DRAWER_VIEWPORT_OFFSET_PX),
    ),
    keyboardInset,
  };
};

const formatThreadTimestamp = (value: string) => {
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true });
  } catch {
    return "Just now";
  }
};

interface JourneysCompanionThreadPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
  historyThreads: CompanionChatThreadSummary[];
  isLoading: boolean;
  canResumeThreads: boolean;
  emptyStateMessage: string;
  onResumeThread: (sessionId: string) => Promise<void>;
}

const JourneysCompanionThreadPicker = memo(function JourneysCompanionThreadPicker({
  open,
  onOpenChange,
  presentation,
  historyThreads,
  isLoading,
  canResumeThreads,
  emptyStateMessage,
  onResumeThread,
}: JourneysCompanionThreadPickerProps) {
  const body = (
    <div
      className={plannerPathfinderTheme.threadPickerShell}
      data-testid="journeys-companion-thread-picker"
    >
      <div className="mb-4 space-y-1">
        <p className="text-sm font-semibold text-white">Thread history</p>
        <p className="text-sm text-white/[0.62]">
          Browse old conversations here and jump back in whenever you want.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/[0.45]">
          Past chats
        </p>
        {isLoading ? (
          <div className={cn(plannerPathfinderTheme.headerBar, "px-4 py-5 text-sm text-white/[0.82]")}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading past chats...
          </div>
        ) : historyThreads.length > 0 ? (
          <div className="space-y-2">
            {historyThreads.map((thread) => (
              <button
                key={thread.sessionId}
                type="button"
                className={cn(
                  "flex w-full items-start justify-between gap-3 rounded-[1.5rem] border-[3px] px-4 py-4 text-left transition-colors shadow-[0_8px_0_rgba(77,40,17,0.8)]",
                  canResumeThreads
                    ? "border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,246,221,0.16),rgba(255,192,86,0.14))] hover:bg-[linear-gradient(180deg,rgba(255,249,231,0.2),rgba(255,192,86,0.18))]"
                    : "cursor-not-allowed border-[#4d2811] bg-white/[0.03] opacity-70",
                )}
                onClick={() => {
                  void onResumeThread(thread.sessionId);
                }}
                disabled={!canResumeThreads}
                data-testid={`journeys-companion-thread-resume-${thread.sessionId}`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{thread.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-white/[0.68]">{thread.previewText}</p>
                  <p className="mt-3 text-xs text-white/[0.5]">
                    Updated {formatThreadTimestamp(thread.lastMessageAt)}
                  </p>
                </div>
                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/[0.48]" />
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border-[3px] border-dashed border-[#e1a54f] bg-white/[0.05] px-4 py-5 text-sm text-white/[0.72]">
            {emptyStateMessage}
          </div>
        )}
      </div>
    </div>
  );

  if (presentation === "dialog") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg border-none bg-transparent p-0 shadow-none" hideCloseButton>
          <DialogHeader className="sr-only">
            <DialogTitle>Companion threads</DialogTitle>
            <DialogDescription>
              Browse archived journeys conversations.
            </DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-none bg-transparent p-0 shadow-none">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Companion threads</DrawerTitle>
          <DrawerDescription>
            Browse archived journeys conversations.
          </DrawerDescription>
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  );
});

const JourneysCompanionOverlayBody = memo(({
  presentation,
  launchIntent,
  onLaunchIntentConsumed,
  onOpenCampaignBuilder,
  drawerLayout,
}: {
  presentation: JourneysCompanionPlannerModalPresentation;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
  drawerLayout?: JourneysCompanionDrawerLayout;
}) => {
  const {
    companionLabel,
    imageUrl,
    focalX,
    focalY,
    element,
    usesPortraitShell,
  } = useJourneysCompanionVisual();
  const assistant = useCompanionAssistant({
    surface: "journeys",
    conversationEnabled: true,
    launchIntent: launchIntent ?? null,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
  });
  const prefersReducedMotion = getReducedMotionPreference();
  const isDrawerPresentation = presentation === "drawer";

  const [plannerQuestionHistory, setPlannerQuestionHistory] = useState<PlannerQuestionHistoryEntry[]>([]);
  const [isThreadPickerOpen, setIsThreadPickerOpen] = useState(false);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [typedAssistantContent, setTypedAssistantContent] = useState("");

  const typingIntervalRef = useRef<number | null>(null);
  const typingTargetRef = useRef<{ id: string; content: string } | null>(null);
  const lastThreadSessionIdRef = useRef<string | null>(null);
  const hasSettledInitialTranscriptRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const transcriptScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const activeThreadSessionId = assistant.activeThread?.sessionId ?? null;

  useLayoutEffect(() => {
    if (assistant.questions.length === 0) return;

    setPlannerQuestionHistory((previous) => {
      const knownIds = new Set(
        previous
          .filter((entry) => entry.threadSessionId === activeThreadSessionId)
          .map((entry) => entry.id),
      );
      const nextEntries = assistant.questions
        .filter((question) => !knownIds.has(questionEntryId(question)))
        .map((question) => ({
          id: questionEntryId(question),
          prompt: question.prompt,
          options: question.options ?? [],
          threadSessionId: activeThreadSessionId,
        }));

      return nextEntries.length > 0 ? [...previous, ...nextEntries] : previous;
    });
  }, [activeThreadSessionId, assistant.questions]);

  const dialogueEntries = useMemo<DialogueEntry[]>(() => [
    ...assistant.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      isSeed: message.isSeed,
    })),
    ...plannerQuestionHistory
      .filter((question) => question.threadSessionId === activeThreadSessionId)
      .map((question) => ({
      id: question.id,
      role: "assistant" as const,
      content: question.prompt,
    })),
  ], [activeThreadSessionId, assistant.messages, plannerQuestionHistory]);

  const latestAssistantEntry = useMemo(
    () => [...dialogueEntries].reverse().find((entry) => entry.role === "assistant") ?? null,
    [dialogueEntries],
  );

  const clearTypingTimer = useCallback(() => {
    if (typingIntervalRef.current !== null) {
      window.clearInterval(typingIntervalRef.current);
      typingIntervalRef.current = null;
    }
  }, []);

  const completeCurrentAssistantLine = useCallback(() => {
    const typingTarget = typingTargetRef.current;
    if (!typingTarget) return false;

    clearTypingTimer();
    setTypingMessageId(null);
    setTypedAssistantContent(typingTarget.content);
    typingTargetRef.current = null;
    return true;
  }, [clearTypingTimer]);

  useEffect(() => () => {
    clearTypingTimer();
  }, [clearTypingTimer]);

  useEffect(() => {
    const nextThreadSessionId = activeThreadSessionId;
    const previousThreadSessionId = lastThreadSessionIdRef.current;
    if (previousThreadSessionId !== null && previousThreadSessionId !== nextThreadSessionId) {
      setPlannerQuestionHistory([]);
    }
    lastThreadSessionIdRef.current = nextThreadSessionId;
    hasSettledInitialTranscriptRef.current = false;
    clearTypingTimer();
    typingTargetRef.current = null;
    setTypingMessageId(null);
    setTypedAssistantContent("");
  }, [activeThreadSessionId, clearTypingTimer]);

  useEffect(() => {
    if (!latestAssistantEntry) return;

    clearTypingTimer();
    typingTargetRef.current = null;
    setTypingMessageId(null);
    setTypedAssistantContent(latestAssistantEntry.content);
  }, [
    clearTypingTimer,
    latestAssistantEntry,
  ]);

  const keepBottomContentVisible = useCallback((behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth") => {
    const transcriptViewport = transcriptScrollAreaRef.current?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]");
    if (transcriptViewport) {
      const nextTop = Math.max(0, transcriptViewport.scrollHeight - transcriptViewport.clientHeight);
      if (typeof transcriptViewport.scrollTo === "function") {
        transcriptViewport.scrollTo({ top: nextTop, behavior });
      } else {
        transcriptViewport.scrollTop = nextTop;
      }
      return;
    }

    if (typeof transcriptEndRef.current?.scrollIntoView === "function") {
      transcriptEndRef.current.scrollIntoView({ behavior, block: "end" });
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    const behavior: ScrollBehavior = hasSettledInitialTranscriptRef.current && !assistant.isLoadingThreads
      ? (prefersReducedMotion ? "auto" : "smooth")
      : "auto";

    keepBottomContentVisible(behavior);
    if (!assistant.isLoadingThreads) {
      hasSettledInitialTranscriptRef.current = true;
    }
  }, [
    assistant.isLoadingThreads,
    assistant.pendingProposals,
    assistant.questions,
    dialogueEntries,
    keepBottomContentVisible,
    prefersReducedMotion,
    typedAssistantContent,
  ]);

  useEffect(() => {
    if (!isDrawerPresentation) return;
    keepBottomContentVisible("auto");
  }, [drawerLayout, isDrawerPresentation, keepBottomContentVisible]);

  const handleSubmit = useCallback(() => {
    if (typingMessageId) {
      completeCurrentAssistantLine();
      return;
    }

    assistant.submitTypedMessage();
  }, [assistant, completeCurrentAssistantLine, typingMessageId]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    handleSubmit();
  }, [handleSubmit]);

  const handleComposerFocus = useCallback(() => {
    keepBottomContentVisible("auto");
  }, [keepBottomContentVisible]);

  const handleQuickReply = useCallback((option: string) => {
    if (typingMessageId) {
      completeCurrentAssistantLine();
      return;
    }

    void assistant.submitMessage(option, "text");
  }, [assistant, completeCurrentAssistantLine, typingMessageId]);

  const handleStarterQuickReply = useCallback((starter: string) => {
    if (typingMessageId) {
      completeCurrentAssistantLine();
    }

    void assistant.submitMessage(starter, "text");
  }, [assistant, completeCurrentAssistantLine, typingMessageId]);

  const handleVoiceToggle = useCallback(() => {
    if (typingMessageId) {
      completeCurrentAssistantLine();
    }

    assistant.toggleRecording();
  }, [assistant, completeCurrentAssistantLine, typingMessageId]);

  const handleResumeThread = useCallback(async (sessionId: string) => {
    await assistant.resumeThread(sessionId);
    setIsThreadPickerOpen(false);
  }, [assistant]);

  const handleArchiveAction = useCallback(async () => {
    if (assistant.canArchiveThread) {
      await assistant.archiveCurrentThread();
    }

    setIsThreadPickerOpen(true);
  }, [assistant]);

  const handleNewChatAction = useCallback(async () => {
    if (!assistant.canStartNewChat) return;
    await assistant.startNewChat();
  }, [assistant]);

  const sendDisabled = assistant.isSubmitting || assistant.isClassifying || (!typingMessageId && !assistant.draftInput.trim());
  const activeProposal = assistant.pendingProposals[0] ?? null;
  const activeQuestPreview = activeProposal
    ? getCompanionPlannerQuestProposalPreview(activeProposal)
    : null;
  const activeOptionQuestions = assistant.questions.filter((question) => (question.options?.length ?? 0) > 0);
  const seededOpenerMessage = assistant.messages.length === 1
    ? assistant.messages[0]
    : null;
  const showStarterQuickReplies = seededOpenerMessage?.role === "assistant"
    && seededOpenerMessage.isSeed === true
    && seededOpenerMessage.content === assistant.greeting
    && plannerQuestionHistory.length === 0
    && assistant.pendingProposals.length === 0;
  const micButtonLabel = assistant.isRecording ? "Stop voice reply" : "Start voice reply";
  const newChatTooltip = assistant.newChatDisabledReason
    ?? (assistant.hasPersistedActiveThread
      ? "Archive this chat and start a new one."
      : "Start a fresh chat.");

  const avatar = usesPortraitShell ? (
    <CompanionPortraitShell
      src={imageUrl}
      element={element}
      className="h-12 w-12 overflow-hidden rounded-full border border-white/[0.15] shadow-[0_18px_32px_-26px_rgba(0,0,0,0.95)]"
    >
      <CompanionImage
        src={imageUrl}
        alt={companionLabel}
        fit="portrait"
        element={element}
        focalX={focalX}
        focalY={focalY}
        className="rounded-full"
      />
    </CompanionPortraitShell>
  ) : (
    <div className="h-12 w-12 overflow-hidden rounded-full border border-white/[0.15] bg-white/10 shadow-[0_18px_32px_-26px_rgba(0,0,0,0.95)]">
      <CompanionImage
        src={imageUrl}
        alt={companionLabel}
        element={element}
        focalX={focalX}
        focalY={focalY}
        className="rounded-full"
      />
    </div>
  );

  const statusText = assistant.isRecording
    ? "Listening..."
    : assistant.isSubmitting || assistant.isClassifying
      ? "Replying..."
      : assistant.todayLabel;
  const plannerShellStyle = isDrawerPresentation && drawerLayout
    ? { height: `${drawerLayout.shellHeight}px` }
    : undefined;

  return (
    <div
      className={plannerPathfinderTheme.shell}
      data-testid="journeys-companion-planner-modal"
    >
      <div className={plannerPathfinderTheme.shellGloss} />
      <div className={plannerPathfinderTheme.shellGlow} />

      <div
        className={cn(
          plannerPathfinderTheme.shellBody,
          isDrawerPresentation ? "h-full" : "h-[min(82vh,46rem)] min-h-[32rem]",
        )}
        style={plannerShellStyle}
        data-testid="journeys-companion-planner-shell"
      >
        <div
          className={plannerPathfinderTheme.headerBar}
          data-testid="journeys-companion-planner-chat-header"
        >
          <div className="relative shrink-0">
            {avatar}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-18%] rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.3),transparent_70%)] blur-lg"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{companionLabel}</p>
            <p className="truncate text-xs text-white/[0.58]">{statusText}</p>
          </div>
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className={cn("h-10 w-10", plannerPathfinderTheme.headerIconButton)}
                      onClick={() => {
                        void handleNewChatAction();
                      }}
                      disabled={!assistant.canStartNewChat}
                      aria-label="New chat"
                      data-testid="journeys-companion-new-chat-button"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {newChatTooltip}
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className={cn("h-10 w-10", plannerPathfinderTheme.headerIconButton)}
                      onClick={() => {
                        void handleArchiveAction();
                      }}
                      disabled={assistant.isLoadingThreads}
                      aria-label="Archive"
                      data-testid="journeys-companion-archive-button"
                    >
                      {assistant.isLoadingThreads ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {assistant.archiveDisabledReason ?? "Archive this chat and browse past chats."}
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <div
          className={cn(
            plannerPathfinderTheme.contentWell,
            typingMessageId && "cursor-pointer",
          )}
          onClick={() => {
            if (typingMessageId) {
              completeCurrentAssistantLine();
            }
          }}
          data-testid="journeys-companion-planner-dialogue-screen"
          data-vaul-no-drag
        >
          <ScrollArea ref={transcriptScrollAreaRef} className="flex-1">
            <div className="space-y-3 p-4 sm:p-5" data-testid="journeys-companion-planner-transcript">
              {dialogueEntries.map((entry) => {
                const displayedContent = stripMarkdown(
                  entry.role === "assistant" && typingMessageId === entry.id
                    ? typedAssistantContent
                    : entry.content,
                );

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex w-full",
                      entry.role === "assistant" ? "justify-start" : "justify-end",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-[1.7rem] border-[3px] px-4 py-3 shadow-[0_8px_0_rgba(77,40,17,0.8),0_18px_34px_-28px_rgba(36,12,4,0.52)] sm:max-w-[78%]",
                        entry.role === "assistant"
                          ? plannerPathfinderTheme.assistantBubble
                          : plannerPathfinderTheme.userBubble,
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6 sm:text-[0.95rem]">
                        {displayedContent || "\u00A0"}
                      </p>
                    </div>
                  </div>
                );
              })}

              {activeProposal ? (
                <div className="flex w-full justify-start">
                  <div
                    className={cn(plannerPathfinderTheme.raisedPanel, "max-w-[88%] p-4")}
                    data-testid="journeys-companion-planner-inline-proposal"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.55]">
                          {proposalKindLabel(activeProposal)}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-white">{activeProposal.title}</p>
                        <p className="mt-1 text-sm text-white/[0.72]">{activeProposal.summary}</p>
                        {!activeProposal.readyToConfirm && activeProposal.missingFields?.length ? (
                          <p className="mt-1 text-xs text-amber-100/[0.7]">
                            Still waiting on: {activeProposal.missingFields.join(", ")}.
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="outline" className={plannerPathfinderTheme.chip}>
                        {activeProposal.status}
                      </Badge>
                    </div>
                    {activeQuestPreview?.notes ? (
                      <div
                        className={cn(plannerPathfinderTheme.mutedPanel, "mt-3 p-3")}
                        data-testid={`journeys-companion-planner-inline-proposal-notes-${activeProposal.id}`}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.46]">
                          Stored note
                        </p>
                        <p className="mt-1 text-sm text-white/[0.78]">{activeQuestPreview.notes}</p>
                      </div>
                    ) : null}
                    {activeQuestPreview?.subtasks.length ? (
                      <div
                        className={cn(plannerPathfinderTheme.mutedPanel, "mt-3 p-3")}
                        data-testid={`journeys-companion-planner-inline-proposal-subtasks-${activeProposal.id}`}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/[0.46]">
                            {activeQuestPreview.subtasks.length} step{activeQuestPreview.subtasks.length === 1 ? "" : "s"}
                          </p>
                          {activeProposal.kind === "update_quest" && activeQuestPreview.subtaskPlanMode ? (
                            <Badge variant="outline" className="border-emerald-300/20 bg-emerald-400/10 text-emerald-50">
                              {activeQuestPreview.subtaskPlanMode === "replace" ? "Replace steps" : "Append steps"}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="mt-2 space-y-1">
                          {activeQuestPreview.subtasks.map((subtask) => (
                            <p key={subtask} className="text-sm text-white/[0.78]">
                              - {subtask}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className={plannerPathfinderTheme.primaryButton}
                        onClick={() => assistant.confirmProposal(activeProposal.id)}
                        disabled={!activeProposal.readyToConfirm}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Confirm
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={plannerPathfinderTheme.outlineButton}
                        onClick={() => assistant.rejectProposal(activeProposal.id)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                      {assistant.readyProposalCount > 1 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={plannerPathfinderTheme.outlineButton}
                          onClick={assistant.confirmAll}
                        >
                          Confirm all
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {showStarterQuickReplies || activeOptionQuestions.length > 0 ? (
                <div
                  className="flex w-full justify-start"
                  data-testid={showStarterQuickReplies ? "journeys-companion-planner-starter-options" : "journeys-companion-planner-inline-options"}
                >
                  <div className={cn(plannerPathfinderTheme.raisedPanel, "max-w-[92%] p-3")}>
                    <div className="flex flex-wrap gap-2">
                      {showStarterQuickReplies
                        ? STARTER_QUICK_REPLIES.map((starter) => (
                            <Button
                              key={starter}
                              type="button"
                              size="sm"
                              variant="outline"
                              className={plannerPathfinderTheme.outlineButton}
                              onClick={() => handleStarterQuickReply(starter)}
                            >
                              {starter}
                            </Button>
                          ))
                        : null}
                      {activeOptionQuestions.flatMap((question) => (
                        question.options?.map((option) => (
                          <Button
                            key={`${question.id}-${option}`}
                            type="button"
                            size="sm"
                            variant="outline"
                            className={plannerPathfinderTheme.outlineButton}
                            onClick={() => handleQuickReply(option)}
                          >
                            {option}
                          </Button>
                        )) ?? []
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={transcriptEndRef} />
            </div>
          </ScrollArea>

          <div className={cn(plannerPathfinderTheme.footerBar, "p-3")}>
            {assistant.isRecording || assistant.interimText ? (
              <div
                className={cn(plannerPathfinderTheme.raisedPanel, "mb-3 px-3 py-3 text-[#5d2a0f]")}
                data-testid="journeys-companion-planner-voice-preview"
              >
                <AudioReactiveWaveform
                  isActive={assistant.isRecording && !assistant.isAutoStopping}
                  className="justify-start text-[#b04b12]"
                />
                <p className="mt-2 text-sm text-[#5d2a0f]">
                  {assistant.interimText || "Listening for your reply..."}
                </p>
              </div>
            ) : null}

            {assistant.isSpeaking ? (
              <div
                className={cn(plannerPathfinderTheme.successCard, "mb-3 flex items-center justify-between gap-3 px-3 py-3")}
                data-testid="journeys-companion-planner-speaking-status"
              >
                <div className="flex items-center gap-2 text-sm text-[#183304]">
                  <Waves className="h-4 w-4" />
                  Speaking {assistant.speechProvider === "cloud" ? "with fallback audio" : "on-device"}.
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-[#183304] hover:bg-[#d2f38e] hover:text-[#183304]"
                  onClick={assistant.stopSpeaking}
                >
                  Stop
                </Button>
              </div>
            ) : null}

            <div className={plannerPathfinderTheme.composerBar}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn(
                  "h-11 w-11 shrink-0 rounded-full border-[3px] border-[#4d2811] bg-white/65 text-[#7f3b12] hover:bg-white/80",
                  assistant.isRecording && "border-[#7f1616] bg-[linear-gradient(180deg,#ffb8a7_0%,#ff7a59_100%)] text-[#4c0f0f]",
                )}
                onClick={handleVoiceToggle}
                disabled={!assistant.isVoiceSupported && !assistant.isRecording}
                aria-label={micButtonLabel}
                data-testid="journeys-companion-planner-mic-button"
              >
                {assistant.isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <label htmlFor="journeys-companion-chat-input" className="sr-only">
                Message your companion
              </label>
              <Textarea
                id="journeys-companion-chat-input"
                rows={1}
                value={assistant.draftInput}
                onChange={(event) => {
                  assistant.setDraftInput(event.target.value);
                }}
                onKeyDown={handleComposerKeyDown}
                onFocus={handleComposerFocus}
                placeholder={assistant.placeholder}
                className={cn(
                  plannerPathfinderTheme.textField,
                  "h-12 min-h-[48px] max-h-[48px] flex-1 w-auto resize-none overflow-y-auto leading-5",
                )}
                data-testid="journeys-companion-planner-text-input"
              />
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={sendDisabled}
                className={cn(plannerPathfinderTheme.primaryButton, "h-11 shrink-0 px-4")}
                data-testid="journeys-companion-planner-send-button"
              >
                {assistant.isSubmitting || assistant.isClassifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Thinking
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PermissionRequestDialog
        isOpen={assistant.showPermissionDialog}
        onClose={() => assistant.setShowPermissionDialog(false)}
        onRequestPermission={assistant.requestMicrophonePermission}
        permissionStatus={assistant.permissionStatus}
        isRequesting={assistant.isRequestingPermission}
      />
      <JourneysCompanionThreadPicker
        open={isThreadPickerOpen}
        onOpenChange={setIsThreadPickerOpen}
        presentation={presentation}
        historyThreads={assistant.historyThreads}
        isLoading={assistant.isLoadingThreads}
        canResumeThreads={assistant.canOpenThreadPicker}
        emptyStateMessage={assistant.threadHistoryEmptyStateMessage}
        onResumeThread={handleResumeThread}
      />
    </div>
  );
});

JourneysCompanionOverlayBody.displayName = "JourneysCompanionOverlayBody";

export const JourneysCompanionPlannerModal = memo(function JourneysCompanionPlannerModal({
  open,
  onOpenChange,
  presentation,
  launchIntent,
  onLaunchIntentConsumed,
  onOpenCampaignBuilder,
}: JourneysCompanionPlannerModalProps) {
  const isDrawerPresentation = presentation === "drawer";
  const [drawerLayout, setDrawerLayout] = useState<JourneysCompanionDrawerLayout>(() => getDrawerLayout());

  useLayoutEffect(() => {
    if (!open || !isDrawerPresentation || typeof window === "undefined") return;

    const syncDrawerLayout = () => {
      const nextLayout = getDrawerLayout();
      setDrawerLayout((previous) => (
        previous.shellHeight === nextLayout.shellHeight
          && previous.keyboardInset === nextLayout.keyboardInset
      )
        ? previous
        : nextLayout);
    };

    syncDrawerLayout();

    const viewport = window.visualViewport;
    const canListenToViewport = !!viewport
      && typeof viewport.addEventListener === "function"
      && typeof viewport.removeEventListener === "function";

    window.addEventListener("resize", syncDrawerLayout);
    if (canListenToViewport) {
      viewport.addEventListener("resize", syncDrawerLayout);
      viewport.addEventListener("scroll", syncDrawerLayout);
    }

    return () => {
      window.removeEventListener("resize", syncDrawerLayout);
      if (canListenToViewport) {
        viewport.removeEventListener("resize", syncDrawerLayout);
        viewport.removeEventListener("scroll", syncDrawerLayout);
      }
    };
  }, [isDrawerPresentation, open]);

  const content = open ? (
    <JourneysCompanionOverlayBody
      presentation={presentation}
      launchIntent={launchIntent}
      onLaunchIntentConsumed={onLaunchIntentConsumed}
      onOpenCampaignBuilder={onOpenCampaignBuilder}
      drawerLayout={isDrawerPresentation ? drawerLayout : undefined}
    />
  ) : null;

  if (presentation === "dialog") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Companion chat</DialogTitle>
            <DialogDescription>
              Chat with your companion through a simple dialogue screen on the quests page.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} repositionInputs={false}>
      <DrawerContent
        className="border-none bg-transparent p-0 shadow-none"
        style={{ bottom: `${drawerLayout.keyboardInset}px` }}
        data-testid="journeys-companion-planner-drawer-content"
      >
        <DrawerHeader className="sr-only">
          <DrawerTitle>Companion chat</DrawerTitle>
          <DrawerDescription>
            Chat with your companion through a simple dialogue screen on the quests page.
          </DrawerDescription>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
});
