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
  "Stage": "Your companion's current evolution stage. There are 7 stages total, from Mysterious Egg to Eternal Titan. Earn XP to unlock the next stage!",
  "XP Progress": "Experience points earned through completing habits, missions, and challenges. Fill the bar to trigger your companion's next evolution!",
};

export const AttributeTooltip = ({ title, description }: AttributeTooltipProps) => {
  const info = ATTRIBUTE_INFO[title] || description;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center justify-center ml-1.5 opacity-50 hover:opacity-100 transition-opacity">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-xs bg-popover/95 backdrop-blur-sm border-primary/20"
        >
          <p className="text-sm">{info}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
