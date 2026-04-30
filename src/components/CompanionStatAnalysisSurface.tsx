import { type CSSProperties, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
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
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

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
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import type { CompanionLayoutMode } from "@/hooks/useCompanionLayoutMode";
import {
  type CompanionStatAnalysis,
  type CompanionStatAttribute,
  type CompanionStatBand,
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
  { label: string; icon: typeof HeartPulse; accentClassName: string; gradientClassName: string }
> = {
  vitality: {
    label: "Vitality",
    icon: HeartPulse,
    accentClassName: "text-rose-300",
    gradientClassName: "from-rose-500/20 to-red-500/10",
  },
  wisdom: {
    label: "Wisdom",
    icon: Brain,
    accentClassName: "text-sky-300",
    gradientClassName: "from-sky-500/20 to-cyan-500/10",
  },
  discipline: {
    label: "Discipline",
    icon: ShieldCheck,
    accentClassName: "text-amber-300",
    gradientClassName: "from-amber-500/20 to-yellow-500/10",
  },
  resolve: {
    label: "Resolve",
    icon: Flame,
    accentClassName: "text-orange-300",
    gradientClassName: "from-orange-500/20 to-red-500/10",
  },
  creativity: {
    label: "Creativity",
    icon: Palette,
    accentClassName: "text-fuchsia-300",
    gradientClassName: "from-fuchsia-500/20 to-pink-500/10",
  },
  alignment: {
    label: "Alignment",
    icon: Compass,
    accentClassName: "text-emerald-300",
    gradientClassName: "from-emerald-500/20 to-teal-500/10",
  },
};

const ATTRIBUTE_ORDER: CompanionStatAttribute[] = [
  "vitality",
  "wisdom",
  "discipline",
  "resolve",
  "creativity",
  "alignment",
];

const STAT_MIN = 100;
const STAT_MAX = 1000;

const RANK_BY_BAND: Record<CompanionStatBand, string> = {
  Emerging: "C",
  Building: "B",
  Strong: "A",
  Exceptional: "S",
};

const rankClassName = (rank: string) =>
  ({
    S: "border-yellow-300/50 bg-yellow-300/12 text-yellow-200",
    A: "border-sky-300/45 bg-sky-300/12 text-sky-200",
    B: "border-emerald-300/45 bg-emerald-300/12 text-emerald-200",
    C: "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
  })[rank] ?? "border-border bg-background text-foreground";

const revealContainerVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: "easeOut",
      staggerChildren: 0.045,
    },
  },
};

const revealItemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: "easeOut" },
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
  { key: "hardTaskWins", label: "Hard task wins" },
  { key: "recoveryActions", label: "Recovery actions" },
  { key: "healthActions", label: "Health actions" },
  { key: "creativeActions", label: "Creative actions" },
  { key: "relationshipActions", label: "Relationship actions" },
  { key: "bounceBackDays", label: "Bounce-back days" },
];

const formatRange = (startDate: string, endDate: string) => {
  if (startDate === endDate) return startDate;
  return `${startDate} to ${endDate}`;
};

const formatSnakeLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getScorePercent = (score: number) =>
  Math.max(0, Math.min(100, Math.round(((score - STAT_MIN) / (STAT_MAX - STAT_MIN)) * 100)));

interface CompanionStatCardViewModel {
  attribute: CompanionStatAttribute;
  label: string;
  score: number;
  percent: number;
  band: CompanionStatBand;
  rank: string;
  status: string;
  reasons: string[];
  drivers: CompanionStatBreakdown["recentDrivers"];
}

