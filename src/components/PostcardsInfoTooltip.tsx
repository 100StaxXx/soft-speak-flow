import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const PostcardsInfoTooltip = () => {
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
            <p className="font-semibold">Cosmic Postcards</p>
            <ul className="space-y-1 text-muted-foreground">
              <li>• Unlocked at Star Path milestones (25%, 50%, 75%, 100%)</li>
              <li>• Your companion visits cosmic locations</li>
              <li>• AI-generated images of their journey</li>
              <li>• Tap to view fullscreen and share</li>
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
