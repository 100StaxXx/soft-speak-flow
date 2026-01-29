import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  X, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  Rocket,
  Clock,
  Target,
  Shield,
  ChevronRight,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRescheduleIntelligence, RescheduleInsight } from '@/hooks/useRescheduleIntelligence';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays } from 'date-fns';

interface SmartRescheduleAdvisorProps {
  epicId: string;
  onSelectAdjustment: (adjustmentText: string) => void;
  onDismiss?: () => void;
  variant?: 'banner' | 'card' | 'inline';
  className?: string;
}

const iconMap = {
  rocket: Rocket,
  clock: Clock,
  target: Target,
  sparkles: Sparkles,
  shield: Shield,
};

export function SmartRescheduleAdvisor({
  epicId,
  onSelectAdjustment,
  onDismiss,
  variant = 'card',
  className,
}: SmartRescheduleAdvisorProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { user } = useAuth();
  
  // Fetch epic details for date range
  const { data: epicData } = useQuery({
    queryKey: ['epic-details', epicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('epics')
        .select('start_date, end_date, epic_habits(habit_id)')
        .eq('id', epicId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return data;
    },
    enabled: !!epicId,
  });
  
  // Fetch habit completions for this epic's habits
  const { data: habitCompletions } = useQuery({
    queryKey: ['epic-habit-completions', epicId, user?.id],
    queryFn: async () => {
      if (!user?.id || !epicData?.epic_habits?.length) return [];
      
      const habitIds = epicData.epic_habits.map((eh: any) => eh.habit_id);
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('habit_completions')
        .select('habit_id, date, habits(title)')
        .eq('user_id', user.id)
        .in('habit_id', habitIds)
        .gte('date', thirtyDaysAgo);
        
      if (error) throw error;
      
      return (data || []).map((hc: any) => ({
        habit_id: hc.habit_id,
        completed_at: hc.date,
        habit: hc.habits,
      }));
    },
    enabled: !!user?.id && !!epicData?.epic_habits?.length,
  });
  
  // Get last check-in date
  const { data: lastCheckIn } = useQuery({
    queryKey: ['last-epic-activity', epicId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('epic_progress_log')
        .select('date')
        .eq('epic_id', epicId)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
        
      if (error && error.code !== 'PGRST116') throw error;
      return data?.date ? new Date(data.date) : undefined;
    },
    enabled: !!user?.id && !!epicId,
  });
  
  const intelligence = useRescheduleIntelligence(
    epicId,
    habitCompletions,
    lastCheckIn,
    epicData?.start_date,
    epicData?.end_date
  );
  
  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };
  
  if (dismissed || (!intelligence.shouldShowAdvisor && variant !== 'inline')) {
    return null;
  }
  
  const primaryInsight = intelligence.insights[0];
  const primaryAction = intelligence.smartQuickActions.find(a => a.priority === 'primary');
  
  if (variant === 'banner') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            "bg-gradient-to-r from-primary/10 via-primary/5 to-transparent",
            "border border-primary/20 rounded-lg p-3",
            className
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {primaryInsight?.title || 'Journey Check-in'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {primaryInsight?.description || 'Get suggestions to optimize your plan'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {primaryAction && (
                <Button
                  size="sm"
                  variant="default"
                  className="text-xs h-7 gap-1"
                  onClick={() => onSelectAdjustment(primaryAction.adjustmentText)}
                >
                  {primaryAction.label}
                  <ChevronRight className="w-3 h-3" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={handleDismiss}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }
  
  if (variant === 'inline') {
    return (
      <div className={cn("space-y-3", className)}>
        {/* Smart Quick Actions */}
        <div className="grid grid-cols-2 gap-2">
          {intelligence.smartQuickActions.map((action, index) => {
            const Icon = iconMap[action.icon];
            return (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onSelectAdjustment(action.adjustmentText)}
                className={cn(
                  "p-3 rounded-lg text-left transition-all",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  action.priority === 'primary'
                    ? "bg-primary/10 border border-primary/30 hover:bg-primary/20"
                    : "bg-secondary/50 border border-border/50 hover:bg-secondary"
                )}
              >
                <div className="flex items-start gap-2">
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0",
                    action.priority === 'primary' 
                      ? "bg-primary/20" 
                      : "bg-muted"
                  )}>
                    <Icon className={cn(
                      "w-3.5 h-3.5",
                      action.priority === 'primary' 
                        ? "text-primary" 
                        : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{action.label}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {action.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
        
        {/* Insights Section */}
        {intelligence.insights.length > 0 && (
          <div className="space-y-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Lightbulb className="w-3 h-3" />
              <span>{intelligence.insights.length} insight{intelligence.insights.length > 1 ? 's' : ''} available</span>
              <ChevronRight className={cn(
                "w-3 h-3 transition-transform",
                expanded && "rotate-90"
              )} />
            </button>
            
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  {intelligence.insights.map((insight, index) => (
                    <InsightCard
                      key={index}
                      insight={insight}
                      onAction={onSelectAdjustment}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        
        {/* Velocity Stats */}
        {intelligence.estimatedCompletionDate && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
            {intelligence.daysAheadOrBehind >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
            )}
            <span>
              Est. completion: {format(intelligence.estimatedCompletionDate, 'MMM d, yyyy')}
              {intelligence.daysAheadOrBehind !== 0 && (
                <span className={cn(
                  "ml-1",
                  intelligence.daysAheadOrBehind >= 0 ? "text-green-500" : "text-amber-500"
                )}>
                  ({intelligence.daysAheadOrBehind > 0 ? '+' : ''}{intelligence.daysAheadOrBehind} days)
                </span>
              )}
            </span>
          </div>
        )}
      </div>
    );
  }
  
  // Default card variant
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-card border border-border rounded-xl overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-primary/10 to-transparent border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Smart Reschedule</h3>
              <p className="text-[10px] text-muted-foreground">Personalized suggestions</p>
            </div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={handleDismiss}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Primary Insight */}
        {primaryInsight && (
          <InsightCard
            insight={primaryInsight}
            onAction={onSelectAdjustment}
            featured
          />
        )}
        
        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-2">
          {intelligence.smartQuickActions.slice(0, 2).map((action, index) => {
            const Icon = iconMap[action.icon];
            return (
              <Button
                key={index}
                variant={action.priority === 'primary' ? 'default' : 'outline'}
                size="sm"
                className="h-auto py-2 px-3 justify-start gap-2"
                onClick={() => onSelectAdjustment(action.adjustmentText)}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="text-xs truncate">{action.label}</span>
              </Button>
            );
          })}
        </div>
        
        {/* Velocity indicator */}
        {intelligence.estimatedCompletionDate && (
          <div className="flex items-center justify-between text-xs bg-secondary/30 rounded-lg px-3 py-2">
            <span className="text-muted-foreground">Projected finish</span>
            <span className="font-medium flex items-center gap-1">
              {format(intelligence.estimatedCompletionDate, 'MMM d')}
              {intelligence.daysAheadOrBehind >= 0 ? (
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-green-500 border-green-500/30">
                  +{intelligence.daysAheadOrBehind}d
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1 py-0 text-amber-500 border-amber-500/30">
                  {intelligence.daysAheadOrBehind}d
                </Badge>
              )}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function InsightCard({ 
  insight, 
  onAction,
  featured = false,
}: { 
  insight: RescheduleInsight; 
  onAction: (text: string) => void;
  featured?: boolean;
}) {
  const getIcon = () => {
    switch (insight.type) {
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
      case 'celebration':
        return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
      default:
        return <Lightbulb className="w-3.5 h-3.5 text-blue-500" />;
    }
  };
  
  const getBgColor = () => {
    switch (insight.type) {
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'celebration':
        return 'bg-green-500/10 border-green-500/20';
      default:
        return 'bg-blue-500/10 border-blue-500/20';
    }
  };
  
  return (
    <div className={cn(
      "rounded-lg border p-3",
      getBgColor(),
      featured && "ring-1 ring-primary/20"
    )}>
      <div className="flex items-start gap-2">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{insight.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {insight.description}
          </p>
          {insight.action && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] mt-2 gap-1"
              onClick={() => onAction(insight.action!.adjustmentText)}
            >
              {insight.action.label}
              <ChevronRight className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
