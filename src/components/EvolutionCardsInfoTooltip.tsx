import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const EvolutionCardsInfoTooltip = () => {
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
            <p className="font-semibold">Evolution Cards</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Collectible cards earned at major evolutions</li>
              <li>• Cards feature unique stats and abilities</li>
              <li>• Tap to flip and see card details</li>
              <li>• Share your cards with friends</li>
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
