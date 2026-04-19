import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Mic,
  MicOff,
  Check,
  Loader2,
  Send,
  X,
} from "lucide-react";

import { AudioReactiveWaveform } from "@/components/AudioReactiveWaveform";
import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useCompanionAssistant } from "@/hooks/useCompanionAssistant";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { cn } from "@/lib/utils";
import { COMPANION_PLANNER_STARTER_TEMPLATES } from "@/shared/companionPlannerCopy";
import type {
  CompanionPlannerProposal,
  CompanionPlannerQuestion,
} from "@/types/companionPlanner";

type JourneysCompanionPlannerModalPresentation = "dialog" | "drawer";

interface JourneysCompanionPlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
}

type DialogueEntry = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

type PlannerQuestionHistoryEntry = {
  id: string;
  prompt: string;
  options: string[];
};

const STARTER_QUICK_REPLIES = [...COMPANION_PLANNER_STARTER_TEMPLATES];

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

const JourneysCompanionOverlayBody = memo(() => {
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
  });
  const prefersReducedMotion = getReducedMotionPreference();

  const [plannerQuestionHistory, setPlannerQuestionHistory] = useState<PlannerQuestionHistoryEntry[]>([]);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [typedAssistantContent, setTypedAssistantContent] = useState("");

  const typingIntervalRef = useRef<number | null>(null);
  const typingTargetRef = useRef<{ id: string; content: string } | null>(null);
  const animatedAssistantIdsRef = useRef<Set<string>>(new Set());
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (assistant.questions.length === 0) return;

    setPlannerQuestionHistory((previous) => {
      const knownIds = new Set(previous.map((entry) => entry.id));
      const nextEntries = assistant.questions
        .filter((question) => !knownIds.has(questionEntryId(question)))
        .map((question) => ({
          id: questionEntryId(question),
          prompt: question.prompt,
          options: question.options ?? [],
        }));

      return nextEntries.length > 0 ? [...previous, ...nextEntries] : previous;
    });
  }, [assistant.questions]);

  const dialogueEntries = useMemo<DialogueEntry[]>(() => [
    ...assistant.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
    })),
    ...plannerQuestionHistory.map((question) => ({
      id: question.id,
      role: "assistant" as const,
      content: question.prompt,
    })),
  ], [assistant.messages, plannerQuestionHistory]);

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
    animatedAssistantIdsRef.current.add(typingTarget.id);
    setTypingMessageId(null);
    setTypedAssistantContent(typingTarget.content);
    typingTargetRef.current = null;
    return true;
  }, [clearTypingTimer]);

  useEffect(() => () => {
    clearTypingTimer();
  }, [clearTypingTimer]);

  useEffect(() => {
    if (!latestAssistantEntry) return;

    if (prefersReducedMotion) {
      animatedAssistantIdsRef.current.add(latestAssistantEntry.id);
      setTypingMessageId(null);
      setTypedAssistantContent(latestAssistantEntry.content);
      typingTargetRef.current = null;
      clearTypingTimer();
      return;
    }

    if (animatedAssistantIdsRef.current.has(latestAssistantEntry.id)) {
      setTypingMessageId(null);
      setTypedAssistantContent(latestAssistantEntry.content);
      typingTargetRef.current = null;
      clearTypingTimer();
      return;
    }

    clearTypingTimer();
    typingTargetRef.current = {
      id: latestAssistantEntry.id,
      content: latestAssistantEntry.content,
    };
    setTypingMessageId(latestAssistantEntry.id);
    setTypedAssistantContent("");

    const characters = Array.from(latestAssistantEntry.content);
    const characterStep = Math.max(1, Math.ceil(characters.length / 24));
    let nextIndex = 0;

    typingIntervalRef.current = window.setInterval(() => {
      nextIndex = Math.min(characters.length, nextIndex + characterStep);
      setTypedAssistantContent(characters.slice(0, nextIndex).join(""));

      if (nextIndex >= characters.length) {
        completeCurrentAssistantLine();
      }
    }, 18);

    return () => {
      clearTypingTimer();
    };
  }, [
    clearTypingTimer,
    completeCurrentAssistantLine,
    latestAssistantEntry,
    prefersReducedMotion,
  ]);

  useEffect(() => {
    if (typeof transcriptEndRef.current?.scrollIntoView === "function") {
      transcriptEndRef.current.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth" });
    }
  }, [dialogueEntries, typedAssistantContent, prefersReducedMotion, assistant.questions, assistant.pendingProposals]);

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

    void assistant.submitPlannerMessage(starter, "text");
  }, [assistant, completeCurrentAssistantLine, typingMessageId]);

  const handleVoiceToggle = useCallback(() => {
    if (typingMessageId) {
      completeCurrentAssistantLine();
    }

    assistant.toggleRecording();
  }, [assistant, completeCurrentAssistantLine, typingMessageId]);

  const sendDisabled = assistant.isSubmitting || assistant.isClassifying || (!typingMessageId && !assistant.draftInput.trim());
  const activeProposal = assistant.pendingProposals[0] ?? null;
  const activeOptionQuestions = assistant.questions.filter((question) => (question.options?.length ?? 0) > 0);
  const showStarterQuickReplies = assistant.messages.length === 1
    && assistant.messages[0]?.role === "assistant"
    && plannerQuestionHistory.length === 0
    && assistant.pendingProposals.length === 0;
  const micButtonLabel = assistant.isRecording ? "Stop voice reply" : "Start voice reply";

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

  return (
    <div
      className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.16),transparent_26%),linear-gradient(180deg,rgba(8,15,28,0.82),rgba(6,12,24,0.66))] text-white shadow-[0_34px_90px_-46px_rgba(0,0,0,0.92)] backdrop-blur-2xl"
      data-testid="journeys-companion-planner-modal"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_18%,transparent_82%,rgba(255,255,255,0.04))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.14),transparent_62%)]" />

      <div className="relative flex h-[min(82vh,46rem)] min-h-[32rem] flex-col p-4 sm:p-5">
        <div
          className="flex items-center gap-3 rounded-[24px] border border-white/[0.12] bg-white/[0.04] px-4 py-3 backdrop-blur-2xl"
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
        </div>

        <div
          className={cn(
            "mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-white/[0.12] bg-white/[0.045] backdrop-blur-2xl shadow-[0_26px_70px_-48px_rgba(0,0,0,0.92)]",
            typingMessageId && "cursor-pointer",
          )}
          onClick={() => {
            if (typingMessageId) {
              completeCurrentAssistantLine();
            }
          }}
          data-testid="journeys-companion-planner-dialogue-screen"
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.02] px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-white/[0.45]">
            <span>Journeys Thread</span>
            <span>{dialogueEntries.length} messages</span>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-3 p-4 sm:p-5" data-testid="journeys-companion-planner-transcript">
              {dialogueEntries.map((entry) => {
                const displayedContent = entry.role === "assistant" && typingMessageId === entry.id
                  ? typedAssistantContent
                  : entry.content;

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
                        "max-w-[85%] rounded-[22px] border px-4 py-3 shadow-[0_24px_45px_-34px_rgba(0,0,0,0.72)] backdrop-blur-xl sm:max-w-[78%]",
                        entry.role === "assistant"
                          ? "rounded-bl-md border-white/[0.12] bg-white/[0.09] text-white/[0.92]"
                          : "rounded-br-md border-sky-100/[0.15] bg-sky-400/[0.26] text-white",
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
                    className="max-w-[88%] rounded-[24px] border border-white/[0.12] bg-white/[0.08] p-4 text-white shadow-[0_24px_45px_-34px_rgba(0,0,0,0.72)] backdrop-blur-xl"
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
                      <Badge variant="outline" className="border-white/[0.15] bg-white/[0.06] text-white/[0.7]">
                        {activeProposal.status}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="border-white/10 bg-white/[0.12] text-white hover:bg-white/[0.18]"
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
                        className="border-white/[0.15] bg-white/[0.04] text-white/[0.78] hover:bg-white/[0.08]"
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
                          className="border-white/[0.15] bg-white/[0.04] text-white/[0.78] hover:bg-white/[0.08]"
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
                  <div className="max-w-[92%] rounded-[24px] border border-white/[0.12] bg-white/[0.06] p-3 shadow-[0_24px_45px_-34px_rgba(0,0,0,0.72)] backdrop-blur-xl">
                    <div className="flex flex-wrap gap-2">
                      {showStarterQuickReplies
                        ? STARTER_QUICK_REPLIES.map((starter) => (
                            <Button
                              key={starter}
                              type="button"
                              size="sm"
                              variant="outline"
                              className="border-white/[0.12] bg-white/[0.08] text-white hover:bg-white/[0.14]"
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
                            className="border-white/[0.12] bg-white/[0.08] text-white hover:bg-white/[0.14]"
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

          <div className="border-t border-white/10 bg-white/[0.03] p-3 backdrop-blur-2xl">
            {assistant.isRecording || assistant.interimText ? (
              <div
                className="mb-3 rounded-[22px] border border-white/[0.12] bg-white/[0.06] px-3 py-3 text-white/80 shadow-[0_22px_40px_-34px_rgba(0,0,0,0.7)] backdrop-blur-xl"
                data-testid="journeys-companion-planner-voice-preview"
              >
                <AudioReactiveWaveform
                  isActive={assistant.isRecording && !assistant.isAutoStopping}
                  className="justify-start text-white/[0.7]"
                />
                <p className="mt-2 text-sm text-white/[0.78]">
                  {assistant.interimText || "Listening for your reply..."}
                </p>
              </div>
            ) : null}

            <div className="flex items-end gap-2 rounded-[24px] border border-white/[0.12] bg-black/10 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className={cn(
                  "h-11 w-11 shrink-0 rounded-full border border-white/[0.12] bg-white/[0.06] text-white hover:bg-white/[0.12]",
                  assistant.isRecording && "border-rose-300/[0.35] bg-rose-400/[0.16] text-rose-50",
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
                value={assistant.draftInput}
                onChange={(event) => {
                  assistant.setDraftInput(event.target.value);
                }}
                onKeyDown={handleComposerKeyDown}
                placeholder={assistant.placeholder}
                className="min-h-[82px] resize-none rounded-[22px] border-white/10 bg-white/[0.04] text-white placeholder:text-white/[0.38]"
                data-testid="journeys-companion-planner-text-input"
              />
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={sendDisabled}
                className="h-11 shrink-0 rounded-full border border-sky-100/10 bg-sky-400/[0.25] px-4 text-white hover:bg-sky-400/[0.35]"
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
    </div>
  );
});

JourneysCompanionOverlayBody.displayName = "JourneysCompanionOverlayBody";

export const JourneysCompanionPlannerModal = memo(function JourneysCompanionPlannerModal({
  open,
  onOpenChange,
  presentation,
}: JourneysCompanionPlannerModalProps) {
  const content = open ? <JourneysCompanionOverlayBody /> : null;

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
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="border-none bg-transparent p-0 shadow-none">
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
