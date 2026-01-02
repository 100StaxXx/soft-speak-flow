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
import { Button } from '@/components/ui/button';
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
      <div className={cn(
        "rounded-xl backdrop-blur-xl border-l-4 border-t border-r border-b bg-card/80 p-4",
        config.borderColor.replace('border-', 'border-l-'),
        "border-t-border/30 border-r-border/30 border-b-border/30"
      )}>
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-lg flex-shrink-0",
            config.bgColor
          )}>
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-bold text-foreground">{insight.title}</p>
              {onDismiss && insight.priority !== 'high' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-50 hover:opacity-100"
                  onClick={() => onDismiss(insight)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{insight.message}</p>
            {insight.actionLabel && onAction && (
              <button
                className={cn("mt-2 text-xs font-bold uppercase tracking-wide flex items-center gap-1", config.color)}
                onClick={() => onAction(insight)}
              >
                {insight.actionLabel}
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>
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
      <div className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-pulse" />
          <span className="text-sm">Analyzing your day...</span>
        </div>
      </div>
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
        <div className="rounded-2xl bg-card/80 backdrop-blur-xl border border-border/50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/30 bg-gradient-to-r from-primary/10 to-accent/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-bold text-sm">Today's Readiness</span>
              </div>
              <div className="px-2.5 py-1 rounded-full bg-primary/20 border border-primary/30">
                <span className="text-xs font-bold text-primary">{overallReadiness}%</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-4 py-4">
            <div className="h-3 w-full bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary via-accent to-nebula-pink rounded-full transition-all duration-500"
                style={{ width: `${overallReadiness}%` }}
              />
            </div>
          
            {/* Energy forecast */}
            {energyForecast && (
              <div className="flex items-center justify-between mt-4 px-2">
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Sun className="h-4 w-4 text-amber-400" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Morning</span>
                  <span className={cn("text-xs font-bold", energyConfig[energyForecast.morning].color)}>
                    {energyConfig[energyForecast.morning].label}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <Sunset className="h-4 w-4 text-orange-400" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Afternoon</span>
                  <span className={cn("text-xs font-bold", energyConfig[energyForecast.afternoon].color)}>
                    {energyConfig[energyForecast.afternoon].label}
                  </span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                    <Moon className="h-4 w-4 text-indigo-400" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">Evening</span>
                  <span className={cn("text-xs font-bold", energyConfig[energyForecast.evening].color)}>
                    {energyConfig[energyForecast.evening].label}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Insights */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-3">
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
