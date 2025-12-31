import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { Loader2, Brain, Dumbbell, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type HabitCategory = 'mind' | 'body' | 'soul';

interface Habit {
  id: string;
  title: string;
  description?: string | null;
  difficulty: string;
  frequency?: string;
  estimated_minutes?: number | null;
  preferred_time?: string | null;
  category?: HabitCategory | null;
}

interface EditHabitDialogProps {
  habit: Habit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (habitId: string, updates: {
    title: string;
    description: string | null;
    frequency: string;
    estimated_minutes: number | null;
    difficulty: string;
    preferred_time: string | null;
    category: HabitCategory | null;
  }) => Promise<void>;
}

const categoryConfig: Record<HabitCategory, { icon: typeof Brain; label: string; color: string }> = {
  mind: { icon: Brain, label: 'Mind', color: 'text-blue-500 border-blue-500/50 bg-blue-500/10' },
  body: { icon: Dumbbell, label: 'Body', color: 'text-green-500 border-green-500/50 bg-green-500/10' },
  soul: { icon: Flame, label: 'Soul', color: 'text-orange-500 border-orange-500/50 bg-orange-500/10' },
};

export const EditHabitDialog = ({ habit, open, onOpenChange, onSave }: EditHabitDialogProps) => {
  const [title, setTitle] = useState(habit?.title || "");
  const [description, setDescription] = useState(habit?.description || "");
  const [frequency, setFrequency] = useState(habit?.frequency || "daily");
  const [estimatedMinutes, setEstimatedMinutes] = useState(habit?.estimated_minutes?.toString() || "");
  const [preferredTime, setPreferredTime] = useState(habit?.preferred_time || "");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    (habit?.difficulty as "easy" | "medium" | "hard") || "easy"
  );
  const [category, setCategory] = useState<HabitCategory>(
    (habit?.category as HabitCategory) || "soul"
  );
  const [saving, setSaving] = useState(false);

  // Reset form when habit changes
  if (habit && title !== habit.title && !saving) {
    setTitle(habit.title);
    setDescription(habit.description || "");
    setFrequency(habit.frequency || "daily");
    setEstimatedMinutes(habit.estimated_minutes?.toString() || "");
    setPreferredTime(habit.preferred_time || "");
    setDifficulty((habit.difficulty as "easy" | "medium" | "hard") || "easy");
    setCategory((habit.category as HabitCategory) || "soul");
  }

  const handleSave = async () => {
    if (!habit || !title.trim()) return;
    
    setSaving(true);
    try {
      await onSave(habit.id, {
        title: title.trim(),
        description: description.trim() || null,
        frequency,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
        difficulty,
        preferred_time: preferredTime || null,
        category,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Habit</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Habit name..."
            />
          </div>
          
          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (what to do)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this habit involves..."
              rows={3}
            />
          </div>
          
          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue placeholder="How often?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="5x_week">5x per week</SelectItem>
                <SelectItem value="3x_week">3x per week</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Estimated Minutes */}
          <div className="space-y-2">
            <Label htmlFor="minutes">Estimated time (minutes)</Label>
            <Input
              id="minutes"
              type="number"
              min="1"
              max="180"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="e.g. 15"
            />
          </div>
          
          {/* Preferred Time */}
          <div className="space-y-2">
            <Label htmlFor="preferred_time">Appears on calendar at</Label>
            <Input
              id="preferred_time"
              type="time"
              value={preferredTime}
              onChange={(e) => setPreferredTime(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty to add as unscheduled
            </p>
          </div>
          
          {/* Difficulty */}
          <HabitDifficultySelector value={difficulty} onChange={setDifficulty} />
          
          {/* Category */}
          <div className="space-y-2">
            <Label>Attribute Boost</Label>
            <div className="flex gap-2">
              {(Object.keys(categoryConfig) as HabitCategory[]).map((cat) => {
                const config = categoryConfig[cat];
                const Icon = config.icon;
                return (
                  <Button
                    key={cat}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "flex-1 gap-2",
                      category === cat && config.color
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {config.label}
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Which companion attribute grows when you complete this habit
            </p>
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
