import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Check,
  Loader2,
  MessageCircleHeart,
  Send,
  Sparkles,
  Swords,
  X,
} from "lucide-react";
import { CompanionImage, CompanionPortraitShell } from "@/components/CompanionImage";
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
import { useJourneysCompanionConversation } from "@/hooks/useJourneysCompanionConversation";
import { useJourneysCompanionVisual } from "@/hooks/useJourneysCompanionVisual";
import { useCompanionPlanner } from "@/hooks/useCompanionPlanner";
import { cn } from "@/lib/utils";
import type { CompanionPlannerProposal } from "@/types/companionPlanner";

type JourneysCompanionPlannerModalPresentation = "dialog" | "drawer";

interface JourneysCompanionPlannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presentation: JourneysCompanionPlannerModalPresentation;
}

const PROPOSAL_KIND_LABELS: Record<CompanionPlannerProposal["kind"], string> = {
  create_quest: "Quest",
  update_quest: "Quest edit",
  create_campaign: "Campaign",
  update_campaign: "Campaign edit",
  create_ritual: "Ritual",
  update_ritual: "Ritual edit",
  suggest_reminder: "Reminder",
};

const CompactProposalCard = memo(({
  proposal,
  onConfirm,
  onReject,
}: {
  proposal: CompanionPlannerProposal;
  onConfirm: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}) => (
  <div
    className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_18px_40px_-36px_rgba(0,0,0,0.95)]"
    data-testid={`journeys-companion-planner-proposal-${proposal.id}`}
  >
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className="border-sky-300/25 bg-sky-400/10 text-sky-50">
        {PROPOSAL_KIND_LABELS[proposal.kind]}
      </Badge>
      {!proposal.readyToConfirm ? (
        <Badge variant="outline" className="border-amber-300/25 bg-amber-400/10 text-amber-50">
          needs detail
        </Badge>
      ) : null}
    </div>

    <div className="mt-3 space-y-1.5">
      <h3 className="text-sm font-semibold text-white">{proposal.title}</h3>
      <p className="text-sm text-white/78">{proposal.summary}</p>
      {!proposal.readyToConfirm && proposal.missingFields?.length ? (
        <p className="text-xs text-white/55">
          Still waiting on: {proposal.missingFields.join(", ")}.
        </p>
      ) : null}
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        onClick={() => onConfirm(proposal.id)}
        disabled={!proposal.readyToConfirm}
      >
        <Check className="mr-2 h-4 w-4" />
        Confirm
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onReject(proposal.id)}
      >
        <X className="mr-2 h-4 w-4" />
        Reject
      </Button>
    </div>
  </div>
));

CompactProposalCard.displayName = "CompactProposalCard";

