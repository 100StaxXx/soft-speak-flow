import {
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Archive,
  Check,
  ChevronRight,
  Loader2,
  Mic,
  Plus,
  Send,
  Waves,
  X,
} from "lucide-react";

import { AudioReactiveWaveform } from "@/components/AudioReactiveWaveform";
import {
  CompanionImage,
  CompanionPortraitShell,
} from "@/components/CompanionImage";
import { CompanionStructuredResponseCards } from "@/components/companion/CompanionStructuredResponseCards";
import { DayPlanCard } from "@/components/companion/DayPlanCard";
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
import {
  type CompanionAssistantMessage,
  useCompanionAssistant,
} from "@/hooks/useCompanionAssistant";
import { usePlannerPathfinderAppearance } from "@/hooks/usePlannerPathfinderAppearance";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { getCompanionFrostedThemeStyle } from "@/lib/companionFrostedTheme";
import { shouldContainCompanionSceneImage } from "@/lib/companionImageFocal";
import { cn, stripMarkdown } from "@/lib/utils";
import {
  type CompanionLatencyTimer,
  finishCompanionLatencyTimer,
  startCompanionLatencyTimer,
} from "@/utils/companionLatencyMetrics";
import type { CompanionStructuredResponse } from "@/shared/companionStructuredOutput";
import type { CompanionChatThreadSummary } from "@/types/companionConversation";
import type { CompanionAgentFollowUp } from "@/types/companionAgent";
import type {
  CompanionPlannerLaunchIntent,
  PlannerBriefingContext,
} from "@/types/companionPlanner";

type JourneysCompanionPlannerModalPresentation = "dialog" | "drawer";

interface JourneysCompanionPlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
  selectedDate?: Date | null;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
}

type JourneysCompanionDrawerLayout = {
  shellHeight: number;
  bottomInset: number;
};

const MOBILE_DRAWER_HEIGHT_MIN_PX = 320;
const MOBILE_DRAWER_HEIGHT_MAX_PX = 736;
const MOBILE_DRAWER_HANDLE_SPACE_PX = 22;
const MOBILE_DRAWER_VIEWPORT_OFFSET_PX = 24;
const TRANSCRIPT_BOTTOM_THRESHOLD_PX = 96;
const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readSnapshotValue = (
  snapshot: Record<string, unknown> | null,
  key: string,
) => {
  const value = snapshot?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return null;
};

const getPlannerBriefingMetrics = (
  snapshot: Record<string, unknown> | null,
) =>
  [
    ["openQuestCount", "Open"],
    ["scheduledQuestCount", "Timed"],
    ["anytimeQuestCount", "Anytime"],
    ["ritualQuestCount", "Rituals"],
    ["activeCampaignCount", "Campaigns"],
    ["estimatedLoadLabel", "Load"],
  ]
    .map(([key, label]) => {
      const value = readSnapshotValue(snapshot, key);
      return value === null ? null : { key, label, value };
    })
    .filter(
      (metric): metric is { key: string; label: string; value: string | number } =>
        Boolean(metric),
    );

const PlannerBriefingContextPanel = memo(function PlannerBriefingContextPanel({
  briefing,
  companionLabel,
}: {
  briefing: PlannerBriefingContext;
  companionLabel: string;
}) {
  const snapshot = asRecord(briefing.dataSnapshot);
  const metrics = getPlannerBriefingMetrics(snapshot);
  const insightStatement =
    typeof snapshot?.plannerInsightStatement === "string"
      ? snapshot.plannerInsightStatement.trim()
      : null;

  return (
    <div
      className="flex w-full justify-start"
      data-testid="journeys-companion-planner-briefing"
    >
      <div className={cn(plannerPathfinderTheme.raisedPanel, "max-w-[92%] p-4")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={plannerPathfinderTheme.chip}>
            Planning with
          </Badge>
          {snapshot?.loadSignal ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium capitalize text-muted-foreground">
              {String(snapshot.loadSignal)} load
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm leading-6 text-foreground">
          {briefing.content}
        </p>
        {metrics.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div
                key={metric.key}
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/75">
                  {metric.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {metric.value}
                </p>
              </div>
            ))}
          </div>
        ) : null}
        {insightStatement ? (
          <figure className="mt-3 border-l-2 border-[hsl(var(--celestial-blue)_/_0.45)] pl-3 text-xs leading-5 text-muted-foreground">
            <blockquote>&quot;{insightStatement}&quot;</blockquote>
            <figcaption className="mt-1 text-[11px] font-medium text-muted-foreground/80">
              - {companionLabel}
            </figcaption>
          </figure>
        ) : null}
      </div>
    </div>
  );
});

