import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./ui/tooltip";

export const BadgesInfoTooltip = () => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="p-1 rounded-full hover:bg-secondary/50 transition-colors">
          <Info className="h-4 w-4 text-muted-foreground" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[260px]">
        <div className="space-y-2">
          <p className="font-semibold">Badge Collection</p>
          <p className="text-xs text-muted-foreground">
            Earn badges by completing milestones, building streaks, evolving your companion, and conquering epics.
          </p>
          <div className="text-xs space-y-1 pt-1 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gradient-to-br from-orange-500 to-orange-700" />
              <span>Bronze - Getting started</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gradient-to-br from-gray-300 to-gray-500" />
              <span>Silver - Building momentum</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600" />
              <span>Gold - True dedication</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gradient-to-br from-purple-400 to-purple-600" />
              <span>Platinum - Elite status</span>
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
