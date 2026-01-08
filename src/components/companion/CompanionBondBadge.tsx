import { memo } from "react";
import { useCompanionMemories } from "@/hooks/useCompanionMemories";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface CompanionBondBadgeProps {
  className?: string;
}

/**
 * Compact badge showing companion's current bond level.
 * Displays icon, name, and level in a pill format.
 */
export const CompanionBondBadge = memo(({ className }: CompanionBondBadgeProps) => {
  const { currentBond, isLoading } = useCompanionMemories();

  if (isLoading || !currentBond) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.div
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            "bg-card/50 backdrop-blur-sm border border-border/30",
            "hover:border-primary/40 transition-all cursor-default",
            className
          )}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
        >
          <span className="text-lg" aria-hidden>{currentBond.icon}</span>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium">{currentBond.name}</span>
            <span className="text-[10px] text-muted-foreground">Lvl {currentBond.level}</span>
          </div>
        </motion.div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">{currentBond.description}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {currentBond.totalInteractions} interactions
        </p>
      </TooltipContent>
    </Tooltip>
  );
});

CompanionBondBadge.displayName = 'CompanionBondBadge';
