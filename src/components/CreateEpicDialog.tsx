import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Target, Zap, Plus, Trash2 } from "lucide-react";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { FrequencyPicker } from "@/components/FrequencyPicker";

interface NewHabit {
  title: string;
  difficulty: "easy" | "medium" | "hard";
  frequency: string;
  custom_days: number[];
}

interface CreateEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateEpic: (data: {
    title: string;
    description?: string;
    target_days: number;
    habits: NewHabit[];
  }) => void;
  isCreating: boolean;
}

export const CreateEpicDialog = ({
  open,
  onOpenChange,
  onCreateEpic,
  isCreating,
}: CreateEpicDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDays, setTargetDays] = useState(30);
  const [newHabits, setNewHabits] = useState<NewHabit[]>([]);
  const [currentHabitTitle, setCurrentHabitTitle] = useState("");
  const [currentHabitDifficulty, setCurrentHabitDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [currentHabitDays, setCurrentHabitDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  const addHabit = () => {
    if (!currentHabitTitle.trim() || newHabits.length >= 2) return;
    
    setNewHabits([...newHabits, {
      title: currentHabitTitle.trim(),
      difficulty: currentHabitDifficulty,
      frequency: currentHabitDays.length === 7 ? 'daily' : 'custom',
      custom_days: currentHabitDays.length === 7 ? [] : currentHabitDays,
    }]);
    
    setCurrentHabitTitle("");
    setCurrentHabitDifficulty("medium");
    setCurrentHabitDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const removeHabit = (index: number) => {
    setNewHabits(newHabits.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!title.trim() || newHabits.length === 0) return;

    onCreateEpic({
      title: title.trim(),
      description: description.trim() || undefined,
      target_days: targetDays,
      habits: newHabits,
    });

    // Reset form
    setTitle("");
    setDescription("");
    setTargetDays(30);
    setNewHabits([]);
    setCurrentHabitTitle("");
    setCurrentHabitDifficulty("medium");
    setCurrentHabitDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const calculateXPReward = () => targetDays * 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Create Legendary Epic
          </DialogTitle>
          <DialogDescription>
            Embark on an epic journey! Link your habits to track progress toward this legendary goal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Epic Name */}
          <div className="space-y-2">
            <Label htmlFor="epic-title">Epic Name *</Label>
            <Input
              id="epic-title"
              placeholder="e.g., Become a Morning Warrior"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="epic-description">Epic Quest Description</Label>
            <Textarea
              id="epic-description"
              placeholder="What legendary feat will you accomplish?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={200}
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="target-days">Epic Duration (Days)</Label>
            <div className="flex gap-2">
              {[7, 14, 30, 60, 90].map((days) => (
                <Button
                  key={days}
                  type="button"
                  variant={targetDays === days ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTargetDays(days)}
                  className="flex-1"
                >
                  {days}d
                </Button>
              ))}
            </div>
            <Input
              id="target-days"
              type="number"
              min={1}
              max={365}
              value={targetDays}
              onChange={(e) => setTargetDays(parseInt(e.target.value) || 30)}
              className="mt-2"
            />
          </div>

          {/* Create Habits */}
          <div className="space-y-3">
            <Label>Epic Habits (Required)</Label>
            
            {/* Existing habits list */}
            {newHabits.length > 0 && (
              <div className="space-y-2">
                {newHabits.map((habit, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-accent/20 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{habit.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {habit.frequency === 'daily' ? 'Daily' : 'Custom days'}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeHabit(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add new habit form */}
            {newHabits.length < 2 && (
              <div className="border rounded-lg p-3 space-y-3">
                <Input
                  placeholder="Habit name (e.g., Morning run)"
                  value={currentHabitTitle}
                  onChange={(e) => setCurrentHabitTitle(e.target.value)}
                  maxLength={60}
                />
                
                <HabitDifficultySelector
                  value={currentHabitDifficulty}
                  onChange={setCurrentHabitDifficulty}
                />
                
                <FrequencyPicker
                  selectedDays={currentHabitDays}
                  onDaysChange={setCurrentHabitDays}
                />
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addHabit}
                  disabled={!currentHabitTitle.trim()}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Habit {newHabits.length > 0 && `(${2 - newHabits.length} remaining)`}
                </Button>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Add up to 2 habits that contribute to this epic
            </p>
          </div>

          {/* XP Reward Preview */}
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-medium">Epic Completion Reward</span>
            </div>
            <span className="text-lg font-bold text-primary">
              +{calculateXPReward()} XP
            </span>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={!title.trim() || newHabits.length === 0 || isCreating}
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
          >
            {isCreating ? "Creating Epic..." : "Begin Epic Quest! 🎯"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
