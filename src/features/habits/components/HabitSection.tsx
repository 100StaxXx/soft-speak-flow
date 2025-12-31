import { useState, useEffect } from "react";
import { Plus, Check, ChevronUp, ChevronDown } from "lucide-react";
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
  onAddHabit: (data: { title: string; difficulty: HabitDifficulty; selectedDays: number[]; preferredTime?: string }) => void;
  onToggleHabit: (data: { habitId: string; isCompleted: boolean }) => void;
  onDeleteHabit?: (habitId: string) => void;
  onReorderHabits?: (habits: { id: string; sort_order: number }[]) => void;
  isAddingHabit: boolean;
}

export function HabitSection({
  habits,
  completions,
  habitProgress,
  onAddHabit,
  onToggleHabit,
  onDeleteHabit,
  onReorderHabits,
  isAddingHabit,
}: HabitSectionProps) {
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showTemplates, setShowTemplates] = useState(habits.length === 0);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [habitDifficulty, setHabitDifficulty] = useState<HabitDifficulty>("medium");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [preferredTime, setPreferredTime] = useState("");

  // Update showTemplates when habits change
  useEffect(() => {
    setShowTemplates(habits.length === 0);
  }, [habits.length]);

  const handleAddHabit = () => {
    if (!newHabitTitle.trim()) return;
    onAddHabit({ 
      title: newHabitTitle, 
      difficulty: habitDifficulty, 
      selectedDays,
      preferredTime: preferredTime || undefined 
    });
    setNewHabitTitle("");
    setHabitDifficulty("medium");
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
    setPreferredTime("");
    setShowAddHabit(false);
  };

  const isHabitCompleted = (habitId: string) => 
    completions.some(c => c.habit_id === habitId);

  const moveHabit = (index: number, direction: 'up' | 'down') => {
    if (!onReorderHabits) return;
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= habits.length) return;
    
    const reorderedHabits = [...habits];
    [reorderedHabits[index], reorderedHabits[newIndex]] = [reorderedHabits[newIndex], reorderedHabits[index]];
    
    const updates = reorderedHabits.map((habit, idx) => ({
      id: habit.id,
      sort_order: idx,
    }));
    
    onReorderHabits(updates);
  };

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
        {habits.map((habit, index) => {
          const completed = isHabitCompleted(habit.id);
          return (
            <div key={habit.id} className="flex items-center gap-2">
              {/* Reorder controls */}
              {habits.length > 1 && onReorderHabits && (
                <div className="flex flex-col">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5"
                    onClick={() => moveHabit(index, 'up')}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-5 w-5"
                    onClick={() => moveHabit(index, 'down')}
                    disabled={index === habits.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              <button
                onClick={() => onToggleHabit({ habitId: habit.id, isCompleted: completed })}
                className={cn(
                  "flex-1 flex items-center gap-3 p-3 rounded-lg border transition-all",
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
            </div>
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
          
          {/* Schedule Time */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Schedule at (optional)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPreferredTime("07:00")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs rounded-md border transition-colors",
                  preferredTime === "07:00" 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-secondary/50 border-border hover:bg-secondary"
                )}
              >
                Morning
              </button>
              <button
                type="button"
                onClick={() => setPreferredTime("12:00")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs rounded-md border transition-colors",
                  preferredTime === "12:00" 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-secondary/50 border-border hover:bg-secondary"
                )}
              >
                Midday
              </button>
              <button
                type="button"
                onClick={() => setPreferredTime("19:00")}
                className={cn(
                  "flex-1 px-3 py-2 text-xs rounded-md border transition-colors",
                  preferredTime === "19:00" 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-secondary/50 border-border hover:bg-secondary"
                )}
              >
                Evening
              </button>
            </div>
            <Input
              type="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
              className="w-full"
              placeholder="Custom time"
            />
          </div>
          
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
