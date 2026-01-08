import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getEvolutionPathInfo, type EvolutionPath } from '@/hooks/useCompanionCareSignals';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EvolutionPathBadgeProps {
  path: EvolutionPath['path'];
  isLocked?: boolean;
  className?: string;
  showDescription?: boolean;
}

/**
 * Displays the companion's evolution path as a visible badge.
 * Users see the path name and can learn what it means.
 */
export const EvolutionPathBadge = memo(({
  path,
  isLocked = false,
  className,
  showDescription = false,
}: EvolutionPathBadgeProps) => {
  const pathInfo = getEvolutionPathInfo(path);

  const badge = (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
        pathInfo.bgColor,
        pathInfo.borderColor,
        "border",
        isLocked && "ring-1 ring-offset-1 ring-offset-background ring-primary/30",
        className
      )}
    >
      <span className="text-base">{pathInfo.icon}</span>
      <span className={pathInfo.color}>{pathInfo.name}</span>
      {isLocked && (
        <span className="text-xs opacity-60">🔒</span>
      )}
    </div>
  );

  if (showDescription) {
    return (
      <div className="flex flex-col items-center gap-2">
        {badge}
        <p className="text-xs text-muted-foreground text-center max-w-[200px]">
          {pathInfo.description}
        </p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[250px]">
          <p className="text-sm">{pathInfo.description}</p>
          {isLocked && (
            <p className="text-xs text-muted-foreground mt-1">
              This path is now permanent.
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

EvolutionPathBadge.displayName = 'EvolutionPathBadge';
