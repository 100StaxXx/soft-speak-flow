import { memo, useCallback, type KeyboardEvent } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  Lock,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Waves,
  X,
} from "lucide-react";

import { AudioReactiveWaveform } from "@/components/AudioReactiveWaveform";
import { PermissionRequestDialog } from "@/components/PermissionRequestDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { useCompanionAssistant } from "@/hooks/useCompanionAssistant";
import { cn, stripMarkdown } from "@/lib/utils";
import type { CompanionPlannerProposal, PlannerHorizon } from "@/types/companionPlanner";
import { getCompanionPlannerQuestProposalPreview } from "@/utils/companionPlannerProposalPreview";

const HORIZON_LABELS: Record<PlannerHorizon, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

const PROPOSAL_KIND_LABELS: Record<CompanionPlannerProposal["kind"], string> = {
  create_quest: "Quest",
  update_quest: "Quest edit",
  create_campaign: "Campaign",
  update_campaign: "Campaign edit",
  adjust_campaign_plan: "Campaign adjust",
  create_ritual: "Ritual",
  update_ritual: "Ritual edit",
  suggest_reminder: "Reminder",
};

const STATUS_BADGE_CLASSNAME: Record<CompanionPlannerProposal["status"], string> = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-100",
  confirmed: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  rejected: "border-slate-400/30 bg-slate-400/10 text-slate-100",
};

const ProposalCard = memo(({
  proposal,
  onConfirm,
  onReject,
}: {
  proposal: CompanionPlannerProposal;
  onConfirm: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}) => {
  const questPreview = getCompanionPlannerQuestProposalPreview(proposal);

  return (
    <div
      className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.8)]"
      data-testid={`assistant-proposal-${proposal.id}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-sky-300/30 bg-sky-400/10 text-sky-100">
          {PROPOSAL_KIND_LABELS[proposal.kind]}
        </Badge>
        <Badge variant="outline" className={STATUS_BADGE_CLASSNAME[proposal.status]}>
          {proposal.status}
        </Badge>
        {!proposal.readyToConfirm && proposal.status === "pending" ? (
          <Badge variant="outline" className="border-rose-300/30 bg-rose-400/10 text-rose-100">
            needs detail
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 space-y-1">
        <h4 className="text-sm font-semibold text-white">{proposal.title}</h4>
        <p className="text-sm text-white/80">{proposal.summary}</p>
        {proposal.reasoning ? (
          <p className="text-xs text-white/55">{proposal.reasoning}</p>
        ) : null}
        {!proposal.readyToConfirm && proposal.missingFields?.length ? (
          <p className="text-xs text-rose-100/90">
            Still waiting on: {proposal.missingFields.join(", ")}.
          </p>
        ) : null}
      </div>

      {questPreview?.notes ? (
        <div
          className="mt-3 rounded-2xl border border-white/8 bg-white/5 p-3"
          data-testid={`assistant-proposal-notes-${proposal.id}`}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Stored note</p>
          <p className="mt-1 text-sm text-white/78">{questPreview.notes}</p>
        </div>
      ) : null}

      {questPreview?.subtasks.length ? (
        <div
          className="mt-3 rounded-2xl border border-white/8 bg-white/5 p-3"
          data-testid={`assistant-proposal-subtasks-${proposal.id}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
              {questPreview.subtasks.length} step{questPreview.subtasks.length === 1 ? "" : "s"}
            </p>
            {proposal.kind === "update_quest" && questPreview.subtaskPlanMode ? (
              <Badge variant="outline" className="border-emerald-300/20 bg-emerald-400/10 text-emerald-50">
                {questPreview.subtaskPlanMode === "replace" ? "Replace steps" : "Append steps"}
              </Badge>
            ) : null}
          </div>
          <div className="mt-2 space-y-1">
            {questPreview.subtasks.map((subtask) => (
              <p key={subtask} className="text-sm text-white/78">
                - {subtask}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => onConfirm(proposal.id)}
          disabled={proposal.status !== "pending" || !proposal.readyToConfirm}
        >
          <Check className="mr-2 h-4 w-4" />
          Confirm
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReject(proposal.id)}
          disabled={proposal.status !== "pending"}
        >
          <X className="mr-2 h-4 w-4" />
          Reject
        </Button>
      </div>
    </div>
  );
});

ProposalCard.displayName = "ProposalCard";

