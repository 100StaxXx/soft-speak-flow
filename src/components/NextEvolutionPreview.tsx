import { memo, useMemo } from "react";
import { Card, outerShellCardClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Sparkles, TrendingUp } from "lucide-react";
import { MAX_COMPANION_STAGE } from "@/config/companionCatalog";
import { useCompanionMemories } from "@/hooks/useCompanionMemories";
import { isNearEvolution } from "@/lib/companionEvolutionSignals";
import {
  getNextUnclaimedVisualStageBoundaryLevel,
  getNextVisualStageBoundaryLevel,
  getProgressionLevelAndTierDisplay,
  getProgressionLevelLabel,
  getProgressionThreshold,
  getVisualStageDisplay,
  resolveProgressionLevelFromXp,
} from "@/config/progression";
import { PRODUCT } from "@/config/product";

interface NextEvolutionPreviewProps {
  currentStage: number;
  currentXP: number;
  nextEvolutionXP: number;
  progressPercent: number;
  showBondProgress?: boolean;
}

export const NextEvolutionPreview = memo(({
  currentStage,
  currentXP,
  nextEvolutionXP,
  progressPercent,
  showBondProgress = true,
}: NextEvolutionPreviewProps) => {
  const earnedLevel = resolveProgressionLevelFromXp(currentXP);
  const readyBoundaryLevel = getNextUnclaimedVisualStageBoundaryLevel(currentStage, earnedLevel);
  const nextLevel = Math.min(earnedLevel + 1, MAX_COMPANION_STAGE);
  const nextLevelLabel = getProgressionLevelAndTierDisplay(nextLevel);
  const readyBoundaryDisplay = readyBoundaryLevel === null
    ? null
    : getVisualStageDisplay(readyBoundaryLevel);
  const readyStateCopy = readyBoundaryLevel === null
    ? null
    : readyBoundaryLevel === 1
      ? "Ready to hatch"
      : `New form ready: ${readyBoundaryDisplay}`;
  const nextVisualStageBoundaryLevel = getNextVisualStageBoundaryLevel(currentStage);
  const nextVisualStageDisplay = nextVisualStageBoundaryLevel === null
    ? null
    : getVisualStageDisplay(nextVisualStageBoundaryLevel);
  const progressTargetXP = readyBoundaryLevel === null
    ? nextEvolutionXP
    : getProgressionThreshold(readyBoundaryLevel) ?? nextEvolutionXP;
  const xpNeeded = Math.max(0, progressTargetXP - currentXP);
  const isMaxStage = earnedLevel >= MAX_COMPANION_STAGE;
  const canEvolve = readyBoundaryLevel !== null;
  const nearEvolution = isNearEvolution({ progressToNext: progressPercent, canEvolve });

  const { currentBond, isLoading: bondLoading } = useCompanionMemories();

  // Calculate bond progress percentage
  const bondProgressPercent = useMemo(() => {
    if (!currentBond?.nextMilestone) return 100;
    const getThreshold = (level: number) => Math.round(25 * Math.pow(1.8, level - 2));
    const currentThreshold = currentBond.level === 1 ? 0 : getThreshold(currentBond.level);
    const nextThreshold = getThreshold(currentBond.level + 1);
    const range = nextThreshold - currentThreshold;
    const progress = currentBond.totalInteractions - currentThreshold;
    return Math.min(100, Math.max(0, (progress / range) * 100));
  }, [currentBond]);

  if (isMaxStage) {
    return (
      <Card className={cn("p-5 border-accent/[0.16]", outerShellCardClassName)}>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm">Fully Flourished</h3>
            <p className="text-xs text-muted-foreground">
              Your companion has reached {getProgressionLevelAndTierDisplay(100)}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "p-5 border-primary/[0.16] hover:border-primary/[0.32] transition-all duration-300",
        outerShellCardClassName,
      )}
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-heading font-bold text-sm">
              {readyBoundaryDisplay ? "Next Stage" : "Next Level"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {readyBoundaryDisplay ?? nextLevelLabel}
            </p>
          </div>
        </div>

        {/* XP Progress */}
        <div
          data-testid="next-evolution-progress"
          className={nearEvolution ? "space-y-2 rounded-lg bg-primary/[0.08] p-2 motion-safe:animate-pulse" : "space-y-2"}
        >
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-primary">
              {readyStateCopy
                ? readyStateCopy
                : xpNeeded > 0
                  ? `${xpNeeded} XP needed`
                  : `Level ${earnedLevel} reached`}
            </span>
          </div>
          <Progress value={readyBoundaryDisplay ? 100 : progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {currentXP} / {progressTargetXP} XP
          </p>
          {!isMaxStage && nextVisualStageBoundaryLevel !== null && nextVisualStageDisplay && (
            <p className="text-xs text-muted-foreground">
              Next stage: {nextVisualStageDisplay} at {getProgressionLevelLabel(nextVisualStageBoundaryLevel)}
            </p>
          )}
        </div>

        {/* Bond Progress */}
        {showBondProgress && currentBond && !bondLoading && (
          <div className="space-y-2 pt-3 border-t border-border/30">
            <div className="flex items-center gap-2">
              <span className="text-lg">{currentBond.icon}</span>
              <div className="flex-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Bond: {currentBond.name}</span>
                  {currentBond.nextMilestone && (
                    <span className="font-medium text-primary/80">
                      → {currentBond.nextMilestone.name}
                    </span>
                  )}
                </div>
                <Progress value={bondProgressPercent} className="h-1.5 mt-1" />
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border/40 bg-background/35 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          {PRODUCT.mode === "christian"
            ? "Daily practices gently nourish this one growth path. Your level reflects return, not spiritual worth."
            : "Complete meaningful quests to fill this level. Major visual changes arrive only at the stage shown above."}
        </div>
      </div>
    </Card>
  );
});

NextEvolutionPreview.displayName = 'NextEvolutionPreview';
