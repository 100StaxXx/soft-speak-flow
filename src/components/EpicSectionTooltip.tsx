import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const EpicSectionTooltip = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          type="button"
          className="inline-flex items-center justify-center ml-2 opacity-60 hover:opacity-100 transition-opacity touch-manipulation active:scale-95"
          aria-label="Learn about Epics"
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
          <h4 className="font-heading font-bold text-base text-primary">Epics (Guilds)</h4>
          <p className="text-sm leading-relaxed text-foreground/90">
            Create long-term goals that span multiple days or weeks. Track your progress with linked habits and earn bonus XP when completing quests as part of an Epic!
          </p>
          <div className="space-y-2 pt-2 border-t border-primary/20">
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-accent mt-0.5">🏰</span>
              <div>
                <p className="text-xs font-semibold text-accent">Personal Epics</p>
                <p className="text-xs text-muted-foreground">Set your own long-term objectives</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-primary mt-0.5">👥</span>
              <div>
                <p className="text-xs font-semibold text-primary">Community Epics</p>
                <p className="text-xs text-muted-foreground">Join guilds and complete goals together</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-yellow-400 mt-0.5">⭐</span>
              <div>
                <p className="text-xs font-semibold text-yellow-400">Star Paths</p>
                <p className="text-xs text-muted-foreground">Browse curated epic templates to get started quickly</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-orange-400 mt-0.5">⚡</span>
              <div>
                <p className="text-xs font-semibold text-orange-400">Guild Bonus</p>
                <p className="text-xs text-muted-foreground">Earn +10% XP on quests when in an active guild</p>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
