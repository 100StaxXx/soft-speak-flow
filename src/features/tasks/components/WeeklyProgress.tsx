import { motion } from 'framer-motion';
import { format, parseISO, isToday } from 'date-fns';
import { CheckCircle2, Clock, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DailyStats } from '../hooks/useProductivityStats';

interface WeeklyProgressProps {
  stats: DailyStats[];
  className?: string;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeeklyProgress({ stats, className }: WeeklyProgressProps) {
  const maxTasks = Math.max(...stats.map(s => s.tasks_completed), 1);
  const maxXP = Math.max(...stats.map(s => s.xp_earned), 1);

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <TrendingUp className="w-4 h-4" />
        This Week
      </h3>

      {/* Bar chart */}
      <div className="flex items-end justify-between gap-2 h-32">
        {stats.map((day, index) => {
          const date = parseISO(day.date);
          const isCurrentDay = isToday(date);
          const taskHeight = (day.tasks_completed / maxTasks) * 100;
          const xpHeight = (day.xp_earned / maxXP) * 100;

          return (
            <div
              key={day.date}
              className="flex-1 flex flex-col items-center gap-1"
            >
              {/* Stats tooltip area */}
              <div className="relative flex-1 w-full flex items-end justify-center gap-0.5 group">
                {/* Tasks bar */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${taskHeight}%` }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className={cn(
                    "w-3 rounded-t-sm",
                    isCurrentDay ? "bg-primary" : "bg-primary/60"
                  )}
                />
                
                {/* XP bar */}
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${xpHeight}%` }}
                  transition={{ delay: index * 0.05 + 0.1, duration: 0.3 }}
                  className={cn(
                    "w-3 rounded-t-sm",
                    isCurrentDay ? "bg-yellow-500" : "bg-yellow-500/60"
                  )}
                />

                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  <div className="bg-popover border border-border rounded-lg shadow-lg p-2 text-xs whitespace-nowrap">
                    <div className="font-medium mb-1">{format(date, 'EEE, MMM d')}</div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                      {day.tasks_completed} tasks
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {day.focus_minutes}m focus
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Zap className="w-3 h-3 text-yellow-500" />
                      {day.xp_earned} XP
                    </div>
                  </div>
                </div>
              </div>

              {/* Day label */}
              <span className={cn(
                "text-xs",
                isCurrentDay ? "text-primary font-medium" : "text-muted-foreground"
              )}>
                {DAY_LABELS[index]}
              </span>

              {/* Current day indicator */}
              {isCurrentDay && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-1.5 h-1.5 rounded-full bg-primary"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          Tasks
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-yellow-500" />
          XP
        </div>
      </div>

      {/* Weekly totals */}
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">
            {stats.reduce((acc, d) => acc + d.tasks_completed, 0)}
          </div>
          <div className="text-xs text-muted-foreground">Tasks Done</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-foreground">
            {Math.round(stats.reduce((acc, d) => acc + d.focus_minutes, 0) / 60)}h
          </div>
          <div className="text-xs text-muted-foreground">Focus Time</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-primary">
            {stats.reduce((acc, d) => acc + d.xp_earned, 0)}
          </div>
          <div className="text-xs text-muted-foreground">XP Earned</div>
        </div>
      </div>
    </div>
  );
}
