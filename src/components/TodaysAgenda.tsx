import { useMemo, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  Flame, 
  Trophy, 
  Plus,
  Check,
  Circle,
  ArrowDown,
  Clock,
  Pencil,
  Repeat
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  task_text: string;
  completed: boolean | null;
  xp_reward: number;
  scheduled_time?: string | null;
  is_main_quest?: boolean | null;
  difficulty?: string | null;
  habit_source_id?: string | null;
  epic_id?: string | null;
}

interface Journey {
  id: string;
  title: string;
  progress_percentage: number;
}

interface TodaysAgendaProps {
  tasks: Task[];
  selectedDate: Date;
  onToggle: (taskId: string, completed: boolean, xpReward: number) => void;
  onAddQuest: () => void;
  completedCount: number;
  totalCount: number;
  currentStreak?: number;
  activeJourneys?: Journey[];
  onUndoToggle?: (taskId: string, xpReward: number) => void;
  onEditQuest?: (task: Task) => void;
  hideIndicator?: boolean;
}

// Helper to format time in 12-hour format
const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export function TodaysAgenda({
  tasks,
  selectedDate,
  onToggle,
  onAddQuest,
  completedCount,
  totalCount,
  currentStreak = 0,
  activeJourneys = [],
  onUndoToggle,
  onEditQuest,
  hideIndicator = false,
}: TodaysAgendaProps) {
  const tutorialCheckboxRef = useRef<HTMLDivElement>(null);
  const [indicatorPosition, setIndicatorPosition] = useState<{ top: number; left: number } | null>(null);

  // Find tutorial quest
  const tutorialQuest = tasks.find(t => t.task_text === 'Join Cosmiq' && !t.completed);

  // Update indicator position when tutorial quest is visible
  useEffect(() => {
    if (!tutorialQuest || !tutorialCheckboxRef.current) {
      setIndicatorPosition(null);
      return;
    }

    const updatePosition = () => {
      if (tutorialCheckboxRef.current) {
        const rect = tutorialCheckboxRef.current.getBoundingClientRect();
        setIndicatorPosition({
          top: rect.top - 44,
          left: rect.left + rect.width / 2,
        });
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [tutorialQuest]);
  
  // Separate ritual tasks (from campaigns) and regular quests
  const { ritualTasks, questTasks, sortedTasks } = useMemo(() => {
    const rituals = tasks.filter(t => !!t.habit_source_id);
    const quests = tasks.filter(t => !t.habit_source_id);
    
    // Sort each group: incomplete first, then by scheduled time
    const sortGroup = (group: Task[]) => [...group].sort((a, b) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.scheduled_time && b.scheduled_time) {
        return a.scheduled_time.localeCompare(b.scheduled_time);
      }
      if (a.scheduled_time) return -1;
      if (b.scheduled_time) return 1;
      return 0;
    });
    
    return {
      ritualTasks: sortGroup(rituals),
      questTasks: sortGroup(quests),
      sortedTasks: [...sortGroup(rituals), ...sortGroup(quests)],
    };
  }, [tasks]);

  const totalXP = tasks.reduce((sum, t) => (t.completed ? sum + t.xp_reward : sum), 0);
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const allComplete = totalCount > 0 && completedCount === totalCount;

  const renderTaskItem = (task: Task) => {
    const isComplete = !!task.completed;
    const isTutorialQuest = task.task_text === 'Join Cosmiq';
    const isRitual = !!task.habit_source_id;
    
    const handleClick = () => {
      if (isComplete && onUndoToggle) {
        // Untoggle completed quest - revert XP
        onUndoToggle(task.id, task.xp_reward);
      } else {
        onToggle(task.id, !isComplete, task.xp_reward);
      }
    };
    
    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center gap-3 p-2 rounded-lg transition-all relative group",
          "hover:bg-muted/30 cursor-pointer",
          isComplete && "opacity-60"
        )}
        onClick={handleClick}
      >
        <div 
          ref={isTutorialQuest && !isComplete ? tutorialCheckboxRef : undefined}
          className="relative"
        >
          <div className={cn(
            "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
            isComplete 
              ? "bg-primary border-primary" 
              : isTutorialQuest 
                ? "border-yellow-400 ring-2 ring-yellow-400 ring-offset-1 ring-offset-background"
                : "border-muted-foreground/30"
          )}>
            {isComplete && <Check className="w-3 h-3 text-primary-foreground" />}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isRitual && (
              <Repeat className="w-3 h-3 text-accent flex-shrink-0" />
            )}
            <p className={cn(
              "text-sm truncate",
              isComplete && "line-through text-muted-foreground"
            )}>
              {task.task_text}
            </p>
          </div>
          {task.scheduled_time && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3" />
              {formatTime(task.scheduled_time)}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Edit button - shows on hover for incomplete quests */}
          {onEditQuest && !isComplete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onEditQuest(task);
              }}
            >
              <Pencil className="w-3 h-3" />
            </Button>
          )}
          {task.is_main_quest && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 border-primary/30">
              Main
            </Badge>
          )}
          <span className="text-xs text-stardust-gold/80">+{task.xp_reward}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <Card className={cn(
      "relative",
      "bg-gradient-to-br from-card via-card to-primary/5",
      "border-primary/20"
    )}>
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative p-4 overflow-visible">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">
                {isToday ? "Today's Agenda" : format(selectedDate, "MMM d")}
              </span>
            </div>
          {currentStreak > 0 && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
                currentStreak >= 30 
                  ? "bg-stardust-gold/20 text-stardust-gold" 
                  : currentStreak >= 14 
                    ? "bg-celestial-blue/20 text-celestial-blue" 
                    : "bg-orange-500/10 text-orange-400"
              )}>
                <Flame className="h-3 w-3" />
                {currentStreak}
              </div>
            )}
          </div>

          <div className={cn(
            "flex items-center gap-1.5 text-sm px-2 py-0.5 rounded-full",
            allComplete ? "bg-stardust-gold/20" : "bg-stardust-gold/10"
          )}>
            <Trophy className={cn(
              "h-4 w-4",
              allComplete ? "text-stardust-gold" : "text-stardust-gold/70"
            )} />
            <span className="font-medium text-stardust-gold">{totalXP} XP</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
          {allComplete && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
          )}
        </div>

        <div className="flex justify-between mb-4 text-xs text-muted-foreground">
          <span>{completedCount} of {totalCount} completed</span>
          <span>{Math.round(progressPercent)}%</span>
        </div>

        {/* Task Lists */}
        {tasks.length === 0 ? (
          <div className="text-center py-6">
            <Circle className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              No tasks for this day
            </p>
            <Button size="sm" onClick={onAddQuest} className="gap-1">
              <Plus className="w-4 h-4" />
              Add Quest
            </Button>
          </div>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {/* Cosmiq Rituals Section */}
            {ritualTasks.length > 0 && (
              <>
                <div className="flex items-center gap-2 py-1.5 px-1">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30">
                    <Sparkles className="w-3 h-3 text-accent" />
                    <span className="text-[10px] font-semibold text-accent uppercase tracking-wide">
                      Cosmiq Rituals
                    </span>
                    <Badge variant="secondary" className="h-4 px-1 text-[10px] bg-accent/20 text-accent border-0">
                      {ritualTasks.length}
                    </Badge>
                  </div>
                </div>
                {ritualTasks.slice(0, 4).map((task) => renderTaskItem(task))}
                {ritualTasks.length > 4 && (
                  <p className="text-xs text-muted-foreground text-center py-0.5">
                    +{ritualTasks.length - 4} more rituals
                  </p>
                )}
              </>
            )}
            
            {/* Regular Quests Section */}
            {questTasks.length > 0 && (
              <>
                {ritualTasks.length > 0 && (
                  <div className="flex items-center gap-2 py-1.5 px-1 mt-2">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Quests
                    </span>
                  </div>
                )}
                {questTasks.slice(0, ritualTasks.length > 0 ? 4 : 8).map((task) => renderTaskItem(task))}
                {questTasks.length > (ritualTasks.length > 0 ? 4 : 8) && (
                  <p className="text-xs text-muted-foreground text-center py-0.5">
                    +{questTasks.length - (ritualTasks.length > 0 ? 4 : 8)} more
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Journey Progress Indicators */}
        {activeJourneys.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Journey Progress</p>
            <div className="flex gap-2 flex-wrap">
              {activeJourneys.map((journey) => (
                <div
                  key={journey.id}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-xs truncate max-w-[100px]">{journey.title}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(journey.progress_percentage)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Portal: Tutorial indicator floats above everything */}
      {indicatorPosition && !hideIndicator && createPortal(
        <div
          className="fixed pointer-events-none z-[9999] flex flex-col items-center gap-0.5"
          style={{ 
            top: indicatorPosition.top,
            left: indicatorPosition.left,
            transform: 'translateX(-50%)',
            animation: 'bounceDown 1.2s ease-in-out infinite'
          }}
        >
          <div
            className="text-[10px] font-bold text-yellow-400 bg-yellow-400/20 px-2 py-0.5 rounded-full border border-yellow-400 shadow-lg whitespace-nowrap"
            style={{ animation: 'clickHerePulse 1.5s ease-in-out infinite' }}
          >
            Click here!
          </div>
          <ArrowDown className="h-4 w-4 text-yellow-400 drop-shadow-[0_0_8px_#facc15]" strokeWidth={3} />
        </div>,
        document.body
      )}
    </Card>
  );
}
