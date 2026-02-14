import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Scale, Sun, ArrowRight, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWeeklyReschedule } from '@/hooks/useWeeklyReschedule';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface WeeklyTask {
  id: string;
  task_text: string;
  task_date: string;
  completed: boolean;
  estimated_duration: number | null;
  scheduled_time: string | null;
  is_main_quest: boolean;
}

interface SmartWeeklyRescheduleCardProps {
  weeklyTasks: WeeklyTask[];
  onDismiss?: () => void;
}

export function SmartWeeklyRescheduleCard({ weeklyTasks, onDismiss }: SmartWeeklyRescheduleCardProps) {
  const queryClient = useQueryClient();
  const { analysis, isRescheduling, executeAction } = useWeeklyReschedule(weeklyTasks);

  // Don't show if week is balanced
  if (!analysis.isUnbalanced || !analysis.suggestedAction) {
    return null;
  }

  const handleAction = async () => {
    if (!analysis.suggestedAction) return;
    
    try {
      await executeAction(analysis.suggestedAction.type);
      toast.success('Week rebalanced!', {
        description: 'Your tasks have been redistributed.',
      });
      queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-tasks'] });
    } catch (error) {
      toast.error('Failed to reschedule', {
        description: 'Please try again.',
      });
    }
  };

  const getIcon = () => {
    switch (analysis.suggestedAction?.type) {
      case 'balance_week':
      case 'redistribute':
        return <Scale className="h-5 w-5" />;
      case 'clear_weekend':
        return <Sun className="h-5 w-5" />;
      case 'push_heavy_days':
        return <Calendar className="h-5 w-5" />;
      default:
        return <Scale className="h-5 w-5" />;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-orange-500/10 p-4"
      >
        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="absolute right-2 top-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex-shrink-0 p-2 rounded-lg bg-amber-500/20 text-amber-400">
            {getIcon()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm text-foreground mb-1">
              Week Balance: {analysis.balanceScore}%
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              {analysis.recommendation}
            </p>

            {/* Stats */}
            {(analysis.overloadedDays.length > 0 || analysis.emptyDays.length > 0) && (
              <div className="flex flex-wrap gap-2 mb-3">
                {analysis.overloadedDays.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
                    {analysis.overloadedDays.length} heavy {analysis.overloadedDays.length === 1 ? 'day' : 'days'}
                  </span>
                )}
                {analysis.emptyDays.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                    {analysis.emptyDays.length} open {analysis.emptyDays.length === 1 ? 'day' : 'days'}
                  </span>
                )}
              </div>
            )}

            {/* Action Button */}
            <Button
              size="sm"
              variant="secondary"
              onClick={handleAction}
              disabled={isRescheduling}
              className="h-8 text-xs gap-1.5"
            >
              {isRescheduling ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Rebalancing...
                </>
              ) : (
                <>
                  {analysis.suggestedAction.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
