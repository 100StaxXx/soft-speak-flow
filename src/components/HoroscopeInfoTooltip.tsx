import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const HoroscopeInfoTooltip = () => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <HelpCircle className="h-4 w-4 text-purple-300" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2 text-sm">
            <p className="font-semibold">Your Cosmiq Insight</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Daily personalized horoscope based on your zodiac</li>
              <li>• Energy Forecast guides Mind, Body & Soul</li>
              <li>• Add birth details for deeper Cosmiq insights</li>
              <li>• Unlock your Big Three (Sun, Moon, Rising)</li>
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
