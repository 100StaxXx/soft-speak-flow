import { cn } from "@/lib/utils";
import { Flame } from "lucide-react";

interface StreakIndicatorProps {
  streak: number;
  multiplier: number;
  className?: string;
}

export function StreakIndicator({ streak, multiplier, className }: StreakIndicatorProps) {
  if (streak < 1) return null;
  
  const getStreakColor = () => {
    if (streak >= 60) return "text-stardust-gold";
    if (streak >= 30) return "text-accent";
    if (streak >= 14) return "text-celestial-blue";
    if (streak >= 7) return "text-green-500";
    return "text-orange-500";
  };
  
  const getGlowColor = () => {
    if (streak >= 60) return "shadow-stardust-gold/50";
    if (streak >= 30) return "shadow-accent/50";
    if (streak >= 14) return "shadow-celestial-blue/50";
    if (streak >= 7) return "shadow-green-500/50";
    return "shadow-orange-500/50";
  };
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Streak flame and count */}
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <Flame 
            className={cn(
              "h-5 w-5 transition-colors",
              getStreakColor(),
              streak >= 7 && "animate-flame-flicker"
            )} 
          />
          {streak >= 30 && (
            <div className={cn(
              "absolute inset-0 blur-sm",
              getStreakColor(),
              "animate-pulse"
            )}>
              <Flame className="h-5 w-5" />
            </div>
          )}
        </div>
        <span className={cn(
          "text-sm font-bold tabular-nums",
          getStreakColor()
        )}>
          {streak}
        </span>
      </div>
      
      {/* Multiplier badge */}
      {multiplier > 1 && (
        <div className={cn(
          "px-2 py-0.5 rounded-full text-xs font-bold",
          "bg-gradient-to-r shadow-lg",
          multiplier >= 2 
            ? "from-stardust-gold/20 to-amber-500/20 text-stardust-gold border border-stardust-gold/30" 
            : "from-primary/20 to-accent/20 text-primary border border-primary/30",
          getGlowColor()
        )}>
          {multiplier}x XP
        </div>
      )}
    </div>
  );
}
