import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Target, Calendar, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useDailyTaskReschedule, RescheduleAction } from '@/hooks/useDailyTaskReschedule';

interface SmartDailyRescheduleCardProps {
  tasks: any[];
  selectedDate: Date;
  onReplan?: () => void;
  onDismiss?: () => void;
}

const actionIcons: Record<RescheduleAction['type'], React.ReactNode> = {
  push_hours: <Clock className="h-4 w-4" />,
  prioritize: <Target className="h-4 w-4" />,
  extend_tomorrow: <Calendar className="h-4 w-4" />,
  replan: <RefreshCw className="h-4 w-4" />,
};

export function SmartDailyRescheduleCard({ 
  tasks, 
  selectedDate, 
  onReplan,
  onDismiss 
}: SmartDailyRescheduleCardProps) {
  const { analysis, isRescheduling, executeAction } = useDailyTaskReschedule(tasks, selectedDate);

  // Don't show if not behind schedule
  if (!analysis.isBehind || !analysis.suggestedAction) {
    return null;
  }

  const handleAction = async () => {
    if (analysis.suggestedAction?.type === 'replan') {
      onReplan?.();
    } else {
      await executeAction(analysis.suggestedAction!.type);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-amber-500/20">
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {analysis.message}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {analysis.suggestedAction.description}
                </p>
                
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-200"
                    onClick={handleAction}
                    disabled={isRescheduling}
                  >
                    {actionIcons[analysis.suggestedAction.type]}
                    <span className="ml-1">
                      {isRescheduling ? 'Updating...' : analysis.suggestedAction.label}
                    </span>
                  </Button>
                  
                  {onDismiss && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      onClick={onDismiss}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="text-right">
                <div className="text-lg font-bold text-amber-400">
                  {analysis.completionRate}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  complete
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
