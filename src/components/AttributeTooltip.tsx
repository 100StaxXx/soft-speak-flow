import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AttributeTooltipProps {
  title: string;
  description: string;
}

const ATTRIBUTE_INFO: Record<string, string> = {
  "Spirit Animal": "Your companion's spirit represents your inner strength and personality. It shapes how your companion appears as it grows through the progression ladder.",
  "Element": "The elemental force that powers your companion's growth. Each element brings unique visual themes to your companion's progression.",
  "Favorite Color": "The primary color that defines your companion's appearance and energy. This was chosen based on your personal preferences.",
  "Stage": "Your companion has a Level from 0 to 100 and a visual Form from 0 to 7. Major Forms run from Egg through Ascended.",
  "Progression": "Your companion has a Level from 0 to 100 and a visual Form from 0 to 7. Major Forms run from Egg through Ascended.",
  "XP Progress": "Experience points earned through completing habits, missions, and challenges. Fill the bar to reach the next stage and eventually the next tier.",
};

export const AttributeTooltip = ({ title, description }: AttributeTooltipProps) => {
  const info = ATTRIBUTE_INFO[title] || description;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          type="button"
          className="inline-flex items-center justify-center ml-1.5 opacity-60 hover:opacity-100 transition-opacity touch-manipulation active:scale-95"
          aria-label={`More information about ${title}`}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 cosmiq-glass border-primary/30 shadow-xl"
        side="top"
        sideOffset={8}
      >
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-primary">{title}</h4>
          <p className="text-sm leading-relaxed text-foreground/90">{info}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
