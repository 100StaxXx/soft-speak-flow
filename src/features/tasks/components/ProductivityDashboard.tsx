import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Calendar, 
  Clock, 
  Target, 
  Zap, 
  TrendingUp,
  Award,
  Brain
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useProductivityStats } from '../hooks/useProductivityStats';
import { WeeklyProgress } from './WeeklyProgress';

interface ProductivityDashboardProps {
  className?: string;
}

export function ProductivityDashboard({ className }: ProductivityDashboardProps) {
  const { todayStats, weeklyStats, weeklySummary, insights, isLoading } = useProductivityStats();

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-32 bg-muted rounded" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Today's Stats */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Today's Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center p-3 rounded-lg bg-muted/50"
            >
              <Target className="w-5 h-5 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold">{todayStats?.tasks_completed || 0}</div>
              <div className="text-xs text-muted-foreground">Tasks Done</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center p-3 rounded-lg bg-muted/50"
            >
              <Clock className="w-5 h-5 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{todayStats?.focus_minutes || 0}</div>
              <div className="text-xs text-muted-foreground">Focus Min</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center p-3 rounded-lg bg-primary/10"
            >
              <Zap className="w-5 h-5 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold text-primary">{todayStats?.xp_earned || 0}</div>
              <div className="text-xs text-muted-foreground">XP Earned</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center p-3 rounded-lg bg-muted/50"
            >
              <TrendingUp className="w-5 h-5 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">{Math.round(todayStats?.completion_rate || 0)}%</div>
              <div className="text-xs text-muted-foreground">Completion</div>
            </motion.div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Progress Chart */}
      <Card>
        <CardContent className="p-6">
          <WeeklyProgress stats={weeklyStats} />
        </CardContent>
      </Card>

      {/* Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-500" />
            Productivity Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Best Day</span>
              </div>
              <div className="font-medium">{insights.mostProductiveDay}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Peak Hour</span>
              </div>
              <div className="font-medium">{formatHour(insights.mostProductiveHour)}</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="p-3 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Daily Avg</span>
              </div>
              <div className="font-medium">{insights.averageTasksPerDay} tasks</div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="p-3 rounded-lg bg-muted/30"
            >
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Focus Total</span>
              </div>
              <div className="font-medium">{insights.totalFocusHours}h this month</div>
            </motion.div>
          </div>

          {/* Weekly Summary */}
          {weeklySummary && weeklySummary.total_tasks > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-5 h-5 text-primary" />
                <span className="font-medium">Weekly Summary</span>
              </div>
              <p className="text-sm text-muted-foreground">
                You completed <span className="text-foreground font-medium">{weeklySummary.total_tasks} tasks</span> and 
                spent <span className="text-foreground font-medium">{Math.round(weeklySummary.total_focus_minutes / 60)}h</span> in 
                deep focus, earning <span className="text-primary font-medium">{weeklySummary.total_xp} XP</span>. 
                {weeklySummary.completion_rate >= 70 && " Great work this week! 🎉"}
              </p>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
