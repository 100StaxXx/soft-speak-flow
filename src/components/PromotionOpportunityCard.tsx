import { memo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, TrendingUp, X, ChevronRight, Zap, Flame, Layers } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PromotionOpportunity } from '@/hooks/usePromotionOpportunities';

interface PromotionOpportunityCardProps {
  opportunity: PromotionOpportunity;
  onPromote: (opportunity: PromotionOpportunity) => void;
  onDismiss: (opportunity: PromotionOpportunity) => void;
  compact?: boolean;
}

const typeConfig = {
  quest_to_epic: {
    icon: TrendingUp,
    label: 'Quest → Epic',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  habit_cluster: {
    icon: Layers,
    label: 'Habit Cluster',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  recurring_pattern: {
    icon: Zap,
    label: 'Pattern Detected',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
};

export const PromotionOpportunityCard = memo(function PromotionOpportunityCard({
  opportunity,
  onPromote,
  onDismiss,
  compact = false,
}: PromotionOpportunityCardProps) {
  const config = typeConfig[opportunity.type];
  const Icon = config.icon;

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
      >
        <Card 
          className={cn(
            "p-3 cursor-pointer transition-all hover:scale-[1.02]",
            "border",
            config.borderColor,
            config.bgColor
          )}
          onClick={() => onPromote(opportunity)}
        >
          <div className="flex items-center gap-3">
            <div className={cn("p-1.5 rounded-md", config.bgColor)}>
              <Icon className={cn("h-4 w-4", config.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{opportunity.title}</p>
              <p className="text-xs text-muted-foreground truncate">{opportunity.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </div>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="relative"
    >
      <Card className={cn(
        "p-4 border-2 overflow-hidden",
        config.borderColor,
        "bg-gradient-to-br from-background to-muted/30"
      )}>
        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6 opacity-50 hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(opportunity);
          }}
        >
          <X className="h-3 w-3" />
        </Button>

        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={cn(
            "p-2 rounded-lg flex-shrink-0",
            config.bgColor
          )}>
            <Icon className={cn("h-5 w-5", config.color)} />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className={cn("text-xs", config.color, config.borderColor)}>
                {config.label}
              </Badge>
              {opportunity.confidence >= 0.8 && (
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  High Match
                </Badge>
              )}
            </div>
            <h3 className="font-semibold text-base">{opportunity.title}</h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-3">
          {opportunity.description}
        </p>

        {/* Reasoning */}
        <div className="text-xs text-muted-foreground/80 bg-muted/50 rounded-md p-2 mb-4">
          <Flame className="h-3 w-3 inline mr-1" />
          {opportunity.reasoning}
        </div>

        {/* Suggested habits preview */}
        {opportunity.suggestedHabits && opportunity.suggestedHabits.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground mb-2">Suggested habits:</p>
            <div className="flex flex-wrap gap-1.5">
              {opportunity.suggestedHabits.slice(0, 3).map((habit, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {habit.title}
                </Badge>
              ))}
              {opportunity.suggestedHabits.length > 3 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  +{opportunity.suggestedHabits.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Action */}
        <Button 
          className="w-full" 
          onClick={() => onPromote(opportunity)}
        >
          <TrendingUp className="h-4 w-4 mr-2" />
          Create Epic
          {opportunity.suggestedDuration && (
            <span className="ml-1 text-xs opacity-70">
              ({opportunity.suggestedDuration} days)
            </span>
          )}
        </Button>
      </Card>
    </motion.div>
  );
});
