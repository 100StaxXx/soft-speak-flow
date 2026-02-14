import { useState } from 'react';
import { CalendarIcon, Bell, Clock } from 'lucide-react';
import { format, addDays, setHours, setMinutes } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useContactReminders } from '@/hooks/useContactReminders';
import { Contact } from '@/hooks/useContacts';

interface ReminderDialogProps {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUICK_PRESETS = [
  { label: 'Tomorrow', getDays: () => 1 },
  { label: 'In 3 days', getDays: () => 3 },
  { label: 'Next week', getDays: () => 7 },
  { label: 'In 2 weeks', getDays: () => 14 },
];

export function ReminderDialog({ contact, open, onOpenChange }: ReminderDialogProps) {
  const tomorrow = addDays(new Date(), 1);
  const defaultTime = setMinutes(setHours(tomorrow, 9), 0);
  
  const [date, setDate] = useState<Date>(defaultTime);
  const [time, setTime] = useState('09:00');
  const [reason, setReason] = useState('');
  
  const { createReminder, isCreating } = useContactReminders(contact.id);

  const handlePresetClick = (days: number) => {
    const newDate = addDays(new Date(), days);
    const [hours, minutes] = time.split(':').map(Number);
    setDate(setMinutes(setHours(newDate, hours), minutes));
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    const [hours, minutes] = newTime.split(':').map(Number);
    setDate(setMinutes(setHours(date, hours), minutes));
  };

  const handleDateSelect = (newDate: Date | undefined) => {
    if (newDate) {
      const [hours, minutes] = time.split(':').map(Number);
      setDate(setMinutes(setHours(newDate, hours), minutes));
    }
  };

  const handleSubmit = () => {
    createReminder({
      contactId: contact.id,
      reminderAt: date,
      reason: reason.trim() || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setReason('');
        setDate(defaultTime);
        setTime('09:00');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Schedule Follow-Up Quest
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Set a reminder to connect with <span className="font-medium text-foreground">{contact.name}</span>
          </p>

          {/* Quick Presets */}
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => handlePresetClick(preset.getDays())}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(date, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                  disabled={(d) => d < new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time Picker */}
          <div className="space-y-2">
            <Label>Time</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">Times are in your local timezone</p>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason (optional)</Label>
            <Input
              placeholder="e.g., Follow up on proposal"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={isCreating}
            >
              {isCreating ? 'Scheduling...' : 'Set Reminder'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
