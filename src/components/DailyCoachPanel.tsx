import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  AlertTriangle, 
  TrendingUp, 
  Lightbulb, 
  Zap,
  Sun,
  Sunset,
  Moon,
  ChevronRight,
  X
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useDailyPlanOptimization, DailyInsight } from '@/hooks/useDailyPlanOptimization';

interface DailyInsightCardProps {
  insight: DailyInsight;
  onAction?: (insight: DailyInsight) => void;
  onDismiss?: (insight: DailyInsight) => void;
}

const insightConfig = {
  optimization: {
    icon: Zap,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  encouragement: {
    icon: TrendingUp,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  suggestion: {
    icon: Lightbulb,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
};

const energyConfig = {
  low: { color: 'text-red-400', label: 'Low' },
  medium: { color: 'text-yellow-400', label: 'Med' },
  high: { color: 'text-green-400', label: 'High' },
};

export const DailyInsightCard = memo(function DailyInsightCard({
  insight,
  onAction,
  onDismiss,
}: DailyInsightCardProps) {
  const config = insightConfig[insight.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
    >
      <Card className={cn(
        "p-3 border",
        config.borderColor,
        config.bgColor
      )}>
        <div className="flex items-start gap-3">
          <div className={cn("p-1.5 rounded-md flex-shrink-0", config.bgColor)}>
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-medium">{insight.title}</p>
              {onDismiss && insight.priority !== 'high' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-50 hover:opacity-100"
                  onClick={() => onDismiss(insight)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{insight.message}</p>
            {insight.actionLabel && onAction && (
              <Button
                variant="ghost"
                size="sm"
                className={cn("mt-2 h-7 text-xs", config.color)}
                onClick={() => onAction(insight)}
              >
                {insight.actionLabel}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
});

interface DailyCoachPanelProps {
  compact?: boolean;
  maxInsights?: number;
  onInsightAction?: (insight: DailyInsight) => void;
}

export const DailyCoachPanel = memo(function DailyCoachPanel({
  compact = false,
  maxInsights = 3,
  onInsightAction,
}: DailyCoachPanelProps) {
  const { 
    insights, 
    energyForecast, 
    overallReadiness, 
    isLoading,
  } = useDailyPlanOptimization();

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Analyzing your day...</span>
        </div>
      </Card>
    );
  }

  if (insights.length === 0) {
    return null;
  }

  const displayedInsights = insights.slice(0, maxInsights);

  return (
    <div className="space-y-4">
      {/* Readiness & Energy Header */}
      {!compact && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Today's Readiness</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {overallReadiness}%
            </Badge>
          </div>
          <Progress value={overallReadiness} className="h-2 mb-4" />
          
          {/* Energy forecast */}
          {energyForecast && (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className={energyConfig[energyForecast.morning].color}>
                  {energyConfig[energyForecast.morning].label}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sunset className="h-3.5 w-3.5 text-orange-400" />
                <span className={energyConfig[energyForecast.afternoon].color}>
                  {energyConfig[energyForecast.afternoon].label}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Moon className="h-3.5 w-3.5 text-indigo-400" />
                <span className={energyConfig[energyForecast.evening].color}>
                  {energyConfig[energyForecast.evening].label}
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Insights */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-2">
          {displayedInsights.map((insight, index) => (
            <DailyInsightCard
              key={`${insight.type}-${insight.title}-${index}`}
              insight={insight}
              onAction={onInsightAction}
            />
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
});
