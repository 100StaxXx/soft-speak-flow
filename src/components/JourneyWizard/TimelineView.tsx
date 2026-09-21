import { useMemo, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { plannerPathfinderTheme } from '@/components/companion/plannerPathfinderTheme';
import { 
  Flag, 
  Calendar, 
  Sparkles, 
  Clock,
  Star,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import { cn, formatDisplayLabel } from '@/lib/utils';
import type { JourneyPhase, JourneyMilestone, JourneyRitual, FeasibilityAssessment, JourneyExecutionModel } from '@/hooks/useJourneySchedule';
import { usePlannerPathfinderAppearance } from '@/hooks/usePlannerPathfinderAppearance';
import { PhaseCard } from './PhaseCard';

interface TimelineViewProps {
  feasibilityAssessment: FeasibilityAssessment;
  phases: JourneyPhase[];
  milestones: JourneyMilestone[];
  rituals: JourneyRitual[];
  weeklyHoursEstimate: number;
  deadline: string;
  onMilestoneToggle?: (milestoneId: string) => void;
  onMilestoneDateChange?: (milestoneId: string, newDate: string) => void;
  postcardCount?: number;
  maxPostcards?: number;
  executionModel?: JourneyExecutionModel;
  companionFrostedThemeStyle?: CSSProperties;
}

export function TimelineView({
  feasibilityAssessment,
  phases,
  milestones,
  rituals,
  weeklyHoursEstimate,
  deadline,
  onMilestoneToggle,
  onMilestoneDateChange,
  postcardCount = 0,
  maxPostcards = 7,
  executionModel = 'sequential',
  companionFrostedThemeStyle,
}: TimelineViewProps) {
  const { themeModeClassName } = usePlannerPathfinderAppearance();
  const sortedPhases = useMemo(() => 
    [...phases].sort((a, b) => a.phaseOrder - b.phaseOrder),
    [phases]
  );

  const milestonesPerPhase = useMemo(() => {
    const map = new Map<number, JourneyMilestone[]>();
    milestones.forEach(m => {
      const existing = map.get(m.phaseOrder) || [];
      map.set(m.phaseOrder, [...existing, m]);
    });
    return map;
  }, [milestones]);

  const feasibilityColors: Record<string, { bg: string; text: string; border: string }> = {
    comfortable: {
      bg: 'bg-[linear-gradient(180deg,hsl(var(--epic-nature)_/_0.22),hsl(var(--category-soul)_/_0.12))]',
      text: 'text-epic-nature',
      border: 'border-epic-nature/60',
    },
    achievable: {
      bg: 'bg-[linear-gradient(180deg,hsl(var(--celestial-blue)_/_0.16),hsl(var(--stardust-gold)_/_0.1))]',
      text: 'text-[hsl(var(--celestial-blue))]',
      border: 'border-[hsl(var(--celestial-blue)_/_0.4)]',
    },
    aggressive: {
      bg: 'bg-[linear-gradient(180deg,hsl(var(--category-body)_/_0.2),hsl(var(--stardust-gold)_/_0.12))]',
      text: 'text-category-body',
      border: 'border-category-body/60',
    },
    very_aggressive: {
      bg: 'bg-[linear-gradient(180deg,hsl(var(--category-body)_/_0.24),hsl(var(--destructive)_/_0.12))]',
      text: 'text-category-body',
      border: 'border-category-body/70',
    },
  };

  const colors = feasibilityColors[feasibilityAssessment.feasibility] || feasibilityColors.achievable;

  return (
    <div className={cn(themeModeClassName, "space-y-4")} style={companionFrostedThemeStyle}>
      {/* Feasibility Assessment Header */}
      <div className={cn(plannerPathfinderTheme.raisedPanel, 'p-4')}>
        <div className="flex items-start gap-3">
          <div className={cn('rounded-xl border p-2', colors.bg, colors.border)}>
            <Calendar className={cn('w-5 h-5', colors.text)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">
                {feasibilityAssessment.daysAvailable} days available
              </span>
              <Badge variant="outline" className={cn(plannerPathfinderTheme.chip, 'text-xs', colors.text, colors.border)}>
                {formatDisplayLabel(feasibilityAssessment.feasibility)}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {feasibilityAssessment.message}
            </p>
          </div>
        </div>
      </div>

      {/* Time Commitment */}
      <div className={`${plannerPathfinderTheme.mutedPanel} flex flex-wrap items-center gap-4 px-4 py-3 text-sm text-muted-foreground`}>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-celestial-blue" />
          <span>~{weeklyHoursEstimate} hrs/week</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-stardust-gold" />
          <span>{milestones.length} milestones</span>
        </div>
      </div>

      {executionModel === 'overlap_early' && (
        <div className={`${plannerPathfinderTheme.mutedPanel} px-3 py-3 text-sm text-muted-foreground`}>
          This plan starts the real work early and keeps momentum going throughout.
        </div>
      )}

      {/* Timeline Phases */}
      <div className="space-y-4">
        {sortedPhases.map((phase, index) => (
          <motion.div
            key={phase.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <PhaseCard
              phase={phase}
              milestones={milestonesPerPhase.get(phase.phaseOrder) || []}
              isFirst={index === 0}
              isLast={index === sortedPhases.length - 1}
              onMilestoneToggle={onMilestoneToggle}
              onMilestoneDateChange={onMilestoneDateChange}
              postcardCount={postcardCount}
              maxPostcards={maxPostcards}
              companionFrostedThemeStyle={companionFrostedThemeStyle}
            />
          </motion.div>
        ))}

        {/* Deadline marker */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: sortedPhases.length * 0.1 }}
          className={`${plannerPathfinderTheme.successCard} p-4`}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-epic-nature/38 bg-epic-nature/15 p-2">
              <Flag className="w-5 h-5 text-epic-nature" />
            </div>
            <div>
              <p className="font-semibold">Goal Complete!</p>
              <p className="text-sm text-epic-nature/85">
                {format(parseISO(deadline), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-epic-nature ml-auto animate-pulse" />
          </div>
        </motion.div>
      </div>

      {/* Rituals Summary */}
      <div className={`${plannerPathfinderTheme.mutedPanel} p-4`}>
        <p className="mb-2 text-xs font-medium text-muted-foreground">
          Daily & weekly rhythms ({rituals.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {rituals.slice(0, 4).map(ritual => (
            <Badge 
              key={ritual.id} 
              variant="outline" 
              className={cn(plannerPathfinderTheme.chip, 'text-xs')}
            >
              {ritual.title}
            </Badge>
          ))}
          {rituals.length > 4 && (
            <Badge variant="outline" className={cn(plannerPathfinderTheme.chip, 'text-xs')}>
              +{rituals.length - 4} more
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
