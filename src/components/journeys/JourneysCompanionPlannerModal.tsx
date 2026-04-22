import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import { formatDistanceToNow } from "date-fns";
import { Capacitor } from "@capacitor/core";
import { Archive, Check, ChevronRight, Loader2, Plus, Send, X } from "lucide-react";

import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
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
import { Textarea } from "@/components/ui/textarea";
import { useCompanionAssistant } from "@/hooks/useCompanionAssistant";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { cn, stripMarkdown } from "@/lib/utils";
import type { CompanionChatThreadSummary } from "@/types/companionConversation";
import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";

type JourneysCompanionPlannerModalPresentation = "dialog" | "drawer";

type JourneysCompanionDrawerLayout = {
  shellHeight: number;
  keyboardInset: number;
};

interface JourneysCompanionPlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
  assistant: ReturnType<typeof useCompanionAssistant>;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
}

interface JourneysCompanionPlannerControllerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
}

const MOBILE_DRAWER_HEIGHT_MIN_PX = 320;
const MOBILE_DRAWER_HEIGHT_MAX_PX = 736;
const MOBILE_DRAWER_VIEWPORT_OFFSET_PX = 24;

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

const speechBubbleClassName = {
  assistant: "border-[#6d3518] bg-[linear-gradient(180deg,#fffaf0_0%,#ffe4b1_100%)] text-[#5b2e13] shadow-[0_10px_0_rgba(109,53,24,0.88),0_18px_26px_rgba(76,34,12,0.22)]",
  user: "border-[#4f6716] bg-[linear-gradient(180deg,#d8ff6d_0%,#b0eb3e_100%)] text-[#243b07] shadow-[0_10px_0_rgba(79,103,22,0.92),0_18px_26px_rgba(52,75,13,0.22)]",
} as const;

function CompanionSpeechBubble({
  role,
  children,
  className,
}: {
  role: "assistant" | "user";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.9rem] border-[3px] px-5 py-4 text-[1.02rem] leading-8",
        speechBubbleClassName[role],
        className,
      )}
      data-message-role={role}
    >
      {children}
    </div>
  );
}

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
      className="rounded-[2rem] border-[4px] border-[#4d2811] bg-[radial-gradient(circle_at_top_left,rgba(255,244,205,0.24),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,153,62,0.22),transparent_32%),linear-gradient(180deg,#a13618_0%,#741d0d_66%,#541308_100%)] p-4 text-white shadow-[0_16px_0_#4d2811,0_34px_72px_-38px_rgba(46,14,6,0.8)]"
      data-testid="journeys-companion-thread-picker"
    >
      <div className="rounded-[1.7rem] border-[3px] border-[#5d3114] bg-[linear-gradient(180deg,rgba(255,246,226,0.2),rgba(255,198,91,0.16))] px-4 py-4 shadow-[0_8px_0_rgba(77,40,17,0.82)]">
        <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[#ffe0b5]">
          Thread History
        </p>
        <p className="mt-2 text-sm text-white/85">
          Browse old conversations and hop back into the one you want.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-[1.6rem] border-[3px] border-[#5d3114] bg-[linear-gradient(180deg,rgba(255,248,233,0.16),rgba(255,209,114,0.14))] px-4 py-5 text-sm shadow-[0_8px_0_rgba(77,40,17,0.82)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading past chats...
          </div>
        ) : historyThreads.length > 0 ? (
          historyThreads.map((thread) => (
            <button
              key={thread.sessionId}
              type="button"
              className={cn(
                "flex w-full items-start justify-between gap-3 rounded-[1.6rem] border-[3px] px-4 py-4 text-left shadow-[0_8px_0_rgba(77,40,17,0.82)] transition-transform hover:-translate-y-0.5",
                canResumeThreads
                  ? "border-[#5d3114] bg-[linear-gradient(180deg,#fffaf0_0%,#ffe4af_100%)] text-[#542b12]"
                  : "cursor-not-allowed border-[#5d3114] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.06))] text-white/70 opacity-80",
              )}
              onClick={() => {
                void onResumeThread(thread.sessionId);
              }}
              disabled={!canResumeThreads}
              data-testid={`journeys-companion-thread-resume-${thread.sessionId}`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{thread.title}</p>
                <p className="mt-1 line-clamp-2 text-sm opacity-80">{thread.previewText}</p>
                <p className="mt-3 text-xs opacity-65">
                  Updated {formatThreadTimestamp(thread.lastMessageAt)}
                </p>
              </div>
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 opacity-65" />
            </button>
          ))
        ) : (
          <div className="rounded-[1.6rem] border-[3px] border-dashed border-[#f4bc63] bg-[linear-gradient(180deg,rgba(255,250,240,0.12),rgba(255,199,99,0.08))] px-4 py-5 text-sm text-white/85 shadow-[0_8px_0_rgba(77,40,17,0.72)]">
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
            <DialogDescription>Browse archived journeys conversations.</DialogDescription>
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
          <DrawerDescription>Browse archived journeys conversations.</DrawerDescription>
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  );
});

