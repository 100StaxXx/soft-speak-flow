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
  Check,
  Loader2,
  Send,
  X,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useJourneysCompanionConversation } from "@/hooks/useJourneysCompanionConversation";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { useCompanionPlanner } from "@/hooks/useCompanionPlanner";
import { cn } from "@/lib/utils";
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

type OverlayMode = "chat" | "plan";

type DialogueEntry = {
  id: string;
  role: "assistant" | "user";
  content: string;
  source: "chat" | "plan" | "question";
};

type PlannerQuestionHistoryEntry = {
  id: string;
  prompt: string;
  options: string[];
};

const questionEntryId = (question: CompanionPlannerQuestion) => `planner-question-${question.id}`;

const proposalKindLabel = (proposal: CompanionPlannerProposal) => ({
  create_quest: "Quest",
  update_quest: "Quest edit",
  create_campaign: "Campaign",
  update_campaign: "Campaign edit",
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
  const conversation = useJourneysCompanionConversation();
  const planner = useCompanionPlanner({ bootstrapGreeting: false });
  const prefersReducedMotion = getReducedMotionPreference();

  const [mode, setMode] = useState<OverlayMode>("chat");
  const [plannerHandoffMessage, setPlannerHandoffMessage] = useState<string | null>(null);
  const [plannerQuestionHistory, setPlannerQuestionHistory] = useState<PlannerQuestionHistoryEntry[]>([]);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [typedAssistantContent, setTypedAssistantContent] = useState("");

  const typingIntervalRef = useRef<number | null>(null);
  const typingTargetRef = useRef<{ id: string; content: string } | null>(null);
  const animatedAssistantIdsRef = useRef<Set<string>>(new Set());
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!conversation.pendingPlannerHandoffMessage) return;

    const message = conversation.pendingPlannerHandoffMessage;
    setMode("plan");
    setPlannerHandoffMessage(message);
    conversation.clearPlannerHandoff();
    void planner.submitMessage(message, "text");
  }, [
    conversation.clearPlannerHandoff,
    conversation.pendingPlannerHandoffMessage,
    planner.submitMessage,
  ]);

  useEffect(() => {
    if (planner.questions.length === 0) return;

    setPlannerQuestionHistory((previous) => {
      const knownIds = new Set(previous.map((entry) => entry.id));
      const nextEntries = planner.questions
        .filter((question) => !knownIds.has(questionEntryId(question)))
        .map((question) => ({
          id: questionEntryId(question),
          prompt: question.prompt,
          options: question.options ?? [],
        }));

      return nextEntries.length > 0 ? [...previous, ...nextEntries] : previous;
    });
  }, [planner.questions]);

  const filteredPlannerMessages = useMemo(() => {
    let skippedHandoffEcho = false;

    return planner.messages.filter((message) => {
      if (
        plannerHandoffMessage
        && !skippedHandoffEcho
        && message.role === "user"
        && message.content === plannerHandoffMessage
      ) {
        skippedHandoffEcho = true;
        return false;
      }

      return true;
    });
  }, [planner.messages, plannerHandoffMessage]);

  const dialogueEntries = useMemo<DialogueEntry[]>(() => [
    ...conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      source: "chat" as const,
    })),
    ...filteredPlannerMessages.map((message) => ({
      id: message.id,
      role: message.role === "companion" ? "assistant" as const : "user" as const,
      content: message.content,
      source: "plan" as const,
    })),
    ...plannerQuestionHistory.map((question) => ({
      id: question.id,
      role: "assistant" as const,
      content: question.prompt,
      source: "question" as const,
    })),
  ], [conversation.messages, filteredPlannerMessages, plannerQuestionHistory]);

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
  }, [dialogueEntries, typedAssistantContent, prefersReducedMotion]);

  const handleSubmit = useCallback(() => {
    if (typingMessageId) {
      completeCurrentAssistantLine();
      return;
    }

    if (mode === "plan") {
      planner.submitTypedMessage();
      return;
    }

    conversation.submitTypedMessage();
  }, [
    completeCurrentAssistantLine,
    conversation,
    mode,
    planner,
    typingMessageId,
  ]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    handleSubmit();
  }, [handleSubmit]);

  const handleQuickReply = useCallback((option: string) => {
    if (typingMessageId) {
      completeCurrentAssistantLine();
      return;
    }

    void planner.submitMessage(option, "text");
  }, [completeCurrentAssistantLine, planner, typingMessageId]);

  const composerValue = mode === "plan" ? planner.draftInput : conversation.draftInput;
  const isSending = mode === "plan"
    ? planner.isSubmitting || planner.isClassifying
    : conversation.isSubmitting;
  const sendDisabled = isSending || (!typingMessageId && !composerValue.trim());

  const activeProposal = mode === "plan"
    ? planner.pendingProposals[0] ?? null
    : null;
  const activeOptionQuestions = mode === "plan"
    ? planner.questions.filter((question) => (question.options?.length ?? 0) > 0)
    : [];

  const portrait = usesPortraitShell ? (
    <CompanionPortraitShell
      src={imageUrl}
      element={element}
      className="h-24 w-24 overflow-hidden rounded-[18px] border border-[#e8d9aa]/35 shadow-[0_18px_32px_-26px_rgba(0,0,0,0.95)] sm:h-32 sm:w-32"
    >
      <CompanionImage
        src={imageUrl}
        alt={companionLabel}
        fit="portrait"
        element={element}
        focalX={focalX}
        focalY={focalY}
        className="rounded-[18px]"
      />
    </CompanionPortraitShell>
  ) : (
    <div className="h-24 w-24 overflow-hidden rounded-[18px] border border-[#e8d9aa]/35 bg-white/10 shadow-[0_18px_32px_-26px_rgba(0,0,0,0.95)] sm:h-32 sm:w-32">
      <CompanionImage
        src={imageUrl}
        alt={companionLabel}
        element={element}
        focalX={focalX}
        focalY={focalY}
        className="rounded-[18px]"
      />
    </div>
  );

  return (
    <div
      className="relative overflow-hidden rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.14),transparent_26%),linear-gradient(180deg,rgba(16,20,34,0.97),rgba(8,10,19,0.995))] text-white shadow-[0_34px_90px_-46px_rgba(0,0,0,0.92)]"
      data-testid="journeys-companion-planner-modal"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[radial-gradient(circle_at_top,rgba(250,204,21,0.16),transparent_38%)] sm:w-32" />

      <div className="grid min-h-[28rem] grid-cols-[96px_minmax(0,1fr)] gap-3 p-4 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-5 sm:p-5">
        <aside
          className="flex flex-col items-center justify-start gap-3 rounded-[20px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-2 py-4 sm:px-3"
          data-testid="journeys-companion-planner-portrait-rail"
        >
          <div className="relative">
            {portrait}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-[-12%] rounded-[24px] bg-[radial-gradient(circle,rgba(125,211,252,0.24),transparent_72%)] blur-xl"
            />
          </div>
          <div className="w-full rounded-[14px] border border-[#e8d9aa]/25 bg-[linear-gradient(180deg,rgba(255,243,209,0.18),rgba(232,217,170,0.08))] px-2 py-1.5 text-center shadow-[0_10px_24px_-18px_rgba(0,0,0,0.95)]">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f5e6b9] sm:text-[11px]">
              {companionLabel}
            </p>
          </div>
        </aside>

        <div className="flex min-h-0 flex-col">
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-[#8d7b57] bg-[linear-gradient(180deg,rgba(247,235,201,0.98),rgba(233,219,182,0.96))] shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)]",
              typingMessageId && "cursor-pointer",
            )}
            onClick={() => {
              if (typingMessageId) {
                completeCurrentAssistantLine();
              }
            }}
            data-testid="journeys-companion-planner-dialogue-screen"
          >
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
                        "border-b border-[#baa87f]/35 pb-3 last:border-b-0 last:pb-0",
                        entry.role === "user" && "ml-auto max-w-[88%] text-right",
                      )}
                    >
                      <p
                        className={cn(
                          "text-[10px] font-semibold uppercase tracking-[0.16em]",
                          entry.role === "assistant" ? "text-[#786041]" : "text-[#5c6f93]",
                        )}
                      >
                        {entry.role === "assistant" ? companionLabel : "You"}
                      </p>
                      <p
                        className={cn(
                          "mt-1 whitespace-pre-wrap text-sm leading-6 sm:text-[0.95rem]",
                          entry.role === "assistant" ? "text-[#2f2415]" : "text-[#26406b]",
                        )}
                      >
                        {displayedContent || "\u00A0"}
                      </p>
                    </div>
                  );
                })}
                <div ref={transcriptEndRef} />
              </div>
            </ScrollArea>
          </div>

          {activeOptionQuestions.length > 0 ? (
            <div
              className="mt-3 rounded-[18px] border border-[#8d7b57]/60 bg-[linear-gradient(180deg,rgba(247,235,201,0.92),rgba(233,219,182,0.9))] px-3 py-3 text-[#2f2415]"
              data-testid="journeys-companion-planner-inline-options"
            >
              <div className="space-y-3">
                {activeOptionQuestions.map((question) => (
                  <div key={question.id}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#6f5738]">
                      Quick reply
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {question.options?.map((option) => (
                        <Button
                          key={`${question.id}-${option}`}
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-[#a58d64] bg-[#f5e6c0] text-[#2f2415] hover:bg-[#f0ddb0]"
                          onClick={() => handleQuickReply(option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeProposal ? (
            <div
              className="mt-3 rounded-[18px] border border-[#8d7b57]/60 bg-[linear-gradient(180deg,rgba(247,235,201,0.92),rgba(233,219,182,0.9))] px-3 py-3 text-[#2f2415]"
              data-testid="journeys-companion-planner-inline-proposal"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#6f5738]">
                {proposalKindLabel(activeProposal)}
              </p>
              <p className="mt-1 text-sm font-semibold">{activeProposal.title}</p>
              <p className="mt-1 text-sm text-[#5d4a31]">{activeProposal.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => planner.confirmProposal(activeProposal.id)}
                  disabled={!activeProposal.readyToConfirm}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Confirm
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => planner.rejectProposal(activeProposal.id)}
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex items-center gap-2 rounded-[18px] border border-white/10 bg-black/20 p-2.5">
            <label htmlFor="journeys-companion-chat-input" className="sr-only">
              {mode === "plan" ? "Tell your companion what to plan" : "Chat with your companion"}
            </label>
            <Input
              id="journeys-companion-chat-input"
              value={composerValue}
              onChange={(event) => {
                if (mode === "plan") {
                  planner.setDraftInput(event.target.value);
                  return;
                }

                conversation.setDraftInput(event.target.value);
              }}
              onKeyDown={handleComposerKeyDown}
              placeholder={mode === "plan" ? "Answer or refine the plan..." : "Type your reply..."}
              className="h-11 border-white/10 bg-white/5 text-white placeholder:text-white/38"
              data-testid="journeys-companion-planner-text-input"
            />
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={sendDisabled}
              data-testid="journeys-companion-planner-send-button"
            >
              {isSending ? (
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
        <DialogContent className="max-w-4xl border-none bg-transparent p-0 shadow-none">
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
