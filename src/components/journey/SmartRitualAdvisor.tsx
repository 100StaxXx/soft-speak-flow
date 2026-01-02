import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ChevronRight, 
  Minus, 
  Plus, 
  TrendingDown, 
  RefreshCw,
  AlertTriangle,
  PartyPopper,
  Lightbulb,
  X,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRitualIntelligence, RitualInsight } from '@/hooks/useRitualIntelligence';

const iconMap: Record<string, LucideIcon> = {
  Minus,
  Plus,
  TrendingDown,
  RefreshCw,
  Sparkles,
};

interface SmartRitualAdvisorProps {
  habits: Array<{
    id: string;
    title: string;
    difficulty?: string;
    frequency?: string;
    estimated_minutes?: number | null;
  }>;
  completionData?: Array<{
    habit_id: string;
    completed_at: string;
  }>;
  onSelectAdjustment: (adjustmentText: string) => void;
  onDismiss?: () => void;
  variant?: 'inline' | 'banner' | 'card';
  className?: string;
}

export function SmartRitualAdvisor({
  habits,
  completionData,
  onSelectAdjustment,
  onDismiss,
  variant = 'inline',
  className,
}: SmartRitualAdvisorProps) {
  const [dismissed, setDismissed] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState(false);

  const intelligence = useRitualIntelligence({
    habits,
    completionData,
  });

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed || !intelligence.shouldShowAdvisor) {
    return null;
  }

  const primaryActions = intelligence.smartQuickActions.filter(a => a.priority === 'primary').slice(0, 2);
  const allActions = intelligence.smartQuickActions.slice(0, 4);

  const renderInsightIcon = (type: RitualInsight['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'celebration':
        return <PartyPopper className="w-4 h-4 text-green-500" />;
      default:
        return <Lightbulb className="w-4 h-4 text-blue-500" />;
    }
  };

  if (variant === 'banner') {
    const primaryInsight = intelligence.insights[0];
    const primaryAction = primaryActions[0];

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl",
          "bg-gradient-to-r from-purple-500/10 to-violet-500/10",
          "border border-purple-500/20",
          className
        )}
      >
        <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {primaryInsight?.title || 'Optimize your rituals'}
          </p>
        </div>
        {primaryAction && (
          <Button
            size="sm"
            variant="secondary"
            className="flex-shrink-0 bg-purple-500/20 hover:bg-purple-500/30 text-purple-200"
            onClick={() => onSelectAdjustment(primaryAction.adjustmentText)}
          >
            {primaryAction.label}
          </Button>
        )}
        {onDismiss && (
          <button
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-white/10 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-4", className)}
    >
      {/* Quick Actions Grid */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">
          Smart suggestions
        </label>
        <div className="grid grid-cols-2 gap-2">
          {allActions.map((action) => {
            const IconComponent = iconMap[action.icon] || Sparkles;
            return (
              <button
                key={action.id}
                onClick={() => onSelectAdjustment(action.adjustmentText)}
                className={cn(
                  "flex flex-col items-start gap-1.5 p-3 rounded-xl text-left transition-all",
                  "bg-gradient-to-br from-purple-500/10 to-violet-500/10",
                  "border border-purple-500/20 hover:border-purple-500/40",
                  "hover:from-purple-500/15 hover:to-violet-500/15",
                  action.priority === 'primary' && "ring-1 ring-purple-500/30"
                )}
              >
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-purple-500/20">
                    <IconComponent className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="text-sm font-medium">{action.label}</span>
                </div>
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {action.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Insights Section */}
      {intelligence.insights.length > 0 && (
        <div>
          <button
            onClick={() => setInsightsExpanded(!insightsExpanded)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            <Lightbulb className="w-4 h-4 text-purple-400" />
            <span>{intelligence.insights.length} insight{intelligence.insights.length !== 1 ? 's' : ''} available</span>
            <ChevronRight className={cn(
              "w-4 h-4 ml-auto transition-transform",
              insightsExpanded && "rotate-90"
            )} />
          </button>

          <AnimatePresence>
            {insightsExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-2 pt-3">
                  {intelligence.insights.map((insight) => (
                    <div
                      key={insight.id}
                      className={cn(
                        "p-3 rounded-xl border",
                        insight.type === 'warning' && "bg-amber-500/10 border-amber-500/20",
                        insight.type === 'celebration' && "bg-green-500/10 border-green-500/20",
                        insight.type === 'suggestion' && "bg-blue-500/10 border-blue-500/20"
                      )}
                    >
                      <div className="flex items-start gap-2">
                        {renderInsightIcon(insight.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{insight.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {insight.description}
                          </p>
                          {insight.action && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="mt-2 h-7 text-xs"
                              onClick={() => onSelectAdjustment(insight.action!.adjustmentText)}
                            >
                              {insight.action.label}
                              <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Stats Summary */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="font-medium text-foreground">{intelligence.totalHabits}</span> rituals
        </span>
        <span className="text-muted-foreground/30">•</span>
        <span className="flex items-center gap-1">
          <span className={cn(
            "font-medium",
            intelligence.overallCompletionRate >= 70 && "text-green-500",
            intelligence.overallCompletionRate >= 40 && intelligence.overallCompletionRate < 70 && "text-amber-500",
            intelligence.overallCompletionRate < 40 && "text-red-500"
          )}>
            {Math.round(intelligence.overallCompletionRate)}%
          </span> avg completion
        </span>
      </div>
    </motion.div>
  );
}
