import {
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Archive,
  Check,
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
import { plannerPathfinderTheme } from "@/components/companion/plannerPathfinderTheme";
import { CompanionStructuredResponseCards } from "@/components/companion/CompanionStructuredResponseCards";
import { PermissionRequestDialog } from "@/components/PermissionRequestDialog";
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
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  type CompanionAssistantMessage,
  useCompanionAssistant,
} from "@/hooks/useCompanionAssistant";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { usePlannerPathfinderAppearance } from "@/hooks/usePlannerPathfinderAppearance";
import {
  isCompanionSceneImageSource,
  shouldContainCompanionSceneImage,
} from "@/lib/companionImageFocal";
import { cn, stripMarkdown } from "@/lib/utils";
import {
  type CompanionLatencyTimer,
  finishCompanionLatencyTimer,
  startCompanionLatencyTimer,
} from "@/utils/companionLatencyMetrics";

interface CompanionChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layoutMode?: CompanionLayoutMode;
}

type CompanionChatDrawerLayout = {
  shellHeight: number;
  bottomInset: number;
};

const MOBILE_CHAT_DRAWER_HEIGHT_RATIO = 0.78;
const MOBILE_CHAT_DRAWER_HEIGHT_MIN_PX = 320;
const MOBILE_CHAT_DRAWER_HANDLE_SPACE_PX = 22;
const MOBILE_CHAT_DRAWER_VIEWPORT_OFFSET_PX = 24;

const getVisibleMessages = (messages: CompanionAssistantMessage[]) =>
  messages.filter((message) => !message.isSeed);

