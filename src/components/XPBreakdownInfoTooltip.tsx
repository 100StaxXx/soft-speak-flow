import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const XPBreakdownInfoTooltip = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-1 rounded-full hover:bg-primary/10 transition-colors">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 text-sm">
            <p className="font-semibold">XP & Streaks</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• XP helps your companion evolve</li>
              <li>• 1x XP (days 0-6) → 1.5x (7-29) → 2x (30+)</li>
              <li>• Earn XP from quests, habits, check-ins & more</li>
              <li>• Keep your streak alive for bonus multipliers!</li>
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
