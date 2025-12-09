import { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { HabitDifficultySelector } from "@/components/HabitDifficultySelector";
import { QuestDifficulty } from "../types";

interface Task {
  id: string;
  task_text: string;
  difficulty?: string | null;
  scheduled_time?: string | null;
  estimated_duration?: number | null;
  notes?: string | null;
}

interface EditQuestDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (taskId: string, updates: {
    task_text: string;
    difficulty: string;
    scheduled_time: string | null;
    estimated_duration: number | null;
    notes: string | null;
  }) => Promise<void>;
  isSaving: boolean;
}

export function EditQuestDialog({
  task,
  open,
  onOpenChange,
  onSave,
  isSaving,
}: EditQuestDialogProps) {
  const [taskText, setTaskText] = useState("");
  const [difficulty, setDifficulty] = useState<QuestDifficulty>("medium");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [estimatedDuration, setEstimatedDuration] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (task) {
      setTaskText(task.task_text);
      setDifficulty((task.difficulty as QuestDifficulty) || "medium");
      setScheduledTime(task.scheduled_time || "");
      setEstimatedDuration(task.estimated_duration?.toString() || "");
      setNotes(task.notes || "");
    }
  }, [task]);

  const handleSave = async () => {
    if (!task || !taskText.trim()) return;
    
    await onSave(task.id, {
      task_text: taskText.trim(),
      difficulty,
      scheduled_time: scheduledTime || null,
      estimated_duration: estimatedDuration ? parseInt(estimatedDuration) : null,
      notes: notes.trim() || null,
    });
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Edit Quest
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Quest Name</label>
            <Input
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="What quest will you conquer?"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Difficulty</label>
            <HabitDifficultySelector
              value={difficulty}
              onChange={setDifficulty}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Scheduled Time</label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (min)</label>
              <Input
                type="number"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder="30"
                min="1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !taskText.trim()}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
