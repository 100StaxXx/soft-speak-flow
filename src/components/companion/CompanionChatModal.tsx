import {
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import { CompanionStructuredResponseCards } from "@/components/companion/CompanionStructuredResponseCards";
import { PermissionRequestDialog } from "@/components/PermissionRequestDialog";
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
import { isCompanionSceneImageSource } from "@/lib/companionImageFocal";
import { cn, stripMarkdown } from "@/lib/utils";

interface CompanionChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layoutMode?: CompanionLayoutMode;
}

const getVisibleMessages = (messages: CompanionAssistantMessage[]) =>
  messages.filter((message) => !message.isSeed);

export const CompanionChatModal = memo(function CompanionChatModal({
  open,
  onOpenChange,
  layoutMode = "mobile",
}: CompanionChatModalProps) {
  const isDesktop = layoutMode === "desktop";
  const transcriptRef = useRef<HTMLDivElement | null>(null);
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
  const actionDisabled = assistant.isSubmitting || assistant.isResolvingAction;
  const sendDisabled = actionDisabled || !assistant.draftInput.trim();
  const statusText = assistant.isSubmitting
    ? "Thinking"
    : assistant.isResolvingAction
      ? "Updating"
      : assistant.isRecording
        ? "Listening"
        : assistant.isSpeaking
          ? "Speaking"
          : "Companion chat";
  const canUsePortraitShell =
    usesPortraitShell || isCompanionSceneImageSource(imageUrl);

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
    <Avatar className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white/[0.06]">
      {imageUrl ? (
        canUsePortraitShell ? (
          <CompanionPortraitShell
            src={imageUrl}
            element={element}
            className="h-full w-full rounded-2xl"
          >
            <CompanionImage
              variant="avatar"
              src={imageUrl}
              alt={companionLabel}
              fit="portrait"
              element={element}
              focalX={focalX}
              focalY={focalY}
              className="rounded-2xl"
            />
          </CompanionPortraitShell>
        ) : (
          <CompanionImage
            variant="avatar"
            src={imageUrl}
            alt={companionLabel}
            element={element}
            focalX={focalX}
            focalY={focalY}
            className="object-cover"
          />
        )
      ) : null}
      <AvatarFallback className="rounded-2xl bg-transparent text-sm font-semibold text-white/80">
        {companionLabel.charAt(0).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );

  const body = (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(10,12,24,0.96),rgba(15,20,38,0.94))] text-white shadow-[0_28px_80px_rgba(0,0,0,0.42)]",
        isDesktop ? "h-[min(80vh,44rem)]" : "h-[78dvh] rounded-b-none",
      )}
      data-testid="companion-chat-modal"
    >
      <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.04] p-4">
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">
            {companionLabel}
          </p>
          <p className="truncate text-xs text-white/58">{statusText}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-full border-white/12 bg-white/[0.06] text-white hover:bg-white/[0.12]"
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
            className="h-9 w-9 rounded-full border-white/12 bg-white/[0.06] text-white hover:bg-white/[0.12]"
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
        ref={transcriptRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
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
                  "max-w-[84%] rounded-2xl border px-4 py-3 text-sm leading-6 shadow-[0_18px_36px_-30px_rgba(0,0,0,0.6)]",
                  message.role === "assistant"
                    ? "border-white/10 bg-white/[0.07] text-white"
                    : "border-primary/25 bg-primary/18 text-white",
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
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"
              data-testid="companion-chat-follow-up"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100/70">
                Follow-up
              </p>
              <p className="mt-2 text-sm font-semibold">
                {assistant.activeFollowUp.question}
              </p>
              {assistant.activeFollowUp.reason ? (
                <p className="mt-1 text-sm text-white/68">
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
                      className="h-auto min-h-9 max-w-full whitespace-normal rounded-full border-white/14 bg-white/[0.06] text-left text-white hover:bg-white/[0.12]"
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
              className="rounded-2xl border border-primary/25 bg-primary/12 p-4"
              data-testid="companion-chat-pending-action"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">
                Pending confirmation
              </p>
              <p className="mt-2 text-sm font-semibold">
                {assistant.pendingAction.summary}
              </p>
              {assistant.pendingAction.confirmationMessage ? (
                <p className="mt-1 text-sm text-white/70">
                  {assistant.pendingAction.confirmationMessage}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
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
                  className="rounded-full border-white/14 bg-white/[0.06] text-white hover:bg-white/[0.12]"
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

      <div className="border-t border-white/10 bg-white/[0.04] p-3">
        {assistant.isRecording || assistant.interimText ? (
          <div
            className="mb-3 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3"
            data-testid="companion-chat-voice-preview"
          >
            <AudioReactiveWaveform
              isActive={assistant.isRecording && !assistant.isAutoStopping}
              className="justify-start text-primary"
            />
            <p className="mt-2 text-sm text-white/76">
              {assistant.interimText || "Listening for your reply..."}
            </p>
          </div>
        ) : null}

        {assistant.isSpeaking ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3">
            <div className="flex items-center gap-2 text-sm text-white/82">
              <Waves className="h-4 w-4" />
              Speaking
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-white hover:bg-white/[0.1]"
              onClick={assistant.stopSpeaking}
            >
              Stop
            </Button>
          </div>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="companion-chat-input" className="sr-only">
            Message your companion
          </label>
          <Textarea
            id="companion-chat-input"
            rows={2}
            value={assistant.draftInput}
            onChange={(event) => assistant.setDraftInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={assistant.placeholder}
            className="min-h-[70px] resize-none rounded-2xl border-white/12 bg-black/22 text-white placeholder:text-white/42 focus-visible:ring-primary"
            data-testid="companion-chat-text-input"
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className={cn(
                "h-11 w-11 rounded-full border-white/14 bg-white/[0.06] text-white hover:bg-white/[0.12]",
                assistant.isRecording && "border-primary/50 bg-primary/20",
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
              className="h-11 rounded-full px-4"
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
        <DialogContent className="max-w-2xl border-none bg-transparent p-0 shadow-none">
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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-none bg-transparent p-0 shadow-none">
        <DrawerHeader className="sr-only">
          <DrawerTitle>Companion chat</DrawerTitle>
          <DrawerDescription>Talk with your companion.</DrawerDescription>
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  );
});
