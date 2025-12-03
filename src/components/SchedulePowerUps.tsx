import { Zap, Target, Trophy, Star, Crown, Sparkles } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  scheduled_time: string | null;
  estimated_duration: number | null;
  is_main_quest: boolean;
  xp_reward: number;
}

interface SchedulePowerUpsProps {
  tasks: Task[];
  className?: string;
}

export const SchedulePowerUps = ({ tasks, className }: SchedulePowerUpsProps) => {
  const calculatePowerUps = () => {
    const scheduledTasks = tasks.filter(t => t.scheduled_time && t.estimated_duration);
    
    // Power Hour: 3+ tasks scheduled consecutively with no gaps
    const powerHours = findPowerHours(scheduledTasks);
    
    // Deep Work Blocks: Tasks 90+ minutes
    const deepWorkBlocks = scheduledTasks.filter(t => (t.estimated_duration || 0) >= 90).length;
    
    // Morning Warrior: Tasks before 9am
    const morningTasks = scheduledTasks.filter(t => {
      const hour = parseInt(t.scheduled_time!.split(':')[0]);
      return hour < 9;
    }).length;
    
    // Perfect Planning: All tasks scheduled with no conflicts
    const allScheduled = tasks.length > 0 && tasks.every(t => t.scheduled_time && t.estimated_duration);
    const hasConflicts = checkConflicts(scheduledTasks);
    const perfectPlanning = allScheduled && !hasConflicts && tasks.length >= 3;
    
    // Main Quest XP Multiplier
    const mainQuestScheduled = tasks.some(t => t.is_main_quest && t.scheduled_time);
    
    return {
      powerHours,
      deepWorkBlocks,
      morningTasks,
      perfectPlanning,
      mainQuestScheduled,
      totalBonus: (powerHours.length * 15) + (deepWorkBlocks * 20) + (morningTasks * 10) + (perfectPlanning ? 50 : 0)
    };
  };

  const findPowerHours = (tasks: Task[]) => {
    // Group tasks by hour and find consecutive blocks of 3+
    const hourlyTasks = new Map<number, Task[]>();
    tasks.forEach(task => {
      const hour = parseInt(task.scheduled_time!.split(':')[0]);
      if (!hourlyTasks.has(hour)) hourlyTasks.set(hour, []);
      hourlyTasks.get(hour)!.push(task);
    });
    
    const powerHours: number[] = [];
    const hours = Array.from(hourlyTasks.keys()).sort((a, b) => a - b);
    
    for (let i = 0; i < hours.length - 2; i++) {
      if (hours[i + 1] === hours[i] + 1 && hours[i + 2] === hours[i] + 2) {
        powerHours.push(hours[i]);
      }
    }
    
    return powerHours;
  };

  const checkConflicts = (tasks: Task[]) => {
    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const t1Start = new Date(`2000-01-01T${tasks[i].scheduled_time}:00`);
        const t1End = new Date(t1Start.getTime() + (tasks[i].estimated_duration! * 60000));
        const t2Start = new Date(`2000-01-01T${tasks[j].scheduled_time}:00`);
        const t2End = new Date(t2Start.getTime() + (tasks[j].estimated_duration! * 60000));
        
        if (t1Start < t2End && t2Start < t1End) return true;
      }
    }
    return false;
  };

  const powerUps = calculatePowerUps();
  const hasAnyBonus = powerUps.totalBonus > 0;

  if (!hasAnyBonus) return null;

  return (
    <Card className={cn(
      "p-4 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30 animate-in fade-in-50 slide-in-from-bottom-3 duration-500",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-primary/20 rounded-lg">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
        </div>
        
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="font-bold text-primary flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Schedule Power-Ups Active!
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Earn bonus XP for smart scheduling
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {powerUps.powerHours.length > 0 && (
              <Badge variant="secondary" className="gap-1 bg-violet-500/20 text-violet-400 border-violet-500/30">
                <Target className="h-3 w-3" />
                Power Hour x{powerUps.powerHours.length} (+{powerUps.powerHours.length * 15} XP)
              </Badge>
            )}
            
            {powerUps.deepWorkBlocks > 0 && (
              <Badge variant="secondary" className="gap-1 bg-blue-500/20 text-blue-400 border-blue-500/30">
                <Star className="h-3 w-3" />
                Deep Work x{powerUps.deepWorkBlocks} (+{powerUps.deepWorkBlocks * 20} XP)
              </Badge>
            )}
            
            {powerUps.morningTasks > 0 && (
              <Badge variant="secondary" className="gap-1 bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Trophy className="h-3 w-3" />
                Morning Warrior x{powerUps.morningTasks} (+{powerUps.morningTasks * 10} XP)
              </Badge>
            )}
            
            {powerUps.perfectPlanning && (
              <Badge variant="secondary" className="gap-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 animate-pulse">
                <Crown className="h-3 w-3" />
                Perfect Planning (+50 XP)
              </Badge>
            )}
          </div>

          <div className="text-center pt-2 border-t border-primary/20">
            <span className="text-lg font-bold text-primary">
              Potential Bonus: +{powerUps.totalBonus} XP
            </span>
            <p className="text-[10px] text-muted-foreground mt-1">
              Keep this schedule to maximize your productivity! 🚀
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
};
