import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { format, parseISO, addDays } from "date-fns";

interface ChallengeProgressProps {
  userChallengeId: string;
  startDate: string;
  currentDay: number;
  totalDays: number;
}

export function ChallengeProgress({ userChallengeId, startDate, currentDay, totalDays }: ChallengeProgressProps) {
  const { data: progressData = [] } = useQuery({
    queryKey: ['challengeProgress', userChallengeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenge_progress')
        .select('*')
        .eq('user_challenge_id', userChallengeId)
        .order('date', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });

  // Generate array of all days in the challenge
  const allDays = Array.from({ length: totalDays }, (_, i) => {
    const dayNumber = i + 1;
    const dayDate = format(addDays(parseISO(startDate), i), 'yyyy-MM-dd');
    const progress = progressData.find(p => p.date === dayDate);
    const isPast = dayNumber < currentDay;
    const isCurrent = dayNumber === currentDay;
    const isFuture = dayNumber > currentDay;
    
    return {
      day: dayNumber,
      date: dayDate,
      completed: progress?.completed || false,
      notes: progress?.notes,
      isPast,
      isCurrent,
      isFuture
    };
  });

  const completedDays = allDays.filter(d => d.completed).length;
  const completionRate = Math.round((completedDays / currentDay) * 100);

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-bold">Progress Tracker</h3>
        <div className="text-sm text-muted-foreground">
          {completedDays}/{currentDay} days completed ({completionRate}%)
        </div>
      </div>

      {/* Progress Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {allDays.map((day) => (
          <div
            key={day.day}
            className={`
              aspect-square flex flex-col items-center justify-center rounded-lg border-2 
              transition-all relative group
              ${day.completed 
                ? 'bg-green-500/20 border-green-500 text-green-700 dark:text-green-300' 
                : day.isCurrent
                ? 'bg-primary/20 border-primary text-primary animate-pulse'
                : day.isPast
                ? 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                : 'bg-muted border-border text-muted-foreground'
              }
            `}
          >
            {day.completed ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : day.isCurrent ? (
              <Circle className="w-5 h-5 fill-current" />
            ) : day.isPast ? (
              <XCircle className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
            <span className="text-xs font-bold mt-1">{day.day}</span>
            
            {/* Tooltip on hover */}
            {day.notes && (
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 bg-popover text-popover-foreground p-2 rounded shadow-lg text-xs max-w-xs">
                {day.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-2 border-t">
        <div className="flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1">
          <Circle className="w-4 h-4 text-primary fill-current" />
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1">
          <XCircle className="w-4 h-4 text-red-500" />
          <span>Missed</span>
        </div>
        <div className="flex items-center gap-1">
          <Circle className="w-4 h-4 text-muted-foreground" />
          <span>Upcoming</span>
        </div>
      </div>
    </Card>
  );
}
