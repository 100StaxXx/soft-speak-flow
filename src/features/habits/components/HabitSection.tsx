import { useState, useEffect } from "react";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { HabitTemplates } from "@/components/HabitTemplates";
import { FrequencyPicker } from "@/components/FrequencyPicker";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { cn } from "@/lib/utils";
import type { Habit, HabitCompletion, HabitDifficulty } from "../types";

interface HabitSectionProps {
  habits: Habit[];
  completions: HabitCompletion[];
  habitProgress: number;
  onAddHabit: (data: { title: string; difficulty: HabitDifficulty; selectedDays: number[] }) => void;
  onToggleHabit: (data: { habitId: string; isCompleted: boolean }) => void;
  isAddingHabit: boolean;
}

export function HabitSection({
  habits,
  completions,
  habitProgress,
  onAddHabit,
  onToggleHabit,
  isAddingHabit,
}: HabitSectionProps) {
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showTemplates, setShowTemplates] = useState(habits.length === 0);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [habitDifficulty, setHabitDifficulty] = useState<HabitDifficulty>("medium");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  // Update showTemplates when habits change
  useEffect(() => {
    setShowTemplates(habits.length === 0);
  }, [habits.length]);

  const handleAddHabit = () => {
    if (!newHabitTitle.trim()) return;
    onAddHabit({ title: newHabitTitle, difficulty: habitDifficulty, selectedDays });
    setNewHabitTitle("");
    setHabitDifficulty("medium");
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setShowAddHabit(false);
  };

  const isHabitCompleted = (habitId: string) => 
    completions.some(c => c.habit_id === habitId);

  if (showTemplates && habits.length === 0) {
    return (
      <Card className="p-4 space-y-4">
        <HabitTemplates
          onSelect={(title) => {
            setNewHabitTitle(title);
            setShowTemplates(false);
            setShowAddHabit(true);
          }}
          onCustom={() => {
            setShowTemplates(false);
            setShowAddHabit(true);
          }}
          existingHabits={habits.map(h => ({ title: h.title }))}
        />
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Daily Habits</h3>
        {habits.length < 2 && (
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAddHabit(!showAddHabit)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Progress */}
      {habits.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {completions.length}/{habits.length} completed
            </span>
            <span className="text-primary font-medium">
              {Math.round(habitProgress * 100)}%
            </span>
          </div>
          <Progress value={habitProgress * 100} className="h-2" />
        </div>
      )}

      {/* Habit List */}
      <div className="space-y-2">
        {habits.map((habit) => {
          const completed = isHabitCompleted(habit.id);
          return (
            <button
              key={habit.id}
              onClick={() => onToggleHabit({ habitId: habit.id, isCompleted: completed })}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-all",
                completed 
                  ? "bg-primary/10 border-primary/30" 
                  : "bg-card hover:bg-accent/50"
              )}
            >
              <div className={cn(
                "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all",
                completed 
                  ? "bg-primary border-primary" 
                  : "border-muted-foreground/30"
              )}>
                {completed && <Check className="h-4 w-4 text-primary-foreground" />}
              </div>
              <span className={cn(
                "font-medium",
                completed && "line-through text-muted-foreground"
              )}>
                {habit.title}
              </span>
            </button>
          );
        })}
      </div>

      {/* Add Habit Form */}
      {showAddHabit && (
        <div className="space-y-3 pt-3 border-t">
          <Input
            placeholder="New habit..."
            value={newHabitTitle}
            onChange={(e) => setNewHabitTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddHabit()}
          />
          <HabitDifficultySelector
            value={habitDifficulty}
            onChange={setHabitDifficulty}
          />
          <FrequencyPicker
            selectedDays={selectedDays}
            onDaysChange={setSelectedDays}
          />
          <div className="flex gap-2">
            <Button 
              onClick={handleAddHabit}
              disabled={!newHabitTitle.trim() || isAddingHabit}
              className="flex-1"
            >
              Add Habit
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowAddHabit(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
