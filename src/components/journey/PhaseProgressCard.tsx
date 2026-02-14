import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { format, differenceInDays } from 'date-fns';
import { 
  Target, 
  Calendar, 
  CheckCircle2, 
  Clock,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { MilestonesByPhase } from '@/hooks/useMilestones';

interface PhaseProgressCardProps {
  milestonesByPhase: MilestonesByPhase[];
  currentPhaseName: string | null;
  className?: string;
  compact?: boolean;
}

export function PhaseProgressCard({
  milestonesByPhase,
  currentPhaseName,
  className,
  compact = false,
}: PhaseProgressCardProps) {
  const phaseStats = useMemo(() => {
    return milestonesByPhase.map((phase, index) => {
      const completed = phase.milestones.filter(m => m.completed_at).length;
      const total = phase.milestones.length;
      const progress = total > 0 ? (completed / total) * 100 : 0;
      
      // Get date range for phase
      const dates = phase.milestones
        .filter(m => m.target_date)
        .map(m => new Date(m.target_date!))
        .sort((a, b) => a.getTime() - b.getTime());
      
      const startDate = dates[0];
      const endDate = dates[dates.length - 1];
      
      // Calculate if phase is on track
      const today = new Date();
      const overdueMilestones = phase.milestones.filter(m => {
        if (m.completed_at || !m.target_date) return false;
        return new Date(m.target_date) < today;
      });
      
      const isOnTrack = overdueMilestones.length === 0;
      const isCurrent = phase.phaseName === currentPhaseName;
      const isComplete = progress === 100;
      
      // Days until phase ends
      const daysUntilEnd = endDate ? differenceInDays(endDate, today) : null;
      
      return {
        ...phase,
        completed,
        total,
        progress,
        startDate,
        endDate,
        isOnTrack,
        isCurrent,
        isComplete,
        daysUntilEnd,
        overdueMilestones: overdueMilestones.length,
        phaseNumber: index + 1,
      };
    });
  }, [milestonesByPhase, currentPhaseName]);

  const currentPhase = phaseStats.find(p => p.isCurrent);
  const totalPhases = phaseStats.length;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3 p-3 bg-muted/30 rounded-lg', className)}>
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">
            Phase {currentPhase?.phaseNumber || 1} of {totalPhases}
          </span>
        </div>
        {currentPhase && (
          <>
            <div className="h-4 w-px bg-border" />
            <Badge 
              variant={currentPhase.isOnTrack ? 'secondary' : 'destructive'}
              className="text-xs"
            >
              {currentPhase.isOnTrack ? (
                <>
                  <TrendingUp className="w-3 h-3 mr-1" />
                  On Track
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {currentPhase.overdueMilestones} Overdue
                </>
              )}
            </Badge>
            <div className="ml-auto text-xs text-muted-foreground">
              {currentPhase.completed}/{currentPhase.total} done
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-3', className)}
    >
      {/* Current Phase Highlight */}
      {currentPhase && (
        <div className={cn(
          'p-4 rounded-xl border-2 bg-gradient-to-br',
          currentPhase.isOnTrack 
            ? 'from-primary/5 to-primary/10 border-primary/30' 
            : 'from-destructive/5 to-destructive/10 border-destructive/30'
        )}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">
                  Phase {currentPhase.phaseNumber} of {totalPhases}
                </Badge>
                <Badge 
                  variant={currentPhase.isOnTrack ? 'default' : 'destructive'}
                  className="text-xs"
                >
                  {currentPhase.isOnTrack ? 'On Track' : 'Behind'}
                </Badge>
              </div>
              <h3 className="font-semibold text-base">{currentPhase.phaseName}</h3>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">{Math.round(currentPhase.progress)}%</div>
              <div className="text-xs text-muted-foreground">Complete</div>
            </div>
          </div>

          <Progress value={currentPhase.progress} className="h-2 mb-3" />

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-background/50 rounded-lg p-2">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                <CheckCircle2 className="w-3 h-3" />
                Done
              </div>
              <div className="font-semibold text-sm">{currentPhase.completed}/{currentPhase.total}</div>
            </div>
            
            <div className="bg-background/50 rounded-lg p-2">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                <Clock className="w-3 h-3" />
                Left
              </div>
              <div className="font-semibold text-sm">
                {currentPhase.daysUntilEnd !== null && currentPhase.daysUntilEnd >= 0 
                  ? `${currentPhase.daysUntilEnd}d` 
                  : 'Past'}
              </div>
            </div>
            
            <div className="bg-background/50 rounded-lg p-2">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                <Calendar className="w-3 h-3" />
                Ends
              </div>
              <div className="font-semibold text-sm">
                {currentPhase.endDate ? format(currentPhase.endDate, 'MMM d') : '-'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Phase Overview Strip */}
      <div className="flex gap-1">
        {phaseStats.map((phase) => (
          <motion.div
            key={phase.phaseName}
            className={cn(
              'flex-1 h-2 rounded-full transition-all',
              phase.isComplete 
                ? 'bg-primary' 
                : phase.isCurrent 
                  ? 'bg-primary/50' 
                  : 'bg-muted'
            )}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.3, delay: phase.phaseNumber * 0.1 }}
          >
            {phase.isCurrent && (
              <div 
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${phase.progress}%` }}
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Phase Labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        {phaseStats.map((phase) => (
          <span 
            key={phase.phaseName}
            className={cn(
              'truncate max-w-[60px]',
              phase.isCurrent && 'text-primary font-medium'
            )}
          >
            {phase.phaseName}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
