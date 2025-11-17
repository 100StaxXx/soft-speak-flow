import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus, Target, Trophy } from "lucide-react";

interface EmptyHabitsProps {
  onAddHabit: () => void;
}

export const EmptyHabits = ({ onAddHabit }: EmptyHabitsProps) => {
  return (
    <Card className="p-6 md:p-8 text-center bg-gradient-to-br from-primary/5 to-accent/5 border-dashed border-2 border-muted-foreground/20">
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl md:text-2xl font-heading font-bold text-foreground">
            Build Better Habits
          </h3>
          <p className="text-sm md:text-base text-muted-foreground">
            Every habit you complete earns XP and helps your companion evolve. 
            Start small, stay consistent, and watch your progress compound.
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-lg my-4">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/50">
            <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium">Earn XP</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/50">
            <Target className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium">Track Progress</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/50">
            <Trophy className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-xs md:text-sm font-medium">Grow Companion</span>
          </div>
        </div>

        <Button 
          onClick={onAddHabit}
          className="gap-2 w-full sm:w-auto"
          size="lg"
        >
          <Plus className="h-4 w-4" />
          Create Your First Habit
        </Button>
      </div>
    </Card>
  );
};
