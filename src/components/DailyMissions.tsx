import { memo } from "react";
import {
  CheckCircle2,
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
import { useMissionAutoComplete } from "@/hooks/useMissionAutoComplete";
import { useProfile } from "@/hooks/useProfile";
import { getTodaysTheme } from "@/config/missionTemplates";
import { getFactionById } from "@/config/factions";
import { haptics } from "@/utils/haptics";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
import { outerShellCardClassName } from "@/components/ui/card";

const DailyMissionsContent = memo(() => {
  const {
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

  useMissionAutoComplete();

  const todaysTheme = missionTheme || getTodaysTheme();
  const callerFaction = profile?.faction;
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
        "group relative overflow-hidden border-accent/[0.16] p-4 transition-all duration-500 hover:border-accent/[0.28] hover:shadow-[0_0_32px_hsl(var(--accent)/0.12)] sm:p-5 md:p-6",
        outerShellCardClassName,
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/[0.08] to-primary/[0.08]" />
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
                  {factionData.name} Practice
                </p>
              )}
              <div className="flex items-center gap-1">
                <h3 className="font-heading text-base font-black sm:text-lg">
                  {hasFactionContext ? "Path Practices" : "Daily Practices"}
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
