import { useEffect } from 'react';
import { Sparkles, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSmartScheduling, SuggestedSlot } from '@/hooks/useSmartScheduling';

interface SuggestedTimeSlotsProps {
  date: Date;
  duration?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  onSelectTime: (time: string) => void;
  disabled?: boolean;
}

function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function SuggestedTimeSlots({
  date,
  duration = 30,
  difficulty = 'medium',
  onSelectTime,
  disabled = false,
}: SuggestedTimeSlotsProps) {
  const { suggestedSlots, isLoading, error, getSuggestedSlots } = useSmartScheduling();

  useEffect(() => {
    getSuggestedSlots(date, duration, difficulty);
  }, [date, duration, difficulty, getSuggestedSlots]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border border-border/50">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Finding best times...</span>
      </div>
    );
  }

  if (error || suggestedSlots.length === 0) {
    return null;
  }

  // Show top 3 suggestions
  const topSlots = suggestedSlots.slice(0, 3);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>Suggested Times</span>
      </div>
      
      <div className="flex flex-wrap gap-2">
        {topSlots.map((slot: SuggestedSlot, index: number) => (
          <Button
            key={slot.time}
            variant="outline"
            size="sm"
            onClick={() => onSelectTime(slot.time)}
            disabled={disabled}
            className="flex items-center gap-2 h-auto py-2 px-3 hover:bg-primary/10 hover:border-primary/50 transition-all"
          >
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex flex-col items-start">
              <span className="font-medium">{formatTime(slot.time)}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {slot.reason}
              </span>
            </div>
            {index === 0 && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                Best
              </span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
