import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AttributeTooltipProps {
  title: string;
  description: string;
}

const ATTRIBUTE_INFO: Record<string, string> = {
  "Spirit Animal": "Your companion's spirit represents your inner strength and personality. It influences how your companion appears as it evolves.",
  "Element": "The elemental force that powers your companion's growth. Each element brings unique visual themes to your companion's evolution.",
  "Favorite Color": "The primary color that defines your companion's appearance and energy. This was chosen based on your personal preferences.",
  "Stage": "Your companion's current evolution stage. There are 21 stages total, from Egg to Ultimate. Earn XP to unlock the next stage!",
  "XP Progress": "Experience points earned through completing habits, missions, and challenges. Fill the bar to trigger your companion's next evolution!",
};

export const AttributeTooltip = ({ title, description }: AttributeTooltipProps) => {
  const info = ATTRIBUTE_INFO[title] || description;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            type="button"
            className="inline-flex items-center justify-center ml-1.5 opacity-60 hover:opacity-100 transition-opacity touch-manipulation active:scale-95"
            aria-label={`More information about ${title}`}
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs bg-popover/98 backdrop-blur-sm border-primary/30 shadow-lg z-50"
          sideOffset={8}
        >
          <p className="text-sm leading-relaxed">{info}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