const JourneysCompanionPlannerBody = memo(({
  open,
  presentation,
  assistant,
  launchIntent,
  onLaunchIntentConsumed,
}: {
  open: boolean;
  presentation: JourneysCompanionPlannerModalPresentation;
  assistant: ReturnType<typeof useCompanionAssistant>;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
}) => {
  const {
    companionLabel,
    imageUrl,
    focalX,
    focalY,
    element,
    usesPortraitShell,
  } = useJourneysCompanionVisual();
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptViewportRef = useRef<HTMLDivElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const handledThreadHistoryIntentRef = useRef<string | null>(null);
  const isDrawerPresentation = presentation === "drawer";
  const [drawerLayout, setDrawerLayout] = useState<JourneysCompanionDrawerLayout>(() => getDrawerLayout());
  const [isThreadPickerOpen, setIsThreadPickerOpen] = useState(false);

  const shouldAutoFocusComposer = useMemo(() => {
    if (typeof window === "undefined") return false;
    return !(Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios");
  }, []);

  const focusComposer = useCallback(() => {
    if (!shouldAutoFocusComposer) return;
    window.requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
  }, [shouldAutoFocusComposer]);

  const keepBottomContentVisible = useCallback(() => {
    const transcriptViewport = transcriptViewportRef.current;
    if (transcriptViewport) {
      transcriptViewport.scrollTop = transcriptViewport.scrollHeight;
      return;
    }

    transcriptEndRef.current?.scrollIntoView({ block: "end" });
  }, []);

  useEffect(() => {
    if (!open) {
      setIsThreadPickerOpen(false);
      return;
    }

    focusComposer();
  }, [focusComposer, open]);

  useEffect(() => {
    keepBottomContentVisible();
  }, [assistant.isSubmitting, assistant.messages, assistant.pendingAction, assistant.error, keepBottomContentVisible]);

  useEffect(() => {
    if (!isDrawerPresentation) return;

    const updateLayout = () => {
      setDrawerLayout(getDrawerLayout());
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.visualViewport?.addEventListener("resize", updateLayout);
    window.visualViewport?.addEventListener("scroll", updateLayout);

    return () => {
      window.removeEventListener("resize", updateLayout);
      window.visualViewport?.removeEventListener("resize", updateLayout);
      window.visualViewport?.removeEventListener("scroll", updateLayout);
    };
  }, [isDrawerPresentation]);

  useEffect(() => {
    if (!launchIntent?.id) return;
    if (launchIntent.starterIntent !== "thread_history") return;
    if (handledThreadHistoryIntentRef.current === launchIntent.id) return;

    handledThreadHistoryIntentRef.current = launchIntent.id;
    setIsThreadPickerOpen(true);
    onLaunchIntentConsumed?.(launchIntent.id);
  }, [launchIntent, onLaunchIntentConsumed]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    assistant.submitTypedMessage();
  }, [assistant]);

  const handleOpenThreadPicker = useCallback(async () => {
    if (assistant.canArchiveThread) {
      await assistant.archiveCurrentThread();
    }

    setIsThreadPickerOpen(true);
  }, [assistant]);

  const handleNewChat = useCallback(async () => {
    if (!assistant.canStartNewChat) return;
    await assistant.startNewChat();
  }, [assistant]);

  const handleResumeThread = useCallback(async (sessionId: string) => {
    await assistant.resumeThread(sessionId);
    setIsThreadPickerOpen(false);
  }, [assistant]);

  const avatar = usesPortraitShell ? (
    <CompanionPortraitShell
      src={imageUrl}
      element={element}
      className="h-14 w-14 overflow-hidden rounded-full border-[3px] border-[#5a2f14] shadow-[0_8px_0_rgba(90,47,20,0.82)]"
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
    <div className="h-14 w-14 overflow-hidden rounded-full border-[3px] border-[#5a2f14] bg-white/20 shadow-[0_8px_0_rgba(90,47,20,0.82)]">
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

  const planDay = assistant.structuredResponse?.planDay ?? null;
  const comingUp = assistant.structuredResponse?.comingUp ?? null;
  const shellStyle = isDrawerPresentation
    ? {
        height: `${drawerLayout.shellHeight}px`,
        paddingBottom: `${Math.max(16, drawerLayout.keyboardInset + 16)}px`,
      }
    : undefined;

  return (
    <>
      <div
        className="relative overflow-hidden rounded-[2.2rem] border-[4px] border-[#4d2811] bg-[radial-gradient(circle_at_top_left,rgba(255,245,207,0.24),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,147,41,0.22),transparent_28%),linear-gradient(180deg,#a33518_0%,#751e0d_66%,#541208_100%)] text-white shadow-[0_18px_0_#4d2811,0_34px_86px_-36px_rgba(44,12,4,0.72)]"
        data-testid="journeys-companion-planner-modal"
      >
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.14),transparent_14%,transparent_84%,rgba(74,18,9,0.14))]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,247,213,0.36),transparent_62%)]" />

        <div
          className={cn(
            "relative flex min-h-0 flex-col p-4 sm:p-5",
            isDrawerPresentation ? "h-full" : "h-[min(82vh,46rem)] min-h-[32rem]",
          )}
          style={shellStyle}
        >
          <div
            className="flex items-center gap-3 rounded-[1.9rem] border-[3px] border-[#5d3114] bg-[linear-gradient(180deg,rgba(244,186,140,0.78),rgba(194,106,63,0.82))] px-4 py-3 shadow-[0_10px_0_rgba(77,40,17,0.84)]"
            data-testid="journeys-companion-planner-chat-header"
          >
            {avatar}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[1.05rem] font-semibold text-white">{companionLabel}</p>
              <p className="truncate text-sm text-white/80">
                {assistant.isSubmitting ? "Thinking..." : assistant.todayLabel}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleNewChat();
                }}
                disabled={!assistant.canStartNewChat}
                className="inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] border-[3px] border-[#5d3114] bg-[linear-gradient(180deg,rgba(255,250,240,0.26),rgba(255,206,108,0.18))] text-white shadow-[0_6px_0_rgba(77,40,17,0.82)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Start a new chat"
                data-testid="journeys-companion-new-chat-button"
              >
                <Plus className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleOpenThreadPicker();
                }}
                className="inline-flex h-14 w-14 items-center justify-center rounded-[1.2rem] border-[3px] border-[#5d3114] bg-[linear-gradient(180deg,rgba(255,250,240,0.26),rgba(255,206,108,0.18))] text-white shadow-[0_6px_0_rgba(77,40,17,0.82)] transition-transform hover:-translate-y-0.5"
                aria-label="Open past chats"
                data-testid="journeys-companion-thread-history-button"
              >
                <Archive className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] border-[4px] border-[#5d3114] bg-[linear-gradient(180deg,#9c3d21_0%,#873119_100%)] shadow-[inset_0_3px_0_rgba(255,248,225,0.14)]">
            <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-[1.55rem] border-[3px] border-[#6d3518] bg-[linear-gradient(180deg,#9c4223_0%,#883119_100%)] m-4 mb-0 shadow-[inset_0_2px_0_rgba(255,238,196,0.1)]">
              <div
                ref={transcriptViewportRef}
                className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 [scrollbar-color:#2e314f_transparent] [scrollbar-width:thin]"
                data-testid="journeys-companion-planner-transcript"
              >
                <div className="space-y-5 pr-6">
                  {assistant.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn("flex w-full", message.role === "assistant" ? "justify-start" : "justify-end")}
                    >
                      <CompanionSpeechBubble
                        role={message.role}
                        className={cn("max-w-[88%] sm:max-w-[80%]", message.role === "assistant" ? "rounded-tl-[1.1rem]" : "rounded-tr-[1.1rem]")}
                      >
                        <p className="whitespace-pre-wrap">
                          {message.role === "assistant"
                            ? stripMarkdown(message.content) || "\u00A0"
                            : message.content || "\u00A0"}
                        </p>
                      </CompanionSpeechBubble>
                    </div>
                  ))}

                  {planDay ? (
                    <CompanionSpeechBubble role="assistant" className="max-w-[92%] rounded-tl-[1.1rem]" >
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[#99602c]">
                        Plan My Day
                      </p>
                      <p className="mt-2 whitespace-pre-wrap">{planDay.message}</p>
                      <p className="mt-3 text-sm font-medium text-[#7b4a20]">
                        Day status: {planDay.dayAssessment.replace(/_/g, " ")}
                      </p>
                      {planDay.suggestedQuests.length > 0 ? (
                        <div className="mt-4 space-y-3">
                          {planDay.suggestedQuests.map((quest) => (
                            <button
                              key={quest.suggestionId}
                              type="button"
                              onClick={() => {
                                if (!quest.proposalId) return;
                                void assistant.acceptSuggestedQuest(quest.proposalId);
                              }}
                              disabled={assistant.isSubmitting || assistant.isResolvingAction || !quest.proposalId}
                              className="w-full rounded-[1.35rem] border-[3px] border-[#6d3518] bg-[linear-gradient(180deg,#fff9ef_0%,#ffe2a6_100%)] px-4 py-4 text-left shadow-[0_8px_0_rgba(109,53,24,0.82)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-[#542b12]">{quest.title}</p>
                                  <p className="mt-1 text-sm text-[#7a4a21]">{quest.reason}</p>
                                </div>
                                <span className="rounded-full border-[2px] border-[#6d3518] bg-white/55 px-2 py-1 text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#8b4d1d]">
                                  {quest.type}
                                </span>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#8b5a2a]">
                                <span>{quest.estimatedDuration}</span>
                                <span>{quest.source}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-[#7a4a21]">
                          No strong quest suggestions right now without crowding the day.
                        </p>
                      )}
                    </CompanionSpeechBubble>
                  ) : null}

                  {comingUp ? (
                    <CompanionSpeechBubble role="assistant" className="max-w-[92%] rounded-tl-[1.1rem]">
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[#99602c]">
                        Coming Up
                      </p>
                      <p className="mt-2 whitespace-pre-wrap">{comingUp.message}</p>
                      {comingUp.nextEvent ? (
                        <div className="mt-4 rounded-[1.3rem] border-[3px] border-[#6d3518] bg-[linear-gradient(180deg,#fff8ec_0%,#ffe2a9_100%)] px-4 py-3 shadow-[0_6px_0_rgba(109,53,24,0.82)]">
                          <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-[#99602c]">
                            Next
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#542b12]">
                            {comingUp.nextEvent.title}
                          </p>
                          <p className="mt-1 text-sm text-[#7a4a21]">
                            {comingUp.nextEvent.label}
                          </p>
                        </div>
                      ) : null}
                      {comingUp.remainingToday.length > 0 ? (
                        <div className="mt-4 space-y-2">
                          {comingUp.remainingToday.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-[1.2rem] border-[3px] border-[#6d3518] bg-[linear-gradient(180deg,#fff9ef_0%,#ffe6b9_100%)] px-4 py-3 shadow-[0_6px_0_rgba(109,53,24,0.82)]"
                            >
                              <p className="text-sm font-semibold text-[#542b12]">{item.title}</p>
                              <p className="mt-1 text-sm text-[#7a4a21]">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-4 text-sm text-[#7a4a21]">
                          Nothing else is scheduled for the rest of today.
                        </p>
                      )}
                      <p className="mt-4 text-sm text-[#7a4a21]">
                        Tomorrow looks {comingUp.tomorrowSummary}.
                      </p>
                      {comingUp.missedItems.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {comingUp.missedItems.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-[1.2rem] border-[3px] border-[#7a5a15] bg-[linear-gradient(180deg,#fff0c9_0%,#ffd570_100%)] px-4 py-3 text-[#603f07] shadow-[0_6px_0_rgba(122,90,21,0.8)]"
                            >
                              <p className="text-sm font-semibold">{item.title}</p>
                              <p className="mt-1 text-sm opacity-85">{item.label}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </CompanionSpeechBubble>
                  ) : null}

                  {assistant.pendingAction ? (
                    <CompanionSpeechBubble role="assistant" className="max-w-[92%] rounded-tl-[1.1rem] border-[#8f6512] bg-[linear-gradient(180deg,#fff0cb_0%,#ffd874_100%)] text-[#5d3907] shadow-[0_10px_0_rgba(143,101,18,0.84),0_18px_26px_rgba(102,65,6,0.2)]">
                      <p className="text-[0.72rem] font-black uppercase tracking-[0.22em] text-[#856017]">
                        Pending Confirmation
                      </p>
                      <p className="mt-2 text-sm font-semibold">
                        {assistant.pendingAction.summary}
                      </p>
                      {assistant.pendingAction.confirmationMessage ? (
                        <p className="mt-2 text-sm opacity-85">
                          {assistant.pendingAction.confirmationMessage}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={assistant.confirmPendingAction}
                          disabled={assistant.isSubmitting || assistant.isResolvingAction}
                          className="rounded-full border-[3px] border-[#4f6716] bg-[linear-gradient(180deg,#d8ff6d_0%,#b0eb3e_100%)] px-5 text-[#243b07] shadow-[0_6px_0_rgba(79,103,22,0.92)] hover:brightness-105"
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Confirm
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={assistant.cancelPendingAction}
                          disabled={assistant.isSubmitting || assistant.isResolvingAction}
                          className="rounded-full border-[3px] border-[#6d3518] bg-[linear-gradient(180deg,#fff8ee_0%,#ffe2a6_100%)] px-5 text-[#5b2e13] shadow-[0_6px_0_rgba(109,53,24,0.82)] hover:bg-[linear-gradient(180deg,#fff8ee_0%,#ffe2a6_100%)]"
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </CompanionSpeechBubble>
                  ) : null}

                  {assistant.error ? (
                    <CompanionSpeechBubble role="assistant" className="max-w-[92%] rounded-tl-[1.1rem] border-[#8d2b1c] bg-[linear-gradient(180deg,#ffe7dd_0%,#ffbda2_100%)] text-[#6d1d12] shadow-[0_10px_0_rgba(141,43,28,0.82),0_18px_26px_rgba(109,29,18,0.18)]">
                      <p className="text-sm">{assistant.error}</p>
                      {assistant.lastFailedMessage ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={assistant.retryLastMessage}
                          disabled={assistant.isSubmitting || assistant.isResolvingAction}
                          className="mt-3 rounded-full border-[3px] border-[#8d2b1c] bg-[linear-gradient(180deg,#fff3ec_0%,#ffd0be_100%)] px-5 text-[#6d1d12] shadow-[0_6px_0_rgba(141,43,28,0.78)] hover:bg-[linear-gradient(180deg,#fff3ec_0%,#ffd0be_100%)]"
                        >
                          Retry
                        </Button>
                      ) : null}
                    </CompanionSpeechBubble>
                  ) : null}

                  <div ref={transcriptEndRef} />
                </div>
              </div>

              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-6 right-3 w-2 rounded-full bg-[#2c2748] shadow-[inset_0_2px_3px_rgba(255,255,255,0.08)]"
              >
                <div className="mt-14 h-24 rounded-full bg-[#34355d]" />
              </div>
            </div>

            <div className="p-4 pt-3 sm:p-5">
              <div className="flex items-end gap-3 rounded-[1.8rem] border-[3px] border-[#221d1f] bg-[#111114] px-4 py-3 shadow-[inset_0_2px_0_rgba(255,255,255,0.05)]">
                <label htmlFor="journeys-companion-chat-input" className="sr-only">
                  Message your companion
                </label>
                <Textarea
                  ref={composerRef}
                  id="journeys-companion-chat-input"
                  rows={1}
                  value={assistant.draftInput}
                  onChange={(event) => {
                    assistant.setDraftInput(event.target.value);
                  }}
                  onKeyDown={handleComposerKeyDown}
                  onFocus={keepBottomContentVisible}
                  placeholder={assistant.placeholder}
                  className="min-h-[52px] flex-1 resize-none border-none bg-transparent px-0 text-base text-white placeholder:text-white/45 focus-visible:ring-0"
                  data-testid="journeys-companion-planner-text-input"
                />
                <button
                  type="button"
                  onClick={assistant.submitTypedMessage}
                  disabled={assistant.isSubmitting || assistant.isResolvingAction || !assistant.draftInput.trim()}
                  className="inline-flex h-14 min-w-[5.25rem] items-center justify-center rounded-[1.3rem] border-[3px] border-[#5d3114] bg-[linear-gradient(180deg,#fffaf0_0%,#ffe2a6_100%)] px-4 text-[#5b2e13] shadow-[0_6px_0_rgba(77,40,17,0.82)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                  data-testid="journeys-companion-planner-send-button"
                >
                  {assistant.isSubmitting || assistant.isResolvingAction ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Send className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
    </>
  );
});

JourneysCompanionPlannerBody.displayName = "JourneysCompanionPlannerBody";

export const JourneysCompanionPlannerModal = memo(function JourneysCompanionPlannerModal({
  open,
  onOpenChange,
  presentation,
  assistant,
  launchIntent,
  onLaunchIntentConsumed,
}: JourneysCompanionPlannerModalProps) {
  const body = (
    <JourneysCompanionPlannerBody
      open={open}
      presentation={presentation}
      assistant={assistant}
      launchIntent={launchIntent}
      onLaunchIntentConsumed={onLaunchIntentConsumed}
    />
  );

  if (presentation === "dialog") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none" hideCloseButton>
          <DialogHeader className="sr-only">
            <DialogTitle>Cosmiq companion</DialogTitle>
            <DialogDescription>
              Talk with Cosmiq about your quests and day.
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
          <DrawerTitle>Cosmiq companion</DrawerTitle>
          <DrawerDescription>
            Talk with Cosmiq about your quests and day.
          </DrawerDescription>
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  );
});

export const JourneysCompanionPlannerController = memo(function JourneysCompanionPlannerController({
  open,
  onOpenChange,
  presentation,
  launchIntent,
  onLaunchIntentConsumed,
  onOpenCampaignBuilder,
}: JourneysCompanionPlannerControllerProps) {
  const assistant = useCompanionAssistant({
    surface: "journeys",
    conversationEnabled: true,
    launchIntent: launchIntent ?? null,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
  });

  return (
    <JourneysCompanionPlannerModal
      open={open}
      onOpenChange={onOpenChange}
      presentation={presentation}
      assistant={assistant}
      launchIntent={launchIntent}
      onLaunchIntentConsumed={onLaunchIntentConsumed}
    />
  );
});
