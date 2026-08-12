import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const QuestSectionTooltip = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          type="button"
          className="inline-flex items-center justify-center ml-2 opacity-60 hover:opacity-100 transition-opacity touch-manipulation active:scale-95"
          aria-label="Learn about Today’s Actions"
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
          <h4 className="font-heading font-bold text-base text-primary">Today’s Actions</h4>
          <p className="text-sm leading-relaxed text-foreground/90">
            Graceward gives you a small set of meaningful daily actions. Complete them to grow in consistency, earn XP, and help your symbolic companion flourish.
          </p>
          <div className="space-y-2 pt-2 border-t border-primary/20">
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-accent mt-0.5">⚔️</span>
              <div>
                <p className="text-xs font-semibold text-accent">Priority action</p>
                <p className="text-xs text-muted-foreground">Your primary focus - earns 1.5x XP</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-primary mt-0.5">✨</span>
              <div>
                <p className="text-xs font-semibold text-primary">Extra Actions</p>
                <p className="text-xs text-muted-foreground">Optional ways to keep moving forward</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-orange-400 mt-0.5">🔥</span>
              <div>
                <p className="text-xs font-semibold text-orange-400">Difficulty Levels</p>
                <p className="text-xs text-muted-foreground">Easy (12 XP) • Medium (16 XP) • Hard (22 XP)</p>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
