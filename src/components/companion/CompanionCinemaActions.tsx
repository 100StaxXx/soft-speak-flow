import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, History, Loader2, Orbit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import {
  completeCompanionCinemaInteraction,
  getCompanionCinemaHistory,
  getCompanionCinemaInteractionStatus,
  resolveCinemaEventSummary,
  startCompanionCinemaInteraction,
  type CompanionCinemaInteractionRun,
  type CompanionCinemaInteractionType,
} from "@/services/companionCinemaInteractions";
import { CompanionCinemaPlayer } from "./CompanionCinemaPlayer";

export const CompanionCinemaActions = () => {
  const [run, setRun] = useState<CompanionCinemaInteractionRun | null>(null);
  const [starting, setStarting] = useState<CompanionCinemaInteractionType | null>(null);
  const [forgeOpen, setForgeOpen] = useState(false);
  const [forgeIntention, setForgeIntention] = useState("");
  const [cinemaOpen, setCinemaOpen] = useState(false);
  const [playerEventId, setPlayerEventId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: history } = useQuery({
    queryKey: ["companion-cinema-history"],
    queryFn: getCompanionCinemaHistory,
    refetchInterval: 15_000,
  });
  const recoverableRun = useMemo(() => history?.runs.find((candidate) => {
    if (!["hunt", "forge"].includes(candidate.interaction_type)) return false;
    const startEvent = resolveCinemaEventSummary(candidate.start_event);
    return ["preparing", "active", "returning"].includes(candidate.status) ||
      (startEvent?.status === "ready" && !startEvent.revealed_at);
  }) ?? null, [history?.runs]);
  useEffect(() => {
    if (!run && recoverableRun) setRun(recoverableRun);
  }, [recoverableRun, run]);
  const { data: runStatus } = useQuery({
    queryKey: ["companion-cinema-interaction", run?.id ?? "none"],
    queryFn: () => getCompanionCinemaInteractionStatus(run!.id),
    enabled: Boolean(run?.id),
    refetchInterval: 15_000,
  });
  const resolvedRun = runStatus?.run ?? run;
  const startEvent = resolveCinemaEventSummary(runStatus?.run?.start_event ?? resolvedRun?.start_event);
  const eventStatus = startEvent?.status;
  const eventId = resolvedRun?.cinema_event_id ?? null;
  const ready = eventStatus === "ready" || eventStatus === "revealed";

  const start = async (
    interactionType: CompanionCinemaInteractionType,
    intention?: string,
  ) => {
    setStarting(interactionType);
    try {
      const result = await startCompanionCinemaInteraction({
        interactionType,
        intention,
      });
      setRun(result.run);
      void queryClient.invalidateQueries({ queryKey: ["companion-cinema-history"] });
      setForgeOpen(false);
      if (interactionType === "hunt") {
        toast.success("Your companion has left on the Hunt.");
      } else if (interactionType === "forge") {
        toast.success("The Forge has begun.");
      }
      if (result.quota && result.quota.dailyRemaining === 0) {
        toast.info("That was today’s final cinematic of this type.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to begin cinematic");
    } finally {
      setStarting(null);
    }
  };

  const reveal = async () => {
    if (!eventId || !resolvedRun?.id) return;
    if (["hunt", "forge"].includes(resolvedRun.interaction_type)) {
      await completeCompanionCinemaInteraction({
        runId: resolvedRun.id,
        completed: true,
        outcome: resolvedRun.interaction_type === "hunt"
          ? { returned: true }
          : { ritualEntered: true, intention: resolvedRun.intention ?? null },
      });
    }
    setPlayerEventId(eventId);
    setCinemaOpen(true);
  };

  const recentMoments = (history?.runs ?? []).flatMap((historyRun) => {
    const events = [
      resolveCinemaEventSummary(historyRun.start_event),
      resolveCinemaEventSummary(historyRun.completion_event),
    ].filter((event): event is NonNullable<typeof event> =>
      Boolean(event && ["ready", "revealed"].includes(event.status))
    );
    return events.map((event) => ({ event, run: historyRun }));
  }).slice(0, 4);
  // The server owns rollout eligibility. Keep paid actions hidden until that
  // affirmative result arrives so disabled users never see a clickable flash.
  const cinemaAvailable = history?.available === true;

  if (!cinemaAvailable && !resolvedRun && recentMoments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3" data-testid="companion-cinema-actions">
      {cinemaAvailable ? <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void start("hunt")}
          disabled={Boolean(starting)}
          className="group rounded-2xl border border-border/70 bg-background/35 p-4 text-left transition hover:border-stardust-gold/35 hover:bg-stardust-gold/[0.06] disabled:opacity-60"
        >
          <div className="flex items-center gap-2 text-stardust-gold">
            {starting === "hunt" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Orbit className="h-4 w-4" />}
            <span className="font-semibold">The Hunt</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Send your companion beyond the known path to return with a symbolic relic.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setForgeOpen(true)}
          disabled={Boolean(starting)}
          className="group rounded-2xl border border-border/70 bg-background/35 p-4 text-left transition hover:border-stardust-gold/35 hover:bg-stardust-gold/[0.06] disabled:opacity-60"
        >
          <div className="flex items-center gap-2 text-stardust-gold">
            {starting === "forge" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flame className="h-4 w-4" />}
            <span className="font-semibold">The Forge</span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Name the challenge. Prepare for it together through a generated ritual.
          </p>
        </button>
      </div> : null}

      {resolvedRun ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-stardust-gold/20 bg-stardust-gold/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{resolvedRun.title ?? "Cinematic moment"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ready
                ? "Your companion wants to see you."
                : "Something is taking shape. You’ll be able to watch it when it is ready."}
            </p>
          </div>
          {ready && eventId ? (
            <Button size="sm" onClick={() => void reveal()}>
              Enter cinematic
            </Button>
          ) : null}
        </div>
      ) : null}

      {recentMoments.length > 0 ? (
        <div className="rounded-2xl border border-border/60 bg-background/25 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <History className="h-4 w-4" />
            Cinema history
          </div>
          <div className="space-y-2">
            {recentMoments.map(({ event, run: historyRun }) => (
              <button
                key={event.id}
                type="button"
                className="flex w-full items-center justify-between rounded-xl border border-border/50 px-3 py-2 text-left transition hover:bg-muted/40"
                onClick={() => {
                  setPlayerEventId(event.id);
                  setCinemaOpen(true);
                }}
              >
                <span>
                  <span className="block text-sm font-medium">{event.title ?? historyRun.title}</span>
                  <span className="block text-xs capitalize text-muted-foreground">
                    {historyRun.interaction_type}
                  </span>
                </span>
                <span className="text-xs text-stardust-gold">Watch</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <Dialog open={forgeOpen} onOpenChange={setForgeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What are we taking down?</DialogTitle>
            <DialogDescription>
              Name the challenge your companion should prepare to face beside you.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={forgeIntention}
            onChange={(event) => setForgeIntention(event.target.value)}
            placeholder="Close four website clients"
            maxLength={500}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setForgeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!forgeIntention.trim() || starting === "forge"}
              onClick={() => void start("forge", forgeIntention.trim())}
            >
              {starting === "forge" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enter the Forge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CompanionCinemaPlayer
        eventId={playerEventId ?? eventId}
        open={cinemaOpen}
        onOpenChange={setCinemaOpen}
        onFinished={() => {
          void queryClient.invalidateQueries({ queryKey: ["companion-cinema-history"] });
          if (resolvedRun?.id) {
            void queryClient.invalidateQueries({
              queryKey: ["companion-cinema-interaction", resolvedRun.id],
            });
          }
        }}
      />
    </div>
  );
};
