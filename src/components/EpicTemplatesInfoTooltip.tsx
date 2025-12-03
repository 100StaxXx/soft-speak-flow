import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const EpicTemplatesInfoTooltip = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          type="button"
          className="inline-flex items-center justify-center ml-2 opacity-60 hover:opacity-100 transition-opacity touch-manipulation active:scale-95"
          aria-label="Learn about Epic Templates"
        >
          <HelpCircle className="h-5 w-5 text-primary" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 cosmiq-glass border-primary/30 shadow-xl"
        side="bottom"
        sideOffset={8}
      >
        <div className="space-y-3">
          <h4 className="font-heading font-bold text-base text-primary">Epic Templates</h4>
          <p className="text-sm leading-relaxed text-foreground/90">
            Pre-built epic journeys with curated habits to help you start your wellness adventure instantly!
          </p>
          <div className="space-y-2 pt-2 border-t border-primary/20">
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-green-400 mt-0.5">🌱</span>
              <div>
                <p className="text-xs font-semibold text-green-400">Beginner</p>
                <p className="text-xs text-muted-foreground">Perfect for starting out</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-yellow-400 mt-0.5">⚡</span>
              <div>
                <p className="text-xs font-semibold text-yellow-400">Intermediate</p>
                <p className="text-xs text-muted-foreground">Ready to level up</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-red-400 mt-0.5">🔥</span>
              <div>
                <p className="text-xs font-semibold text-red-400">Advanced</p>
                <p className="text-xs text-muted-foreground">For seasoned warriors</p>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
