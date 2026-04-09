import { memo, useMemo } from "react";
import { Card, outerShellCardClassName } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Sparkles, TrendingUp } from "lucide-react";
import { MAX_COMPANION_STAGE } from "@/config/companionCatalog";
import { useCompanionMemories } from "@/hooks/useCompanionMemories";
import { isNearEvolution } from "@/lib/companionEvolutionSignals";
import {
  getNextVisualStageBoundaryLevel,
  getProgressionLevelAndTierDisplay,
  getProgressionLevelLabel,
  getVisualStageDisplay,
} from "@/config/progression";

interface NextEvolutionPreviewProps {
  currentStage: number;
  currentXP: number;
  nextEvolutionXP: number;
  progressPercent: number;
  showBondProgress?: boolean;
}

const XP_TIPS = [
  { action: "Complete a habit", xp: "7-24 XP", icon: "✓" },
  { action: "Finish all daily habits", xp: "+15 XP bonus", icon: "🎯" },
  { action: "Complete daily missions", xp: "8-28 XP (Main Quest 1.5x)", icon: "⚡" },
  { action: "Challenge day bonus", xp: "25 XP", icon: "💪" },
  { action: "Streak milestones", xp: "15 XP", icon: "🔥" },
  { action: "Weekly challenge complete", xp: "60 XP", icon: "🏆" },
];

export const NextEvolutionPreview = memo(({
  currentStage,
  currentXP,
  nextEvolutionXP,
  progressPercent,
  showBondProgress = true,
}: NextEvolutionPreviewProps) => {
  const nextStage = Math.min(currentStage + 1, MAX_COMPANION_STAGE);
  const nextLevelLabel = getProgressionLevelAndTierDisplay(nextStage);
  const nextVisualStageBoundaryLevel = getNextVisualStageBoundaryLevel(currentStage);
  const nextVisualStageDisplay = nextVisualStageBoundaryLevel === null
    ? null
    : getVisualStageDisplay(nextVisualStageBoundaryLevel);
  const xpNeeded = Math.max(0, nextEvolutionXP - currentXP);
  const isMaxStage = currentStage >= MAX_COMPANION_STAGE;
  const canEvolve = nextEvolutionXP > 0 && currentXP >= nextEvolutionXP;
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
      <Card className={cn("p-5 border-accent/16", outerShellCardClassName)}>
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-accent/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm">Maximum Evolution!</h3>
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
        "p-5 border-primary/16 hover:border-primary/32 transition-all duration-300",
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
            <h3 className="font-heading font-bold text-sm">Next Level</h3>
            <p className="text-xs text-muted-foreground">
              {nextLevelLabel}
            </p>
          </div>
        </div>

        {/* XP Progress */}
        <div
          data-testid="next-evolution-progress"
          className={nearEvolution ? "space-y-2 rounded-lg bg-primary/8 p-2 motion-safe:animate-pulse" : "space-y-2"}
        >
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-primary">
              {xpNeeded > 0 ? `${xpNeeded} XP needed` : `Ready to evolve to ${getProgressionLevelLabel(nextStage)}`}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {currentXP} / {nextEvolutionXP} XP
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

        {/* XP Tips */}
        <div className="space-y-2 pt-2 border-t border-border/50">
          <p className="text-xs font-medium text-muted-foreground">Quick XP Tips:</p>
          <div className="space-y-1.5">
            {XP_TIPS.slice(0, 3).map((tip, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <span>{tip.icon}</span>
                  {tip.action}
                </span>
                <span className="font-medium text-primary">{tip.xp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
});

NextEvolutionPreview.displayName = 'NextEvolutionPreview';
