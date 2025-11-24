import { CheckCircle2, Circle, Trash2, Star, Sparkles, Clock, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface TaskCardProps {
  task: {
    id: string;
    task_text: string;
    completed: boolean;
    difficulty?: string;
    xp_reward: number;
    is_main_quest?: boolean;
    scheduled_time?: string | null;
    estimated_duration?: number | null;
    recurrence_pattern?: string | null;
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
  const [showXP, setShowXP] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

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

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const getRecurrenceLabel = (pattern: string) => {
    const labels: Record<string, string> = {
      daily: "Daily",
      weekly: "Weekly",
      custom: "Custom",
    };
    return labels[pattern] || pattern;
  };

  useEffect(() => {
    if (task.completed && !justCompleted) {
      setJustCompleted(true);
      setShowXP(true);
      const timer = setTimeout(() => {
        setShowXP(false);
        setJustCompleted(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (!task.completed && justCompleted) {
      setJustCompleted(false);
    }
  }, [task.completed, justCompleted]);

  return (
    <div className="relative">
      {/* Floating XP Animation */}
      {showXP && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div 
            className="text-lg font-bold"
            style={{ 
              animation: 'fadeInUp 2s ease-out',
              color: isMainQuest ? 'hsl(45, 100%, 60%)' : 'hsl(var(--primary))'
            }}
          >
            +{task.xp_reward} XP
          </div>
        </div>
      )}
      
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-300 cursor-pointer group",
          // Main Quest Styling - Gold border, glow, elevated
          isMainQuest && [
            "border-2 border-[hsl(45,100%,60%)]",
            "bg-gradient-to-br from-[hsl(45,100%,60%)]/10 via-primary/5 to-primary/10",
            "shadow-[0_0_20px_hsl(45,100%,60%/0.3),0_4px_16px_rgba(0,0,0,0.3)]",
            "hover:shadow-[0_0_30px_hsl(45,100%,60%/0.5),0_8px_24px_rgba(0,0,0,0.4)]",
            "scale-[1.02]"
          ],
          // Side Quest Styling
          !isMainQuest && "hover:shadow-lg border-border/50",
          // Completed state
          task.completed && "opacity-60"
        )}
      >
        {/* Gold Glow Overlay for Main Quest */}
        {isMainQuest && !task.completed && (
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{ 
              background: 'linear-gradient(90deg, transparent, hsl(45, 100%, 60%, 0.1), transparent)',
              backgroundSize: '200% 100%',
              animation: 'shimmerBackground 3s ease-in-out infinite'
            }} 
          />
        )}
        
        {/* Star Badge for Main Quest */}
        {isMainQuest && (
          <div className="absolute top-2 right-2 z-10">
            <div className="bg-[hsl(45,100%,60%)] rounded-full p-1 shadow-lg">
              <Star className="h-3 w-3 text-background fill-current" />
            </div>
          </div>
        )}
      <div className={cn("p-4 flex items-center gap-3", isMainQuest && "py-5")}>
        {/* Completion Button */}
        <button
          onClick={onToggle}
          className="flex-shrink-0 touch-manipulation active:scale-95 transition-transform"
          aria-label={task.completed ? "Mark task as incomplete" : "Mark task as complete"}
        >
          {task.completed ? (
            <CheckCircle2 className={cn(
              "h-6 w-6 transition-all",
              isMainQuest ? "text-[hsl(45,100%,60%)]" : "text-green-500"
            )} />
          ) : (
            <Circle className={cn(
              "h-6 w-6 transition-all",
              isMainQuest ? "text-[hsl(45,100%,60%)]" : "text-muted-foreground"
            )} />
          )}
        </button>

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              {isMainQuest && <Sparkles className="h-4 w-4 text-[hsl(45,100%,60%)] flex-shrink-0 mt-0.5 animate-pulse" />}
              <p
                className={cn(
                  "text-sm font-medium leading-relaxed break-words",
                  task.completed && "line-through text-muted-foreground",
                  isMainQuest && "text-base font-semibold text-foreground"
                )}
              >
                {task.task_text}
              </p>
            </div>
          
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {task.difficulty && (
                <span className={cn("text-xs", difficultyColors[task.difficulty as keyof typeof difficultyColors])}>
                  {difficultyIcons[task.difficulty as keyof typeof difficultyIcons]}
                </span>
              )}
              <span className={cn(
                "text-xs font-semibold",
                isMainQuest ? "text-[hsl(45,100%,60%)]" : "text-muted-foreground"
              )}>
                +{task.xp_reward} XP
              </span>
              
              {task.scheduled_time && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatTime(task.scheduled_time)}
                </div>
              )}
              
              {task.estimated_duration && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDuration(task.estimated_duration)}
                </div>
              )}
              
              {task.recurrence_pattern && (
                <div className="flex items-center gap-1 text-xs text-primary/80">
                  <Repeat className="w-3 h-3" />
                  {getRecurrenceLabel(task.recurrence_pattern)}
                </div>
              )}
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
                aria-label="Set as Main Quest"
              >
                <Star className="h-4 w-4 text-[hsl(45,100%,60%)]" />
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
                aria-label="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
