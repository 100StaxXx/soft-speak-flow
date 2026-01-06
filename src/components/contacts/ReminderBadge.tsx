import { Bell, AlertCircle } from 'lucide-react';
import { formatDistanceToNow, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ReminderBadgeProps {
  reminderAt: string;
  reason?: string | null;
  className?: string;
}

export function ReminderBadge({ reminderAt, reason, className }: ReminderBadgeProps) {
  const reminderDate = new Date(reminderAt);
  const isOverdue = isPast(reminderDate);
  const isDueToday = isToday(reminderDate);
  
  const relativeTime = formatDistanceToNow(reminderDate, { addSuffix: true });
  
  const tooltipText = reason 
    ? `${isOverdue ? 'Overdue' : 'Reminder'}: ${reason} (${relativeTime})`
    : `Reminder ${relativeTime}`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              isOverdue && 'bg-destructive/10 text-destructive',
              isDueToday && !isOverdue && 'bg-amber-500/10 text-amber-600',
              !isOverdue && !isDueToday && 'bg-primary/10 text-primary',
              className
            )}
          >
            {isOverdue ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              <Bell className="h-3 w-3" />
            )}
            <span className="truncate max-w-[80px]">
              {isOverdue ? 'Overdue' : isDueToday ? 'Today' : relativeTime.replace('in ', '')}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
