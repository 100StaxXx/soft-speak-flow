import { type KeyboardEvent, memo, useCallback } from "react";
import {
  CalendarDays,
  Check,
  Loader2,
  Mic,
  MicOff,
  Send,
  Waves,
  X,
} from "lucide-react";

import { AudioReactiveWaveform } from "@/components/AudioReactiveWaveform";
import { CompanionPlanningModeSelector } from "@/components/companion/CompanionPlanningModeSelector";
import { CompanionStructuredResponseCards } from "@/components/companion/CompanionStructuredResponseCards";
import { PermissionRequestDialog } from "@/components/PermissionRequestDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCompanionAssistant } from "@/hooks/useCompanionAssistant";
import { useCompanionModeSettings } from "@/hooks/useCompanionModeSettings";
import { cn, stripMarkdown } from "@/lib/utils";
import { COMPANION_MODE_OPTIONS } from "@/shared/companionModes";
import { COMPANION_PLANNER_SURFACE_ACTIONS } from "@/shared/companionPlannerSurfaceActions";

export const CompanionPlannerPanel = memo(() => {
  const assistant = useCompanionAssistant({
    surface: "companion",
    conversationEnabled: true,
  });
  const modeSettings = useCompanionModeSettings();
  const quickActionsDisabled = assistant.isSubmitting ||
    assistant.isResolvingAction ||
    Boolean(assistant.pendingAction);

  const handleComposerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      assistant.submitTypedMessage();
    },
    [assistant],
  );

  return (
    <section
      className="mt-3 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.98))] shadow-[0_28px_80px_-45px_rgba(15,23,42,0.95)]"
      data-testid="companion-planner-panel"
    >
      <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.18),transparent_55%)] px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-100/70">
              Cosmiq Companion
            </div>
            <h2 className="text-base font-semibold text-white sm:text-lg">
              Talk naturally, ask what your schedule looks like, or prepare one
              confirmable action.
            </h2>
            <p className="text-sm text-white/60">
              Nothing changes until you confirm it.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="min-w-[11rem]">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Mode
              </label>
              <Select
                value={modeSettings.mode}
                onValueChange={(value) => {
                  void modeSettings.setMode(value as typeof modeSettings.mode);
                }}
              >
                <SelectTrigger className="h-10 border-white/10 bg-white/5 text-white">
                  <SelectValue placeholder="Choose a mode" />
                </SelectTrigger>
                <SelectContent>
                  {COMPANION_MODE_OPTIONS.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">
              <Switch
                checked={modeSettings.adaptationEnabled}
                onCheckedChange={(checked) => {
                  void modeSettings.setAdaptationEnabled(checked);
                }}
                disabled={modeSettings.isSaving}
                aria-label="Adaptive tone"
              />
              Adaptive tone
            </label>

            <Badge
              variant="outline"
              className="border-white/10 bg-white/5 text-white/70"
            >
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              {assistant.todayLabel}
            </Badge>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <CompanionPlanningModeSelector
          mode={assistant.planningMode}
          onChange={assistant.setPlanningMode}
          variant="companion"
        />

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">
            Quick Starts
          </div>
          <div className="flex flex-wrap gap-2">
            {COMPANION_PLANNER_SURFACE_ACTIONS.filter((action) =>
              [
                "plan-week",
                "plan-day",
                "prepare-tomorrow",
                "advance-campaign",
                "adjust-day",
                "make-room",
                "low-energy",
                "what-matters",
                "right-now",
                "upcoming",
              ].includes(
                action.id,
              )
            ).map((action) => (
              <Button
                key={action.id}
                type="button"
                variant="outline"
                className="h-9 rounded-full border-white/10 bg-white/[0.04] px-4 text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/80 hover:bg-white/[0.08]"
                disabled={quickActionsDisabled}
                data-testid={`companion-quick-action-${action.id}`}
                data-tour={action.id === "plan-day" ? "companion-plan-my-day-action" : undefined}
                onClick={() => {
                  if (action.id === "plan-day") {
                    window.dispatchEvent(
                      new CustomEvent("companion-plan-my-day-started"),
                    );
                  }
                  if (action.planningMode) {
                    assistant.setPlanningMode(action.planningMode);
                  }
                  void assistant.submitMessage(action.message, "text", {
                    starterIntent: action.starterIntent,
                    planningMode: action.planningMode ?? null,
                  });
                }}
              >
                {action.id === "plan-week"
                  ? "Plan My Week"
                  : action.id === "plan-day"
                  ? "Plan My Day"
                  : action.id === "prepare-tomorrow"
                  ? "Tomorrow"
                  : action.id === "advance-campaign"
                  ? "Advance My Campaign"
                  : action.id === "adjust-day"
                  ? "Adjust My Day"
                  : action.id === "make-room"
                  ? "Make Room"
                  : action.id === "low-energy"
                  ? "Low Energy"
                  : action.id === "what-matters"
                  ? "What Matters"
                  : action.id === "right-now"
                  ? "Right Now"
                  : "Coming Up"}
              </Button>
            ))}
          </div>
        </div>

        {assistant.isRecording || assistant.interimText || assistant.isSpeaking
          ? (
            <div className="rounded-[26px] border border-white/10 bg-black/20 p-4">
              {assistant.isRecording || assistant.interimText
                ? (
                  <>
                    <AudioReactiveWaveform
                      isActive={assistant.isRecording &&
                        !assistant.isAutoStopping}
                      className="justify-start"
                    />
                    <p className="mt-2 text-sm text-white/80">
                      {assistant.interimText || "Listening..."}
                    </p>
                  </>
                )
                : null}
              {assistant.isSpeaking
                ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-emerald-50">
                      <Waves className="h-4 w-4" />
                      Speaking {assistant.speechProvider === "cloud"
                        ? "with fallback audio"
                        : "on-device"}.
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={assistant.stopSpeaking}
                    >
                      Stop
                    </Button>
                  </div>
                )
                : null}
            </div>
          )
          : null}

        <ScrollArea
          className="max-h-[24rem] pr-3"
          data-testid="companion-assistant-transcript"
        >
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

        <CompanionStructuredResponseCards
          structuredResponse={assistant.structuredResponse}
          variant="companion"
          onConfirmSuggestion={assistant.confirmSuggestedQuest}
          savedProposalIds={assistant.savedSuggestionProposalIds}
          pendingProposalId={assistant.pendingSuggestionProposalId}
          actionDisabled={assistant.isSubmitting ||
            assistant.isResolvingAction || Boolean(assistant.pendingAction)}
        />

        {assistant.pendingAction
          ? (
            <div
              className="rounded-[26px] border border-amber-300/20 bg-amber-400/10 p-4"
              data-testid="companion-agent-pending-action"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-amber-300/25 bg-amber-400/10 text-amber-50"
                >
                  Pending confirmation
                </Badge>
                {assistant.readyPendingActionCount > 1
                  ? (
                    <Badge
                      variant="outline"
                      className="border-amber-300/25 bg-amber-400/10 text-amber-50"
                    >
                      {assistant.readyPendingActionCount} ready
                    </Badge>
                  )
                  : null}
                <Badge
                  variant="outline"
                  className="border-white/10 bg-white/5 text-white/70"
                >
                  {assistant.pendingAction.actionType.replace(/_/g, " ")}
                </Badge>
              </div>
              <p className="mt-3 text-sm font-medium text-white">
                {assistant.pendingAction.summary}
              </p>
              {assistant.pendingAction.confirmationMessage
                ? (
                  <p className="mt-1 text-sm text-white/70">
                    {assistant.pendingAction.confirmationMessage}
                  </p>
                )
                : null}
              {assistant.readyPendingActionCount > 1
                ? (
                  <p className="mt-2 text-sm text-white/70">
                    {assistant.readyPendingActionCount}{" "}
                    planner actions are ready. Confirm all to save the batch, or
                    confirm them one at a time.
                  </p>
                )
                : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {assistant.readyPendingActionCount > 1
                  ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={assistant.confirmAllPendingActions}
                      disabled={assistant.isResolvingAction ||
                        assistant.isSubmitting}
                    >
                      Confirm All ({assistant.readyPendingActionCount})
                    </Button>
                  )
                  : null}
                <Button
                  type="button"
                  onClick={assistant.confirmPendingAction}
                  disabled={assistant.isResolvingAction ||
                    assistant.isSubmitting}
                >
                  <Check className="mr-2 h-4 w-4" />
                  Confirm
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={assistant.cancelPendingAction}
                  disabled={assistant.isResolvingAction ||
                    assistant.isSubmitting}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </div>
          )
          : null}

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
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
          </div>

          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "group relative h-14 w-14 rounded-full border border-white/15 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.34),rgba(16,185,129,0.16)_55%,rgba(15,23,42,0.92))] text-white shadow-[0_24px_60px_-28px_rgba(59,130,246,0.65)] transition-transform hover:scale-[1.02]",
                assistant.isRecording &&
                  "border-rose-300/40 shadow-[0_28px_70px_-28px_rgba(251,113,133,0.85)]",
              )}
              onClick={assistant.toggleRecording}
              disabled={!assistant.isVoiceSupported && !assistant.isRecording}
              data-testid="companion-assistant-mic-button"
            >
              {assistant.isRecording
                ? <MicOff className="h-5 w-5" />
                : <Mic className="h-5 w-5" />}
            </Button>

            <Button
              type="button"
              onClick={assistant.submitTypedMessage}
              disabled={assistant.isSubmitting || assistant.isResolvingAction ||
                !assistant.draftInput.trim()}
              className="min-w-[8rem]"
              data-testid="companion-assistant-send-button"
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
