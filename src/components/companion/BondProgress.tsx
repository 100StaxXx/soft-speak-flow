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

  // Calculate progress to next level using exponential thresholds
  const progressToNext = useMemo(() => {
    if (!currentBond.nextMilestone) return 100; // Max level
    
    // Exponential thresholds: level 2 = 25, level 3 = 70, level 4 = 150, etc.
    const getThreshold = (level: number) => Math.round(25 * Math.pow(1.8, level - 2));
    const currentThreshold = currentBond.level === 1 ? 0 : getThreshold(currentBond.level);
    const nextThreshold = getThreshold(currentBond.level + 1);
    const range = nextThreshold - currentThreshold;
    const progress = currentBond.totalInteractions - currentThreshold;
    
    return Math.min(100, Math.max(0, (progress / range) * 100));
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
          <div className="relative flex items-center justify-between px-3">
            {/* Background connecting line */}
            <div className="absolute top-3 left-6 right-6 h-0.5 bg-muted/30" />
            {/* Progress line overlay */}
            <div 
              className="absolute top-3 left-6 h-0.5 bg-primary/50 transition-all duration-500"
              style={{ 
                width: `calc(${((currentBond.level - 1) / (bondMilestones.length - 1)) * 100}% - 24px)` 
              }}
            />
            
            {/* Milestone dots */}
            {bondMilestones.map((milestone) => (
              <div
                key={milestone.level}
                className="relative z-10 flex flex-col items-center gap-1"
              >
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs bg-background border-2",
                    milestone.unlockedAt 
                      ? "border-primary/70" 
                      : "border-muted/40 opacity-50"
                  )}
                  style={{
                    boxShadow: milestone.unlockedAt ? `0 0 8px ${primaryAura}` : 'none'
                  }}
                >
                  {milestone.icon}
                </div>
                <span className={cn(
                  "text-[10px] text-center max-w-[50px] leading-tight",
                  milestone.unlockedAt ? "text-foreground" : "text-muted-foreground/50"
                )}>
                  {milestone.name.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

BondProgress.displayName = 'BondProgress';
