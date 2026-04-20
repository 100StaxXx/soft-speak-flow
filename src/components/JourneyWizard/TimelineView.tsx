import { useMemo } from 'react';
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
}: TimelineViewProps) {
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
    comfortable: { bg: 'bg-[#dff5a7]', text: 'text-[#315114]', border: 'border-[#315114]' },
    achievable: { bg: 'bg-[#fff0bb]', text: 'text-[#8d481c]', border: 'border-[#8d481c]' },
    aggressive: { bg: 'bg-[#ffdba3]', text: 'text-[#9a4718]', border: 'border-[#9a4718]' },
    very_aggressive: { bg: 'bg-[#ffcab2]', text: 'text-[#8a2716]', border: 'border-[#8a2716]' },
  };

  const colors = feasibilityColors[feasibilityAssessment.feasibility] || feasibilityColors.achievable;

  return (
    <div className="space-y-4">
      {/* Feasibility Assessment Header */}
      <div className={cn(plannerPathfinderTheme.raisedPanel, 'p-4')}>
        <div className="flex items-start gap-3">
          <div className={cn('rounded-xl border-[3px] p-2', colors.bg, colors.border)}>
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
            <p className="text-sm text-[#7f4a1d]/80">
              {feasibilityAssessment.message}
            </p>
          </div>
        </div>
      </div>

      {/* Time Commitment */}
      <div className={`${plannerPathfinderTheme.mutedPanel} flex flex-wrap items-center gap-4 px-4 py-3 text-sm text-[#7f4a1d]/80`}>
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-[#8d481c]" />
          <span>~{weeklyHoursEstimate} hrs/week</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-[#d38b22]" />
          <span>{postcardCount}/{maxPostcards} celebration milestones</span>
        </div>
      </div>

      {executionModel === 'overlap_early' && (
        <div className={`${plannerPathfinderTheme.mutedPanel} px-3 py-3 text-sm text-[#7f4a1d]/80`}>
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
            <div className="rounded-full border-[3px] border-[#315114] bg-white/35 p-2">
              <Flag className="w-5 h-5 text-[#315114]" />
            </div>
            <div>
              <p className="font-semibold">Goal Complete!</p>
              <p className="text-sm text-[#315114]/80">
                {format(parseISO(deadline), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-[#315114] ml-auto animate-pulse" />
          </div>
        </motion.div>
      </div>

      {/* Rituals Summary */}
      <div className={`${plannerPathfinderTheme.mutedPanel} p-4`}>
        <p className="mb-2 text-xs font-medium text-[#7f4a1d]/80">
          Daily & Weekly Rituals ({rituals.length})
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
