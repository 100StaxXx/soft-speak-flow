import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Plus } from "lucide-react";

interface EmptyHabitsProps {
  onAddHabit: () => void;
}

export const EmptyHabits = ({ onAddHabit }: EmptyHabitsProps) => {
  return (
    <Card className="p-8 text-center bg-gradient-to-br from-primary/5 to-accent/5 border-dashed border-2 border-muted-foreground/20">
      <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-heading font-bold text-foreground">
            No Habits Yet
          </h3>
          <p className="text-sm text-muted-foreground">
            Start building momentum by creating your first habit. 
            Your companion grows stronger with every completed task!
          </p>
        </div>
        <Button 
          onClick={onAddHabit}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Your First Habit
        </Button>
      </div>
    </Card>
  );
};
