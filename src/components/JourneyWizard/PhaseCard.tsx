import { useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { plannerPathfinderTheme } from '@/components/companion/plannerPathfinderTheme';
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
    'border-[#6b3416] bg-[linear-gradient(180deg,rgba(255,247,220,0.92),rgba(255,216,131,0.92))]',
    'border-[#7e4019] bg-[linear-gradient(180deg,rgba(255,238,204,0.92),rgba(255,194,120,0.9))]',
    'border-[#93431d] bg-[linear-gradient(180deg,rgba(255,234,198,0.92),rgba(255,180,111,0.9))]',
    'border-[#724012] bg-[linear-gradient(180deg,rgba(241,255,213,0.92),rgba(190,229,106,0.92))]',
    'border-[#8a2c19] bg-[linear-gradient(180deg,rgba(255,225,205,0.94),rgba(255,171,128,0.9))]',
  ];

  const colorClass = phaseColors[(phase.phaseOrder - 1) % phaseColors.length];

  return (
    <div className="relative">
      {/* Timeline connector */}
      {!isFirst && (
        <div className="absolute left-6 -top-4 h-4 w-1 rounded-full bg-[#8d481c]/35" />
      )}
      
      <div className={cn(
        'rounded-[1.7rem] border-[3px] p-4 shadow-[0_8px_0_rgba(77,40,17,0.18)]',
        colorClass
      )}>
        {/* Phase Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-[#6b3416] bg-white/65 text-sm font-bold text-[#6b3416]">
              {phase.phaseOrder}
            </div>
            <div>
              <h4 className="font-semibold">{phase.name}</h4>
              <p className="text-xs text-[#7f4a1d]/80">
                {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')} ({durationDays} days)
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn(plannerPathfinderTheme.chip, "text-xs")}>
            {durationDays}d
          </Badge>
        </div>

        {/* Phase Description */}
        <p className="mb-3 text-sm text-[#7f4a1d]/80">
          {phase.description}
        </p>

        {/* Milestones in this phase */}
        {milestones.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1 text-xs font-medium text-[#8d481c]">
              <Flag className="w-3 h-3" />
              Milestones
            </p>
            {milestones.map(milestone => (
              <div
                key={milestone.id}
                className={cn(
                  'w-full rounded-[1.2rem] border-[3px] p-3 text-left transition-all',
                  'border-[#6b3416] bg-white/65 hover:bg-white/78',
                  milestone.isPostcardMilestone && 'ring-2 ring-[#d38b22]/35'
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
                        ? "text-[#d38b22] hover:text-[#be7816]" 
                        : postcardCount >= maxPostcards
                          ? "cursor-not-allowed text-[#8d481c]/25"
                          : "text-[#8d481c]/60 hover:text-[#d38b22]"
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
                        className="h-7 rounded-full border-[3px] border-[#6b3416] bg-white/70 px-2 text-xs text-[#7f4a1d] hover:bg-white/85 hover:text-[#5d2a0f]"
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
                    <Badge variant="outline" className={cn(plannerPathfinderTheme.chip, "h-5 flex-shrink-0 px-2 py-0 text-[10px]")}>
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
        <div className="absolute left-6 -bottom-4 h-4 w-1 rounded-full bg-[#8d481c]/35" />
      )}
    </div>
  );
}
