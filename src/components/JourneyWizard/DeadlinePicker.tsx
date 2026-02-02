import { useState } from 'react';
import { format, addDays, addWeeks, addMonths, addYears, differenceInDays } from 'date-fns';
import { Calendar as CalendarIcon, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DeadlinePickerProps {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  minDate?: Date;
}

const quickOptions = [
  { label: '2 weeks', getValue: () => addWeeks(new Date(), 2) },
  { label: '1 month', getValue: () => addMonths(new Date(), 1) },
  { label: '3 months', getValue: () => addMonths(new Date(), 3) },
  { label: '6 months', getValue: () => addMonths(new Date(), 6) },
  { label: '1 year', getValue: () => addYears(new Date(), 1) },
];

export function DeadlinePicker({ value, onChange, minDate }: DeadlinePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const effectiveMinDate = minDate || addDays(new Date(), 7);
  
  const daysUntilDeadline = value 
    ? differenceInDays(value, new Date())
    : null;

  return (
    <div className="space-y-3">
      {/* Quick Options */}
      <div className="flex flex-wrap gap-2">
        {quickOptions.map(option => {
          const optionDate = option.getValue();
          const isSelected = value && 
            format(value, 'yyyy-MM-dd') === format(optionDate, 'yyyy-MM-dd');
          
          return (
            <Button
              key={option.label}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange(optionDate)}
              className="flex-1 min-w-[80px]"
            >
              {option.label}
            </Button>
          );
        })}
      </div>

      {/* Calendar Picker */}
      <Popover open={isOpen} onOpenChange={setIsOpen} modal>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal h-12',
              !value && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? (
              <span className="flex items-center gap-2">
                {format(value, 'EEEE, MMMM d, yyyy')}
                {daysUntilDeadline && (
                  <span className="text-xs text-muted-foreground">
                    ({daysUntilDeadline} days)
                  </span>
                )}
              </span>
            ) : (
              <span>Pick a specific date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-auto p-0 z-[100] pointer-events-auto" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange(date);
              setIsOpen(false);
            }}
            disabled={(date) => date < effectiveMinDate}
            initialFocus
            className="pointer-events-auto"
            captionLayout="dropdown"
            fromYear={new Date().getFullYear()}
            toYear={new Date().getFullYear() + 10}
          />
        </PopoverContent>
      </Popover>

      {/* Time estimate display */}
      {value && daysUntilDeadline && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>
            {daysUntilDeadline} days until deadline
            {daysUntilDeadline <= 14 && (
              <span className="ml-2 text-amber-500 font-medium">
                <Zap className="w-3 h-3 inline mr-1" />
                Intensive
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
