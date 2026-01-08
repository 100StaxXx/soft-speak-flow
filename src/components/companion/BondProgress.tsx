import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { useCompanionMemories } from "@/hooks/useCompanionMemories";
import { useCompanionAuraColors } from "@/hooks/useCompanionAuraColors";
import { cn } from "@/lib/utils";

interface BondProgressProps {
  className?: string;
  showMilestones?: boolean;
}

/**
 * Displays the companion bond level with visual progress indicator.
 * Shows current bond name, icon, and progress to next level.
 */
export const BondProgress = memo(({ className, showMilestones = false }: BondProgressProps) => {
  const { currentBond, bondMilestones, isLoading } = useCompanionMemories();
  const { primaryAura } = useCompanionAuraColors();

  // Calculate progress to next level (based on interactions)
  const progressToNext = useMemo(() => {
    if (!currentBond.nextMilestone) return 100; // Max level
    
    // Rough estimate: ~50 interactions per level
    const interactionsPerLevel = 50;
    const levelInteractions = currentBond.totalInteractions % interactionsPerLevel;
    return Math.min(100, (levelInteractions / interactionsPerLevel) * 100);
  }, [currentBond]);

  if (isLoading) {
    return (
      <div className={cn("h-20 bg-card/30 rounded-xl animate-pulse", className)} />
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Current bond display */}
      <div className="flex items-center gap-3">
        {/* Bond icon */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
          style={{
            background: `linear-gradient(135deg, ${primaryAura}, transparent)`,
            boxShadow: `0 0 20px ${primaryAura}`,
          }}
        >
          {currentBond.icon}
        </div>

        {/* Bond info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-heading font-bold text-foreground">
              {currentBond.name}
            </h3>
            <span className="text-xs text-muted-foreground">
              Lvl {currentBond.level}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {currentBond.description}
          </p>
        </div>
      </div>

      {/* Progress bar to next level */}
      {currentBond.nextMilestone && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress to {currentBond.nextMilestone.name}</span>
            <span>{Math.round(progressToNext)}%</span>
          </div>
          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: primaryAura }}
              initial={{ width: 0 }}
              animate={{ width: `${progressToNext}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Milestone timeline */}
      {showMilestones && (
        <div className="pt-4 space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Bond Journey</h4>
          <div className="flex items-center gap-1">
            {bondMilestones.map((milestone, index) => (
              <div
                key={milestone.level}
                className={cn(
                  "flex-1 flex flex-col items-center gap-1",
                  milestone.unlockedAt ? "opacity-100" : "opacity-40"
                )}
              >
                {/* Milestone dot */}
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                    milestone.unlockedAt 
                      ? "bg-primary/20 ring-2 ring-primary/50" 
                      : "bg-muted/30"
                  )}
                >
                  {milestone.icon}
                </div>
                {/* Connecting line */}
                {index < bondMilestones.length - 1 && (
                  <div className={cn(
                    "absolute h-0.5 w-full",
                    milestone.unlockedAt ? "bg-primary/30" : "bg-muted/20"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

BondProgress.displayName = 'BondProgress';
