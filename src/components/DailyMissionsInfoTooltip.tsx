import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const DailyMissionsInfoTooltip = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-1 rounded-full hover:bg-accent/10 transition-colors">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Daily Missions</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Auto-generated daily based on your activity</li>
              <li>• <span className="text-accent">Auto</span> missions complete when you do the action</li>
              <li>• Earn XP to help your companion evolve</li>
              <li>• Bonus missions offer extra rewards</li>
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
