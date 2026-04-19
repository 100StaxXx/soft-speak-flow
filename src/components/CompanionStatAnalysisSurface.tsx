import type { CSSProperties } from "react";
import {
  Brain,
  Compass,
  Flame,
  HeartPulse,
  Palette,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";
import {
  type CompanionStatAnalysis,
  type CompanionStatAttribute,
  type CompanionStatBreakdown,
  useCompanionStatAnalysis,
} from "@/hooks/useCompanionStatAnalysis";
import { cn } from "@/lib/utils";

interface CompanionStatAnalysisSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layoutMode: CompanionLayoutMode;
}

const ATTRIBUTE_META: Record<
  CompanionStatAttribute,
  { label: string; icon: typeof HeartPulse; accentClassName: string }
> = {
  vitality: {
    label: "Vitality",
    icon: HeartPulse,
    accentClassName: "text-rose-300",
  },
  wisdom: {
    label: "Wisdom",
    icon: Brain,
    accentClassName: "text-sky-300",
  },
  discipline: {
    label: "Discipline",
    icon: ShieldCheck,
    accentClassName: "text-amber-300",
  },
  resolve: {
    label: "Resolve",
    icon: Flame,
    accentClassName: "text-orange-300",
  },
  creativity: {
    label: "Creativity",
    icon: Palette,
    accentClassName: "text-fuchsia-300",
  },
  alignment: {
    label: "Alignment",
    icon: Compass,
    accentClassName: "text-emerald-300",
  },
};

const ACTIVITY_FIELDS: Array<{
  key: keyof CompanionStatAnalysis["activitySnapshot"];
  label: string;
}> = [
  { key: "morningCheckIns", label: "Morning check-ins" },
  { key: "eveningReflections", label: "Evening reflections" },
  { key: "habitCompletions", label: "Habit completions" },
  { key: "onTimeTasks", label: "On-time tasks" },
  { key: "trackedAttributeEvents", label: "Tracked boosts" },
  { key: "streakMilestones", label: "Streak milestones" },
];

const formatRange = (startDate: string, endDate: string) => {
  if (startDate === endDate) return startDate;
  return `${startDate} to ${endDate}`;
};

const mentorAccentStyle = (analysis: CompanionStatAnalysis | null): CSSProperties | undefined => {
  const color = analysis?.mentor.primaryColor;
  if (!color) return undefined;

  return {
    borderColor: `${color}55`,
    boxShadow: `0 16px 32px ${color}22`,
  };
};

function LoadingState() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-full" />
        </CardHeader>
      </Card>
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function BreakdownCard({ breakdown }: { breakdown: CompanionStatBreakdown }) {
  const meta = ATTRIBUTE_META[breakdown.attribute];
  const Icon = meta.icon;

  return (
    <Card className="border-border/60 bg-background/55">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-white/10 bg-white/5 p-2">
              <Icon className={cn("h-4 w-4", meta.accentClassName)} />
            </div>
            <div>
              <CardTitle className="text-base">{meta.label}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{breakdown.status}</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-background/70 text-foreground">
            {breakdown.band}
          </Badge>
        </div>
        <div className="flex items-end justify-between gap-3 rounded-xl border border-white/5 bg-background/40 px-3 py-2">
          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Score</span>
          <span className="text-2xl font-semibold">{breakdown.score}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Why it looks this way
          </p>
          <div className="space-y-2">
            {breakdown.primaryReasons.map((reason) => (
              <p key={reason} className="text-sm leading-6 text-foreground/88">
                {reason}
              </p>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Recent drivers
          </p>
          {breakdown.recentDrivers.length > 0 ? (
            <div className="space-y-2">
              {breakdown.recentDrivers.map((driver) => (
                <div
                  key={driver.key}
                  className="rounded-xl border border-white/5 bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{driver.label}</span>
                    <Badge variant="secondary" className="bg-white/10 text-[10px] uppercase tracking-wide">
                      {driver.window}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{driver.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              No recent tracked boosts yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AnalysisContent() {
  const {
    analysis,
    cached,
    error,
    isLoading,
    isRefreshing,
    refreshAnalysis,
  } = useCompanionStatAnalysis({ enabled: true });

  if (isLoading && !analysis) {
    return <LoadingState />;
  }

  if (!analysis) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Stats analysis is unavailable right now.</p>
            <p className="text-sm text-muted-foreground">{error ?? "Try again in a moment."}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refreshAnalysis()}
            disabled={isRefreshing}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            Retry analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card style={mentorAccentStyle(analysis)}>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Mentor read
            </Badge>
            {cached ? (
              <Badge variant="outline" className="bg-background/60">
                Cached for today
              </Badge>
            ) : null}
            <Badge variant="outline" className="bg-background/60">
              {analysis.analysisDate}
            </Badge>
          </div>
          <div className="space-y-2">
            <CardTitle className="text-xl leading-tight">
              {analysis.mentor.name} says your stats make sense.
            </CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Activity snapshot</CardTitle>
          <p className="text-sm text-muted-foreground">
            Recent activity:{" "}
            {formatRange(analysis.activitySnapshot.activityStartDate, analysis.activitySnapshot.activityEndDate)}
            {"  "} | {"  "}
            Provenance window:{" "}
            {formatRange(
              analysis.activitySnapshot.provenanceStartDate,
              analysis.activitySnapshot.provenanceEndDate,
            )}
          </p>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {ACTIVITY_FIELDS.map((field) => (
            <div
              key={field.key}
              className="rounded-xl border border-white/5 bg-background/45 px-3 py-3"
            >
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{field.label}</p>
              <p className="mt-2 text-2xl font-semibold">
                {analysis.activitySnapshot[field.key]}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {analysis.statBreakdowns.map((breakdown) => (
          <BreakdownCard key={breakdown.attribute} breakdown={breakdown} />
        ))}
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Best next move</CardTitle>
          <p className="text-sm leading-6 text-foreground/88">{analysis.suggestedAction}</p>
        </CardHeader>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={() => void refreshAnalysis()}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          {isRefreshing ? "Refreshing..." : "Refresh analysis"}
        </Button>
      </div>
    </div>
  );
}

export function CompanionStatAnalysisSurface({
  open,
  onOpenChange,
  layoutMode,
}: CompanionStatAnalysisSurfaceProps) {
  const sharedBody = (
    <div className="max-h-[75vh] overflow-y-auto px-4 pb-4 sm:px-1">
      <AnalysisContent />
    </div>
  );

  if (layoutMode === "desktop") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-testid="companion-stats-analysis-dialog"
          className="max-h-[88vh] max-w-4xl gap-0 overflow-hidden"
        >
          <DialogHeader className="px-6 pb-4 pt-6">
            <DialogTitle>Analyze My Stats</DialogTitle>
            <DialogDescription>
              A mentor-guided read on what your companion stats are saying and what has been shaping them lately.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6">{sharedBody}</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        data-testid="companion-stats-analysis-drawer"
        className="max-h-[88dvh] border-border/70 bg-card/96"
      >
        <DrawerHeader className="px-4 pb-3 pt-1 text-left">
          <DrawerTitle>Analyze My Stats</DrawerTitle>
          <DrawerDescription>
            A mentor-guided read on what your companion stats are saying and what has been shaping them lately.
          </DrawerDescription>
        </DrawerHeader>
        {sharedBody}
      </DrawerContent>
    </Drawer>
  );
}
