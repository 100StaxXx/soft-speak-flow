import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const StoryJournalInfoTooltip = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="p-1 rounded-full hover:bg-primary/10 transition-colors">
          <HelpCircle className="h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" className="max-w-xs">
        <div className="space-y-2 text-sm">
          <p className="font-semibold">Story Journal</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>• Each evolution stage unlocks a new chapter</li>
            <li>• Stories unique to your journey</li>
            <li>• Learn life lessons through your companion's tale</li>
            <li>• Prologue + 20 chapters to unlock</li>
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
};
