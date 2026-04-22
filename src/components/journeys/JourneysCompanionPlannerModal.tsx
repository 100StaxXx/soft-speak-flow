import {
  memo,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
} from "react";
import { Check, Loader2, Send, X } from "lucide-react";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useCompanionAssistant } from "@/hooks/useCompanionAssistant";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { cn, stripMarkdown } from "@/lib/utils";
import type { CompanionPlannerLaunchIntent } from "@/types/companionPlanner";

type JourneysCompanionPlannerModalPresentation = "dialog" | "drawer";

interface JourneysCompanionPlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
  assistant: ReturnType<typeof useCompanionAssistant>;
}

interface JourneysCompanionPlannerControllerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
  launchIntent?: CompanionPlannerLaunchIntent | null;
  onLaunchIntentConsumed?: (intentId: string) => void;
  onOpenCampaignBuilder?: (message: string) => void;
}

const JourneysCompanionPlannerBody = memo(({
  open,
  assistant,
}: {
  open: boolean;
  assistant: ReturnType<typeof useCompanionAssistant>;
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
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const focusComposer = useCallback(() => {
    window.requestAnimationFrame(() => {
      composerRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    focusComposer();
  }, [focusComposer, open]);

  useEffect(() => {
    if (typeof transcriptEndRef.current?.scrollIntoView === "function") {
      transcriptEndRef.current.scrollIntoView({ block: "end" });
    }
  }, [assistant.isSubmitting, assistant.messages, assistant.pendingAction]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    assistant.submitTypedMessage();
  }, [assistant]);

  const avatar = usesPortraitShell ? (
    <CompanionPortraitShell
      src={imageUrl}
      element={element}
      className="h-12 w-12 overflow-hidden rounded-full border border-white/15 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.85)]"
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
    <div className="h-12 w-12 overflow-hidden rounded-full border border-white/15 bg-white/10 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.85)]">
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

  return (
    <div
      className="flex h-[min(82vh,46rem)] min-h-[32rem] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_46%),linear-gradient(180deg,#22140d_0%,#160d08_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.42)]"
      data-testid="journeys-companion-planner-modal"
    >
      <div
        className="flex items-center gap-3 border-b border-white/10 bg-black/10 px-4 py-4 sm:px-5"
        data-testid="journeys-companion-planner-chat-header"
      >
        {avatar}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{companionLabel}</p>
          <p className="truncate text-xs text-white/60">
            {assistant.isSubmitting ? "Thinking..." : assistant.todayLabel}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(180deg,rgba(255,248,231,0.06),rgba(255,248,231,0.02))]">
        <ScrollArea className="flex-1">
          <div className="space-y-3 p-4 sm:p-5" data-testid="journeys-companion-planner-transcript">
            {assistant.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex w-full",
                  message.role === "assistant" ? "justify-start" : "justify-end",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-[1.5rem] border px-4 py-3 text-sm leading-6 shadow-[0_10px_24px_-18px_rgba(0,0,0,0.5)] sm:max-w-[78%]",
                    message.role === "user"
                      ? "border-[#6b3416] bg-[linear-gradient(180deg,#fff1d1_0%,#ffd27a_100%)] text-[#4a220c]"
                      : "border-white/12 bg-white/8 text-white",
                  )}
                  data-message-role={message.role}
                >
                  <p className="whitespace-pre-wrap">
                    {message.role === "assistant"
                      ? stripMarkdown(message.content) || "\u00A0"
                      : message.content || "\u00A0"}
                  </p>
                </div>
              </div>
            ))}

            {assistant.pendingAction ? (
              <div className="rounded-[1.5rem] border border-amber-300/25 bg-amber-400/10 p-4 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100/70">
                  Pending confirmation
                </p>
                <p className="mt-2 text-sm font-medium">
                  {assistant.pendingAction.summary}
                </p>
                {assistant.pendingAction.confirmationMessage ? (
                  <p className="mt-1 text-sm text-white/70">
                    {assistant.pendingAction.confirmationMessage}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={assistant.confirmPendingAction}
                    disabled={assistant.isSubmitting || assistant.isResolvingAction}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={assistant.cancelPendingAction}
                    disabled={assistant.isSubmitting || assistant.isResolvingAction}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {assistant.error ? (
              <div className="rounded-[1.5rem] border border-rose-300/25 bg-rose-500/10 p-4 text-white">
                <p className="text-sm">{assistant.error}</p>
                {assistant.lastFailedMessage ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={assistant.retryLastMessage}
                    disabled={assistant.isSubmitting || assistant.isResolvingAction}
                    className="mt-3"
                  >
                    Retry
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div ref={transcriptEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-white/10 bg-black/10 p-3 sm:p-4">
          <div className="flex items-end gap-3">
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
              placeholder={assistant.placeholder}
              className="min-h-[48px] flex-1 resize-none rounded-[1.3rem] border-white/12 bg-white/8 text-white placeholder:text-white/40"
              data-testid="journeys-companion-planner-text-input"
            />
            <Button
              type="button"
              onClick={assistant.submitTypedMessage}
              disabled={
                assistant.isSubmitting
                || assistant.isResolvingAction
                || !assistant.draftInput.trim()
              }
              className="h-12 rounded-full bg-[linear-gradient(180deg,#ffe2a7_0%,#ffbe4d_100%)] px-4 text-[#40210a] hover:brightness-105"
              data-testid="journeys-companion-planner-send-button"
            >
              {assistant.isSubmitting || assistant.isResolvingAction ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending
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
  );
});

JourneysCompanionPlannerBody.displayName = "JourneysCompanionPlannerBody";

export const JourneysCompanionPlannerModal = memo(function JourneysCompanionPlannerModal({
  open,
  onOpenChange,
  presentation,
  assistant,
}: JourneysCompanionPlannerModalProps) {
  const body = (
    <JourneysCompanionPlannerBody
      open={open}
      assistant={assistant}
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
    />
  );
});