export const buildCompanionStatAnalysisViewModel = (analysis: CompanionStatAnalysis) => {
  const breakdownByAttribute = new Map(
    analysis.statBreakdowns.map((breakdown) => [breakdown.attribute, breakdown]),
  );
  const statCards = ATTRIBUTE_ORDER.map((attribute) => {
    const breakdown = breakdownByAttribute.get(attribute);
    if (!breakdown) {
      throw new Error(`Missing stat breakdown for ${attribute}`);
    }

    return {
      attribute,
      label: ATTRIBUTE_META[attribute].label,
      score: breakdown.score,
      percent: getScorePercent(breakdown.score),
      band: breakdown.band,
      rank: RANK_BY_BAND[breakdown.band],
      status: breakdown.status,
      reasons: breakdown.primaryReasons,
      drivers: breakdown.recentDrivers,
    } satisfies CompanionStatCardViewModel;
  });
  const rankedStats = [...statCards].sort((left, right) => {
    const scoreDiff = right.score - left.score;
    if (scoreDiff !== 0) return scoreDiff;
    return ATTRIBUTE_ORDER.indexOf(left.attribute) - ATTRIBUTE_ORDER.indexOf(right.attribute);
  });
  const weakestStat = [...statCards].sort((left, right) => {
    const scoreDiff = left.score - right.score;
    if (scoreDiff !== 0) return scoreDiff;
    return ATTRIBUTE_ORDER.indexOf(left.attribute) - ATTRIBUTE_ORDER.indexOf(right.attribute);
  })[0];
  const dominantLabel = ATTRIBUTE_META[analysis.statProfile.dominantStat].label;
  const secondaryLabel = ATTRIBUTE_META[analysis.statProfile.secondaryStat].label;
  const radarData = ATTRIBUTE_ORDER.map((attribute) => {
    const card = statCards.find((stat) => stat.attribute === attribute);
    if (!card) throw new Error(`Missing radar stat for ${attribute}`);
    return {
      attribute: ATTRIBUTE_META[attribute].label,
      score: card.score,
      percent: card.percent,
    };
  });

  return {
    statCards,
    rankedStats,
    weakestStat,
    dominantLabel,
    secondaryLabel,
    radarData,
    currentBuild: `${dominantLabel} / ${secondaryLabel}`,
  };
};

