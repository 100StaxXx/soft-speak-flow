import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  Loader2,
  Lock,
  MessageCircleHeart,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import { AudioReactiveWaveform } from "@/components/AudioReactiveWaveform";
import { PermissionRequestDialog } from "@/components/PermissionRequestDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAccessStatus } from "@/hooks/useAccessStatus";
import { useCompanionChat } from "@/hooks/useCompanionChat";
import { useCompanionPlanner } from "@/hooks/useCompanionPlanner";
import { cn } from "@/lib/utils";
import { LOCKED_COMPANION_VOICE_LABEL } from "@/shared/companionChaosVoice";
import type { CompanionConversationMode } from "@/types/companionConversation";
import type {
  CompanionPlannerProposal,
  PlannerHorizon,
} from "@/types/companionPlanner";

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
}) => (
  <div
    className="rounded-2xl border border-white/10 bg-black/20 p-4 shadow-[0_20px_45px_-30px_rgba(0,0,0,0.8)]"
    data-testid={`planner-proposal-${proposal.id}`}
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
));

ProposalCard.displayName = "ProposalCard";

const CompanionTalkSurface = memo(({
  chat,
}: {
  chat: ReturnType<typeof useCompanionChat>;
}) => {
  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    chat.submitTypedMessage();
  }, [chat]);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5">
      <div className="rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.16),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100/75">
              <MessageCircleHeart className="h-3.5 w-3.5" />
              Companion talk
            </div>
            <h3 className="text-base font-semibold text-white sm:text-lg">{chat.greeting}</h3>
            <p className="text-sm text-white/62">
              Have a normal conversation. Voice replies stay on-device first and only fall back to cloud speech when needed.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {chat.isLoadingHistory ? (
              <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Syncing
              </Badge>
            ) : null}
            {chat.speechProvider !== "none" ? (
              <Badge
                variant="outline"
                className={cn(
                  "border-white/10 bg-white/5 text-white/70",
                  chat.speechProvider === "cloud" && "border-amber-300/20 bg-amber-400/10 text-amber-50",
                  chat.speechProvider === "device" && "border-emerald-300/20 bg-emerald-400/10 text-emerald-50",
                )}
              >
                {chat.speechProvider === "device" ? "On-device voice" : "Cloud fallback"}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="companion-autoplay-voice" className="text-sm text-white">
                    Autoplay voice
                  </Label>
                  <p className="mt-1 text-xs text-white/55">Speak new replies aloud after they arrive.</p>
                </div>
                <Switch
                  id="companion-autoplay-voice"
                  checked={chat.autoplayVoice}
                  onCheckedChange={chat.setAutoplayVoice}
                  data-testid="companion-talk-autoplay-toggle"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="companion-mute-voice" className="text-sm text-white">
                    Mute spoken replies
                  </Label>
                  <p className="mt-1 text-xs text-white/55">Keep the transcript active without reading replies aloud.</p>
                </div>
                <Switch
                  id="companion-mute-voice"
                  checked={chat.muteSpokenReplies}
                  onCheckedChange={chat.setMuteSpokenReplies}
                  data-testid="companion-talk-mute-toggle"
                />
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            className={cn(
              "group relative h-24 w-24 rounded-full border border-white/15 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.34),rgba(16,185,129,0.16)_55%,rgba(15,23,42,0.92))] text-white shadow-[0_24px_60px_-28px_rgba(59,130,246,0.65)] transition-transform hover:scale-[1.02]",
              chat.isRecording && "border-rose-300/40 shadow-[0_28px_70px_-28px_rgba(251,113,133,0.85)]",
            )}
            onClick={chat.toggleRecording}
            disabled={!chat.isVoiceSupported && !chat.isRecording}
            data-testid="companion-talk-mic-button"
          >
            <div className="flex flex-col items-center gap-2">
              {chat.isRecording ? (
                <>
                  <MicOff className="h-6 w-6" />
                  <span className="text-xs font-medium">{chat.isAutoStopping ? "Stopping" : "Listening"}</span>
                </>
              ) : (
                <>
                  <Mic className="h-6 w-6" />
                  <span className="text-xs font-medium">Push to talk</span>
                </>
              )}
            </div>
          </Button>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3">
          <div className="flex items-center gap-2 text-xs text-white/65">
            {chat.muteSpokenReplies ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span>
              Keep it conversational. Ask for support, reflection, perspective, or a quick pep talk.
            </span>
          </div>
          {chat.isRecording || chat.interimText ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <AudioReactiveWaveform isActive={chat.isRecording && !chat.isAutoStopping} className="justify-start" />
              <p className="mt-2 text-sm text-white/80">{chat.interimText || "Listening..."}</p>
            </div>
          ) : null}
          {chat.isSpeaking ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-emerald-50">
                <Waves className="h-4 w-4" />
                Speaking {chat.speechProvider === "cloud" ? "with fallback audio" : "on-device"}.
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={chat.stopSpeaking}>
                Stop
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <ScrollArea className="max-h-[24rem] pr-3" data-testid="companion-talk-transcript">
        <div className="space-y-3">
          {chat.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[92%] rounded-2xl px-4 py-3 text-sm",
                message.role === "assistant"
                  ? "bg-white/8 text-white shadow-[0_20px_50px_-40px_rgba(74,222,128,0.55)]"
                  : "ml-auto bg-emerald-400/15 text-emerald-50 shadow-[0_20px_50px_-40px_rgba(16,185,129,0.95)]",
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              {message.inputMode ? (
                <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-white/40">{message.inputMode}</p>
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="rounded-[26px] border border-white/10 bg-white/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <label htmlFor="companion-talk-input" className="sr-only">
          Message your companion
        </label>
        <Textarea
          id="companion-talk-input"
          value={chat.draftInput}
          onChange={(event) => chat.setDraftInput(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="Talk to your companion like a real conversation..."
          className="min-h-[104px] resize-none border-white/10 bg-black/20 text-white placeholder:text-white/35"
          data-testid="companion-talk-text-input"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-white/50">
            Text works everywhere. Voice input falls back to text if speech recognition is unavailable.
          </div>
          <Button
            type="button"
            onClick={chat.submitTypedMessage}
            disabled={chat.isSubmitting || !chat.draftInput.trim()}
            className="min-w-[8rem]"
            data-testid="companion-talk-send-button"
          >
            {chat.isSubmitting ? (
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
        isOpen={chat.showPermissionDialog}
        onClose={() => chat.setShowPermissionDialog(false)}
        onRequestPermission={chat.requestMicrophonePermission}
        permissionStatus={chat.permissionStatus}
        isRequesting={chat.isRequestingPermission}
      />
    </div>
  );
});

CompanionTalkSurface.displayName = "CompanionTalkSurface";

const CompanionTalkLockedState = memo(() => (
  <div className="space-y-4 px-4 py-4 sm:px-5" data-testid="companion-talk-locked">
    <div className="rounded-[26px] border border-amber-300/20 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.18),transparent_60%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-3 text-amber-50">
          <Lock className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">Premium companion talk</p>
            <Badge variant="outline" className="border-amber-300/25 bg-amber-400/10 text-amber-50">
              Premium
            </Badge>
          </div>
          <p className="text-sm text-white/75">
            Normal back-and-forth conversation, push-to-talk input, and spoken replies live here. Planning stays available below either way.
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">Real conversation</Badge>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">Voice input</Badge>
            <Badge variant="outline" className="border-white/10 bg-white/5 text-white/70">On-device speech</Badge>
          </div>
        </div>
      </div>
    </div>
  </div>
));

CompanionTalkLockedState.displayName = "CompanionTalkLockedState";

const CompanionPlanSurface = memo(({
  planner,
  showPlannerBridgeHint,
}: {
  planner: ReturnType<typeof useCompanionPlanner>;
  showPlannerBridgeHint: boolean;
}) => {
  const handleComposerKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    planner.submitTypedMessage();
  }, [planner]);

  return (
    <div className="space-y-4 px-4 py-4 sm:px-5">
      {showPlannerBridgeHint ? (
        <div
          className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-50"
          data-testid="planner-handoff-banner"
        >
          Switched to Plan so the companion can turn that into confirmable changes instead of saving anything automatically.
        </div>
      ) : null}

      <div className="rounded-[26px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/70">
              <Sparkles className="h-3.5 w-3.5" />
              Companion planner
            </div>
            <h3 className="text-base font-semibold text-white sm:text-lg">{planner.greeting}</h3>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>{planner.todayLabel}</span>
              {planner.isLoadingContext ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  syncing context
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">Voice</p>
              <div
                className="inline-flex items-center rounded-full border border-sky-300/30 bg-sky-400/10 px-3 py-1.5 text-sm font-medium text-sky-100"
                data-testid="planner-voice-lock"
              >
                {LOCKED_COMPANION_VOICE_LABEL}
              </div>
              <p className="text-xs text-white/55">
                Chaotic commentary. Truth first. Sugar never.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-white/45">Horizon</p>
              <ToggleGroup
                type="single"
                value={planner.horizon}
                onValueChange={(value) => {
                  if (value) planner.setHorizon(value as PlannerHorizon);
                }}
                className="flex flex-wrap justify-start gap-2"
                data-testid="planner-horizon-toggle"
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

          <Button
            type="button"
            variant="ghost"
            className={cn(
              "group relative h-28 w-28 rounded-full border border-white/15 bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.36),rgba(14,116,144,0.18)_55%,rgba(15,23,42,0.92))] text-white shadow-[0_24px_60px_-28px_rgba(14,165,233,0.8)] transition-transform hover:scale-[1.02]",
              planner.isRecording && "border-rose-300/40 shadow-[0_28px_70px_-28px_rgba(251,113,133,0.85)]",
            )}
            onClick={planner.toggleRecording}
            disabled={!planner.isVoiceSupported && !planner.isRecording}
            data-testid="planner-mic-button"
          >
            <div className="flex flex-col items-center gap-2">
              {planner.isRecording ? (
                <>
                  <MicOff className="h-7 w-7" />
                  <span className="text-xs font-medium">{planner.isAutoStopping ? "Stopping" : "Listening"}</span>
                </>
              ) : (
                <>
                  <Mic className="h-7 w-7" />
                  <span className="text-xs font-medium">Speak plan</span>
                </>
              )}
            </div>
          </Button>
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2 text-xs text-white/65">
            <Volume2 className="h-3.5 w-3.5" />
            <span>
              Ask me to plan the day, adjust a quest, spin something into a campaign, or set up a repeat.
            </span>
          </div>
          {planner.isRecording || planner.interimText ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <AudioReactiveWaveform isActive={planner.isRecording && !planner.isAutoStopping} className="justify-start" />
              <p className="mt-2 text-sm text-white/80">{planner.interimText || "Listening for your plan..."}</p>
            </div>
          ) : null}
        </div>
      </div>

      {planner.questions.length > 0 ? (
        <div className="grid gap-2" data-testid="planner-question-list">
          {planner.questions.map((question) => (
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

      {planner.scheduleInsights ? (
        <div
          className="rounded-[26px] border border-white/10 bg-[linear-gradient(180deg,rgba(14,165,233,0.12),rgba(15,23,42,0.18))] p-4"
          data-testid="planner-schedule-insights"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-100/70">
                Schedule read
              </p>
              <p className="text-sm text-white">{planner.scheduleInsights.summary}</p>
              {planner.plannerMemory?.preferredTimeOfDay ? (
                <p className="text-xs text-white/60">
                  Usual rhythm: {planner.plannerMemory.preferredTimeOfDay}
                  {planner.plannerMemory.preferredTimeReason ? ` because ${planner.plannerMemory.preferredTimeReason}` : ""}.
                </p>
              ) : null}
            </div>
            <Badge variant="outline" className="border-white/15 bg-white/5 text-white/70">
              {planner.scheduleInsights.horizon}
            </Badge>
          </div>

          {planner.scheduleInsights.suggestedSlots.length > 0 ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/45">Best openings</p>
              <div className="flex flex-wrap gap-2">
                {planner.scheduleInsights.suggestedSlots.slice(0, 3).map((slot) => (
                  <Badge
                    key={`${slot.date}-${slot.time}`}
                    variant="outline"
                    className="border-emerald-300/20 bg-emerald-400/10 text-emerald-50"
                  >
                    {slot.date === planner.scheduleInsights?.selectedDate ? slot.time : `${slot.date} ${slot.time}`}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {planner.scheduleInsights.conflicts.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-rose-300/15 bg-rose-400/10 p-3 text-sm text-rose-50">
              {planner.scheduleInsights.conflicts.length} overlap{planner.scheduleInsights.conflicts.length === 1 ? "" : "s"} in view.
              {` `}
              First clash: {planner.scheduleInsights.conflicts[0]?.taskATitle} vs {planner.scheduleInsights.conflicts[0]?.taskBTitle}.
            </div>
          ) : null}

          {planner.scheduleInsights.moveSuggestions[0] ? (
            <div className="mt-3 rounded-2xl border border-amber-300/15 bg-amber-400/10 p-3 text-sm text-amber-50">
              Suggested adjustment: move {planner.scheduleInsights.moveSuggestions[0].taskTitle ?? "this block"} toward {planner.scheduleInsights.moveSuggestions[0].toDate}
              {planner.scheduleInsights.moveSuggestions[0].suggestedTime ? ` at ${planner.scheduleInsights.moveSuggestions[0].suggestedTime}` : ""}.
            </div>
          ) : null}

          {(planner.scheduleInsights.overloadedDates.length > 0 || planner.scheduleInsights.emptyDates.length > 0) ? (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {planner.scheduleInsights.overloadedDates.slice(0, 3).map((date) => (
                <Badge key={`busy-${date}`} variant="outline" className="border-amber-300/20 bg-amber-400/10 text-amber-50">
                  Busy {date}
                </Badge>
              ))}
              {planner.scheduleInsights.emptyDates.slice(0, 3).map((date) => (
                <Badge key={`open-${date}`} variant="outline" className="border-sky-300/20 bg-sky-400/10 text-sky-50">
                  Open {date}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <ScrollArea className="max-h-[22rem] pr-3" data-testid="planner-transcript">
        <div className="space-y-3">
          {planner.messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "max-w-[92%] rounded-2xl px-4 py-3 text-sm",
                message.role === "companion"
                  ? "bg-white/8 text-white shadow-[0_20px_50px_-40px_rgba(125,211,252,0.85)]"
                  : "ml-auto bg-sky-400/15 text-sky-50 shadow-[0_20px_50px_-40px_rgba(14,165,233,0.95)]",
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              {message.inputMode ? (
                <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-white/40">{message.inputMode}</p>
              ) : null}
            </div>
          ))}
        </div>
      </ScrollArea>

      {planner.proposals.length > 0 ? (
        <div className="space-y-3" data-testid="planner-proposals">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white">Pending changes</p>
              <p className="text-xs text-white/55">Nothing saves until you confirm it.</p>
            </div>
            {planner.readyProposalCount > 1 ? (
              <Button size="sm" variant="outline" onClick={planner.confirmAll}>
                Confirm all
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3">
            {planner.proposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                onConfirm={planner.confirmProposal}
                onReject={planner.rejectProposal}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[26px] border border-white/10 bg-white/5 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <label htmlFor="companion-planner-input" className="sr-only">
          Ask your companion planner
        </label>
        <Textarea
          id="companion-planner-input"
          value={planner.draftInput}
          onChange={(event) => planner.setDraftInput(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          placeholder="Tell me what you want to plan, adjust, repeat, or turn into a campaign..."
          className="min-h-[104px] resize-none border-white/10 bg-black/20 text-white placeholder:text-white/35"
          data-testid="planner-text-input"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-white/50">
            I&apos;ll ask about time of day, why it fits, cadence, end dates, and whether this belongs in a campaign.
          </div>
          <Button
            type="button"
            onClick={planner.submitTypedMessage}
            disabled={planner.isSubmitting || planner.isClassifying || !planner.draftInput.trim()}
            className="min-w-[8rem]"
            data-testid="planner-send-button"
          >
            {planner.isSubmitting || planner.isClassifying ? (
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
        isOpen={planner.showPermissionDialog}
        onClose={() => planner.setShowPermissionDialog(false)}
        onRequestPermission={planner.requestMicrophonePermission}
        permissionStatus={planner.permissionStatus}
        isRequesting={planner.isRequestingPermission}
      />
    </div>
  );
});

CompanionPlanSurface.displayName = "CompanionPlanSurface";

export const CompanionPlannerPanel = memo(() => {
  const { isSubscribed, loading: accessLoading } = useAccessStatus();
  const planner = useCompanionPlanner();
  const chat = useCompanionChat({ enabled: isSubscribed });
  const { handoffToPlanner, clearPlannerHandoff } = chat;
  const [mode, setMode] = useState<CompanionConversationMode>("plan");
  const [showPlannerBridgeHint, setShowPlannerBridgeHint] = useState(false);
  const initializedModeRef = useRef(false);

  useEffect(() => {
    if (accessLoading || initializedModeRef.current) return;
    setMode(isSubscribed ? "talk" : "plan");
    initializedModeRef.current = true;
  }, [accessLoading, isSubscribed]);

  useEffect(() => {
    if (!isSubscribed && mode === "talk") {
      setMode("plan");
    }
  }, [isSubscribed, mode]);

  useEffect(() => {
    if (!handoffToPlanner) return;
    setMode("plan");
    setShowPlannerBridgeHint(true);
    clearPlannerHandoff();
  }, [clearPlannerHandoff, handoffToPlanner]);

  return (
    <section
      className="mt-3 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.96))] shadow-[0_28px_80px_-45px_rgba(15,23,42,0.95)]"
      data-testid="companion-planner-panel"
    >
      <Tabs
        value={mode}
        onValueChange={(value) => {
          const nextMode = value as CompanionConversationMode;
          setMode(nextMode);
          if (nextMode !== "plan") {
            setShowPlannerBridgeHint(false);
          }
        }}
      >
        <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%)] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/70">
                <Sparkles className="h-3.5 w-3.5" />
                Companion conversation
              </div>
              <h2 className="text-base font-semibold text-white sm:text-lg">
                {isSubscribed
                  ? "Talk naturally or switch into planning when you want confirmable changes."
                  : "Planning stays open. Premium unlocks the live Talk lane with voice."}
              </h2>
              <p className="text-sm text-white/60">
                Talk is premium and audible. Plan keeps the structured companion planner exactly where it belongs.
              </p>
            </div>

            <TabsList
              className="grid h-auto w-full max-w-[18rem] grid-cols-2 border-white/10 bg-white/5 p-1.5 text-white/65"
              data-testid="companion-mode-tabs"
            >
              <TabsTrigger
                value="talk"
                disabled={!isSubscribed}
                className="gap-2 data-[state=active]:border-emerald-300/25 data-[state=active]:bg-emerald-400/15 data-[state=active]:text-white"
              >
                {!isSubscribed ? <Lock className="h-3.5 w-3.5" /> : <MessageCircleHeart className="h-3.5 w-3.5" />}
                Talk
              </TabsTrigger>
              <TabsTrigger
                value="plan"
                className="gap-2 data-[state=active]:border-sky-300/25 data-[state=active]:bg-sky-400/15 data-[state=active]:text-white"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Plan
              </TabsTrigger>
            </TabsList>
          </div>

          {!isSubscribed ? <CompanionTalkLockedState /> : null}
        </div>

        <TabsContent value="talk" className="mt-0">
          {isSubscribed ? <CompanionTalkSurface chat={chat} /> : null}
        </TabsContent>

        <TabsContent value="plan" className="mt-0">
          <CompanionPlanSurface
            planner={planner}
            showPlannerBridgeHint={showPlannerBridgeHint}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
});

CompanionPlannerPanel.displayName = "CompanionPlannerPanel";
