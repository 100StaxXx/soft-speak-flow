import React from 'react';
import { Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BlockedBadgeProps {
  blockerCount: number;
  blockerNames?: string[];
}

export const BlockedBadge: React.FC<BlockedBadgeProps> = ({
  blockerCount,
  blockerNames = [],
}) => {
  if (blockerCount === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className="gap-1 text-xs bg-amber-500/10 text-amber-500 border-amber-500/30 hover:bg-amber-500/20 cursor-help"
          >
            <Lock className="h-3 w-3" />
            Blocked
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium text-xs">Waiting on:</p>
            <ul className="text-xs text-muted-foreground space-y-0.5">
              {blockerNames.slice(0, 3).map((name, i) => (
                <li key={i} className="truncate">• {name}</li>
              ))}
              {blockerNames.length > 3 && (
                <li className="text-muted-foreground/60">
                  +{blockerNames.length - 3} more
                </li>
              )}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
