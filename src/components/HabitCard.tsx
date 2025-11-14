import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { CheckCircle2, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface HabitCardProps {
  id: string;
  title: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  onComplete: () => void;
}

export const HabitCard = ({
  title,
  currentStreak,
  longestStreak,
  completedToday,
  onComplete,
}: HabitCardProps) => {
  return (
    <Card className="p-5 md:p-6 bg-gradient-to-br from-card to-secondary border-primary/20 hover:border-primary/40 transition-all hover:shadow-glow relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="space-y-4 relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg md:text-xl font-heading font-black text-foreground mb-3 break-words">{title}</h3>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-primary">
                <Flame className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-bold whitespace-nowrap">{currentStreak} day{currentStreak !== 1 ? 's' : ''}</span>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                Best: {longestStreak}
              </span>
            </div>
          </div>
          <Button
            onClick={onComplete}
            disabled={completedToday}
            size="icon"
            variant={completedToday ? "secondary" : "default"}
            className={cn(
              "h-12 w-12 rounded-full flex-shrink-0 transition-all",
              completedToday && "bg-primary/20 text-primary hover:bg-primary/30"
            )}
          >
            <CheckCircle2 className="w-6 h-6" />
          </Button>
        </div>
        
        {completedToday && (
          <div className="p-3 md:p-4 bg-primary/10 rounded-lg border border-primary/20 animate-velocity-fade-in">
            <p className="text-xs md:text-sm text-primary font-bold">
              ✓ Completed today. Keep the momentum.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
