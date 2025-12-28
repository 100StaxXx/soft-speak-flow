import { useMemo } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { 
  Sparkles, 
  Flame, 
  Trophy, 
  Plus,
  Check,
  Circle,
  Target
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
}

export function TodaysAgenda({
  tasks,
  selectedDate,
  onToggle,
  onAddQuest,
  completedCount,
  totalCount,
  currentStreak = 0,
  activeJourneys = [],
}: TodaysAgendaProps) {
  const { rituals, quests } = useMemo(() => {
    const ritualsList: Task[] = [];
    const questsList: Task[] = [];
    
    tasks.forEach((task) => {
      if (task.habit_source_id) {
        ritualsList.push(task);
      } else {
        questsList.push(task);
      }
    });
    
    // Sort: incomplete first, then by scheduled time
    const sortTasks = (a: Task, b: Task) => {
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1;
      }
      if (a.scheduled_time && b.scheduled_time) {
        return a.scheduled_time.localeCompare(b.scheduled_time);
      }
      return 0;
    };
    
    return {
      rituals: ritualsList.sort(sortTasks),
      quests: questsList.sort(sortTasks),
    };
  }, [tasks]);

  const totalXP = tasks.reduce((sum, t) => (t.completed ? sum + t.xp_reward : sum), 0);
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
  const allComplete = totalCount > 0 && completedCount === totalCount;

  const renderTaskItem = (task: Task, isRitual: boolean) => {
    const isComplete = !!task.completed;
    
    return (
      <motion.div
        key={task.id}
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className={cn(
          "flex items-center gap-3 p-2 rounded-lg transition-all",
          "hover:bg-muted/30 cursor-pointer",
          isComplete && "opacity-60"
        )}
        onClick={() => onToggle(task.id, !isComplete, task.xp_reward)}
      >
        <div className={cn(
          "flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
          isComplete 
            ? "bg-primary border-primary" 
            : "border-muted-foreground/30"
        )}>
          {isComplete && <Check className="w-3 h-3 text-primary-foreground" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm truncate",
            isComplete && "line-through text-muted-foreground"
          )}>
            {task.task_text}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {isRitual && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-accent/10 border-accent/30">
              Ritual
            </Badge>
          )}
          {task.is_main_quest && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-primary/10 border-primary/30">
              Main
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">+{task.xp_reward}</span>
        </div>
      </motion.div>
    );
  };

  return (
    <Card className={cn(
      "relative overflow-hidden",
      "bg-gradient-to-br from-card via-card to-primary/5",
      "border-primary/20"
    )}>
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 pointer-events-none" />
      
      <div className="relative p-4">
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
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 text-xs">
                <Flame className="h-3 w-3" />
                {currentStreak}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-sm">
            <Trophy className={cn(
              "h-4 w-4",
              allComplete ? "text-stardust-gold" : "text-muted-foreground"
            )} />
            <span className="font-medium">{totalXP} XP</span>
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
          <div className="space-y-4 max-h-64 overflow-y-auto">
            {/* Quests Section */}
            {quests.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Quests ({quests.filter(q => q.completed).length}/{quests.length})
                  </span>
                </div>
                {quests.slice(0, 5).map((task) => renderTaskItem(task, false))}
                {quests.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{quests.length - 5} more quests
                  </p>
                )}
              </div>
            )}
            
            {/* Rituals Section */}
            {rituals.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Rituals ({rituals.filter(r => r.completed).length}/{rituals.length})
                  </span>
                </div>
                {rituals.slice(0, 5).map((task) => renderTaskItem(task, true))}
                {rituals.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-1">
                    +{rituals.length - 5} more rituals
                  </p>
                )}
              </div>
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
    </Card>
  );
}