const getFollowUpMetadataString = (
  followUp: CompanionAgentFollowUp | null | undefined,
  key: string,
) => {
  const value = followUp?.metadata?.[key];
  return typeof value === "string" ? value : null;
};

const getFollowUpKey = (
  followUp: CompanionAgentFollowUp | null | undefined,
) => {
  if (!followUp) return null;

  return [
    followUp.question.trim().toLowerCase(),
    getFollowUpMetadataString(followUp, "questionId") ?? "",
    getFollowUpMetadataString(followUp, "sourceStarterIntent") ?? "",
    getFollowUpMetadataString(followUp, "consentKind") ?? "",
    getFollowUpMetadataString(followUp, "sourceMessage") ?? "",
  ].join("::");
};

const hasRichStructuredResponse = (
  structuredResponse: CompanionStructuredResponse | null | undefined,
) =>
  Boolean(
    structuredResponse?.planDay ||
    structuredResponse?.weeklyPlan ||
    structuredResponse?.priorityOverview ||
    structuredResponse?.reflectionBridge ||
    structuredResponse?.comingUp ||
    structuredResponse?.campaignMomentum,
  );

const findStructuredResponseBubbleMessageId = (
  messages: CompanionAssistantMessage[],
  structuredResponse: CompanionStructuredResponse | null | undefined,
) => {
  if (!hasRichStructuredResponse(structuredResponse)) return null;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message.role === "assistant" &&
      !message.receipt &&
      hasRichStructuredResponse(message.structuredResponse)
    ) {
      return message.id;
    }
  }

  return null;
};