const getCompanionChatDrawerLayout = (): CompanionChatDrawerLayout => {
  if (typeof window === "undefined") {
    return {
      shellHeight: MOBILE_CHAT_DRAWER_HEIGHT_MIN_PX,
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
  const defaultShellHeight = Math.round(
    window.innerHeight * MOBILE_CHAT_DRAWER_HEIGHT_RATIO,
  );
  const availableShellHeight = Math.max(
    0,
    safeViewportHeight -
      MOBILE_CHAT_DRAWER_VIEWPORT_OFFSET_PX -
      MOBILE_CHAT_DRAWER_HANDLE_SPACE_PX,
  );
  const targetShellHeight = Math.min(defaultShellHeight, availableShellHeight);

  return {
    shellHeight: Math.max(
      Math.min(MOBILE_CHAT_DRAWER_HEIGHT_MIN_PX, availableShellHeight),
      targetShellHeight,
    ),
    bottomInset,
  };
};

export const CompanionChatModal = memo(function CompanionChatModal({
  open,
  onOpenChange,
  layoutMode = "mobile",
}: CompanionChatModalProps) {
  const isDesktop = layoutMode === "desktop";
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const chatOpenTimerRef = useRef<CompanionLatencyTimer | null>(null);
  const [drawerLayout, setDrawerLayout] =
    useState<CompanionChatDrawerLayout>(() => getCompanionChatDrawerLayout());
  const { themeModeClassName } = usePlannerPathfinderAppearance();
  const {
    companionLabel,
    imageUrl,
    focalX,
    focalY,
    element,
    usesPortraitShell,
  } = useJourneysCompanionVisual();
  const assistant = useCompanionAssistant({
    surface: "companion",
    conversationEnabled: open,
  });

  const visibleMessages = useMemo(
    () => getVisibleMessages(assistant.messages),
    [assistant.messages],
  );
  const followUpOptions = assistant.activeFollowUp?.options ?? [];
  const actionDisabled =
    assistant.isOpeningThread ||
    assistant.isSubmitting ||
    assistant.isResolvingAction;
  const sendDisabled =
    !assistant.canSubmitMessage || !assistant.draftInput.trim();
  const statusText = assistant.isOpeningThread
    ? "Starting"
    : assistant.isSubmitting
    ? "Thinking"
    : assistant.isResolvingAction
      ? "Updating"
      : assistant.isRecording
        ? "Listening"
        : assistant.isSpeaking
          ? "Speaking"
          : "Companion chat";
  const usesGeneratedSceneAvatar = shouldContainCompanionSceneImage(imageUrl);
  const canUsePortraitShell =
    !usesGeneratedSceneAvatar && (usesPortraitShell || isCompanionSceneImageSource(imageUrl));

  useEffect(() => {
    if (open) {
      chatOpenTimerRef.current = startCompanionLatencyTimer(
        "companion_chat_composer_ready",
        {
          surface: "companion",
          presentation: isDesktop ? "dialog" : "drawer",
        },
      );
      return;
    }

    chatOpenTimerRef.current = null;
  }, [isDesktop, open]);

  useEffect(() => {
    if (!open || !composerRef.current || !chatOpenTimerRef.current) return;

    finishCompanionLatencyTimer(chatOpenTimerRef.current, {
      surface: "companion",
      presentation: isDesktop ? "dialog" : "drawer",
    });
    chatOpenTimerRef.current = null;
  });

  useEffect(() => {
    if (isDesktop || !open) return;

    const syncLayout = () => {
      setDrawerLayout(getCompanionChatDrawerLayout());
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
  }, [isDesktop, open]);

  useEffect(() => {
    if (!open) return;
    const transcript = transcriptRef.current;
    if (!transcript) return;
    transcript.scrollTop = transcript.scrollHeight;
  }, [
    assistant.activeFollowUp,
    assistant.isSubmitting,
    assistant.pendingAction,
    assistant.structuredResponse,
    open,
    visibleMessages.length,
  ]);

  const submitComposer = useCallback(() => {
    if (sendDisabled) return;
    void assistant.submitTypedMessage();
  }, [assistant, sendDisabled]);

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      submitComposer();
    },
    [submitComposer],
  );

  const handleFollowUpOption = useCallback(
    (option: string) => {
      void assistant.submitMessage(option, "text", {
        turnOrigin: "follow_up_option",
      });
    },
    [assistant],
  );

  const handleNewChat = useCallback(() => {
    void assistant.startNewChat();
  }, [assistant]);

  const handleArchive = useCallback(() => {
    void assistant.archiveCurrentThread();
  }, [assistant]);

  const avatar = (
    <Avatar
      className={cn(
        "relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/[0.15] shadow-[0_18px_32px_-26px_rgba(0,0,0,0.95)]",
        usesGeneratedSceneAvatar ? "bg-black" : "bg-white/10",
      )}
    >
      {imageUrl ? (
        canUsePortraitShell ? (
          <CompanionPortraitShell
            src={imageUrl}
            element={element}
            className="h-full w-full rounded-full"
          >
            <CompanionImage
              variant="avatar"
              src={imageUrl}
              alt={companionLabel}
              fit="portrait"
              element={element}
              focalX={focalX}
              focalY={focalY}
              className="rounded-full"
            />
          </CompanionPortraitShell>
        ) : usesGeneratedSceneAvatar ? (
          <CompanionImage
            src={imageUrl}
            alt={companionLabel}
            fit="contain"
            element={element}
            focalX={focalX}
            focalY={focalY}
            className="absolute inset-0 z-10 rounded-full"
          />
        ) : (
          <CompanionImage
            variant="avatar"
            src={imageUrl}
            alt={companionLabel}
            fit={usesGeneratedSceneAvatar ? "contain" : "cover"}
            element={element}
            focalX={focalX}
            focalY={focalY}
            className="rounded-full"
          />
        )
      ) : null}
      <AvatarFallback
        className={cn(
          "rounded-full bg-card/80 text-sm font-semibold text-foreground",
          imageUrl && usesGeneratedSceneAvatar && "absolute inset-0 z-0",
        )}
      >
        {companionLabel.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );

  const mobileShellStyle = isDesktop
    ? undefined
    : { height: `${drawerLayout.shellHeight}px` };

  const body = (
    <div
      className={cn(
        themeModeClassName,
        plannerPathfinderTheme.shell,
        isDesktop ? "h-[min(80vh,44rem)]" : "rounded-b-none",
      )}
      style={mobileShellStyle}
      data-testid="companion-chat-modal"
    >
      <div className={plannerPathfinderTheme.shellGloss} />
      <div className={plannerPathfinderTheme.shellGlow} />

      <div
        className={cn(plannerPathfinderTheme.shellBody, "h-full")}
        data-testid="companion-chat-shell"
      >
        <div
          className={plannerPathfinderTheme.headerBar}
          data-testid="companion-chat-header"
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className={cn("h-10 w-10", plannerPathfinderTheme.headerIconButton)}
              onClick={handleNewChat}
              disabled={!assistant.canStartNewChat}
              aria-label="New chat"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className={cn("h-10 w-10", plannerPathfinderTheme.headerIconButton)}
              onClick={handleArchive}
              disabled={!assistant.canArchiveThread}
              aria-label="Archive chat"
            >
              {assistant.isLoadingThreads ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <div
          className={plannerPathfinderTheme.contentWell}
          data-vaul-no-drag
          data-testid="companion-chat-dialogue-screen"
        >
          <div
            ref={transcriptRef}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5"
            data-testid="companion-chat-transcript"
          >
            <div className="space-y-3">
              {visibleMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex w-full",
                    message.role === "assistant" ? "justify-start" : "justify-end",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-[1.7rem] border px-4 py-3 text-sm leading-6 shadow-[0_14px_32px_-28px_rgba(28,87,135,0.44),inset_0_1px_0_rgba(255,255,255,0.6)] sm:max-w-[78%]",
                      message.role === "assistant"
                        ? plannerPathfinderTheme.assistantBubble
                        : plannerPathfinderTheme.userBubble,
                    )}
                  >
                    <p className="whitespace-pre-wrap">
                      {stripMarkdown(message.content) || "\u00A0"}
                    </p>
                  </div>
                </div>
              ))}

              <CompanionStructuredResponseCards
                structuredResponse={assistant.structuredResponse}
                variant="companion"
                onConfirmSuggestion={assistant.confirmSuggestedQuest}
                savedProposalIds={assistant.savedSuggestionProposalIds}
                pendingProposalId={assistant.pendingSuggestionProposalId}
                actionDisabled={actionDisabled || Boolean(assistant.pendingAction)}
              />

              {assistant.activeFollowUp ? (
                <div
                  className={cn(plannerPathfinderTheme.raisedPanel, "max-w-[88%] p-4")}
                  data-testid="companion-chat-follow-up"
                >
                  <Badge variant="outline" className={plannerPathfinderTheme.chip}>
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
                          disabled={actionDisabled}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {assistant.pendingAction ? (
                <div
                  className={cn(plannerPathfinderTheme.raisedPanel, "max-w-[88%] p-4")}
                  data-testid="companion-chat-pending-action"
                >
                  <Badge variant="outline" className={plannerPathfinderTheme.chip}>
                    Pending confirmation
                  </Badge>
                  <p className="mt-3 text-sm font-semibold text-foreground">
                    {assistant.pendingAction.summary}
                  </p>
                  {assistant.pendingAction.confirmationMessage ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {assistant.pendingAction.confirmationMessage}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className={plannerPathfinderTheme.primaryButton}
                      onClick={assistant.confirmPendingAction}
                      disabled={actionDisabled}
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
                      disabled={actionDisabled}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              plannerPathfinderTheme.footerBar,
              "p-3",
              !isDesktop &&
                "pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
            )}
            data-testid="companion-chat-footer"
          >
            {assistant.isRecording || assistant.interimText ? (
              <div
                className={cn(
                  plannerPathfinderTheme.raisedPanel,
                  "mb-3 px-3 py-3 text-foreground",
                )}
                data-testid="companion-chat-voice-preview"
              >
                <AudioReactiveWaveform
                  isActive={assistant.isRecording && !assistant.isAutoStopping}
                  className="justify-start text-[hsl(var(--celestial-blue))]"
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
              >
                <div className="flex items-center gap-2 text-sm text-epic-nature">
                  <Waves className="h-4 w-4" />
                  Speaking
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
              data-companion-chat-composer
              data-vaul-no-drag
            >
              <label htmlFor="companion-chat-input" className="sr-only">
                Message your companion
              </label>
              <Textarea
                ref={composerRef}
                id="companion-chat-input"
                rows={2}
                value={assistant.draftInput}
                onChange={(event) => assistant.setDraftInput(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={assistant.placeholder}
                className={cn(
                  plannerPathfinderTheme.textField,
                  "min-h-[72px] w-full resize-none leading-5",
                )}
                data-testid="companion-chat-text-input"
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
                  onClick={assistant.toggleRecording}
                  disabled={!assistant.isVoiceSupported && !assistant.isRecording}
                  aria-label={assistant.isRecording ? "Stop voice input" : "Start voice input"}
                >
                  <Mic className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  onClick={submitComposer}
                  disabled={sendDisabled}
                  className={cn(plannerPathfinderTheme.primaryButton, "h-11 shrink-0 px-4")}
                  data-testid="companion-chat-send-button"
                >
                  {actionDisabled ? (
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
    </div>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-2xl border-none bg-transparent p-0 shadow-none"
          hideCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Companion chat</DialogTitle>
            <DialogDescription>
              Talk with your companion.
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
        data-testid="companion-chat-drawer-content"
      >
        <DrawerHeader className="sr-only">
          <DrawerTitle>Companion chat</DrawerTitle>
          <DrawerDescription>Talk with your companion.</DrawerDescription>
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  );
});
