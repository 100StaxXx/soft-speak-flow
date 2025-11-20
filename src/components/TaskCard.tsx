import { CheckCircle2, Circle, Trash2, Star, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  task: {
    id: string;
    task_text: string;
    completed: boolean;
    difficulty?: string;
    xp_reward: number;
    is_main_quest?: boolean;
  };
  onToggle: () => void;
  onDelete: () => void;
  onSetMainQuest?: () => void;
  showPromoteButton?: boolean;
  isMainQuest?: boolean;
}

export const TaskCard = ({
  task,
  onToggle,
  onDelete,
  onSetMainQuest,
  showPromoteButton,
  isMainQuest,
}: TaskCardProps) => {
  const difficultyColors = {
    easy: "text-green-500",
    medium: "text-yellow-500",
    hard: "text-red-500",
  };

  const difficultyIcons = {
    easy: "◆",
    medium: "◆◆",
    hard: "◆◆◆",
  };

  return (
    <Card
      className={cn(
        "transition-all duration-300 hover:shadow-lg cursor-pointer group",
        isMainQuest && "border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10 shadow-primary/20",
        task.completed && "opacity-60"
      )}
    >
      <div className="p-4 flex items-center gap-3">
        {/* Completion Button */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 touch-manipulation active:scale-95 transition-transform"
        >
          {task.completed ? (
            <CheckCircle2 className={cn("h-6 w-6", isMainQuest ? "text-primary" : "text-green-500")} />
          ) : (
            <Circle className={cn("h-6 w-6", isMainQuest ? "text-primary" : "text-muted-foreground")} />
          )}
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {isMainQuest && <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />}
            <p
              className={cn(
                "text-sm font-medium leading-relaxed break-words",
                task.completed && "line-through text-muted-foreground",
                isMainQuest && "text-base font-semibold"
              )}
            >
              {task.task_text}
            </p>
          </div>
          
          <div className="flex items-center gap-2 mt-1">
            {task.difficulty && (
              <span className={cn("text-xs", difficultyColors[task.difficulty as keyof typeof difficultyColors])}>
                {difficultyIcons[task.difficulty as keyof typeof difficultyIcons]}
              </span>
            )}
            <span className={cn(
              "text-xs font-medium",
              isMainQuest ? "text-primary" : "text-muted-foreground"
            )}>
              +{task.xp_reward} XP
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Promote to Main Quest Button */}
          {showPromoteButton && onSetMainQuest && !task.completed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSetMainQuest();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              title="Set as Main Quest"
            >
              <Star className="h-4 w-4" />
            </Button>
          )}

          {/* Delete Button */}
          {!task.completed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
