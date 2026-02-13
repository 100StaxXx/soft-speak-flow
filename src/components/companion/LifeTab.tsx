import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Sun, Moon, RefreshCw, CheckCircle2, Gauge, AlarmClock, BellRing } from "lucide-react";
import { useCompanionLife } from "@/hooks/useCompanionLife";

const urgencyVariant: Record<string, "secondary" | "default" | "destructive"> = {
  gentle: "secondary",
  important: "default",
  critical: "destructive",
};

const escalationVariant: Record<string, "secondary" | "default" | "destructive"> = {
  stable: "secondary",
  watch: "default",
  critical: "destructive",
};

const urgencyWeight: Record<string, number> = {
  critical: 3,
  important: 2,
  gentle: 1,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type AutonomyFilter = "all" | "critical" | "important" | "gentle" | "overdue";
type RecoveryLane = "stable" | "active" | "critical";
type WindowStage = "none" | "stable" | "closing" | "critical" | "overdue";

interface WindowMeta {
  label: string;
  variant: "secondary" | "default" | "destructive";
  sortRank: number;
  overdue: boolean;
  stage: WindowStage;
}

const formatChoiceLabel = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatDueWindow = (nextDueAt: string | null, nowMs: number): string => {
  if (!nextDueAt) return "No active due window";
  const due = new Date(nextDueAt);
  if (Number.isNaN(due.getTime())) return "No active due window";

  const deltaMinutes = Math.round((due.getTime() - nowMs) / 60_000);
  if (deltaMinutes <= -1) return `Overdue by ${Math.abs(deltaMinutes)}m`;
  if (deltaMinutes < 60) return `Due in ${Math.max(0, deltaMinutes)}m`;

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) return `Due in ${deltaHours}h`;

  return `Due ${due.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
};

const formatLatency = (minutes: number | null): string => {
  if (minutes === null) return "No data";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
};

const getWindowMeta = (dueAt: string | null, nowMs: number): WindowMeta => {
  if (!dueAt) {
    return {
      label: "No window",
      variant: "secondary",
      sortRank: 9_999_999,
      overdue: false,
      stage: "none",
    };
  }

  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) {
    return {
      label: "No window",
      variant: "secondary",
      sortRank: 9_999_999,
      overdue: false,
      stage: "none",
    };
  }

  const deltaMinutes = Math.round((due.getTime() - nowMs) / 60_000);
  if (deltaMinutes < 0) {
    return {
      label: `Overdue ${Math.abs(deltaMinutes)}m`,
      variant: "destructive",
      sortRank: -100_000 + deltaMinutes,
      overdue: true,
      stage: "overdue",
    };
  }

  if (deltaMinutes <= 120) {
    return {
      label: `Critical Window ${Math.max(0, deltaMinutes)}m`,
      variant: "destructive",
      sortRank: deltaMinutes,
      overdue: false,
      stage: "critical",
    };
  }

  if (deltaMinutes <= 360) {
    return {
      label: `Closing Soon ${Math.ceil(deltaMinutes / 60)}h`,
      variant: "default",
      sortRank: deltaMinutes,
      overdue: false,
      stage: "closing",
    };
  }

  if (deltaMinutes < 1440) {
    return {
      label: `Due in ${Math.ceil(deltaMinutes / 60)}h`,
      variant: "secondary",
      sortRank: deltaMinutes,
      overdue: false,
      stage: "stable",
    };
  }

  return {
    label: `Due ${due.toLocaleDateString([], { month: "short", day: "numeric" })}`,
    variant: "secondary",
    sortRank: deltaMinutes,
    overdue: false,
    stage: "stable",
  };
};

export const LifeTab = memo(() => {
  const {
    lifeSnapshot,
    rituals,
    requests,
    requestCadence,
    requestAnalytics,
    isLoading,
    processDayTick,
    generateRequests,
    completeRitual,
    resolveRequest,
    advanceCampaign,
  } = useCompanionLife();
  const [autonomyFilter, setAutonomyFilter] = useState<AutonomyFilter>("all");
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [escalationNotice, setEscalationNotice] = useState<string | null>(null);
  const previousStagesRef = useRef<Record<string, WindowStage>>({});

  useEffect(() => {
    const tick = () => setClockNow(Date.now());
    const intervalId = setInterval(tick, 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const completedRituals = rituals.filter((ritual) => ritual.status === "completed").length;
  const pendingRituals = rituals.filter((ritual) => ritual.status !== "completed");
  const ritualProgress = rituals.length > 0 ? Math.round((completedRituals / rituals.length) * 100) : 0;
  const cooldownPercent = requestCadence.maxOpenRequests > 0
    ? Math.round((requestCadence.openRequests / requestCadence.maxOpenRequests) * 100)
    : 0;
  const escalationPercent = Math.min(100, Math.round((requestCadence.escalationPressure / 1.2) * 100));
  const dueWindowLabel = formatDueWindow(requestCadence.nextDueAt, clockNow);
  const recoveryPressure = Math.min(
    100,
    Math.round(
      (100 - clamp(lifeSnapshot.routineStabilityScore, 0, 100)) * 0.55
      + clamp(lifeSnapshot.requestFatigue, 0, 10) * 7
      + requestCadence.overdueCount * 12,
    ),
  );
  const recoveryLane: RecoveryLane = recoveryPressure >= 72
    ? "critical"
    : recoveryPressure >= 44
      ? "active"
      : "stable";

  const requestsWithWindow = useMemo(() => {
    return requests.map((request) => ({
      request,
      windowMeta: getWindowMeta(request.dueAt, clockNow),
    }));
  }, [clockNow, requests]);

  const sortedRequests = useMemo(() => {
    return [...requestsWithWindow].sort((a, b) => {
      const urgencyDelta = (urgencyWeight[b.request.urgency] ?? 0) - (urgencyWeight[a.request.urgency] ?? 0);
      if (urgencyDelta !== 0) return urgencyDelta;
      return a.windowMeta.sortRank - b.windowMeta.sortRank;
    });
  }, [requestsWithWindow]);

  const visibleRequests = useMemo(() => {
    if (autonomyFilter === "all") return sortedRequests;
    if (autonomyFilter === "overdue") return sortedRequests.filter((entry) => entry.windowMeta.overdue);
    return sortedRequests.filter((entry) => entry.request.urgency === autonomyFilter);
  }, [autonomyFilter, sortedRequests]);

  const overdueAutonomyCount = useMemo(
    () => requestsWithWindow.filter((entry) => entry.windowMeta.overdue).length,
    [requestsWithWindow],
  );

  useEffect(() => {
    const nextStages: Record<string, WindowStage> = {};
    const escalatedTitles: string[] = [];

    sortedRequests.forEach(({ request, windowMeta }) => {
      const previous = previousStagesRef.current[request.id];
      const isCriticalNow = windowMeta.stage === "critical" || windowMeta.stage === "overdue";
      const wasCritical = previous === "critical" || previous === "overdue";

      if (previous && isCriticalNow && !wasCritical) {
        escalatedTitles.push(request.title);
      }
      nextStages[request.id] = windowMeta.stage;
    });

    previousStagesRef.current = nextStages;

    if (escalatedTitles.length > 0) {
      if (escalatedTitles.length === 1) {
        setEscalationNotice(`${escalatedTitles[0]} entered a critical response window.`);
      } else {
        setEscalationNotice(`${escalatedTitles.length} autonomy events entered a critical response window.`);
      }
    }
  }, [sortedRequests]);

  useEffect(() => {
    if (!escalationNotice) return;
    const timeout = setTimeout(() => setEscalationNotice(null), 12_000);
    return () => clearTimeout(timeout);
  }, [escalationNotice]);

  if (isLoading) {
    return (
      <div className="space-y-4 mt-6">
        <Card className="h-28 animate-pulse" />
        <Card className="h-48 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      <Card className="p-4 bg-card/70 border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Morning Check-In</p>
            <h3 className="text-lg font-semibold mt-1">{lifeSnapshot.currentEmotionalArc.replace(/_/g, " ")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Stability {Math.round(lifeSnapshot.routineStabilityScore)} · Fatigue {lifeSnapshot.requestFatigue}
            </p>
          </div>
          <Sun className="h-5 w-5 text-amber-300" />
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button
            size="sm"
            onClick={() => processDayTick.mutate()}
            disabled={processDayTick.isPending}
          >
            {processDayTick.isPending ? "Refreshing..." : "Run Day Tick"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generateRequests.mutate()}
            disabled={generateRequests.isPending || requestCadence.cooldownActive}
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {generateRequests.isPending
              ? "Generating"
              : requestCadence.cooldownActive
                ? "Cooldown Active"
                : "Generate Requests"}
          </Button>
        </div>
        {requestCadence.cooldownActive && (
          <p className="text-xs text-muted-foreground mt-2">
            Request generation is paused until an active request is resolved.
          </p>
        )}
      </Card>

      <Card className="p-4 bg-card/70 border-border/60 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold flex items-center gap-2">
            <Gauge className="h-4 w-4 text-cyan-300" />
            Request Cadence Guardrails
          </h3>
          <Badge variant={escalationVariant[requestCadence.escalationLevel] ?? "secondary"} className="capitalize">
            {requestCadence.escalationLevel}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground">
          Slots {requestCadence.openRequests}/{requestCadence.maxOpenRequests} · {dueWindowLabel}
        </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Cooldown pressure</span>
            <span>{requestCadence.slotsAvailable} slot{requestCadence.slotsAvailable === 1 ? "" : "s"} open</span>
          </div>
          <Progress value={cooldownPercent} className="h-2" />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Urgency escalation</span>
            <span>{Math.round(requestCadence.escalationPressure * 100)}%</span>
          </div>
          <Progress value={escalationPercent} className="h-2" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Gentle {requestCadence.urgencyCounts.gentle}</Badge>
          <Badge variant="default">Important {requestCadence.urgencyCounts.important}</Badge>
          <Badge variant="destructive">Critical {requestCadence.urgencyCounts.critical}</Badge>
          {requestCadence.overdueCount > 0 && (
            <Badge variant="destructive" className="gap-1">
              <AlarmClock className="h-3 w-3" />
              Overdue {requestCadence.overdueCount}
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {requestCadence.cooldownActive
            ? "Resolve or complete one request to reopen cadence slots."
            : `You can safely generate up to ${requestCadence.recommendedNewRequests} new request${requestCadence.recommendedNewRequests === 1 ? "" : "s"} right now.`}
        </p>
      </Card>

      <Card className="p-4 bg-card/70 border-border/60 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <AlarmClock className="h-4 w-4 text-amber-300" />
            Recovery Lane
          </h3>
          <Badge
            variant={recoveryLane === "critical" ? "destructive" : recoveryLane === "active" ? "default" : "secondary"}
            className="capitalize"
          >
            {recoveryLane}
          </Badge>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Recovery pressure</span>
            <span>{recoveryPressure}%</span>
          </div>
          <Progress value={recoveryPressure} className="h-2" />
        </div>
        <p className="text-xs text-muted-foreground">
          {recoveryLane === "critical"
            ? "Ritual consistency is under strain. Complete one pending ritual and one active request this session."
            : recoveryLane === "active"
              ? "You are in repair mode. Keep your ritual streak intact to bring pressure down."
              : "Recovery pressure is stable. Maintain rhythm to protect bond momentum."}
        </p>
        {pendingRituals.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => completeRitual.mutate(pendingRituals[0].id)}
            disabled={completeRitual.isPending}
          >
            Complete Next Ritual
          </Button>
        )}
      </Card>

      <Card className="p-4 bg-card/70 border-border/60 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <BellRing className="h-4 w-4 text-rose-300" />
            Autonomy Event Inbox
          </h3>
          <span className="text-xs text-muted-foreground">{sortedRequests.length} active</span>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-border/50 bg-background/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Avg Response</p>
            <p className="text-sm font-medium" data-testid="autonomy-metric-latency">
              {formatLatency(requestAnalytics.averageResponseMinutes)}
            </p>
          </div>
          <div className="rounded-md border border-border/50 bg-background/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Completion Streak</p>
            <p className="text-sm font-medium" data-testid="autonomy-metric-streak">
              {requestAnalytics.completionStreakDays} day{requestAnalytics.completionStreakDays === 1 ? "" : "s"}
            </p>
          </div>
          <div className="rounded-md border border-border/50 bg-background/30 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">30d Completion</p>
            <p className="text-sm font-medium" data-testid="autonomy-metric-rate">
              {requestAnalytics.completionRate30d === null
                ? "No data"
                : `${Math.round(requestAnalytics.completionRate30d)}%`}
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Companion-initiated moments with response windows. Overdue events: {overdueAutonomyCount}.
        </p>

        {escalationNotice && (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            data-testid="autonomy-escalation-banner"
          >
            {escalationNotice}
          </div>
        )}

        {sortedRequests.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(["all", "critical", "important", "gentle", "overdue"] as const).map((filterKey) => {
              const count = filterKey === "all"
                ? sortedRequests.length
                : filterKey === "overdue"
                  ? sortedRequests.filter((entry) => entry.windowMeta.overdue).length
                  : sortedRequests.filter((entry) => entry.request.urgency === filterKey).length;
              if (filterKey === "overdue" && count === 0) return null;
              return (
                <Button
                  key={filterKey}
                  size="sm"
                  variant={autonomyFilter === filterKey ? "secondary" : "outline"}
                  onClick={() => setAutonomyFilter(filterKey)}
                >
                  {formatChoiceLabel(filterKey)} ({count})
                </Button>
              );
            })}
          </div>
        )}

        {sortedRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active autonomy events right now.</p>
        ) : visibleRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No autonomy events for this urgency filter.</p>
        ) : (
          <div className="space-y-2">
            {visibleRequests.map(({ request, windowMeta }) => (
              <div
                key={request.id}
                className={`rounded-lg border p-3 bg-background/30 ${windowMeta.overdue ? "border-destructive/50" : "border-border/50"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{request.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{request.prompt}</p>
                  </div>
                  <Badge variant={urgencyVariant[request.urgency] ?? "secondary"}>{request.urgency}</Badge>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant={windowMeta.variant}>{windowMeta.label}</Badge>
                  <Badge variant="outline">{formatChoiceLabel(request.requestType)}</Badge>
                </div>

                {request.consequenceHint && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {request.consequenceHint}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => resolveRequest.mutate({ requestId: request.id, action: "accept" })}
                    disabled={resolveRequest.isPending}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => resolveRequest.mutate({ requestId: request.id, action: "complete" })}
                    disabled={resolveRequest.isPending}
                  >
                    Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveRequest.mutate({ requestId: request.id, action: "snooze" })}
                    disabled={resolveRequest.isPending}
                  >
                    Snooze
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => resolveRequest.mutate({ requestId: request.id, action: "decline" })}
                    disabled={resolveRequest.isPending}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 bg-card/70 border-border/60 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Day Rituals
          </h3>
          <span className="text-xs text-muted-foreground">{completedRituals}/{rituals.length || 0}</span>
        </div>
        <Progress value={ritualProgress} className="h-2" />

        <div className="space-y-2">
          {rituals.length === 0 && (
            <p className="text-sm text-muted-foreground">No rituals generated yet. Run day tick to plan today.</p>
          )}

          {rituals.map((ritual) => (
            <div key={ritual.id} className="rounded-lg border border-border/50 p-3 bg-background/30">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{ritual.ritualDef?.title ?? "Companion Ritual"}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ritual.ritualDef?.description ?? "Build consistency with your companion."}
                  </p>
                </div>
                <Badge variant={urgencyVariant[ritual.urgency] ?? "secondary"}>{ritual.urgency}</Badge>
              </div>

              <div className="mt-3 flex items-center gap-2">
                {ritual.status === "completed" ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Completed
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => completeRitual.mutate(ritual.id)}
                    disabled={completeRitual.isPending}
                  >
                    Complete Ritual
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-card/70 border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Evening Reflection</p>
            <h3 className="text-lg font-semibold mt-1">Close the loop before nightfall</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Advance your campaign chapter after reviewing your day.
            </p>
          </div>
          <Moon className="h-5 w-5 text-indigo-300" />
        </div>

        <Button className="mt-4" onClick={() => advanceCampaign.mutate("steady")} disabled={advanceCampaign.isPending}>
          {advanceCampaign.isPending ? "Advancing..." : "Advance Campaign"}
        </Button>
      </Card>
    </div>
  );
});

LifeTab.displayName = "LifeTab";
