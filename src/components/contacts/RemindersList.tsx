import { Bell, Check, Trash2, Clock } from 'lucide-react';
import { format, isPast } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ContactReminder, useContactReminders } from '@/hooks/useContactReminders';
import { cn } from '@/lib/utils';

interface RemindersListProps {
  contactId: string;
}

export function RemindersList({ contactId }: RemindersListProps) {
  const { reminders, isLoading, deleteReminder, markComplete, isDeleting } = useContactReminders(contactId);

  const pendingReminders = reminders.filter((r) => !r.sent);
  const completedReminders = reminders.filter((r) => r.sent);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No follow-up quests scheduled</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pending Reminders */}
      {pendingReminders.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Upcoming Quests
          </h4>
          <div className="space-y-2">
            {pendingReminders.map((reminder) => (
              <ReminderItem
                key={reminder.id}
                reminder={reminder}
                onComplete={() => markComplete(reminder.id)}
                onDelete={() => deleteReminder(reminder.id)}
                isDeleting={isDeleting}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Reminders */}
      {completedReminders.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Check className="h-4 w-4" />
            Completed
          </h4>
          <div className="space-y-2 opacity-60">
            {completedReminders.slice(0, 3).map((reminder) => (
              <ReminderItem
                key={reminder.id}
                reminder={reminder}
                onDelete={() => deleteReminder(reminder.id)}
                isDeleting={isDeleting}
                isCompleted
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ReminderItemProps {
  reminder: ContactReminder;
  onComplete?: () => void;
  onDelete: () => void;
  isDeleting: boolean;
  isCompleted?: boolean;
}

function ReminderItem({ reminder, onComplete, onDelete, isDeleting, isCompleted }: ReminderItemProps) {
  const reminderDate = new Date(reminder.reminder_at);
  const isOverdue = !isCompleted && isPast(reminderDate);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card',
        isOverdue && 'border-destructive/50 bg-destructive/5',
        isCompleted && 'line-through'
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', isOverdue && 'text-destructive')}>
          {format(reminderDate, 'PPP')} at {format(reminderDate, 'p')}
        </p>
        {reminder.reason && (
          <p className="text-xs text-muted-foreground truncate">{reminder.reason}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!isCompleted && onComplete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
            onClick={onComplete}
          >
            <Check className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
