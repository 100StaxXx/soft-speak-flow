import { Snowflake, Clock } from "lucide-react";
import { useCompanionHealth } from "@/hooks/useCompanionHealth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StreakFreezeDisplayProps {
  compact?: boolean;
}

export const StreakFreezeDisplay = ({ compact = false }: StreakFreezeDisplayProps) => {
  const { streakFreeze } = useCompanionHealth();

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Snowflake className="h-4 w-4 text-blue-400" />
              <span className="text-sm font-medium text-blue-400">
                {streakFreeze.streakFreezesAvailable}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">
              {streakFreeze.streakFreezesAvailable} Streak Freeze{streakFreeze.streakFreezesAvailable !== 1 ? 's' : ''} Available
            </p>
            <p className="text-xs text-muted-foreground">
              Resets in {streakFreeze.daysUntilReset} day{streakFreeze.daysUntilReset !== 1 ? 's' : ''}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
            <Snowflake className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h4 className="font-medium text-sm">Streak Freezes</h4>
            <p className="text-xs text-muted-foreground">Protect your streak!</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-400">
            {streakFreeze.streakFreezesAvailable}/1
          </p>
          <p className="text-xs text-muted-foreground">Available</p>
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
        <Clock className="h-3 w-3" />
        <span>Resets in {streakFreeze.daysUntilReset} day{streakFreeze.daysUntilReset !== 1 ? 's' : ''}</span>
      </div>
      
      <p className="text-xs text-muted-foreground mt-2">
        If you miss a day, a streak freeze will automatically protect your streak! ❄️
      </p>
    </div>
  );
};
