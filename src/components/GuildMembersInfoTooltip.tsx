import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const GuildMembersInfoTooltip = () => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button 
          type="button"
          className="inline-flex items-center justify-center ml-2 opacity-60 hover:opacity-100 transition-opacity touch-manipulation active:scale-95"
          aria-label="Learn about Guild Members"
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
          <h4 className="font-heading font-bold text-base text-primary">Guild Members</h4>
          <p className="text-sm leading-relaxed text-foreground/90">
            Your fellow guild members on this epic journey! Compete, encourage, and grow together.
          </p>
          <div className="space-y-2 pt-2 border-t border-primary/20">
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-orange-400 mt-0.5">⚔️</span>
              <div>
                <p className="text-xs font-semibold text-orange-400">Set a Rival</p>
                <p className="text-xs text-muted-foreground">Choose someone to compete with directly</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-primary mt-0.5">📢</span>
              <div>
                <p className="text-xs font-semibold text-primary">Send Shouts</p>
                <p className="text-xs text-muted-foreground">Hype up or challenge your guildmates</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs font-semibold text-accent mt-0.5">🏆</span>
              <div>
                <p className="text-xs font-semibold text-accent">Leaderboard</p>
                <p className="text-xs text-muted-foreground">Ranked by total XP contribution</p>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
