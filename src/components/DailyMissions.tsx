import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  CheckCircle2,
  Globe2,
  Target,
  TrendingUp,
  Zap,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { EmptyMissions } from "@/components/EmptyMissions";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MissionErrorFallback } from "@/components/ErrorFallback";
import { MissionCardSkeleton } from "@/components/SkeletonLoader";
import { useDailyMissions } from "@/hooks/useDailyMissions";
import { useDailyMissionPulse } from "@/hooks/useDailyMissionPulse";
import { useMissionAutoComplete } from "@/hooks/useMissionAutoComplete";
import { useProfile } from "@/hooks/useProfile";
import { getTodaysTheme } from "@/config/missionTemplates";
import { getFactionById } from "@/config/factions";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { outerShellCardClassName } from "@/components/ui/card";

interface MissionPulsePanelProps {
  title: string;
  accentColor: string;
  percentage: number;
  primaryText: string;
  secondaryText?: string;
  icon: LucideIcon;
}

const MissionPulsePanel = ({
  title,
  accentColor,
  percentage,
  primaryText,
  secondaryText,
  icon: Icon,
}: MissionPulsePanelProps) => {
  return (
    <div
      className="rounded-2xl border p-3 sm:p-3.5 backdrop-blur-sm"
      style={{
        borderColor: `${accentColor}40`,
        background: `linear-gradient(135deg, ${accentColor}18 0%, transparent 100%)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {title}
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-2xl font-black leading-none" style={{ color: accentColor }}>
              {percentage}%
            </span>
            <span className="pb-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              completed
            </span>
          </div>
        </div>
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border"
          style={{
            borderColor: `${accentColor}4d`,
            backgroundColor: `${accentColor}20`,
          }}
        >
          <Icon className="h-4 w-4" style={{ color: accentColor }} />
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(0, Math.min(percentage, 100))}%`,
              background: `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
            }}
          />
        </div>
        <p className="text-xs text-foreground/88">{primaryText}</p>
        {secondaryText && (
          <p className="text-[11px] text-muted-foreground">{secondaryText}</p>
        )}
      </div>
    </div>
  );
};

interface MissionCompetitionSnapshotProps {
  guildName: string;
  accentColor: string;
  guildPercentage: number;
  networkPercentage: number;
  deltaText: string;
}

const clampPercentage = (value: number) => Math.max(0, Math.min(value, 100));

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((segment) => `${segment}${segment}`)
          .join("")
      : normalized;

  const parsed = Number.parseInt(expanded, 16);
  if (Number.isNaN(parsed)) {
    return `rgba(255, 255, 255, ${alpha})`;
  }

  const red = (parsed >> 16) & 255;
  const green = (parsed >> 8) & 255;
  const blue = parsed & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const MissionCompetitionSnapshot = ({
  guildName,
  accentColor,
  guildPercentage,
  networkPercentage,
  deltaText,
}: MissionCompetitionSnapshotProps) => {
  const guildValue = clampPercentage(guildPercentage);
  const networkValue = clampPercentage(networkPercentage);
  const size = 156;
  const center = size / 2;
  const outerRadius = 58;
  const innerRadius = 42;
  const outerStroke = 12;
  const innerStroke = 10;
  const startAngleOffset = 0.25;
  const guildCircumference = 2 * Math.PI * outerRadius;
  const networkCircumference = 2 * Math.PI * innerRadius;
  const guildDashOffset = guildCircumference * (1 - guildValue / 100);
  const networkDashOffset = networkCircumference * (1 - networkValue / 100);
  const networkColor = hexToRgba(accentColor, 0.62);
  const outerTrackColor = hexToRgba(accentColor, 0.14);
  const innerTrackColor = hexToRgba(accentColor, 0.1);
  const glowColor = hexToRgba(accentColor, 0.2);
  const chartLabel = `Today's competition. ${guildName} is at ${guildValue}% completed. Network average is ${networkValue}%. ${deltaText}.`;

  return (
    <div
      className="rounded-[28px] border p-4 sm:p-5 backdrop-blur-sm"
      style={{
        borderColor: hexToRgba(accentColor, 0.24),
        background: `linear-gradient(160deg, ${hexToRgba(accentColor, 0.18)} 0%, rgba(10, 15, 25, 0.18) 52%, rgba(10, 15, 25, 0.06) 100%)`,
        boxShadow: `0 18px 44px ${glowColor}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">
            Today's Competition
          </p>
          <p className="mt-1 text-sm font-medium text-foreground/86">
            See how your guild stacks up right now.
          </p>
        </div>
        <div
          className="rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{
            borderColor: hexToRgba(accentColor, 0.34),
            backgroundColor: hexToRgba(accentColor, 0.12),
            color: accentColor,
          }}
        >
          {deltaText}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="relative h-40 w-40 flex-shrink-0"
          role="img"
          aria-label={chartLabel}
        >
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="h-full w-full -rotate-90 overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="guild-competition-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={hexToRgba(accentColor, 0.72)} />
                <stop offset="100%" stopColor={accentColor} />
              </linearGradient>
              <linearGradient id="network-competition-ring" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={hexToRgba(accentColor, 0.28)} />
                <stop offset="100%" stopColor={networkColor} />
              </linearGradient>
            </defs>

            <circle
              cx={center}
              cy={center}
              r={outerRadius}
              fill="none"
              stroke={outerTrackColor}
              strokeWidth={outerStroke}
            />
            <circle
              cx={center}
              cy={center}
              r={outerRadius}
              fill="none"
              stroke="url(#guild-competition-ring)"
              strokeWidth={outerStroke}
              strokeLinecap="round"
              strokeDasharray={guildCircumference}
              strokeDashoffset={guildDashOffset}
              transform={`rotate(${startAngleOffset * 360} ${center} ${center})`}
            />

            <circle
              cx={center}
              cy={center}
              r={innerRadius}
              fill="none"
              stroke={innerTrackColor}
              strokeWidth={innerStroke}
            />
            <circle
              cx={center}
              cy={center}
              r={innerRadius}
              fill="none"
              stroke="url(#network-competition-ring)"
              strokeWidth={innerStroke}
              strokeLinecap="round"
              strokeDasharray={networkCircumference}
              strokeDashoffset={networkDashOffset}
              transform={`rotate(${startAngleOffset * 360} ${center} ${center})`}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              {guildName}
            </span>
            <span className="mt-1 text-3xl font-black leading-none" style={{ color: accentColor }}>
              {guildValue}%
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              completed
            </span>
          </div>
        </div>

        <div className="grid w-full gap-2.5 sm:max-w-[220px]">
          <div
            className="rounded-2xl border px-3 py-2.5"
            style={{
              borderColor: hexToRgba(accentColor, 0.3),
              backgroundColor: hexToRgba(accentColor, 0.08),
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                {guildName}
              </span>
              <span className="text-lg font-black" style={{ color: accentColor }}>
                {guildValue}%
              </span>
            </div>
          </div>

          <div
            className="rounded-2xl border px-3 py-2.5"
            style={{
              borderColor: hexToRgba(accentColor, 0.18),
              backgroundColor: "rgba(255, 255, 255, 0.03)",
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Network Average
              </span>
              <span className="text-lg font-black" style={{ color: networkColor }}>
                {networkValue}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const formatAverageDelta = (delta: number) => {
  if (delta > 0) return `${delta} pts above average`;
  if (delta < 0) return `${Math.abs(delta)} pts below average`;
  return "At guild average";
};

const DailyMissionsContent = memo(() => {
  const {
    missionDate,
    missions,
    isLoading,
    completeMission,
    isCompleting,
    completedCount,
    totalCount,
    allComplete,
    regenerateMissions,
    isRegenerating,
    generationErrorMessage,
    missionTheme,
  } = useDailyMissions();
  const { profile } = useProfile();
  const { pulse, isLoading: isPulseLoading } = useDailyMissionPulse({
    missionDate,
    enabled: !isLoading && missions.length > 0,
  });

  useMissionAutoComplete();

  const todaysTheme = missionTheme || getTodaysTheme();
  const callerFaction = profile?.faction || pulse?.caller_faction;
  const factionData = getFactionById(callerFaction);
  const hasFactionContext = Boolean(callerFaction);
  const DispatchIcon = factionData?.icon || Target;

  if (isLoading) {
    return <MissionCardSkeleton />;
  }

  if (missions.length === 0) {
    return (
      <EmptyMissions
        onRetry={regenerateMissions}
        isRetrying={isRegenerating}
        errorMessage={generationErrorMessage}
      />
    );
  }

  const progress = (completedCount / totalCount) * 100;
  const baseMissions = missions.filter((mission) => !mission.is_bonus);
  const bonusMissions = missions.filter((mission) => mission.is_bonus);

  const handleComplete = async (id: string) => {
    haptics.medium();

    try {
      await completeMission(id);

      const updatedMissions = missions.map((mission) =>
        mission.id === id ? { ...mission, completed: true } : mission,
      );
      const allWillBeComplete = updatedMissions.every((mission) => mission.completed);

      if (allWillBeComplete) {
        setTimeout(() => {
          confetti({
            particleCount: 150,
            spread: 120,
            origin: { y: 0.6 },
            colors: ["#A76CFF", "#C084FC", "#E879F9", "#FFD700", "#FFA500"],
            ticks: 400,
            gravity: 0.6,
            scalar: 1.5,
          });
        }, 500);
      }
    } catch (error) {
      console.error("Failed to complete mission:", error);
      haptics.light();
    }
  };

  const renderMission = (mission: typeof missions[0]) => {
    const hasProgress = mission.progress_target > 1;
    const progressPercent = hasProgress
      ? (mission.progress_current / mission.progress_target) * 100
      : 0;
    const isAutoComplete = mission.auto_complete;

    return (
      <div
        key={mission.id}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          "flex items-center justify-between rounded-lg border p-2.5 transition-all select-none sm:p-3",
          mission.completed
            ? "border-accent/20 bg-accent/5 opacity-60"
            : "border-border bg-background hover:border-accent/40",
          mission.is_bonus && "border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 to-orange-500/5",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {mission.completed && (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-accent sm:h-5 sm:w-5" />
          )}
          <div className="flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p className={cn("text-sm font-medium", mission.completed && "line-through")}>
                {mission.mission_text}
              </p>
              {isAutoComplete && !mission.completed && (
                <Badge variant="outline" className="px-1.5 py-0 text-xs">
                  <Zap className="mr-1 h-2.5 w-2.5" />
                  Auto
                </Badge>
              )}
              {mission.is_bonus && (
                <Badge variant="gold" className="px-1.5 py-0 text-xs">
                  <Sparkles className="mr-1 h-2.5 w-2.5" />
                  Bonus
                </Badge>
              )}
              {mission.difficulty === "hard" && !mission.completed && (
                <Badge variant="outline" className="border-red-500/50 px-1.5 py-0 text-xs text-red-600">
                  <TrendingUp className="mr-1 h-2.5 w-2.5" />
                  Hard
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">+{mission.xp_reward} XP</p>
              {hasProgress && !mission.completed && (
                <span className="text-xs text-muted-foreground">
                  • {mission.progress_current}/{mission.progress_target}
                </span>
              )}
            </div>
            {hasProgress && !mission.completed && (
              <Progress value={progressPercent} className="mt-1.5 h-1" />
            )}
          </div>
        </div>

        {!mission.completed && !isAutoComplete && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleComplete(mission.id)}
            disabled={isCompleting}
            className="min-w-[90px] transition-transform hover:scale-105 hover:border-accent/60 hover:bg-accent/10 active:scale-95"
          >
            {isCompleting ? (
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            ) : (
              "Complete"
            )}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-accent/16 p-4 transition-all duration-500 hover:border-accent/28 hover:shadow-[0_0_32px_hsl(var(--accent)/0.12)] sm:p-5 md:p-6",
        outerShellCardClassName,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/8 to-primary/8" />
      {factionData && (
        <div
          className="pointer-events-none absolute -right-12 top-[-56px] h-44 w-44 rounded-full blur-3xl"
          style={{ backgroundColor: `${factionData.color}33` }}
        />
      )}

      <div className="relative z-10 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <div
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border sm:h-10 sm:w-10"
              style={
                factionData
                  ? {
                      borderColor: `${factionData.color}4d`,
                      backgroundColor: `${factionData.color}1f`,
                    }
                  : undefined
              }
            >
              <DispatchIcon
                className="h-4 w-4 text-accent sm:h-5 sm:w-5"
                style={factionData ? { color: factionData.color } : undefined}
              />
            </div>
            <div className="min-w-0">
              {factionData && (
                <p
                  className="truncate text-[10px] font-semibold uppercase tracking-[0.26em]"
                  style={{ color: factionData.color }}
                >
                  {factionData.name} Dispatch
                </p>
              )}
              <div className="flex items-center gap-1">
                <h3 className="font-heading text-base font-black sm:text-lg">
                  {hasFactionContext ? "Guild Missions" : "Daily Missions"}
                </h3>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="text-sm">{todaysTheme.emoji}</span>
                <span className="text-xs font-medium text-muted-foreground">{todaysTheme.name}</span>
                {factionData && (
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    • {factionData.subtitle}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] text-muted-foreground sm:text-xs">
              {completedCount}/{totalCount} complete
            </p>
            {allComplete && (
              <div className="text-[10px] font-bold text-stardust-gold animate-pulse sm:text-xs">
                Dispatch complete
              </div>
            )}
          </div>
        </div>

        <Progress value={progress} className="h-2" />

        {!isPulseLoading && pulse && (
          <div className="grid gap-2.5">
            {hasFactionContext && (
              <MissionCompetitionSnapshot
                guildName={factionData?.name || "Your Guild"}
                accentColor={factionData?.color || "#A76CFF"}
                guildPercentage={pulse.faction_completion_percentage}
                networkPercentage={pulse.network_average_completion_percentage}
                deltaText={formatAverageDelta(pulse.faction_vs_network_average_pp)}
              />
            )}
            {!hasFactionContext && (
              <MissionPulsePanel
                title="Network Average"
                accentColor={factionData?.color || "#A76CFF"}
                percentage={pulse.network_average_completion_percentage}
                primaryText="Average mission completion across guilds today"
                icon={Globe2}
              />
            )}
          </div>
        )}

        <div className="space-y-2">
          {baseMissions.map(renderMission)}
        </div>

        {bonusMissions.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pt-2">
              <Sparkles className="h-3.5 w-3.5 text-stardust-gold" />
              <span className="text-xs font-semibold text-stardust-gold">Streak Bonus</span>
            </div>
            {bonusMissions.map(renderMission)}
          </div>
        )}
      </div>
    </Card>
  );
});

DailyMissionsContent.displayName = "DailyMissionsContent";

export const DailyMissions = memo(() => (
  <ErrorBoundary fallback={<MissionErrorFallback />}>
    <DailyMissionsContent />
  </ErrorBoundary>
));

DailyMissions.displayName = "DailyMissions";
