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
            <h3 className="text-lg md:text-xl font-heading font-black text-foreground mb-4 break-words">{title}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30">
                  <Flame className="w-6 h-6 text-primary flex-shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-2xl font-heading font-black text-primary leading-none">{currentStreak}</span>
                    <span className="text-xs text-muted-foreground">day streak</span>
                  </div>
                </div>
                {longestStreak > 0 && (
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-foreground">{longestStreak}</span>
                    <span className="text-xs text-muted-foreground">best</span>
                  </div>
                )}
              </div>
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
