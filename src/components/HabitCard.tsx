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
    <Card className="p-6 bg-gradient-to-br from-card to-card/50 border-primary/20 hover:border-primary/40 transition-all">
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-heading text-foreground">{title}</h3>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1 text-primary">
                <Flame className="w-4 h-4" />
                <span className="text-sm font-bold">{currentStreak} day streak</span>
              </div>
              <span className="text-xs text-muted-foreground">
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
              "h-12 w-12 rounded-full",
              completedToday && "bg-primary/20 text-primary"
            )}
          >
            <CheckCircle2 className="w-6 h-6" />
          </Button>
        </div>
        
        {completedToday && (
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <p className="text-sm text-primary font-medium">
              ✓ Completed today. Keep the momentum.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};
