import { motion } from 'framer-motion';
import { Brain, Clock, Zap, TrendingUp, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useFocusSession, FocusSession } from '../hooks/useFocusSession';
import { format, parseISO } from 'date-fns';

interface FocusStatsProps {
  className?: string;
}

export function FocusStats({ className }: FocusStatsProps) {
  const { todaySessions, stats, isLoading } = useFocusSession();

  const formatSessionTime = (session: FocusSession) => {
    const date = parseISO(session.started_at);
    return format(date, 'h:mm a');
  };

  const getSessionTypeLabel = (type: string) => {
    switch (type) {
      case 'pomodoro': return 'Focus';
      case 'short_break': return 'Short Break';
      case 'long_break': return 'Long Break';
      default: return 'Custom';
    }
  };

  const getSessionTypeColor = (type: string) => {
    switch (type) {
      case 'pomodoro': return 'bg-primary/10 text-primary';
      case 'short_break': return 'bg-green-500/10 text-green-500';
      case 'long_break': return 'bg-blue-500/10 text-blue-500';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'cancelled': return 'text-muted-foreground';
      case 'active': return 'text-primary';
      case 'paused': return 'text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          Focus Stats
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center p-3 rounded-lg bg-muted/50"
          >
            <div className="flex justify-center mb-2">
              <Clock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.completedToday}</div>
            <div className="text-xs text-muted-foreground">Sessions</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-center p-3 rounded-lg bg-muted/50"
          >
            <div className="flex justify-center mb-2">
              <TrendingUp className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground">{stats.totalFocusMinutes}</div>
            <div className="text-xs text-muted-foreground">Minutes</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center p-3 rounded-lg bg-primary/10"
          >
            <div className="flex justify-center mb-2">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="text-2xl font-bold text-primary">{stats.totalXPToday}</div>
            <div className="text-xs text-muted-foreground">XP Earned</div>
          </motion.div>
        </div>

        {/* Session History */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Today's Sessions
          </h4>
          
          {todaySessions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No focus sessions yet today. Start one to build your streak!
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {todaySessions.map((session, index) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-xs px-2 py-1 rounded-full",
                      getSessionTypeColor(session.duration_type)
                    )}>
                      {getSessionTypeLabel(session.duration_type)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatSessionTime(session)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.status === 'completed' && session.xp_earned && (
                      <span className="text-xs font-medium text-primary">
                        +{session.xp_earned} XP
                      </span>
                    )}
                    <span className={cn(
                      "text-xs capitalize",
                      getStatusColor(session.status)
                    )}>
                      {session.status}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Streak indicator */}
        {stats.completedToday >= 4 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center p-3 rounded-lg bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/20"
          >
            <span className="text-sm font-medium text-primary">
              🔥 {stats.completedToday} sessions today! Keep the momentum!
            </span>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
