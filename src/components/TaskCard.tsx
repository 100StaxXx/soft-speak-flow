import { CheckCircle2, Circle, Trash2, Star, Sparkles, Clock, Repeat, ArrowDown, Pencil, Shield, Sword, Crown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, stripMarkdown } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { haptics } from "@/utils/haptics";
import { playHabitComplete } from "@/utils/soundEffects";

interface TaskCardProps {
  task: {
    id: string;
    task_text: string;
    completed: boolean;
    difficulty?: string | null;
    xp_reward: number;
    is_main_quest?: boolean | null;
    scheduled_time?: string | null;
    estimated_duration?: number | null;
    recurrence_pattern?: string | null;
    notes?: string | null;
  };
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  onSetMainQuest?: () => void;
  showPromoteButton?: boolean;
  isMainQuest?: boolean;
  isTutorialQuest?: boolean;
  streakMultiplier?: number;
  isToggling?: boolean;
}

export const TaskCard = ({
  task,
  onToggle,
  onDelete,
  onEdit,
  onSetMainQuest,
  showPromoteButton,
  isMainQuest,
  isTutorialQuest,
  streakMultiplier = 1,
  isToggling = false,
}: TaskCardProps) => {
  const [showXP, setShowXP] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  const [showCheckAnimation, setShowCheckAnimation] = useState(false);
  const isInitialMount = useRef(true);

  // Enhanced difficulty config with icons and glow colors
  const difficultyConfig = {
    easy: { 
      icon: Shield, 
      label: "E", 
      color: "text-green-500", 
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      glowColor: "shadow-green-500/20"
    },
    medium: { 
      icon: Sword, 
      label: "M", 
      color: "text-yellow-500", 
      bgColor: "bg-yellow-500/10",
      borderColor: "border-yellow-500/30",
      glowColor: "shadow-yellow-500/20"
    },
    hard: { 
      icon: Crown, 
      label: "H", 
      color: "text-red-500", 
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
      glowColor: "shadow-red-500/20"
    },
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
    // Skip XP animation on initial mount (for already-completed tasks)
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    if (task.completed && !justCompleted) {
      setJustCompleted(true);
      setShowXP(true);
      setShowCheckAnimation(true);
      
      // Play completion sound
      playHabitComplete();
      
      const timer = setTimeout(() => {
        setShowXP(false);
        setJustCompleted(false);
        setShowCheckAnimation(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else if (!task.completed && justCompleted) {
      setJustCompleted(false);
      setShowCheckAnimation(false);
    }
  }, [task.completed, justCompleted]);

  const displayXP = streakMultiplier > 1 
    ? Math.round(task.xp_reward * streakMultiplier) 
    : task.xp_reward;

  return (
    <div 
      className={cn(
        "relative",
        showCheckAnimation && "animate-task-complete"
      )}
      data-tutorial-quest={isTutorialQuest ? "true" : undefined}
      style={{
        WebkitUserSelect: 'none',
        userSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'manipulation',
      }}
    >
      {/* Enhanced Floating XP Animation */}
      {showXP && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div 
            className={cn(
              "text-xl font-black relative flex items-center gap-1",
              "animate-xp-float"
            )}
            style={{ 
              color: isMainQuest ? 'hsl(45, 100%, 60%)' : 'hsl(var(--primary))'
            }}
          >
            <span>+{displayXP}</span>
            <span className="text-sm">XP</span>
            {streakMultiplier > 1 && (
              <span className="text-xs ml-1 opacity-80">({streakMultiplier}x)</span>
            )}
            {/* Enhanced sparkle particles */}
            <span className="absolute -left-4 -top-2 w-2 h-2 bg-stardust-gold rounded-full animate-sparkle-burst" style={{ animationDelay: '0ms' }} />
            <span className="absolute -right-4 top-0 w-2 h-2 bg-primary rounded-full animate-sparkle-burst" style={{ animationDelay: '100ms' }} />
            <span className="absolute left-1/2 -top-4 w-1.5 h-1.5 bg-accent rounded-full animate-sparkle-burst" style={{ animationDelay: '200ms' }} />
            <span className="absolute -left-2 bottom-0 w-1.5 h-1.5 bg-stardust-gold rounded-full animate-sparkle-burst" style={{ animationDelay: '150ms' }} />
            <span className="absolute right-0 -bottom-2 w-1 h-1 bg-primary rounded-full animate-sparkle-burst" style={{ animationDelay: '250ms' }} />
          </div>
        </div>
      )}
      
      {/* Completion ring ripple */}
      {showCheckAnimation && (
        <div className="absolute left-6 top-1/2 -translate-y-1/2 pointer-events-none z-20">
          <div className="w-8 h-8 rounded-full border-2 border-green-500 animate-ripple-expand" />
        </div>
      )}
      
      <Card
        className={cn(
          "relative transition-all duration-300 cursor-pointer group",
          isTutorialQuest && !task.completed ? "overflow-visible" : "overflow-hidden",
          // Main Quest Styling - Gold cosmiq glow
          isMainQuest && [
            "border-2 border-stardust-gold",
            "cosmiq-glass",
            "shadow-[0_0_20px_hsl(var(--stardust-gold)/0.5),0_4px_16px_rgba(0,0,0,0.3)]",
            "hover:shadow-[0_0_30px_hsl(var(--stardust-gold)/0.7),0_8px_24px_rgba(0,0,0,0.4)]",
            "scale-[1.02]"
          ],
          // Side Quest Styling - Subtle cosmiq glass
          !isMainQuest && "cosmiq-glass hover:shadow-lg border-border/50",
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
        <div className="relative overflow-visible">
          {/* Animated Arrow Indicator for Tutorial Quest */}
          {isTutorialQuest && !task.completed && (
            <div
              className="absolute left-1/2 -top-20 -translate-x-1/2 pointer-events-none z-[60] flex flex-col items-center gap-2"
              style={{
                animation: 'bounceDown 1.2s ease-in-out infinite',
              }}
            >
              <div
                className="text-xs font-bold text-primary bg-primary/20 px-3 py-1.5 rounded-full border-2 border-primary shadow-lg"
                style={{
                  animation: 'clickHerePulse 1.5s ease-in-out infinite',
                }}
              >
                Click here!
              </div>
              <ArrowDown
                className="h-8 w-8 -translate-y-1 text-primary drop-shadow-[0_0_12px_hsl(var(--primary))] filter brightness-125"
                strokeWidth={3}
              />
            </div>
          )}
          <button
            onClick={() => {
              if (isToggling) return;
              haptics.success();
              onToggle();
            }}
            disabled={isToggling}
            className={cn(
              "flex-shrink-0 touch-manipulation active:scale-95 transition-transform relative z-10",
              isToggling && "opacity-50 cursor-not-allowed"
            )}
            aria-label={task.completed ? "Mark task as incomplete" : "Mark task as complete"}
          >
            {isToggling ? (
              <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            ) : task.completed ? (
              <CheckCircle2 className={cn(
                "h-6 w-6 transition-all",
                isMainQuest ? "text-[hsl(45,100%,60%)]" : "text-green-500"
              )} />
            ) : (
              <Circle className={cn(
                "h-6 w-6 transition-all",
                isMainQuest ? "text-[hsl(45,100%,60%)]" : "text-muted-foreground",
                isTutorialQuest && "text-primary ring-2 ring-primary ring-offset-2 ring-offset-background rounded-full"
              )} />
            )}
          </button>
        </div>

          {/* Task Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              {isMainQuest && <Sparkles className="h-4 w-4 text-[hsl(45,100%,60%)] flex-shrink-0 mt-0.5 animate-pulse" />}
              <p
                className={cn(
                  "text-sm font-medium leading-relaxed break-words",
                  task.completed && "text-muted-foreground",
                  task.completed && (justCompleted ? "animate-strikethrough" : "line-through"),
                  isMainQuest && "text-base font-semibold text-foreground"
                )}
              >
                {task.task_text}
              </p>
            </div>

            {task.notes && (
              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                {stripMarkdown(task.notes)}
              </p>
            )}

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {/* Enhanced difficulty badge */}
              {task.difficulty && difficultyConfig[task.difficulty as keyof typeof difficultyConfig] && (
                <div className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold border",
                  difficultyConfig[task.difficulty as keyof typeof difficultyConfig].bgColor,
                  difficultyConfig[task.difficulty as keyof typeof difficultyConfig].borderColor,
                  difficultyConfig[task.difficulty as keyof typeof difficultyConfig].color,
                  "shadow-sm",
                  difficultyConfig[task.difficulty as keyof typeof difficultyConfig].glowColor
                )}>
                  {(() => {
                    const DiffIcon = difficultyConfig[task.difficulty as keyof typeof difficultyConfig].icon;
                    return <DiffIcon className="h-3 w-3" />;
                  })()}
                  <span>{difficultyConfig[task.difficulty as keyof typeof difficultyConfig].label}</span>
                </div>
              )}
              <span className={cn(
                "text-xs font-semibold",
                isMainQuest ? "text-[hsl(45,100%,60%)]" : "text-muted-foreground"
              )}>
                +{displayXP} XP
                {streakMultiplier > 1 && !isMainQuest && (
                  <span className="text-primary/70 ml-0.5">({streakMultiplier}x)</span>
                )}
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
            {/* Edit Button */}
            {onEdit && !task.completed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Edit task"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            
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
