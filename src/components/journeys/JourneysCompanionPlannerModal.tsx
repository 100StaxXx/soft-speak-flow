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
import { formatDistanceToNow } from "date-fns";
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
import type { CompanionChatThreadSummary } from "@/types/companionConversation";
import type {
  CompanionPlannerLaunchIntent,
  CompanionPlannerProposal,
} from "@/types/companionPlanner";

type JourneysCompanionPlannerModalPresentation = "dialog" | "drawer";

interface JourneysCompanionPlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
  onQuestProposalEditHandoff?: (
    proposal: CompanionPlannerProposal,
  ) => Promise<{ saved: boolean; savedTitle?: string | null }>;
}

type JourneysCompanionDrawerLayout = {
  shellHeight: number;
  keyboardInset: number;
};

const MOBILE_DRAWER_HEIGHT_MIN_PX = 320;
const MOBILE_DRAWER_HEIGHT_MAX_PX = 736;
const MOBILE_DRAWER_VIEWPORT_OFFSET_PX = 24;

const getReducedMotionPreference = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getDrawerLayout = (): JourneysCompanionDrawerLayout => {
  if (typeof window === "undefined") {
    return {
      shellHeight: MOBILE_DRAWER_HEIGHT_MIN_PX,
      keyboardInset: 0,
    };
  }

  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const safeViewportHeight = Number.isFinite(viewportHeight)
    ? viewportHeight
    : window.innerHeight;
  const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0;
  const keyboardInset = Math.max(
    0,
    window.innerHeight - (viewportOffsetTop + safeViewportHeight),
  );

  return {
    shellHeight: Math.max(
      MOBILE_DRAWER_HEIGHT_MIN_PX,
      Math.min(
        MOBILE_DRAWER_HEIGHT_MAX_PX,
        safeViewportHeight - MOBILE_DRAWER_VIEWPORT_OFFSET_PX,
      ),
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
          {isLoading
            ? (
              <div
                className={cn(
                  plannerPathfinderTheme.headerBar,
                  "px-4 py-5 text-sm text-white/[0.82]",
                )}
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading past chats...
              </div>
            )
            : historyThreads.length > 0
            ? (
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
                      <p className="truncate text-sm font-semibold text-white">
                        {thread.title}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-white/[0.68]">
                        {thread.previewText}
                      </p>
                      <p className="mt-3 text-xs text-white/[0.5]">
                        Updated {formatThreadTimestamp(thread.lastMessageAt)}
                      </p>
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-white/[0.48]" />
                  </button>
                ))}
              </div>
            )
            : (
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

  const [isThreadPickerOpen, setIsThreadPickerOpen] = useState(false);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const transcriptScrollAreaRef = useRef<HTMLDivElement | null>(null);
  const activeThreadSessionId = assistant.activeThread?.sessionId ?? null;

  useEffect(() => {
    if (!launchIntent?.id || launchIntent.starterIntent !== "thread_history") {
      return;
    }
    setIsThreadPickerOpen(true);
    onLaunchIntentConsumed?.(launchIntent.id);
  }, [launchIntent, onLaunchIntentConsumed]);

  const keepBottomContentVisible = useCallback(
    (behavior: ScrollBehavior = prefersReducedMotion ? "auto" : "smooth") => {
      const transcriptViewport = transcriptScrollAreaRef.current?.querySelector<
        HTMLElement
      >("[data-radix-scroll-area-viewport]");
      if (transcriptViewport) {
        const nextTop = Math.max(
          0,
          transcriptViewport.scrollHeight - transcriptViewport.clientHeight,
        );
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
    },
    [prefersReducedMotion],
  );

  useEffect(() => {
    keepBottomContentVisible("auto");
  }, [
    activeThreadSessionId,
    assistant.messages,
    assistant.pendingAction,
    keepBottomContentVisible,
  ]);

  const syncComposerHeight = useCallback(() => {
    const composer = composerRef.current;
    if (!composer) return;

    composer.style.height = "0px";
    const nextHeight = Math.max(72, Math.min(260, composer.scrollHeight));
    composer.style.height = `${nextHeight}px`;
    composer.style.overflowY = composer.scrollHeight > 260 ? "auto" : "hidden";
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

  const handleComposerFocus = useCallback(() => {
    keepBottomContentVisible("auto");
  }, [keepBottomContentVisible]);

  const handleVoiceToggle = useCallback(() => {
    assistant.toggleRecording();
  }, [assistant]);

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

  const sendDisabled = assistant.isSubmitting || assistant.isResolvingAction ||
    !assistant.draftInput.trim();
  const micButtonLabel = assistant.isRecording
    ? "Stop voice reply"
    : "Start voice reply";
  const newChatTooltip = assistant.newChatDisabledReason ??
    (assistant.hasPersistedActiveThread
      ? "Archive this chat and start a new one."
      : "Start a fresh chat.");

  const avatar = usesPortraitShell
    ? (
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
    )
    : (
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
    : assistant.isSubmitting || assistant.isResolvingAction
    ? "Working..."
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
            <p className="truncate text-sm font-semibold text-white">
              {companionLabel}
            </p>
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
                      {assistant.isLoadingThreads
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Archive className="h-4 w-4" />}
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
              className="space-y-3 p-4 sm:p-5"
              data-testid="journeys-companion-planner-transcript"
            >
              {assistant.messages.map((entry) => (
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
                      "max-w-[85%] rounded-[1.7rem] border-[3px] px-4 py-3 shadow-[0_8px_0_rgba(77,40,17,0.8),0_18px_34px_-28px_rgba(36,12,4,0.52)] sm:max-w-[78%]",
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

              <CompanionStructuredResponseCards
                structuredResponse={assistant.structuredResponse}
                variant="journeys"
                onConfirmSuggestion={assistant.confirmSuggestedQuest}
                savedProposalIds={assistant.savedSuggestionProposalIds}
                pendingProposalId={assistant.pendingSuggestionProposalId}
                actionDisabled={assistant.isSubmitting ||
                  assistant.isResolvingAction ||
                  Boolean(assistant.pendingAction)}
              />

              {assistant.pendingAction
                ? (
                  <div
                    className="flex w-full justify-start"
                    data-testid="journeys-companion-pending-action"
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
                        {assistant.readyPendingActionCount > 1
                          ? (
                            <Badge
                              variant="outline"
                              className={plannerPathfinderTheme.chip}
                            >
                              {assistant.readyPendingActionCount} ready
                            </Badge>
                          )
                          : null}
                        <Badge
                          variant="outline"
                          className={plannerPathfinderTheme.chip}
                        >
                          {assistant.pendingAction.actionType.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white">
                        {assistant.pendingAction.summary}
                      </p>
                      {assistant.pendingAction.confirmationMessage
                        ? (
                          <p className="mt-1 text-sm text-white/[0.72]">
                            {assistant.pendingAction.confirmationMessage}
                          </p>
                        )
                        : null}
                      {assistant.readyPendingActionCount > 1
                        ? (
                          <p className="mt-2 text-sm text-white/[0.72]">
                            {assistant.readyPendingActionCount}{" "}
                            planner actions are ready. Confirm all to save the
                            batch, or confirm them one at a time.
                          </p>
                        )
                        : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {assistant.readyPendingActionCount > 1
                          ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className={plannerPathfinderTheme.outlineButton}
                              onClick={assistant.confirmAllPendingActions}
                              disabled={assistant.isSubmitting ||
                                assistant.isResolvingAction}
                            >
                              Confirm All ({assistant.readyPendingActionCount})
                            </Button>
                          )
                          : null}
                        <Button
                          type="button"
                          size="sm"
                          className={plannerPathfinderTheme.primaryButton}
                          onClick={assistant.confirmPendingAction}
                          disabled={assistant.isSubmitting ||
                            assistant.isResolvingAction}
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
                          disabled={assistant.isSubmitting ||
                            assistant.isResolvingAction}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )
                : null}

              <div ref={transcriptEndRef} />
            </div>
          </ScrollArea>

          <div className={cn(plannerPathfinderTheme.footerBar, "p-3")}>
            {assistant.isRecording || assistant.interimText
              ? (
                <div
                  className={cn(
                    plannerPathfinderTheme.raisedPanel,
                    "mb-3 px-3 py-3 text-[#5d2a0f]",
                  )}
                  data-testid="journeys-companion-planner-voice-preview"
                >
                  <AudioReactiveWaveform
                    isActive={assistant.isRecording &&
                      !assistant.isAutoStopping}
                    className="justify-start text-[#b04b12]"
                  />
                  <p className="mt-2 text-sm text-[#5d2a0f]">
                    {assistant.interimText || "Listening for your reply..."}
                  </p>
                </div>
              )
              : null}

            {assistant.isSpeaking
              ? (
                <div
                  className={cn(
                    plannerPathfinderTheme.successCard,
                    "mb-3 flex items-center justify-between gap-3 px-3 py-3",
                  )}
                  data-testid="journeys-companion-planner-speaking-status"
                >
                  <div className="flex items-center gap-2 text-sm text-[#183304]">
                    <Waves className="h-4 w-4" />
                    Speaking {assistant.speechProvider === "cloud"
                      ? "with fallback audio"
                      : "on-device"}.
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
              )
              : null}

            <div
              className={cn(
                plannerPathfinderTheme.composerBar,
                "flex-col items-stretch gap-2",
              )}
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
                onChange={(event) => {
                  assistant.setDraftInput(event.target.value);
                }}
                onKeyDown={handleComposerKeyDown}
                onFocus={handleComposerFocus}
                placeholder={assistant.placeholder}
                className={cn(
                  plannerPathfinderTheme.textField,
                  "min-h-[72px] max-h-[260px] w-full resize-none leading-5",
                )}
                style={{ height: "72px", overflowY: "hidden" }}
                data-testid="journeys-companion-planner-text-input"
              />
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={cn(
                    "h-11 w-11 shrink-0 rounded-full border-[3px] border-[#4d2811] bg-white/65 text-[#7f3b12] hover:bg-white/80",
                    assistant.isRecording &&
                      "border-[#7f1616] bg-[linear-gradient(180deg,#ffb8a7_0%,#ff7a59_100%)] text-[#4c0f0f]",
                  )}
                  onClick={handleVoiceToggle}
                  disabled={!assistant.isVoiceSupported &&
                    !assistant.isRecording}
                  aria-label={micButtonLabel}
                  data-testid="journeys-companion-planner-mic-button"
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  onClick={assistant.submitTypedMessage}
                  disabled={sendDisabled}
                  className={cn(
                    plannerPathfinderTheme.primaryButton,
                    "h-11 shrink-0 px-4",
                  )}
                  data-testid="journeys-companion-planner-send-button"
                >
                  {assistant.isSubmitting || assistant.isResolvingAction
                    ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Thinking
                      </>
                    )
                    : (
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
});

JourneysCompanionOverlayBody.displayName = "JourneysCompanionOverlayBody";

export const JourneysCompanionPlannerModal = memo(
  function JourneysCompanionPlannerModal({
    open,
    onOpenChange,
    presentation,
    launchIntent,
    onLaunchIntentConsumed,
    onOpenCampaignBuilder,
  }: JourneysCompanionPlannerModalProps) {
    const [drawerLayout, setDrawerLayout] = useState<
      JourneysCompanionDrawerLayout
    >(() => getDrawerLayout());

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
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="border-none bg-transparent p-0 shadow-none">
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
