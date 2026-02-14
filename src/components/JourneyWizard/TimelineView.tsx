import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import { 
  Flag, 
  Calendar, 
  Sparkles, 
  Clock,
  Star,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils';
import type { JourneyPhase, JourneyMilestone, JourneyRitual, FeasibilityAssessment } from '@/hooks/useJourneySchedule';
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
    comfortable: { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/30' },
    achievable: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30' },
    aggressive: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/30' },
    very_aggressive: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/30' },
  };

  const colors = feasibilityColors[feasibilityAssessment.feasibility] || feasibilityColors.achievable;

  return (
    <div className="space-y-4">
      {/* Feasibility Assessment Header */}
      <div className={cn('p-4 rounded-xl border', colors.bg, colors.border)}>
        <div className="flex items-start gap-3">
          <div className={cn('p-2 rounded-lg', colors.bg)}>
            <Calendar className={cn('w-5 h-5', colors.text)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm">
                {feasibilityAssessment.daysAvailable} days available
              </span>
              <Badge variant="outline" className={cn('text-xs', colors.text, colors.border)}>
                {feasibilityAssessment.feasibility.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {feasibilityAssessment.message}
            </p>
          </div>
        </div>
      </div>

      {/* Time Commitment */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          <span>~{weeklyHoursEstimate} hrs/week</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Star className="w-4 h-4 text-amber-500" />
          <span>{postcardCount}/{maxPostcards} celebration milestones</span>
        </div>
      </div>

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
          className="p-4 bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl border border-primary/30"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-primary/20">
              <Flag className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Goal Complete!</p>
              <p className="text-sm text-muted-foreground">
                {format(parseISO(deadline), 'EEEE, MMMM d, yyyy')}
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-primary ml-auto animate-pulse" />
          </div>
        </motion.div>
      </div>

      {/* Rituals Summary */}
      <div className="p-4 rounded-lg bg-muted/30 border">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Daily & Weekly Rituals ({rituals.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {rituals.slice(0, 4).map(ritual => (
            <Badge 
              key={ritual.id} 
              variant="secondary" 
              className="text-xs"
            >
              {ritual.title}
            </Badge>
          ))}
          {rituals.length > 4 && (
            <Badge variant="outline" className="text-xs">
              +{rituals.length - 4} more
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
