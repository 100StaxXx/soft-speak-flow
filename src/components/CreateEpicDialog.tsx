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
import { Checkbox } from "@/components/ui/checkbox";
import { Target, Zap } from "lucide-react";

interface Habit {
  id: string;
  title: string;
  difficulty: string;
}

interface CreateEpicDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateEpic: (data: {
    title: string;
    description?: string;
    target_days: number;
    habit_ids: string[];
  }) => void;
  availableHabits: Habit[];
  isCreating: boolean;
}

export const CreateEpicDialog = ({
  open,
  onOpenChange,
  onCreateEpic,
  availableHabits,
  isCreating,
}: CreateEpicDialogProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDays, setTargetDays] = useState(30);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);

  const handleSubmit = () => {
    if (!title.trim()) return;

    onCreateEpic({
      title: title.trim(),
      description: description.trim() || undefined,
      target_days: targetDays,
      habit_ids: selectedHabits,
    });

    // Reset form
    setTitle("");
    setDescription("");
    setTargetDays(30);
    setSelectedHabits([]);
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

          {/* Linked Habits */}
          <div className="space-y-2">
            <Label>Link Habits to Epic</Label>
            <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
              {availableHabits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No habits available. Create habits first to link to this epic!
                </p>
              ) : (
                availableHabits.map((habit) => (
                  <div key={habit.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`habit-${habit.id}`}
                      checked={selectedHabits.includes(habit.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedHabits([...selectedHabits, habit.id]);
                        } else {
                          setSelectedHabits(
                            selectedHabits.filter((id) => id !== habit.id)
                          );
                        }
                      }}
                    />
                    <label
                      htmlFor={`habit-${habit.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {habit.title}
                    </label>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Your epic progress will advance when you complete these habits each day
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
            disabled={!title.trim() || isCreating}
            className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
          >
            {isCreating ? "Creating Epic..." : "Begin Epic Quest! 🎯"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
