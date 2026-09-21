import { memo, useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FocusTimer } from "@/features/tasks/components/FocusTimer";
import { Shield, Sparkles, Timer } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ResistModePanel } from "./ResistModePanel";
import { cn } from "@/lib/utils";
import { outerShellCardClassName } from "@/components/ui/card";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";
import {
  type CompanionCinemaInteractionRun,
  completeCompanionCinemaInteraction,
  getCompanionCinemaHistory,
  getCompanionCinemaInteractionStatus,
  resolveCinemaEventSummary,
  startCompanionCinemaInteraction,
} from "@/services/companionCinemaInteractions";
import { CompanionCinemaPlayer } from "./CompanionCinemaPlayer";
import type { FocusSession } from "@/features/tasks/hooks/useFocusSession";

type FocusMode = "focus" | "resist";

interface FocusTabProps {
  layoutMode?: CompanionLayoutMode;
  enableCosmiqCinema?: boolean;
}

export const FocusTab = memo(({
  layoutMode = "mobile",
  enableCosmiqCinema = false,
}: FocusTabProps) => {
  const [mode, setMode] = useState<FocusMode>("focus");
  const [watchRun, setWatchRun] = useState<
    CompanionCinemaInteractionRun | null
  >(null);
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [playerEventId, setPlayerEventId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: cinemaHistory } = useQuery({
    queryKey: ["companion-cinema-history"],
    queryFn: getCompanionCinemaHistory,
    enabled: enableCosmiqCinema,
    refetchInterval: 15_000,
  });
  const recoveredWatchRun = cinemaHistory?.runs.find((candidate) => {
    if (candidate.interaction_type !== "watch") return false;
    const startEvent = resolveCinemaEventSummary(candidate.start_event);
    const completionEvent = resolveCinemaEventSummary(
      candidate.completion_event,
    );
    return ["preparing", "active", "returning"].includes(candidate.status) ||
      (startEvent?.status === "ready" && !startEvent.revealed_at) ||
      (completionEvent?.status === "ready" && !completionEvent.revealed_at);
  }) ?? null;
  const effectiveWatchRun = watchRun ?? recoveredWatchRun;
  const isDesktop = layoutMode === "desktop";
  const { data: watchStatus } = useQuery({
    queryKey: ["companion-cinema-interaction", effectiveWatchRun?.id ?? "none"],
    queryFn: () => getCompanionCinemaInteractionStatus(effectiveWatchRun!.id),
    enabled: enableCosmiqCinema && Boolean(effectiveWatchRun?.id),
    refetchInterval: 15_000,
  });
  const resolvedWatchRun = watchStatus?.run ?? effectiveWatchRun;
  const watchStartEvent = resolveCinemaEventSummary(
    resolvedWatchRun?.start_event,
  );
  const watchCompletionEvent = resolveCinemaEventSummary(
    resolvedWatchRun?.completion_event,
  );
  const watchEventStatus = watchStartEvent?.status;
  const watchEventId = resolvedWatchRun?.cinema_event_id ?? null;
  const completionReady = watchCompletionEvent &&
    ["ready", "revealed"].includes(watchCompletionEvent.status);

  const handleFocusStarted = useCallback((session: FocusSession) => {
    if (!enableCosmiqCinema) return;
    void startCompanionCinemaInteraction({
      interactionType: "watch",
      intention: "Protect this deep-work session",
      expectedMinutes: session.planned_duration,
    }).then(({ run }) => {
      setWatchRun(run);
      setPlayerEventId(null);
      void queryClient.invalidateQueries({
        queryKey: ["companion-cinema-history"],
      });
    }).catch((error) => {
      console.warn("[CompanionCinema] The Watch could not start", error);
    });
  }, [enableCosmiqCinema, queryClient]);

  const finishWatch = useCallback(
    (completed: boolean, session: FocusSession) => {
      if (!enableCosmiqCinema || !effectiveWatchRun?.id) return;
      void completeCompanionCinemaInteraction({
        runId: effectiveWatchRun.id,
        completed,
        outcome: {
          focusSessionId: session.id,
          plannedMinutes: session.planned_duration,
          actualMinutes: session.actual_duration,
          distractions: session.distractions_count,
        },
      }).then(({ run }) => {
        if (run) setWatchRun(run);
        void queryClient.invalidateQueries({
          queryKey: ["companion-cinema-history"],
        });
        void queryClient.invalidateQueries({
          queryKey: ["companion-cinema-interaction", effectiveWatchRun.id],
        });
      }).catch((error) => {
        console.warn("[CompanionCinema] The Watch could not close", error);
      });
    },
    [effectiveWatchRun, enableCosmiqCinema, queryClient],
  );

  const watchCard = resolvedWatchRun
    ? (
      <GlassCard variant="pageShell" className="p-4 text-left space-y-3">
        <div className="flex items-center gap-2 text-primary">
          <Shield className="h-5 w-5" />
          <span className="text-sm font-medium">The Watch is active</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {watchEventStatus === "ready" || watchEventStatus === "revealed"
            ? "Your companion has taken its post. The cinematic is ready."
            : "Your companion is preparing its guard while you work."}
        </p>
        {(watchEventStatus === "ready" || watchEventStatus === "revealed") &&
            watchEventId
          ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPlayerEventId(watchEventId);
                setCinemaOpen(true);
              }}
            >
              Watch cinematic
            </Button>
          )
          : null}
        {completionReady
          ? (
            <Button
              size="sm"
              onClick={() => {
                setPlayerEventId(watchCompletionEvent.id);
                setCinemaOpen(true);
              }}
            >
              See your companion return
            </Button>
          )
          : null}
      </GlassCard>
    )
    : null;

  if (isDesktop) {
    return (
      <div className="space-y-6 pt-1">
        <div
          className={cn(
            "flex flex-col gap-4 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between",
            outerShellCardClassName,
          )}
        >
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Focus studio
            </p>
            <p className="text-2xl font-semibold tracking-tight">
              Run focus sessions or resist an urge without leaving your
              companion.
            </p>
          </div>
          <div className="flex gap-2 rounded-2xl bg-background/[0.28] p-1">
            <Button
              variant={mode === "focus" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("focus")}
              className="min-w-[116px] gap-2"
            >
              <Timer className="h-4 w-4" />
              Focus
            </Button>
            <Button
              variant={mode === "resist" ? "default" : "ghost"}
              size="sm"
              onClick={() => setMode("resist")}
              className="min-w-[116px] gap-2"
            >
              <Shield className="h-4 w-4" />
              Resist
            </Button>
          </div>
        </div>

        {mode === "focus"
          ? (
            <div className="space-y-6">
              <GlassCard
                variant="pageShell"
                className="p-5 text-left space-y-2"
              >
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="h-5 w-5" />
                  <span className="text-sm font-medium">
                    Focus to grow your companion
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Every completed session adds steady XP without pulling
                  attention away from the work.
                </p>
              </GlassCard>

              {enableCosmiqCinema ? watchCard : null}
              <FocusTimer
                onStart={handleFocusStarted}
                onComplete={(session) => finishWatch(true, session)}
                onCancel={(session) => finishWatch(false, session)}
              />
            </div>
          )
          : <ResistModePanel />}
        {enableCosmiqCinema
          ? (
            <CompanionCinemaPlayer
              eventId={playerEventId ?? watchEventId}
              open={cinemaOpen}
              onOpenChange={setCinemaOpen}
              onFinished={() => {
                void queryClient.invalidateQueries({
                  queryKey: ["companion-cinema-history"],
                });
              }}
            />
          )
          : null}
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-6">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          variant={mode === "focus" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("focus")}
          className={cn("flex-1 gap-2")}
        >
          <Timer className="h-4 w-4" />
          Focus
        </Button>
        <Button
          variant={mode === "resist" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("resist")}
          className={cn("flex-1 gap-2")}
        >
          <Shield className="h-4 w-4" />
          Resist
        </Button>
      </div>

      {mode === "focus"
        ? (
          <>
            <GlassCard
              variant="pageShell"
              className="p-4 text-center space-y-2"
            >
              <div className="flex items-center justify-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-medium">
                  Focus to grow your companion
                </span>
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-xs text-muted-foreground">
                XP earned from focus sessions helps your companion evolve
              </p>
            </GlassCard>

            {enableCosmiqCinema ? watchCard : null}
            <FocusTimer
              onStart={handleFocusStarted}
              onComplete={(session) => finishWatch(true, session)}
              onCancel={(session) => finishWatch(false, session)}
            />
          </>
        )
        : <ResistModePanel />}
      {enableCosmiqCinema
        ? (
          <CompanionCinemaPlayer
            eventId={playerEventId ?? watchEventId}
            open={cinemaOpen}
            onOpenChange={setCinemaOpen}
            onFinished={() => {
              void queryClient.invalidateQueries({
                queryKey: ["companion-cinema-history"],
              });
            }}
          />
        )
        : null}
    </div>
  );
});

FocusTab.displayName = "FocusTab";
