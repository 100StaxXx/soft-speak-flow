import { AlertTriangle, Clock } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  task_text: string;
  scheduled_time: string | null;
  estimated_duration: number | null;
}

interface TimeConflictDetectorProps {
  tasks: Task[];
  className?: string;
}

interface Conflict {
  task1: Task;
  task2: Task;
  overlapMinutes: number;
}

export const TimeConflictDetector = ({ tasks, className }: TimeConflictDetectorProps) => {
  const detectConflicts = (): Conflict[] => {
    const conflicts: Conflict[] = [];
    const scheduledTasks = tasks.filter(t => t.scheduled_time && t.estimated_duration);

    for (let i = 0; i < scheduledTasks.length; i++) {
      for (let j = i + 1; j < scheduledTasks.length; j++) {
        const task1 = scheduledTasks[i];
        const task2 = scheduledTasks[j];

        const task1Start = new Date(`2000-01-01T${task1.scheduled_time}:00`);
        const task1End = new Date(task1Start.getTime() + (task1.estimated_duration! * 60000));
        const task2Start = new Date(`2000-01-01T${task2.scheduled_time}:00`);
        const task2End = new Date(task2Start.getTime() + (task2.estimated_duration! * 60000));

        if (task1Start < task2End && task2Start < task1End) {
          const overlapStart = task1Start > task2Start ? task1Start : task2Start;
          const overlapEnd = task1End < task2End ? task1End : task2End;
          const overlapMinutes = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000);

          conflicts.push({
            task1,
            task2,
            overlapMinutes
          });
        }
      }
    }

    return conflicts;
  };

  const conflicts = detectConflicts();

  if (conflicts.length === 0) return null;

  return (
    <Card className={cn("p-4 border-destructive bg-destructive/5", className)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-semibold text-destructive">Schedule Conflicts Detected</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {conflicts.length} time {conflicts.length === 1 ? 'conflict' : 'conflicts'} found. Adjust your schedule to avoid overlapping tasks.
            </p>
          </div>

          <div className="space-y-2">
            {conflicts.map((conflict, index) => (
              <div key={index} className="bg-card p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-destructive" />
                  <Badge variant="destructive" className="text-xs">
                    {conflict.overlapMinutes} min overlap
                  </Badge>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="font-medium">{conflict.task1.task_text}</span>
                    <span className="text-xs text-muted-foreground">
                      {conflict.task1.scheduled_time} ({conflict.task1.estimated_duration}m)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span className="font-medium">{conflict.task2.task_text}</span>
                    <span className="text-xs text-muted-foreground">
                      {conflict.task2.scheduled_time} ({conflict.task2.estimated_duration}m)
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
};