type OverlayMode = "chat" | "plan";

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

  const [mode, setMode] = useState<OverlayMode>("chat");
  const [showPlannerBridgeHint, setShowPlannerBridgeHint] = useState(false);
  const [plannerHandoffMessage, setPlannerHandoffMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!conversation.pendingPlannerHandoffMessage) return;

    const message = conversation.pendingPlannerHandoffMessage;
    setMode("plan");
    setShowPlannerBridgeHint(true);
    setPlannerHandoffMessage(message);
    conversation.clearPlannerHandoff();
    void planner.submitMessage(message, "text");
  }, [
    conversation.clearPlannerHandoff,
    conversation.pendingPlannerHandoffMessage,
    planner.submitMessage,
  ]);

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();

    if (mode === "plan") {
      planner.submitTypedMessage();
      return;
    }

    conversation.submitTypedMessage();
  }, [conversation, mode, planner]);

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

  const composerValue = mode === "plan" ? planner.draftInput : conversation.draftInput;
  const isSending = mode === "plan"
    ? planner.isSubmitting || planner.isClassifying
    : conversation.isSubmitting;
  const sendDisabled = isSending || !composerValue.trim();

  const transcriptEntries = [
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
  ];

  const portrait = usesPortraitShell ? (
    <CompanionPortraitShell
      src={imageUrl}
      element={element}
      className="h-40 w-40 overflow-hidden rounded-full border border-white/15 sm:h-48 sm:w-48"
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
    <div className="h-40 w-40 overflow-hidden rounded-full border border-white/15 bg-white/10 sm:h-48 sm:w-48">
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
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.12),transparent_34%),radial-gradient(circle_at_bottom,rgba(250,204,21,0.08),transparent_30%),linear-gradient(180deg,rgba(19,17,29,0.985),rgba(8,11,23,0.99))] text-white shadow-[0_32px_80px_-40px_rgba(0,0,0,0.85)]"
      data-testid="journeys-companion-planner-modal"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.22),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-16 h-32 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.18),transparent_72%)] blur-2xl" />

      <div className="relative flex max-h-[86dvh] min-h-[34rem] flex-col">
        <div className="px-5 pb-4 pt-5 sm:px-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              {portrait}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,rgba(125,211,252,0.24),transparent_68%)] blur-2xl"
              />
            </div>

            <div className="mt-4 space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/78">
                {mode === "plan" ? <Swords className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                {mode === "plan" ? "Quest planning" : "Companion chat"}
              </div>
              <h2 className="text-xl font-semibold text-white sm:text-2xl">{companionLabel}</h2>
              <p className="text-sm text-white/58">
                {mode === "plan"
                  ? "Natural chat kicked this into planning mode so nothing saves without your say-so."
                  : "A light RPG-style overlay for talking through quests, momentum, and whatever is on your mind."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6">
          <ScrollArea className="flex-1 pr-3" data-testid="journeys-companion-planner-transcript">
            <div className="space-y-4 pb-4">
              {transcriptEntries.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[92%] rounded-[22px] px-4 py-3 text-sm shadow-[0_20px_50px_-40px_rgba(0,0,0,0.92)]",
                    message.role === "assistant"
                      ? "bg-white/[0.08] text-white"
                      : "ml-auto bg-sky-400/15 text-sky-50",
                    message.source === "plan" && message.role === "assistant" && "border border-sky-300/15 bg-sky-400/10",
                  )}
                >
                  {message.source === "plan" && message.role === "assistant" ? (
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-100/75">
                      <MessageCircleHeart className="h-3.5 w-3.5" />
                      Planner reply
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
              ))}

              {showPlannerBridgeHint ? (
                <div
                  className="rounded-[20px] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50"
                  data-testid="journeys-companion-planner-handoff-banner"
                >
                  Switching to plan so your companion can turn that into confirmable changes.
                </div>
              ) : null}

              {mode === "plan" && planner.questions.length > 0 ? (
                <section
                  className="rounded-[22px] border border-amber-300/15 bg-amber-400/10 p-4"
                  data-testid="journeys-companion-planner-questions"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-50/80">
                    Still needed before save
                  </p>
                  <div className="mt-3 space-y-3">
                    {planner.questions.map((question) => (
                      <div key={question.id}>
                        <p className="text-sm font-medium text-white">{question.prompt}</p>
                        {question.options?.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {question.options.map((option) => (
                              <Badge
                                key={option}
                                variant="outline"
                                className="border-white/12 bg-white/[0.06] text-white/72"
                              >
                                {option}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {mode === "plan" && planner.pendingProposals.length > 0 ? (
                <section data-testid="journeys-companion-planner-proposals">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Pending changes</p>
                      <p className="text-xs text-white/52">Nothing saves until you confirm it.</p>
                    </div>
                    {planner.readyProposalCount > 1 ? (
                      <Button type="button" size="sm" variant="outline" onClick={planner.confirmAll}>
                        Confirm all
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    {planner.pendingProposals.map((proposal) => (
                      <CompactProposalCard
                        key={proposal.id}
                        proposal={proposal}
                        onConfirm={planner.confirmProposal}
                        onReject={planner.rejectProposal}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </ScrollArea>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <label htmlFor="journeys-companion-chat-input" className="sr-only">
              {mode === "plan" ? "Tell your companion what to plan" : "Chat with your companion"}
            </label>
            <Textarea
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
              placeholder={
                mode === "plan"
                  ? "Tell your companion what to turn into a quest, campaign, or schedule change..."
                  : "Talk to your companion like a real chat..."
              }
              className="min-h-[96px] resize-none border-white/10 bg-transparent text-white placeholder:text-white/35 focus-visible:ring-white/15"
              data-testid="journeys-companion-planner-text-input"
            />

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-white/48">
                {mode === "plan"
                  ? "Planner mode asks follow-ups and creates confirmable changes only."
                  : "Keep it simple. Natural language first, planning only when you ask for it."}
              </p>

              <Button
                type="button"
                onClick={() => {
                  if (mode === "plan") {
                    planner.submitTypedMessage();
                    return;
                  }

                  conversation.submitTypedMessage();
                }}
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
        <DialogContent className="max-w-2xl border-none bg-transparent p-0 shadow-none">
          <DialogHeader className="sr-only">
            <DialogTitle>Companion chat</DialogTitle>
            <DialogDescription>
              Chat with your companion and switch into planning only when the conversation calls for it.
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
            Chat with your companion and switch into planning only when the conversation calls for it.
          </DrawerDescription>
        </DrawerHeader>
        {content}
      </DrawerContent>
    </Drawer>
  );
});