export const CompanionPlannerPanel = memo(() => {
  const { isSubscribed } = useAccessStatus();
  const assistant = useCompanionAssistant({
    surface: "companion",
    conversationEnabled: isSubscribed,
  });

  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    assistant.submitTypedMessage();
  }, [assistant]);

  return (
    <section
      className="mt-3 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.96))] shadow-[0_28px_80px_-45px_rgba(15,23,42,0.95)]"
      data-testid="companion-planner-panel"
    >
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%)] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/70">
              <Sparkles className="h-3.5 w-3.5" />
              Direct Companion Assistant
            </div>
            <h2 className="text-base font-semibold text-white sm:text-lg">
              Ask what is scheduled, move quests around, or talk normally without switching modes.
            </h2>
            <p className="text-sm text-white/60">
              Planning replies stay inline, nothing saves without confirmation, and connected calendar events stay read-only.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              {assistant.todayLabel}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        {!isSubscribed ? (
          <div className="rounded-[26px] border border-amber-300/20 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-amber-50">
                <Lock className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-white">Conversation mode is Premium</p>
                  <Badge variant="outline" className="border-amber-300/25 bg-amber-400/10 text-amber-50">
                    Premium
                  </Badge>
                </div>
                <p className="text-sm text-white/75">
                  Scheduling questions, quest moves, and campaign adjustments still work here. Premium unlocks the full freeform talk lane.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">Horizon</p>
                  <ToggleGroup
                    type="single"
                    value={assistant.horizon}
                    onValueChange={(value) => {
                      if (value) assistant.setHorizon(value as PlannerHorizon);
                    }}
                    className="flex flex-wrap justify-start gap-2"
                    data-testid="assistant-horizon-toggle"
                  >
                    {(Object.keys(HORIZON_LABELS) as PlannerHorizon[]).map((option) => (
                      <ToggleGroupItem
                        key={option}
                        value={option}
                        variant="outline"
                        size="sm"
                        className="rounded-full border-white/10 bg-white/5 px-3 text-white/80 data-[state=on]:border-emerald-300/35 data-[state=on]:bg-emerald-400/15 data-[state=on]:text-white"
                      >
                        {HORIZON_LABELS[option]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              className={cn(
                "group relative h-28 w-28 rounded-full border border-white/15 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.34),rgba(16,185,129,0.16)_55%,rgba(15,23,42,0.92))] text-white shadow-[0_24px_60px_-28px_rgba(59,130,246,0.65)] transition-transform hover:scale-[1.02]",
                assistant.isRecording && "border-rose-300/40 shadow-[0_28px_70px_-28px_rgba(251,113,133,0.85)]",
              )}
              onClick={assistant.toggleRecording}
              disabled={!assistant.isVoiceSupported && !assistant.isRecording}
              data-testid="companion-assistant-mic-button"
            >
              <div className="flex flex-col items-center gap-2">
                {assistant.isRecording ? (
                  <>
                    <MicOff className="h-7 w-7" />
                    <span className="text-xs font-medium">{assistant.isAutoStopping ? "Stopping" : "Listening"}</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-7 w-7" />
                    <span className="text-xs font-medium">Push to talk</span>
                  </>
                )}
              </div>
            </Button>
          </div>
        )}

        {assistant.isRecording || assistant.interimText || assistant.isSpeaking ? (
          <div className="rounded-[26px] border border-white/10 bg-black/20 p-4">
            {assistant.isRecording || assistant.interimText ? (
              <>
                <AudioReactiveWaveform isActive={assistant.isRecording && !assistant.isAutoStopping} className="justify-start" />
                <p className="mt-2 text-sm text-white/80">{assistant.interimText || "Listening..."}</p>
              </>
            ) : null}
            {assistant.isSpeaking ? (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-emerald-50">
                  <Waves className="h-4 w-4" />
                  Speaking {assistant.speechProvider === "cloud" ? "with fallback audio" : "on-device"}.
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={assistant.stopSpeaking}>
                  Stop
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {assistant.questions.length > 0 ? (
          <div className="grid gap-2" data-testid="assistant-question-list">
            {assistant.questions.map((question) => (
              <div key={question.id} className="rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/80">
                  <Clock3 className="h-3.5 w-3.5" />
                  Needed before save
                </div>
                <p className="mt-2 text-sm font-medium text-white">{question.prompt}</p>
                {question.reason ? (
                  <p className="mt-1 text-xs text-white/65">{question.reason}</p>
                ) : null}
                {question.options?.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {question.options.map((option) => (
                      <Badge key={option} variant="outline" className="border-white/15 bg-white/5 text-white/75">
                        {option}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {assistant.scheduleInsights ? (
          <div
            className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,165,233,0.12),rgba(15,23,42,0.18))] p-4"
            data-testid="assistant-schedule-insights"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/70">
                  Schedule read
                </p>
                <p className="text-sm text-white">{assistant.scheduleInsights.summary}</p>
                {assistant.plannerMemory?.preferredTimeOfDay ? (
                  <p className="text-xs text-white/60">
                    Usual rhythm: {assistant.plannerMemory.preferredTimeOfDay}
                    {assistant.plannerMemory.preferredTimeReason ? ` because ${assistant.plannerMemory.preferredTimeReason}` : ""}.
                  </p>
                ) : null}
              </div>
              <Badge variant="outline" className="border-white/15 bg-white/5 text-white/70">
                {assistant.scheduleInsights.horizon}
              </Badge>
            </div>

            {assistant.scheduleInsights.suggestedSlots.length > 0 ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">Best openings</p>
                <div className="flex flex-wrap gap-2">
                  {assistant.scheduleInsights.suggestedSlots.slice(0, 3).map((slot) => (
                    <Badge
                      key={`${slot.date}-${slot.time}`}
                      variant="outline"
                      className="border-emerald-300/20 bg-emerald-400/10 text-emerald-50"
                    >
                      {slot.date === assistant.scheduleInsights?.selectedDate ? slot.time : `${slot.date} ${slot.time}`}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <ScrollArea className="max-h-[24rem] pr-3" data-testid="companion-assistant-transcript">
          <div className="space-y-3">
            {assistant.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[92%] rounded-2xl px-4 py-3 text-sm",
                  message.role === "assistant"
                    ? "bg-white/8 text-white shadow-[0_20px_50px_-40px_rgba(74,222,128,0.55)]"
                    : "ml-auto bg-emerald-400/15 text-emerald-50 shadow-[0_20px_50px_-40px_rgba(16,185,129,0.95)]",
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">
                  {message.role === "assistant"
                    ? stripMarkdown(message.content)
                    : message.content}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/40">
                  {message.inputMode ? <span>{message.inputMode}</span> : null}
                  <span>{message.source}</span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {assistant.proposals.length > 0 ? (
          <div className="space-y-3" data-testid="assistant-proposals">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Pending changes</p>
                <p className="text-xs text-white/55">Nothing saves until you confirm it.</p>
              </div>
              {assistant.readyProposalCount > 1 ? (
                <Button size="sm" variant="outline" onClick={assistant.confirmAll}>
                  Confirm all
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3">
              {assistant.proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onConfirm={assistant.confirmProposal}
                  onReject={assistant.rejectProposal}
                />
              ))}
            </div>
          </div>
        ) : null}

        <div className="rounded-[26px] border border-white/10 bg-white/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          <label htmlFor="companion-assistant-input" className="sr-only">
            Message your companion assistant
          </label>
          <Textarea
            id="companion-assistant-input"
            value={assistant.draftInput}
            onChange={(event) => assistant.setDraftInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder={assistant.placeholder}
            className="min-h-[104px] resize-none border-white/10 bg-black/20 text-white placeholder:text-white/35"
            data-testid="companion-assistant-text-input"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-white/50">
              Ask for support, schedule answers, or confirmable quest and campaign changes in the same thread.
            </div>
            <Button
              type="button"
              onClick={assistant.submitTypedMessage}
              disabled={assistant.isSubmitting || assistant.isClassifying || !assistant.draftInput.trim()}
              className="min-w-[8rem]"
              data-testid="companion-assistant-send-button"
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

        <PermissionRequestDialog
          isOpen={assistant.showPermissionDialog}
          onClose={() => assistant.setShowPermissionDialog(false)}
          onRequestPermission={assistant.requestMicrophonePermission}
          permissionStatus={assistant.permissionStatus}
          isRequesting={assistant.isRequestingPermission}
        />
      </div>
    </section>
  );
});

CompanionPlannerPanel.displayName = "CompanionPlannerPanel";
