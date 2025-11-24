import { Target, Clock, Sparkles, Zap, Flame, Mountain } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface QuestDragCardProps {
  task: {
    id: string;
    task_text: string;
    scheduled_time: string | null;
    estimated_duration: number | null;
    completed: boolean;
    is_main_quest: boolean;
    difficulty: string | null;
    xp_reward: number;
  };
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}

const difficultyConfig = {
  easy: { 
    color: "border-l-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20",
    icon: Zap,
    glow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
  },
  medium: { 
    color: "border-l-amber-500 bg-amber-500/10 hover:bg-amber-500/20",
    icon: Flame,
    glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.3)]"
  },
  hard: { 
    color: "border-l-rose-500 bg-rose-500/10 hover:bg-rose-500/20",
    icon: Mountain,
    glow: "hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]"
  }
};

export const QuestDragCard = ({ task, isDragging, onDragStart }: QuestDragCardProps) => {
  const [isHovering, setIsHovering] = useState(false);
  const config = task.difficulty ? difficultyConfig[task.difficulty as keyof typeof difficultyConfig] : null;
  const DifficultyIcon = config?.icon;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={cn(
        "relative group cursor-move transition-all duration-300",
        "border-l-4 rounded-lg p-2 mb-1",
        task.completed && "opacity-50 line-through",
        task.is_main_quest && "border-l-amber-500 bg-gradient-to-r from-amber-500/10 to-amber-500/5",
        !task.is_main_quest && config?.color,
        config?.glow,
        isDragging && "opacity-50 scale-95",
        !isDragging && "hover:scale-105 hover:-translate-y-1",
        "animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
      )}
      style={{
        boxShadow: isHovering && !task.completed 
          ? `0 0 30px ${task.is_main_quest ? 'rgba(245,158,11,0.4)' : 'rgba(167,108,255,0.2)'}`
          : undefined
      }}
    >
      {/* Sparkle effect on hover */}
      {isHovering && !task.completed && (
        <div className="absolute -top-1 -right-1 animate-pulse">
          <Sparkles className="h-3 w-3 text-primary" />
        </div>
      )}

      {/* Main Quest Crown */}
      {task.is_main_quest && (
        <div className="absolute -top-2 -left-2 bg-amber-500 rounded-full p-1 shadow-lg animate-bounce">
          <Target className="h-3 w-3 text-white" />
        </div>
      )}

      <div className="flex items-start gap-2">
        {DifficultyIcon && !task.is_main_quest && (
          <DifficultyIcon className="h-3 w-3 mt-0.5 flex-shrink-0 text-current" />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{task.task_text}</div>
          
          <div className="flex items-center gap-2 mt-1">
            {task.scheduled_time && (
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-2 w-2" />
                {task.scheduled_time}
              </div>
            )}
            
            {task.estimated_duration && (
              <div className="text-[10px] text-muted-foreground">
                {task.estimated_duration}m
              </div>
            )}
            
            <div className={cn(
              "ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full",
              task.is_main_quest 
                ? "bg-amber-500/20 text-amber-500"
                : "bg-primary/20 text-primary"
            )}>
              +{task.is_main_quest ? task.xp_reward * 2 : task.xp_reward} XP
            </div>
          </div>
        </div>
      </div>

      {/* Drag hint on hover */}
      {isHovering && !task.completed && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-pulse pointer-events-none" />
      )}
    </div>
  );
};