const mentorAccentStyle = (analysis: CompanionStatAnalysis): CSSProperties | undefined => {
  const color = analysis.mentor.primaryColor;
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

function StatSheetCard({ stat, index }: { stat: CompanionStatCardViewModel; index: number }) {
  const meta = ATTRIBUTE_META[stat.attribute];
  const Icon = meta.icon;

  return (
    <motion.div variants={revealItemVariants}>
      <Card
        data-testid={`companion-rpg-stat-card-${stat.attribute}`}
        className={cn(
          "h-full overflow-hidden border-border/60 bg-gradient-to-br bg-background/60",
          meta.gradientClassName,
        )}
      >
        <CardHeader className="space-y-4 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                <Icon className={cn("h-4 w-4", meta.accentClassName)} />
              </div>
              <div>
                <CardTitle className="text-base">{stat.label}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Loadout slot #{index + 1}</p>
              </div>
            </div>
            <Badge variant="outline" className={cn("border", rankClassName(stat.rank))}>
              Rank {stat.rank}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">{stat.band}</span>
              <span className="text-2xl font-semibold">{stat.score}</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-lg border border-white/5 bg-background/55"
              aria-label={`${stat.label} score meter`}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={stat.percent}
              aria-valuetext={`${stat.score} out of ${STAT_MAX}`}
              role="progressbar"
            >
              <div
                className="h-full rounded-lg bg-primary/80 transition-all duration-500"
                style={{ width: `${stat.percent}%` }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-foreground/85">{stat.status}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatIntelCard({ stat }: { stat: CompanionStatCardViewModel }) {
  const meta = ATTRIBUTE_META[stat.attribute];
  const Icon = meta.icon;

  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <Icon className={cn("h-4 w-4", meta.accentClassName)} />
          </div>
          <div className="flex items-center gap-2">
            <div>
              <p className="text-sm font-semibold">{stat.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.band} | {stat.score}</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 border", rankClassName(stat.rank))}>
          Rank {stat.rank}
        </Badge>
      </div>

      <div className="mt-3 space-y-3">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Why it looks this way</p>
          <div className="space-y-2">
            {stat.reasons.map((reason) => (
              <p key={reason} className="text-sm leading-6 text-foreground/90">
                {reason}
              </p>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">Recent drivers</p>
          {stat.drivers.length > 0 ? (
            <div className="space-y-2">
              {stat.drivers.map((driver) => (
                <div
                  key={driver.key}
                  className="rounded-lg border border-white/5 bg-background/40 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{driver.label}</span>
                    <Badge variant="secondary" className="bg-white/10 text-[10px]">
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
      </div>
    </div>
  );
}

function AnalysisUnavailableCard({
  message,
  isRefreshing,
  onRetry,
}: {
  message: string;
  isRefreshing: boolean;
  onRetry: () => void;
}) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Stats analysis is unavailable right now.</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
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

function CompanionStatAnalysisView({
  analysis,
  cached,
  isRefreshing,
  onRefresh,
}: {
  analysis: CompanionStatAnalysis;
  cached: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const viewModel = useMemo(() => buildCompanionStatAnalysisViewModel(analysis), [analysis]);
  const dominantMeta = ATTRIBUTE_META[analysis.statProfile.dominantStat];
  const secondaryMeta = ATTRIBUTE_META[analysis.statProfile.secondaryStat];
  const DominantIcon = dominantMeta.icon;
  const SecondaryIcon = secondaryMeta.icon;

  return (
    <motion.div
      className="space-y-4"
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      variants={revealContainerVariants}
    >
      <motion.div variants={revealItemVariants}>
        <Card
          className="overflow-hidden border-primary/20 bg-[linear-gradient(135deg,hsl(var(--primary)/0.16),hsl(var(--background)/0.72)_42%,hsl(var(--accent)/0.11))]"
          style={mentorAccentStyle(analysis)}
        >
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                <Sparkles className="mr-1 h-3.5 w-3.5" />
                Stat Reading
              </Badge>
              <Badge variant="outline" className="bg-background/60">
                {analysis.mentor.name}
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

            <div className="rounded-lg border border-white/10 bg-background/45 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Fantasy Title</p>
                <Badge variant="outline" className="bg-background/60">
                  {analysis.fantasyTitle.archetype}
                </Badge>
              </div>
              <CardTitle className="mt-2 text-3xl leading-tight md:text-4xl">
                {analysis.fantasyTitle.title}
              </CardTitle>
              <p className="mt-3 text-sm leading-6 text-foreground/90">
                {analysis.fantasyTitle.explanation}
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-end">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Current Build</p>
                  <CardTitle className="mt-1 text-2xl leading-tight md:text-3xl">
                    {viewModel.currentBuild}
                  </CardTitle>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{analysis.summary}</p>
                <p className="text-sm leading-6 text-foreground/90">{analysis.narrativeBrief}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/10 bg-background/40 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <DominantIcon className={cn("h-3.5 w-3.5", dominantMeta.accentClassName)} />
                    Dominant
                  </div>
                  <p className="mt-2 text-sm font-semibold">{viewModel.dominantLabel}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-background/40 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <SecondaryIcon className={cn("h-3.5 w-3.5", secondaryMeta.accentClassName)} />
                    Growing
                  </div>
                  <p className="mt-2 text-sm font-semibold">{viewModel.secondaryLabel}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Momentum</p>
                  <p className="mt-2 text-sm font-semibold">{formatSnakeLabel(analysis.momentumState)}</p>
                </div>
                <div className="rounded-lg border border-white/10 bg-background/40 p-3">
                  <p className="text-xs text-muted-foreground">Needs Support</p>
                  <p className="mt-2 text-sm font-semibold">{viewModel.weakestStat.label}</p>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <motion.div variants={revealItemVariants}>
          <Card className="h-full border-border/60 bg-background/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Character Sheet</CardTitle>
              <p className="text-sm text-muted-foreground">
                Stat shape based on normalized 0-100 power from your 100-1000 scores.
              </p>
            </CardHeader>
            <CardContent>
              <div
                data-testid="companion-stat-radar"
                className="h-[260px] min-h-[260px] w-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={viewModel.radarData} outerRadius="72%">
                    <PolarGrid stroke="hsl(var(--border) / 0.45)" />
                    <PolarAngleAxis
                      dataKey="attribute"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      axisLine={false}
                      domain={[0, 100]}
                      tick={false}
                    />
                    <Radar
                      dataKey="percent"
                      name="Score"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.28}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={revealItemVariants}>
          <Card className="h-full border-primary/20 bg-primary/5">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Recommended Quest
                </Badge>
                <Badge variant="outline" className={cn("border", rankClassName(viewModel.weakestStat.rank))}>
                  Rebalance {viewModel.weakestStat.label}
                </Badge>
              </div>
              <CardTitle className="text-xl">Best next move</CardTitle>
              <p className="text-sm leading-6 text-foreground/90">{analysis.suggestedAction}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-white/10 bg-background/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Today reads as</p>
                <p className="mt-2 text-sm font-semibold">{analysis.dailyNarrative}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{analysis.weeklyNarrative}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-background/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Miss read</p>
                <p className="mt-2 text-sm font-semibold">{formatSnakeLabel(analysis.recentMissInterpretation)}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {viewModel.rankedStats.map((stat, index) => (
          <StatSheetCard key={stat.attribute} stat={stat} index={index} />
        ))}
      </div>

      <motion.details
        variants={revealItemVariants}
        className="rounded-lg border border-border/60 bg-background/45 p-4"
      >
        <summary className="cursor-pointer text-sm font-semibold">
          Battle Log & Stat Intel
        </summary>

        <div className="mt-4 space-y-4">
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-semibold">Activity snapshot</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Recent activity:{" "}
                {formatRange(analysis.activitySnapshot.activityStartDate, analysis.activitySnapshot.activityEndDate)}
                {"  "} | {"  "}
                Provenance window:{" "}
                {formatRange(
                  analysis.activitySnapshot.provenanceStartDate,
                  analysis.activitySnapshot.provenanceEndDate,
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {ACTIVITY_FIELDS.map((field) => (
                <div
                  key={field.key}
                  className="rounded-lg border border-white/5 bg-background/45 px-3 py-3"
                >
                  <p className="text-xs text-muted-foreground">{field.label}</p>
                  <p className="mt-2 text-xl font-semibold">
                    {analysis.activitySnapshot[field.key]}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {analysis.strongestRecentDrivers.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-base font-semibold">Strongest recent drivers</h3>
              <div className="grid gap-2 md:grid-cols-2">
                {analysis.strongestRecentDrivers.map((driver) => (
                  <div key={driver.key} className="rounded-lg border border-white/5 bg-background/40 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-medium">{driver.label}</span>
                      <Badge variant="outline" className="bg-background/60">
                        {driver.window}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{driver.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-base font-semibold">Per-stat intel</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {viewModel.statCards.map((stat) => (
                <StatIntelCard key={stat.attribute} stat={stat} />
              ))}
            </div>
          </section>
        </div>
      </motion.details>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          {isRefreshing ? "Refreshing..." : "Refresh analysis"}
        </Button>
      </div>
    </motion.div>
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
  const [renderBoundaryKey, setRenderBoundaryKey] = useState(0);

  const handleRefresh = () => {
    void refreshAnalysis().catch(() => undefined);
  };

  const handleRenderRecovery = () => {
    void refreshAnalysis()
      .catch(() => undefined)
      .finally(() => {
        setRenderBoundaryKey((current) => current + 1);
      });
  };

  if (isLoading && !analysis) {
    return <LoadingState />;
  }

  if (!analysis) {
    return (
      <AnalysisUnavailableCard
        message={error ?? "Try again in a moment."}
        isRefreshing={isRefreshing}
        onRetry={handleRefresh}
      />
    );
  }

  return (
    <SectionErrorBoundary
      key={renderBoundaryKey}
      section="companion-stat-analysis"
      fallback={
        <AnalysisUnavailableCard
          message="We couldn't render this analysis right now. Try refreshing it."
          isRefreshing={isRefreshing}
          onRetry={handleRenderRecovery}
        />
      }
    >
      <CompanionStatAnalysisView
        analysis={analysis}
        cached={cached}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
      />
    </SectionErrorBoundary>
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
