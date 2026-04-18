import { memo, useCallback, type KeyboardEvent } from "react";
import {
  Check,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
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
import { Textarea } from "@/components/ui/textarea";
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
    className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4 shadow-[0_18px_36px_rgba(0,0,0,0.16)]"
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

export const JourneysCompanionPlannerModal = memo(function JourneysCompanionPlannerModal({
  open,
  onOpenChange,
  presentation,
}: JourneysCompanionPlannerModalProps) {
  const {
    companionLabel,
    imageUrl,
    focalX,
    focalY,
    element,
    usesPortraitShell,
  } = useJourneysCompanionVisual();
  const {
    greeting,
    messages,
    questions,
    pendingProposals,
    readyProposalCount,
    draftInput,
    setDraftInput,
    interimText,
    isSubmitting,
    isClassifying,
    isRecording,
    isAutoStopping,
    isVoiceSupported,
    permissionStatus,
    showPermissionDialog,
    setShowPermissionDialog,
    isRequestingPermission,
    submitTypedMessage,
    toggleRecording,
    requestMicrophonePermission,
    confirmProposal,
    rejectProposal,
    confirmAll,
  } = useCompanionPlanner();

  const hasUserTurns = messages.some((message) => message.role === "user");
  const latestCompanionReply = [...messages].reverse().find((message) => message.role === "companion");

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    submitTypedMessage();
  }, [submitTypedMessage]);

  const portrait = usesPortraitShell ? (
    <CompanionPortraitShell
      src={imageUrl}
      element={element}
      className="h-14 w-14 overflow-hidden rounded-full"
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
    <div className="h-14 w-14 overflow-hidden rounded-full bg-white/10">
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

  const body = (
    <div
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.08),transparent_28%),linear-gradient(180deg,rgba(19,17,29,0.985),rgba(13,11,22,0.99))] text-white shadow-[0_28px_80px_-42px_rgba(0,0,0,0.7)]"
      data-testid="journeys-companion-planner-modal"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.14),transparent_62%)]" />

      <div className="relative flex max-h-[82dvh] flex-col">
        <div className="border-b border-white/10 px-4 pb-4 pt-5 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              {portrait}
              <span className="pointer-events-none absolute inset-0 rounded-full bg-celestial-blue/20 blur-xl" aria-hidden="true" />
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/72">
                <Sparkles className="h-3.5 w-3.5" />
                Companion planner
              </div>
              <h2 className="truncate text-base font-semibold text-white sm:text-lg">{companionLabel}</h2>
              <p className="text-sm text-white/62">
                Text directly or use the mic and I&apos;ll turn it into a planner reply with confirmable changes.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto px-4 pb-4 pt-4 sm:px-5">
          <div className="space-y-4">
            <section className="rounded-[26px] border border-white/10 bg-white/[0.05] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="rounded-[22px] border border-sky-300/15 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.18),transparent_68%),linear-gradient(180deg,rgba(125,211,252,0.1),rgba(15,23,42,0.18))] px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100/75">
                  Backlit opener
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white">{greeting}</p>
              </div>

              <div className="mt-3 rounded-[22px] border border-white/8 bg-black/20 p-3">
                <label htmlFor="journeys-companion-planner-input" className="sr-only">
                  Message your companion planner
                </label>
                <Textarea
                  id="journeys-companion-planner-input"
                  value={draftInput}
                  onChange={(event) => setDraftInput(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Text your companion directly about the quest, routine, or plan you want help shaping..."
                  className="min-h-[112px] resize-none border-white/10 bg-transparent text-white placeholder:text-white/35 focus-visible:ring-white/15"
                  data-testid="journeys-companion-planner-text-input"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={toggleRecording}
                      disabled={!isVoiceSupported && !isRecording}
                      className={cn(
                        "h-10 w-10 rounded-full border-white/12 bg-white/[0.05] text-white hover:bg-white/[0.09]",
                        isRecording && "border-rose-300/28 bg-rose-400/12 text-rose-50",
                      )}
                      data-testid="journeys-companion-planner-mic-button"
                    >
                      {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>

                    {isRecording || interimText ? (
                      <div
                        className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2"
                        data-testid="journeys-companion-planner-listening"
                      >
                        <div className="flex items-center gap-2">
                          <AudioReactiveWaveform isActive={isRecording && !isAutoStopping} className="justify-start" />
                          <span className="truncate text-xs text-white/70">
                            {interimText || (isAutoStopping ? "Finishing up..." : "Listening...")}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-white/45">
                        Mic stays in this window so voice and typing share the same planner thread.
                      </p>
                    )}
                  </div>

                  <Button
                    type="button"
                    onClick={submitTypedMessage}
                    disabled={isSubmitting || isClassifying || !draftInput.trim()}
                    data-testid="journeys-companion-planner-send-button"
                  >
                    {isSubmitting || isClassifying ? (
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
            </section>

            {hasUserTurns && latestCompanionReply ? (
              <section
                className="rounded-[24px] border border-white/10 bg-white/[0.05] p-4"
                data-testid="journeys-companion-planner-latest-reply"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/46">
                  Latest reply
                </p>
                <p className="mt-2 text-sm leading-relaxed text-white/86">{latestCompanionReply.content}</p>
              </section>
            ) : null}

            {questions.length > 0 ? (
              <section
                className="rounded-[24px] border border-amber-300/15 bg-amber-400/10 p-4"
                data-testid="journeys-companion-planner-questions"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-50/80">
                  Still needed before save
                </p>
                <div className="mt-3 space-y-3">
                  {questions.map((question) => (
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

            {pendingProposals.length > 0 ? (
              <section data-testid="journeys-companion-planner-proposals">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Pending changes</p>
                    <p className="text-xs text-white/52">Nothing saves until you confirm it.</p>
                  </div>
                  {readyProposalCount > 1 ? (
                    <Button type="button" size="sm" variant="outline" onClick={confirmAll}>
                      Confirm all
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-3">
                  {pendingProposals.map((proposal) => (
                    <CompactProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      onConfirm={confirmProposal}
                      onReject={rejectProposal}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {presentation === "dialog" ? (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-xl border-0 bg-transparent p-0 shadow-none" hideCloseButton>
            <DialogHeader className="sr-only">
              <DialogTitle>Companion planner</DialogTitle>
              <DialogDescription>Text or speak to your companion to shape your plan.</DialogDescription>
            </DialogHeader>
            {body}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
          <DrawerContent className="max-h-[85dvh] border-0 bg-transparent p-0 shadow-none">
            <DrawerHeader className="sr-only">
              <DrawerTitle>Companion planner</DrawerTitle>
              <DrawerDescription>Text or speak to your companion to shape your plan.</DrawerDescription>
            </DrawerHeader>
            {body}
          </DrawerContent>
        </Drawer>
      )}

      <PermissionRequestDialog
        isOpen={showPermissionDialog}
        onClose={() => setShowPermissionDialog(false)}
        onRequestPermission={requestMicrophonePermission}
        permissionStatus={permissionStatus}
        isRequesting={isRequestingPermission}
      />
    </>
  );
});
