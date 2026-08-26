import { useState, type CSSProperties } from 'react';
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
import { usePlannerPathfinderAppearance } from '@/hooks/usePlannerPathfinderAppearance';
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
  companionFrostedThemeStyle?: CSSProperties;
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
  companionFrostedThemeStyle,
}: PhaseCardProps) {
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<string>>(new Set());
  const { themeModeClassName } = usePlannerPathfinderAppearance();
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
    'border-[hsl(var(--celestial-blue)_/_0.28)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.96),hsl(var(--celestial-blue)_/_0.12))]',
    'border-[hsl(var(--celestial-blue)_/_0.28)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.96),hsl(var(--secondary)_/_0.72))]',
    'border-epic-nature/[0.28] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.96),hsl(var(--epic-nature)_/_0.1))]',
    'border-[hsl(var(--celestial-blue)_/_0.24)] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.96),hsl(var(--stardust-gold)_/_0.1))]',
    'border-category-body/[0.32] bg-[linear-gradient(180deg,hsl(var(--card)_/_0.96),hsl(var(--category-body)_/_0.08))]',
  ];

  const colorClass = phaseColors[(phase.phaseOrder - 1) % phaseColors.length];

  return (
    <div className="relative">
      {/* Timeline connector */}
      {!isFirst && (
        <div className="absolute left-6 -top-4 h-4 w-1 rounded-full bg-[hsl(var(--celestial-blue)_/_0.24)]" />
      )}
      
      <div className={cn(
        'rounded-[1.7rem] border p-4 shadow-[0_14px_32px_-28px_rgba(var(--primary-rgb),0.44),inset_0_1px_0_rgba(255,255,255,0.58)]',
        colorClass
      )}>
        {/* Phase Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(var(--celestial-blue)_/_0.34)] bg-card/70 text-sm font-bold text-[hsl(var(--celestial-blue))]">
              {phase.phaseOrder}
            </div>
            <div>
              <h4 className="font-semibold">{phase.name}</h4>
              <p className="text-xs text-muted-foreground">
                {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')} ({durationDays} days)
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn(plannerPathfinderTheme.chip, "text-xs")}>
            {durationDays}d
          </Badge>
        </div>

        {/* Phase Description */}
        <p className="mb-3 text-sm text-muted-foreground">
          {phase.description}
        </p>

        {/* Milestones in this phase */}
        {milestones.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1 text-xs font-medium text-celestial-blue">
              <Flag className="w-3 h-3" />
              Milestones
            </p>
            {milestones.map(milestone => (
              <div
                key={milestone.id}
                className={cn(
                  'w-full rounded-[1.2rem] border p-3 text-left transition-all',
                  'border-[hsl(var(--celestial-blue)_/_0.22)] bg-card/70 hover:bg-card',
                  milestone.isPostcardMilestone && 'ring-2 ring-stardust-gold/35'
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
                        ? "text-stardust-gold hover:text-stardust-gold/90"
                        : postcardCount >= maxPostcards
                          ? "cursor-not-allowed text-muted-foreground/35"
                          : "text-muted-foreground/70 hover:text-stardust-gold"
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
                        className="h-7 rounded-full border border-[hsl(var(--celestial-blue)_/_0.26)] bg-card/70 px-2 text-xs text-foreground hover:border-[hsl(var(--celestial-blue)_/_0.44)] hover:bg-card hover:text-foreground"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        {format(parseISO(milestone.targetDate), 'MMM d')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className={cn(themeModeClassName, plannerPathfinderTheme.portalSurface, "w-auto p-0")}
                      align="end"
                      style={companionFrostedThemeStyle}
                    >
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
        <div className="absolute left-6 -bottom-4 h-4 w-1 rounded-full bg-[hsl(var(--celestial-blue)_/_0.24)]" />
      )}
    </div>
  );
}