const getReducedMotionPreference = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getDrawerLayout = (): JourneysCompanionDrawerLayout => {
  if (typeof window === "undefined") {
    return {
      shellHeight: MOBILE_DRAWER_HEIGHT_MIN_PX,
      bottomInset: 0,
    };
  }

  const visualViewport = window.visualViewport;
  const viewportHeight = visualViewport?.height ?? window.innerHeight;
  const safeViewportHeight = Number.isFinite(viewportHeight)
    ? viewportHeight
    : window.innerHeight;
  const viewportOffsetTop =
    visualViewport && Number.isFinite(visualViewport.offsetTop)
      ? visualViewport.offsetTop
      : 0;
  const visibleViewportBottom = viewportOffsetTop + safeViewportHeight;
  const bottomInset = Math.max(0, window.innerHeight - visibleViewportBottom);
  const availableShellHeight = Math.max(
    0,
    safeViewportHeight -
      MOBILE_DRAWER_VIEWPORT_OFFSET_PX -
      MOBILE_DRAWER_HANDLE_SPACE_PX,
  );
  const boundedShellHeight = Math.min(
    MOBILE_DRAWER_HEIGHT_MAX_PX,
    availableShellHeight,
  );

  return {
    shellHeight: Math.max(
      Math.min(MOBILE_DRAWER_HEIGHT_MIN_PX, availableShellHeight),
      boundedShellHeight,
    ),
    bottomInset,
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

const JourneysCompanionThreadPicker = memo(
  function JourneysCompanionThreadPicker({
    open,
    onOpenChange,
    presentation,
    historyThreads,
    isLoading,
    canResumeThreads,
    emptyStateMessage,
    onResumeThread,
  }: JourneysCompanionThreadPickerProps) {
    const { themeModeClassName } = usePlannerPathfinderAppearance();
    const { favoriteColor } = useJourneysCompanionVisual();
    const companionFrostedThemeStyle = useMemo(
      () => getCompanionFrostedThemeStyle(favoriteColor),
      [favoriteColor],
    );
    const body = (
      <div
        className={cn(themeModeClassName, plannerPathfinderTheme.threadPickerShell)}
        data-testid="journeys-companion-thread-picker"
        style={companionFrostedThemeStyle}
      >
        <div className="mb-4 space-y-1">
          <p className="text-sm font-semibold text-foreground">Thread history</p>
          <p className="text-sm text-muted-foreground">
            Browse old conversations here and jump back in whenever you want.
          </p>
        </div>

        <div className="space-y-2">
          <p className={plannerPathfinderTheme.sectionEyebrow}>
            Past chats
          </p>
          {isLoading ? (
            <div
              className={cn(
                plannerPathfinderTheme.headerBar,
                "px-4 py-5 text-sm text-muted-foreground",
              )}
            >
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
                    "flex w-full items-start justify-between gap-3 rounded-[1.5rem] border px-4 py-4 text-left transition-colors shadow-[0_12px_30px_-26px_rgba(var(--primary-rgb),0.36),inset_0_1px_0_rgba(255,255,255,0.58)]",
                    canResumeThreads
                      ? "border-[hsl(var(--celestial-blue)_/_0.24)] bg-card/[0.72] hover:bg-card"
                      : "cursor-not-allowed border-[hsl(var(--celestial-blue)_/_0.16)] bg-card/40 opacity-70",
                  )}
                  onClick={() => {
                    void onResumeThread(thread.sessionId);
                  }}
                  disabled={!canResumeThreads}
                  data-testid={`journeys-companion-thread-resume-${thread.sessionId}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {thread.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {thread.previewText}
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground/80">
                      Updated {formatThreadTimestamp(thread.lastMessageAt)}
                    </p>
                  </div>
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-dashed border-[hsl(var(--celestial-blue)_/_0.28)] bg-card/50 px-4 py-5 text-sm text-muted-foreground">
              {emptyStateMessage}
            </div>
          )}
        </div>
      </div>
    );

    if (presentation === "dialog") {
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            className="max-w-lg border-none bg-transparent p-0 shadow-none"
            hideCloseButton
          >
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
  },
);

const JourneysCompanionOverlayBody = memo(
  ({
    presentation,
    open,
    selectedDate,
    launchIntent,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
    drawerLayout,
  }: {
    presentation: JourneysCompanionPlannerModalPresentation;
    open: boolean;
    selectedDate?: Date | null;
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
      favoriteColor,
    } = useJourneysCompanionVisual();
    const assistant = useCompanionAssistant({
      surface: "journeys",
      conversationEnabled: true,
      defaultSelectedDate: selectedDate ? format(selectedDate, "yyyy-MM-dd") : null,
      launchIntent: launchIntent ?? null,
      onLaunchIntentConsumed,
      onOpenCampaignBuilder,
    });
    const [plannerBriefing, setPlannerBriefing] =
      useState<PlannerBriefingContext | null>(() =>
        launchIntent?.briefingContext ?? null,
      );
    const { themeModeClassName } = usePlannerPathfinderAppearance();
    const visibleMessages = useMemo(
      () => assistant.messages.filter((entry) => !entry.isSeed),
      [assistant.messages],
    );
    const prefersReducedMotion = getReducedMotionPreference();
    const isDrawerPresentation = presentation === "drawer";

    const [isThreadPickerOpen, setIsThreadPickerOpen] = useState(false);
    const [pendingFollowUpOption, setPendingFollowUpOption] = useState<
      string | null
    >(null);
    const [handledLocalFollowUpKey, setHandledLocalFollowUpKey] = useState<
      string | null
    >(null);

    const composerRef = useRef<HTMLTextAreaElement | null>(null);
    const chatOpenTimerRef = useRef<CompanionLatencyTimer | null>(null);
    const transcriptScrollAreaRef = useRef<HTMLDivElement | null>(null);
    const transcriptInnerRef = useRef<HTMLDivElement | null>(null);
    const transcriptPinnedToBottomRef = useRef(true);
    const lastAutoScrolledThreadSessionIdRef = useRef<
      string | null | undefined
    >(undefined);
    const lastSeenComingUpResponseRef = useRef<
      CompanionStructuredResponse["comingUp"] | null | undefined
    >(undefined);
    const activeThreadSessionId = assistant.activeThread?.sessionId ?? null;
    const displayMessages = useMemo(() => {
      const structuredResponseBubbleMessageId =
        findStructuredResponseBubbleMessageId(
          visibleMessages,
          assistant.structuredResponse,
        );
      if (!structuredResponseBubbleMessageId) return visibleMessages;

      return visibleMessages.filter(
        (message) => message.id !== structuredResponseBubbleMessageId,
      );
    }, [assistant.structuredResponse, visibleMessages]);
    const activeFollowUpKey = useMemo(
      () => getFollowUpKey(assistant.activeFollowUp),
      [assistant.activeFollowUp],
    );

    useEffect(() => {
      if (open) {
        chatOpenTimerRef.current = startCompanionLatencyTimer(
          "companion_chat_composer_ready",
          {
            surface: "journeys",
            presentation,
          },
        );
        return;
      }

      chatOpenTimerRef.current = null;
    }, [open, presentation]);

    useEffect(() => {
      if (!open || !composerRef.current || !chatOpenTimerRef.current) return;

      finishCompanionLatencyTimer(chatOpenTimerRef.current, {
        surface: "journeys",
        presentation,
      });
      chatOpenTimerRef.current = null;
    });

    useEffect(() => {
      if (launchIntent?.briefingContext) {
        setPlannerBriefing(launchIntent.briefingContext);
      }
    }, [launchIntent?.briefingContext, launchIntent?.id]);

    useEffect(() => {
      if (!open) {
        setPlannerBriefing(null);
      }
    }, [open]);

    useEffect(() => {
      if (
        !launchIntent?.id ||
        launchIntent.starterIntent !== "thread_history"
      ) {
        return;
      }
      setIsThreadPickerOpen(true);
      onLaunchIntentConsumed?.(launchIntent.id);
    }, [launchIntent, onLaunchIntentConsumed]);

    useEffect(() => {
      if (!activeFollowUpKey) {
        setHandledLocalFollowUpKey(null);
      }
    }, [activeFollowUpKey]);

    const getTranscriptViewport = useCallback(
      () =>
        transcriptScrollAreaRef.current?.querySelector<HTMLElement>(
          "[data-radix-scroll-area-viewport]",
        ) ?? null,
      [],
    );

    const updateTranscriptPinnedState = useCallback(
      (transcriptViewport = getTranscriptViewport()) => {
        if (!transcriptViewport) {
          return transcriptPinnedToBottomRef.current;
        }

        const distanceFromBottom =
          transcriptViewport.scrollHeight -
          (transcriptViewport.scrollTop + transcriptViewport.clientHeight);
        const isPinnedToBottom =
          distanceFromBottom <= TRANSCRIPT_BOTTOM_THRESHOLD_PX;
        transcriptPinnedToBottomRef.current = isPinnedToBottom;
        return isPinnedToBottom;
      },
      [getTranscriptViewport],
    );

    const scrollTranscriptToBottom = useCallback(
      (behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth") => {
        const transcriptViewport = getTranscriptViewport();
        if (!transcriptViewport) {
          return;
        }

        const nextTop = Math.max(
          0,
          transcriptViewport.scrollHeight - transcriptViewport.clientHeight,
        );
        if (typeof transcriptViewport.scrollTo === "function") {
          transcriptViewport.scrollTo({ top: nextTop, behavior });
        } else {
          transcriptViewport.scrollTop = nextTop;
        }
        transcriptPinnedToBottomRef.current = true;
      },
      [getTranscriptViewport, prefersReducedMotion],
    );

    useEffect(() => {
      const transcriptViewport = getTranscriptViewport();
      if (!transcriptViewport) return;

      const handleScroll = () => {
        updateTranscriptPinnedState(transcriptViewport);
      };

      transcriptViewport.addEventListener("scroll", handleScroll, {
        passive: true,
      });
      updateTranscriptPinnedState(transcriptViewport);

      return () => {
        transcriptViewport.removeEventListener("scroll", handleScroll);
      };
    }, [getTranscriptViewport, updateTranscriptPinnedState]);

    useEffect(() => {
      const activeThreadChanged =
        lastAutoScrolledThreadSessionIdRef.current !== activeThreadSessionId;
      const comingUpResponse = assistant.structuredResponse?.comingUp ?? null;
      const comingUpResponseChanged =
        Boolean(comingUpResponse) &&
        lastSeenComingUpResponseRef.current !== comingUpResponse;
      lastSeenComingUpResponseRef.current = comingUpResponse;

      if (comingUpResponseChanged) {
        lastAutoScrolledThreadSessionIdRef.current = activeThreadSessionId;
        transcriptPinnedToBottomRef.current = false;
        return;
      }

      if (activeThreadChanged) {
        lastAutoScrolledThreadSessionIdRef.current = activeThreadSessionId;
        transcriptPinnedToBottomRef.current = true;
        scrollTranscriptToBottom("auto");
        return;
      }

      if (transcriptPinnedToBottomRef.current) {
        scrollTranscriptToBottom(prefersReducedMotion ? "auto" : "smooth");
      }
    }, [
      activeThreadSessionId,
      assistant.activeFollowUp,
      assistant.dayPlan,
      assistant.pendingAction,
      assistant.structuredResponse,
      drawerLayout?.bottomInset,
      drawerLayout?.shellHeight,
      displayMessages,
      prefersReducedMotion,
      scrollTranscriptToBottom,
    ]);

    useEffect(() => {
      if (typeof ResizeObserver === "undefined") return;
      const inner = transcriptInnerRef.current;
      const transcriptViewport = getTranscriptViewport();
      if (!inner || !transcriptViewport) return;

      const reanchorIfPinnedToBottom = () => {
        if (transcriptPinnedToBottomRef.current) {
          scrollTranscriptToBottom(prefersReducedMotion ? "auto" : "smooth");
        }
      };

      const observer = new ResizeObserver(() => {
        reanchorIfPinnedToBottom();
      });
      observer.observe(inner);
      return () => observer.disconnect();
    }, [getTranscriptViewport, prefersReducedMotion, scrollTranscriptToBottom]);

    const syncComposerHeight = useCallback(() => {
      const composer = composerRef.current;
      if (!composer) return;

      composer.style.height = "auto";
      const nextHeight = Math.max(72, Math.min(260, composer.scrollHeight));
      composer.style.height = `${nextHeight}px`;
      composer.style.overflowY =
        composer.scrollHeight > 260 ? "auto" : "hidden";
    }, []);

    useLayoutEffect(() => {
      syncComposerHeight();
    }, [assistant.draftInput, syncComposerHeight]);

    const handleComposerKeyDown = useCallback(
      (event: KeyboardEvent<HTMLTextAreaElement>) => {
        if (event.key !== "Enter" || event.shiftKey) return;
        event.preventDefault();
        assistant.submitTypedMessage();
      },
      [assistant],
    );

    const handleComposerSubmit = useCallback(() => {
      assistant.submitTypedMessage();
    }, [assistant]);

    const handleVoiceToggle = useCallback(() => {
      assistant.toggleRecording();
    }, [assistant]);

    const handleResumeThread = useCallback(
      async (sessionId: string) => {
        await assistant.resumeThread(sessionId);
        setIsThreadPickerOpen(false);
      },
      [assistant],
    );

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

    const localActionPending = Boolean(pendingFollowUpOption);

    const handleFollowUpOption = useCallback(
      async (option: string) => {
        if (localActionPending) return;

        setPendingFollowUpOption(option);
        try {
          await assistant.submitMessage(option, "text", {
            turnOrigin: "follow_up_option",
          });
        } finally {
          setPendingFollowUpOption(null);
        }
      },
      [assistant, localActionPending],
    );

    const assistantActionDisabled =
      assistant.isSubmitting ||
      assistant.isResolvingAction ||
      localActionPending;
    const sendDisabled =
      assistantActionDisabled || !assistant.draftInput.trim();
    const followUpOptions =
      assistant.activeFollowUp?.options?.filter(
        (option) => option.trim().length > 0,
      ) ?? [];
    const hasFollowUpPanel = Boolean(
      assistant.activeFollowUp &&
      !assistant.pendingAction &&
      activeFollowUpKey !== handledLocalFollowUpKey,
    );
    const micButtonLabel = assistant.isRecording
      ? "Stop voice reply"
      : "Start voice reply";
    const newChatTooltip =
      assistant.newChatDisabledReason ??
      (assistant.hasPersistedActiveThread
        ? "Archive this chat and start a new one."
        : "Start a fresh chat.");

    const usesGeneratedSceneAvatar = shouldContainCompanionSceneImage(imageUrl);
    const avatar = usesPortraitShell && !usesGeneratedSceneAvatar ? (
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
      <div
        className={cn(
          "h-12 w-12 overflow-hidden rounded-full border border-white/[0.15] shadow-[0_18px_32px_-26px_rgba(0,0,0,0.95)]",
          usesGeneratedSceneAvatar ? "bg-black" : "bg-white/10",
        )}
      >
        <CompanionImage
          src={imageUrl}
          alt={companionLabel}
          fit={usesGeneratedSceneAvatar ? "contain" : "cover"}
          element={element}
          focalX={focalX}
          focalY={focalY}
          className="rounded-full"
        />
      </div>
    );

    const statusText = assistant.isRecording
      ? "Listening..."
      : assistant.isSubmitting || assistant.isResolvingAction
        ? "Working..."
        : assistant.todayLabel;
    const plannerShellStyle =
      isDrawerPresentation && drawerLayout
        ? { height: `${drawerLayout.shellHeight}px` }
        : undefined;
    const companionFrostedThemeStyle = useMemo(
      () => getCompanionFrostedThemeStyle(favoriteColor),
      [favoriteColor],
    );

    return (
      <div
        className={cn(themeModeClassName, plannerPathfinderTheme.shell)}
        data-testid="journeys-companion-planner-modal"
        style={companionFrostedThemeStyle}
      >
        <div className={plannerPathfinderTheme.shellGloss} />
        <div className={plannerPathfinderTheme.shellGlow} />

        <div
          className={cn(
            plannerPathfinderTheme.shellBody,
            isDrawerPresentation
              ? "h-full"
              : "h-[min(82vh,46rem)] min-h-[32rem]",
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
                className="pointer-events-none absolute inset-[-18%] rounded-full bg-[radial-gradient(circle,hsl(var(--celestial-blue)_/_0.24),transparent_70%)] blur-lg"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {companionLabel}
              </p>
              <p className="truncate text-xs text-muted-foreground">{statusText}</p>
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
                        className={cn(
                          "h-10 w-10",
                          plannerPathfinderTheme.headerIconButton,
                        )}
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
                        className={cn(
                          "h-10 w-10",
                          plannerPathfinderTheme.headerIconButton,
                        )}
                        onClick={() => {
                          void handleArchiveAction();
                        }}
                        disabled={!assistant.canArchiveThread}
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
                    {assistant.archiveDisabledReason ??
                      "Archive this chat and browse past chats."}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>

          <div
            className={plannerPathfinderTheme.contentWell}
            data-testid="journeys-companion-planner-dialogue-screen"
            data-vaul-no-drag
          >
            <ScrollArea ref={transcriptScrollAreaRef} className="flex-1">
              <div
                ref={transcriptInnerRef}
                className="space-y-3 p-4 sm:p-5"
                style={{
                  paddingBottom:
                    "calc(1rem + var(--mentor-guidance-bottom-inset, 0px))",
                }}
                data-testid="journeys-companion-planner-transcript"
              >
                {plannerBriefing ? (
                  <PlannerBriefingContextPanel
                    briefing={plannerBriefing}
                    companionLabel={companionLabel}
                  />
                ) : null}

                {displayMessages.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex w-full",
                      entry.role === "assistant"
                        ? "justify-start"
                        : "justify-end",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] rounded-[1.7rem] border px-4 py-3 shadow-[0_14px_32px_-28px_rgba(var(--primary-rgb),0.44),inset_0_1px_0_rgba(255,255,255,0.6)] sm:max-w-[78%]",
                        entry.role === "assistant"
                          ? plannerPathfinderTheme.assistantBubble
                          : plannerPathfinderTheme.userBubble,
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6 sm:text-[0.95rem]">
                        {stripMarkdown(entry.content) || "\u00A0"}
                      </p>
                    </div>
                  </div>
                ))}

                {assistant.dayPlan ? (
                  <DayPlanCard
                    dayPlan={assistant.dayPlan}
                    committed={Boolean(assistant.committedDayPlanId)}
                    committing={assistant.committingDayPlan}
                    onCommit={() => {
                      void assistant.commitDayPlan();
                    }}
                  />
                ) : null}

                {!assistant.dayPlan ? (
                  <CompanionStructuredResponseCards
                    structuredResponse={assistant.structuredResponse}
                    variant="journeys"
                  />
                ) : null}

                {hasFollowUpPanel && assistant.activeFollowUp ? (
                  <div
                    className="flex w-full justify-start"
                    data-testid="journeys-companion-follow-up"
                    data-tutorial-avoid="true"
                  >
                    <div
                      className={cn(
                        plannerPathfinderTheme.raisedPanel,
                        "max-w-[88%] p-4",
                      )}
                    >
                      <Badge
                        variant="outline"
                        className={plannerPathfinderTheme.chip}
                      >
                        Follow-up
                      </Badge>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        {assistant.activeFollowUp.question}
                      </p>
                      {assistant.activeFollowUp.reason ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {assistant.activeFollowUp.reason}
                        </p>
                      ) : null}
                      {followUpOptions.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {followUpOptions.map((option) => (
                            <Button
                              key={option}
                              type="button"
                              size="sm"
                              variant="outline"
                              className={cn(
                                plannerPathfinderTheme.outlineButton,
                                "h-auto min-h-9 max-w-full whitespace-normal text-left leading-tight",
                              )}
                              onClick={() => handleFollowUpOption(option)}
                              disabled={assistantActionDisabled}
                              data-tour="companion-plan-day-follow-up-option"
                              data-tour-shape="rounded-rect"
                            >
                              {pendingFollowUpOption === option ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              {option}
                            </Button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {assistant.pendingAction ? (
                  <div
                    className="flex w-full justify-start"
                    data-testid="journeys-companion-pending-action"
                    data-tutorial-avoid="true"
                  >
                    <div
                      className={cn(
                        plannerPathfinderTheme.raisedPanel,
                        "max-w-[88%] p-4",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={plannerPathfinderTheme.chip}
                        >
                          Pending confirmation
                        </Badge>
                        {assistant.readyPendingActionCount > 1 ? (
                          <Badge
                            variant="outline"
                            className={plannerPathfinderTheme.chip}
                          >
                            {assistant.readyPendingActionCount} ready
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={plannerPathfinderTheme.chip}
                        >
                          {assistant.pendingAction.actionType.replace(
                            /_/g,
                            " ",
                          )}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        {assistant.pendingAction.summary}
                      </p>
                      {assistant.pendingAction.confirmationMessage ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {assistant.pendingAction.confirmationMessage}
                        </p>
                      ) : null}
                      {assistant.readyPendingActionCount > 1 ? (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {assistant.readyPendingActionCount} planner actions
                          are ready. Confirm all to save the batch, or confirm
                          them one at a time.
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {assistant.readyPendingActionCount > 1 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={plannerPathfinderTheme.outlineButton}
                            onClick={assistant.confirmAllPendingActions}
                            disabled={assistantActionDisabled}
                            data-tour="companion-plan-day-pending-confirm-all"
                            data-tour-shape="rounded-rect"
                          >
                            Confirm All ({assistant.readyPendingActionCount})
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          className={plannerPathfinderTheme.primaryButton}
                          onClick={assistant.confirmPendingAction}
                          disabled={assistantActionDisabled}
                          data-tour="companion-plan-day-pending-confirm"
                          data-tour-shape="rounded-rect"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Confirm
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className={plannerPathfinderTheme.outlineButton}
                          onClick={assistant.cancelPendingAction}
                          disabled={assistantActionDisabled}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </ScrollArea>

            <div
              className={cn(
                plannerPathfinderTheme.footerBar,
                "p-3",
                isDrawerPresentation &&
                  "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
              )}
              data-tutorial-avoid="true"
              data-testid="journeys-companion-planner-footer"
            >
              {assistant.isRecording || assistant.interimText ? (
                <div
                  className={cn(
                    plannerPathfinderTheme.raisedPanel,
                    "mb-3 px-3 py-3 text-foreground",
                  )}
                  data-testid="journeys-companion-planner-voice-preview"
                >
                  <AudioReactiveWaveform
                    isActive={
                      assistant.isRecording && !assistant.isAutoStopping
                    }
                    className="justify-start text-stardust-gold"
                  />
                  <p className="mt-2 text-sm text-foreground">
                    {assistant.interimText || "Listening for your reply..."}
                  </p>
                </div>
              ) : null}

              {assistant.isSpeaking ? (
                <div
                  className={cn(
                    plannerPathfinderTheme.successCard,
                    "mb-3 flex items-center justify-between gap-3 px-3 py-3",
                  )}
                  data-testid="journeys-companion-planner-speaking-status"
                >
                  <div className="flex items-center gap-2 text-sm text-epic-nature">
                    <Waves className="h-4 w-4" />
                    Speaking{" "}
                    {assistant.speechProvider === "cloud"
                      ? "with fallback audio"
                      : "on-device"}
                    .
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-epic-nature hover:bg-epic-nature/10 hover:text-epic-nature"
                    onClick={assistant.stopSpeaking}
                  >
                    Stop
                  </Button>
                </div>
              ) : null}

              <div
                className={cn(
                  plannerPathfinderTheme.composerBar,
                  "flex-col items-stretch gap-2",
                )}
                data-journeys-companion-composer
                data-vaul-no-drag
                data-tutorial-avoid="true"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onPointerMove={(event) => event.stopPropagation()}
                onPointerUp={(event) => {
                  event.stopPropagation();
                }}
              >
                <label
                  htmlFor="journeys-companion-chat-input"
                  className="sr-only"
                >
                  Message your companion
                </label>
                <Textarea
                  ref={composerRef}
                  id="journeys-companion-chat-input"
                  rows={2}
                  value={assistant.draftInput}
                  onChange={(event) =>
                    assistant.setDraftInput(event.target.value)
                  }
                  onKeyDown={handleComposerKeyDown}
                  placeholder={assistant.placeholder}
                  className={cn(
                    plannerPathfinderTheme.textField,
                    "min-h-[72px] max-h-[260px] w-full resize-none leading-5",
                  )}
                  style={{ height: "72px", overflowY: "hidden" }}
                  data-tour="companion-plan-day-chat-input"
                  data-tour-shape="rounded-rect"
                  data-testid="journeys-companion-planner-text-input"
                />
                <div className="flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-11 w-11 shrink-0 rounded-full border border-[hsl(var(--celestial-blue)_/_0.3)] bg-card/80 text-[hsl(var(--celestial-blue))] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)] hover:bg-card",
                      assistant.isRecording &&
                        "border-category-body/70 bg-[linear-gradient(180deg,hsl(var(--category-body)_/_0.34)_0%,hsl(var(--destructive)_/_0.22)_100%)] text-category-body",
                    )}
                    onClick={handleVoiceToggle}
                    disabled={
                      !assistant.isVoiceSupported && !assistant.isRecording
                    }
                    aria-label={micButtonLabel}
                    data-testid="journeys-companion-planner-mic-button"
                  >
                    <Mic className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    onClick={handleComposerSubmit}
                    disabled={sendDisabled}
                    className={cn(
                      plannerPathfinderTheme.primaryButton,
                      "h-11 shrink-0 px-4",
                    )}
                    data-tour="companion-plan-day-chat-send"
                    data-tour-shape="rounded-rect"
                    data-testid="journeys-companion-planner-send-button"
                  >
                    {assistant.isSubmitting || assistant.isResolvingAction ? (
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
  },
);

JourneysCompanionOverlayBody.displayName = "JourneysCompanionOverlayBody";

export const JourneysCompanionPlannerModal = memo(
  function JourneysCompanionPlannerModal({
    open,
    onOpenChange,
    presentation,
    selectedDate,
    launchIntent,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
  }: JourneysCompanionPlannerModalProps) {
    const [drawerLayout, setDrawerLayout] =
      useState<JourneysCompanionDrawerLayout>(() => getDrawerLayout());

    useEffect(() => {
      if (presentation !== "drawer" || !open) return;

      const syncLayout = () => {
        setDrawerLayout(getDrawerLayout());
      };

      syncLayout();
      window.addEventListener("resize", syncLayout);
      window.visualViewport?.addEventListener("resize", syncLayout);
      window.visualViewport?.addEventListener("scroll", syncLayout);

      return () => {
        window.removeEventListener("resize", syncLayout);
        window.visualViewport?.removeEventListener("resize", syncLayout);
        window.visualViewport?.removeEventListener("scroll", syncLayout);
      };
    }, [open, presentation]);

    const body = (
      <JourneysCompanionOverlayBody
        presentation={presentation}
        open={open}
        selectedDate={selectedDate}
        launchIntent={launchIntent}
        onLaunchIntentConsumed={onLaunchIntentConsumed}
        onOpenCampaignBuilder={onOpenCampaignBuilder}
        drawerLayout={presentation === "drawer" ? drawerLayout : undefined}
      />
    );

    if (presentation === "dialog") {
      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            className="max-w-4xl border-none bg-transparent p-0 shadow-none"
            hideCloseButton
          >
            <DialogHeader className="sr-only">
              <DialogTitle>Cosmiq companion</DialogTitle>
              <DialogDescription>
                Talk with Cosmiq about your day, schedule, and plans.
              </DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      );
    }

    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        repositionInputs={false}
        handleOnly
      >
        <DrawerContent
          className="max-h-none border-none bg-transparent p-0 shadow-none"
          style={{ bottom: `${drawerLayout.bottomInset}px` }}
          data-testid="journeys-companion-planner-drawer-content"
        >
          <DrawerHeader className="sr-only">
            <DrawerTitle>Cosmiq companion</DrawerTitle>
            <DrawerDescription>
              Talk with Cosmiq about your day, schedule, and plans.
            </DrawerDescription>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    );
  },
);
