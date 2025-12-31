import { useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { 
  ChevronRight, 
  Flag, 
  Star,
  Calendar,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { JourneyPhase, JourneyMilestone } from '@/hooks/useJourneySchedule';

interface PhaseCardProps {
  phase: JourneyPhase;
  milestones: JourneyMilestone[];
  isFirst?: boolean;
  isLast?: boolean;
  onMilestoneToggle?: (milestoneId: string) => void;
  onMilestoneDateChange?: (milestoneId: string, newDate: string) => void;
  postcardCount?: number;
  maxPostcards?: number;
}

export function PhaseCard({ 
  phase, 
  milestones, 
  isFirst, 
  isLast,
  onMilestoneToggle,
  onMilestoneDateChange,
  postcardCount = 0,
  maxPostcards = 7,
}: PhaseCardProps) {
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const startDate = parseISO(phase.startDate);

  const toggleExpanded = (milestoneId: string) => {
    setExpandedMilestones(prev => {
      const next = new Set(prev);
      if (next.has(milestoneId)) {
        next.delete(milestoneId);
      } else {
        next.add(milestoneId);
      }
      return next;
    });
  };
  const endDate = parseISO(phase.endDate);
  const durationDays = differenceInDays(endDate, startDate) + 1;

  const phaseColors = [
    'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    'from-purple-500/20 to-pink-500/20 border-purple-500/30',
    'from-amber-500/20 to-orange-500/20 border-amber-500/30',
    'from-green-500/20 to-emerald-500/20 border-green-500/30',
    'from-rose-500/20 to-red-500/20 border-rose-500/30',
  ];

  const colorClass = phaseColors[(phase.phaseOrder - 1) % phaseColors.length];

  return (
    <div className="relative">
      {/* Timeline connector */}
      {!isFirst && (
        <div className="absolute left-6 -top-4 w-0.5 h-4 bg-border" />
      )}
      
      <div className={cn(
        'p-4 rounded-xl border bg-gradient-to-br',
        colorClass
      )}>
        {/* Phase Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-background/50 flex items-center justify-center font-bold text-sm">
              {phase.phaseOrder}
            </div>
            <div>
              <h4 className="font-semibold">{phase.name}</h4>
              <p className="text-xs text-muted-foreground">
                {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')} ({durationDays} days)
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {durationDays}d
          </Badge>
        </div>

        {/* Phase Description */}
        <p className="text-sm text-muted-foreground mb-3">
          {phase.description}
        </p>

        {/* Milestones in this phase */}
        {milestones.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Flag className="w-3 h-3" />
              Milestones
            </p>
            {milestones.map(milestone => (
              <div
                key={milestone.id}
                className={cn(
                  'w-full p-2.5 rounded-lg text-left transition-all',
                  'bg-background/50 hover:bg-background/80',
                  'border border-transparent hover:border-primary/30',
                  milestone.isPostcardMilestone && 'ring-1 ring-amber-500/50'
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Postcard Toggle Star */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMilestoneToggle?.(milestone.id);
                    }}
                    disabled={!milestone.isPostcardMilestone && postcardCount >= maxPostcards}
                    className={cn(
                      "flex-shrink-0 transition-all",
                      milestone.isPostcardMilestone 
                        ? "text-amber-500 hover:text-amber-600" 
                        : postcardCount >= maxPostcards
                          ? "text-muted-foreground/30 cursor-not-allowed"
                          : "text-muted-foreground hover:text-amber-500"
                    )}
                    title={
                      milestone.isPostcardMilestone 
                        ? "Remove celebration milestone" 
                        : postcardCount >= maxPostcards 
                          ? `Max ${maxPostcards} postcards reached` 
                          : "Mark as celebration milestone"
                    }
                  >
                    <Star 
                      className="w-4 h-4" 
                      fill={milestone.isPostcardMilestone ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    onClick={() => toggleExpanded(milestone.id)}
                    className="flex-1 min-w-0 text-left flex items-center gap-1"
                  >
                    <ChevronRight className={cn(
                      "w-3 h-3 flex-shrink-0 transition-transform",
                      expandedMilestones.has(milestone.id) && "rotate-90"
                    )} />
                    <p className={cn(
                      "text-sm font-medium",
                      expandedMilestones.has(milestone.id) 
                        ? "whitespace-normal break-words" 
                        : "truncate"
                    )}>
                      {milestone.title}
                    </p>
                  </button>
                  <Popover 
                    open={openPopoverId === milestone.id} 
                    onOpenChange={(open) => setOpenPopoverId(open ? milestone.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        {format(parseISO(milestone.targetDate), 'MMM d')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
                        mode="single"
                        selected={parseISO(milestone.targetDate)}
                        onSelect={(date) => {
                          if (date) {
                            onMilestoneDateChange?.(milestone.id, format(date, 'yyyy-MM-dd'));
                            setOpenPopoverId(null);
                          }
                        }}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  {milestone.isPostcardMilestone && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
                      Postcard
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-6 -bottom-4 w-0.5 h-4 bg-border" />
      )}
    </div>
  );
}
