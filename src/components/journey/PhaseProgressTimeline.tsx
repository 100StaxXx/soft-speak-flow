import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  Flag, 
  CheckCircle2, 
  Sparkles,
  MapPin,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MilestonesByPhase } from '@/hooks/useMilestones';

interface PhaseProgressTimelineProps {
  milestonesByPhase: MilestonesByPhase[];
  currentPhaseName: string | null;
  deadline?: string;
  variant?: 'horizontal' | 'vertical';
  className?: string;
}

export function PhaseProgressTimeline({
  milestonesByPhase,
  currentPhaseName,
  deadline,
  variant = 'horizontal',
  className,
}: PhaseProgressTimelineProps) {
  const phaseData = useMemo(() => {
    return milestonesByPhase.map((phase, index) => {
      const completed = phase.milestones.filter(m => m.completed_at).length;
      const total = phase.milestones.length;
      const progress = total > 0 ? (completed / total) * 100 : 0;
      const isComplete = progress === 100;
      const isCurrent = phase.phaseName === currentPhaseName;
      
      // Get postcards in this phase
      const postcards = phase.milestones.filter(m => m.is_postcard_milestone);
      
      // Get date range
      const dates = phase.milestones
        .filter(m => m.target_date)
        .map(m => new Date(m.target_date!));
      const startDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
      const endDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : null;
      
      return {
        ...phase,
        completed,
        total,
        progress,
        isComplete,
        isCurrent,
        isPast: !isCurrent && progress === 100,
        isFuture: !isCurrent && progress === 0,
        postcardCount: postcards.length,
        startDate,
        endDate,
        phaseNumber: index + 1,
      };
    });
  }, [milestonesByPhase, currentPhaseName]);

  const totalPhases = phaseData.length;
  const currentPhaseIndex = phaseData.findIndex(p => p.isCurrent);

  if (variant === 'vertical') {
    return (
      <div className={cn('space-y-4', className)}>
        {phaseData.map((phase, index) => (
          <motion.div
            key={phase.phaseName}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative flex gap-4"
          >
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2',
                phase.isComplete 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : phase.isCurrent 
                    ? 'bg-primary/20 text-primary border-primary animate-pulse' 
                    : 'bg-muted text-muted-foreground border-muted'
              )}>
                {phase.isComplete ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  phase.phaseNumber
                )}
              </div>
              {index < totalPhases - 1 && (
                <div className={cn(
                  'w-0.5 flex-1 min-h-[40px]',
                  phase.isComplete ? 'bg-primary' : 'bg-muted'
                )} />
              )}
            </div>

            {/* Phase content */}
            <div className={cn(
              'flex-1 pb-4 rounded-lg p-3 -mt-1',
              phase.isCurrent && 'bg-primary/5 border border-primary/20'
            )}>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'font-semibold text-sm',
                  phase.isCurrent && 'text-primary'
                )}>
                  {phase.phaseName}
                </span>
                {phase.isCurrent && (
                  <Badge variant="default" className="text-[10px] h-4">
                    <MapPin className="w-2.5 h-2.5 mr-0.5" />
                    You are here
                  </Badge>
                )}
                {phase.postcardCount > 0 && (
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                )}
              </div>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{phase.completed}/{phase.total} milestones</span>
                {phase.startDate && phase.endDate && (
                  <>
                    <span>•</span>
                    <span>
                      {format(phase.startDate, 'MMM d')} - {format(phase.endDate, 'MMM d')}
                    </span>
                  </>
                )}
              </div>
              
              {/* Progress bar */}
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-primary rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${phase.progress}%` }}
                  transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
                />
              </div>
            </div>
          </motion.div>
        ))}

        {/* Deadline marker */}
        {deadline && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: totalPhases * 0.1 }}
            className="flex gap-4"
          >
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Flag className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <span className="font-semibold text-sm">Goal Complete!</span>
              <div className="text-xs text-muted-foreground">
                {format(new Date(deadline), 'EEEE, MMMM d, yyyy')}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // Horizontal variant
  return (
    <div className={cn('py-4', className)}>
      {/* Phase progress bar */}
      <div className="relative flex items-center mb-4">
        {/* Background line */}
        <div className="absolute inset-x-0 h-1 bg-muted rounded-full" />
        
        {/* Progress line */}
        <motion.div
          className="absolute left-0 h-1 bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ 
            width: `${((currentPhaseIndex + 1) / totalPhases) * 100}%` 
          }}
          transition={{ duration: 0.8 }}
        />
        
        {/* Phase dots */}
        <div className="relative flex justify-between w-full">
          {phaseData.map((phase, index) => (
            <motion.div
              key={phase.phaseName}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: index * 0.1, type: 'spring' }}
              className="flex flex-col items-center"
            >
              <div className={cn(
                'w-4 h-4 rounded-full border-2 transition-all',
                phase.isComplete 
                  ? 'bg-primary border-primary' 
                  : phase.isCurrent 
                    ? 'bg-background border-primary ring-4 ring-primary/20' 
                    : 'bg-muted border-muted-foreground/30'
              )}>
                {phase.isComplete && (
                  <CheckCircle2 className="w-full h-full text-primary-foreground p-0.5" />
                )}
              </div>
              
              <span className={cn(
                'text-[10px] mt-1 text-center max-w-[50px] truncate',
                phase.isCurrent ? 'text-primary font-medium' : 'text-muted-foreground'
              )}>
                {phase.phaseName}
              </span>
            </motion.div>
          ))}
          
          {/* Deadline flag */}
          {deadline && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: totalPhases * 0.1, type: 'spring' }}
              className="flex flex-col items-center"
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                <Flag className="w-2.5 h-2.5 text-white" />
              </div>
              <span className="text-[10px] mt-1 text-muted-foreground">Goal</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Current phase indicator */}
      {phaseData[currentPhaseIndex] && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 text-sm"
        >
          <MapPin className="w-4 h-4 text-primary" />
          <span className="text-muted-foreground">Currently in</span>
          <span className="font-medium text-primary">
            {phaseData[currentPhaseIndex].phaseName}
          </span>
          <Badge variant="secondary" className="text-xs">
            {phaseData[currentPhaseIndex].completed}/{phaseData[currentPhaseIndex].total}
          </Badge>
        </motion.div>
      )}
    </div>
  );
}
