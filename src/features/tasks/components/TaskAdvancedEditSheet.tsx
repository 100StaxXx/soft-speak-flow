import { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar as CalendarIcon, Clock, Timer, Zap, Flame, Mountain, AlertTriangle, Repeat, Bell, Check, X, CalendarOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ParsedTask } from '../hooks/useNaturalLanguageParser';
import { format, parseISO } from 'date-fns';
import { QuestAttachmentPicker } from '@/components/QuestAttachmentPicker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { QuestAttachmentInput } from '@/types/questAttachments';

interface TaskAdvancedEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsed: ParsedTask;
  onSave: (updated: ParsedTask) => void;
  onCancel: () => void;
}

const difficultyOptions = [
  { value: 'easy', label: 'Easy', icon: Zap, color: 'text-green-500' },
  { value: 'medium', label: 'Medium', icon: Flame, color: 'text-yellow-500' },
  { value: 'hard', label: 'Hard', icon: Mountain, color: 'text-red-500' },
] as const;

const priorityOptions = [
  { value: 'low', label: 'Low', color: 'text-muted-foreground' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' },
] as const;

const durationOptions = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 180, label: '3 hours' },
];

const reminderOptions = [
  { value: 5, label: '5 min before' },
  { value: 10, label: '10 min before' },
  { value: 15, label: '15 min before' },
  { value: 30, label: '30 min before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 10080, label: '1 week before' },
];

const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

function toAppDayIndex(jsDay: number): number {
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function TaskAdvancedEditSheet({
  open,
  onOpenChange,
  parsed,
  onSave,
  onCancel,
}: TaskAdvancedEditSheetProps) {
  const parsedReferenceDate = parsed.scheduledDate
    ? new Date(`${parsed.scheduledDate}T00:00:00`)
    : new Date();
  const safeReferenceDate = Number.isNaN(parsedReferenceDate.getTime()) ? new Date() : parsedReferenceDate;
  const defaultWeekday = toAppDayIndex(safeReferenceDate.getDay());
  const defaultMonthDay = Math.min(31, Math.max(1, safeReferenceDate.getDate()));

  const [text, setText] = useState(parsed.text);
  const [scheduledDate, setScheduledDate] = useState(parsed.scheduledDate || '');
  const [scheduledTime, setScheduledTime] = useState(parsed.scheduledTime || '');
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(parsed.estimatedDuration || null);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(parsed.difficulty || 'medium');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent' | null>(parsed.priority || null);
  const [notes, setNotes] = useState(parsed.notes || '');
  const [reminderEnabled, setReminderEnabled] = useState(parsed.reminderEnabled || false);
  const [reminderMinutes, setReminderMinutes] = useState(parsed.reminderMinutesBefore || 15);
  const [recurrencePattern, setRecurrencePattern] = useState(parsed.recurrencePattern || '');
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(() => {
    const parsedDays = parsed.recurrenceDays ?? parsed.customDays ?? [];
    if (parsedDays.length > 0) return parsedDays;
    if (parsed.recurrencePattern === 'weekdays') return [0, 1, 2, 3, 4];
    if (parsed.recurrencePattern === 'weekly' || parsed.recurrencePattern === 'biweekly' || parsed.recurrencePattern === 'custom') {
      return [defaultWeekday];
    }
    return [];
  });
  const [recurrenceMonthDays, setRecurrenceMonthDays] = useState<number[]>(() => {
    const parsedMonthDays = parsed.recurrenceMonthDays ?? [];
    if (parsedMonthDays.length > 0) return parsedMonthDays;
    if (parsed.recurrencePattern === 'monthly' || (parsed.recurrencePattern === 'custom' && parsed.recurrenceCustomPeriod === 'month')) {
      return [defaultMonthDay];
    }
    return [];
  });
  const [recurrenceCustomPeriod, setRecurrenceCustomPeriod] = useState<'week' | 'month'>(parsed.recurrenceCustomPeriod ?? 'week');
  const [recurrenceEndType, setRecurrenceEndType] = useState<'never' | 'on_date'>(
    parsed.recurrenceEndDate ? 'on_date' : 'never'
  );
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(
    parsed.recurrenceEndDate ? parseISO(parsed.recurrenceEndDate) : undefined
  );
  const [attachments, setAttachments] = useState<QuestAttachmentInput[]>(
    parsed.attachments?.length
      ? parsed.attachments
      : parsed.imageUrl
        ? [{
          fileUrl: parsed.imageUrl,
          filePath: '',
          fileName: 'image',
          mimeType: 'image/jpeg',
          fileSizeBytes: 0,
          isImage: true,
          sortOrder: 0,
        }]
        : [],
  );
  
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  const getReferenceDate = () => {
    if (scheduledDate) {
      const parsedDate = new Date(`${scheduledDate}T00:00:00`);
      if (!Number.isNaN(parsedDate.getTime())) return parsedDate;
    }
    return new Date();
  };

  const getDefaultRecurrenceWeekday = () => toAppDayIndex(getReferenceDate().getDay());
  const getDefaultRecurrenceMonthDay = () => Math.min(31, Math.max(1, getReferenceDate().getDate()));
  const isCustomWeek = recurrencePattern === 'custom' && recurrenceCustomPeriod === 'week';
  const isCustomMonth = recurrencePattern === 'custom' && recurrenceCustomPeriod === 'month';
  
  // Reset end date when recurrence is cleared
  const handleRecurrenceChange = (pattern: string) => {
    setRecurrencePattern(pattern);
    if (pattern === 'weekdays') {
      setRecurrenceDays([0, 1, 2, 3, 4]);
      setRecurrenceCustomPeriod('week');
    } else if (pattern === 'weekly' || pattern === 'biweekly') {
      setRecurrenceDays((prev) => prev.length > 0 ? [prev[0]] : [getDefaultRecurrenceWeekday()]);
      setRecurrenceCustomPeriod('week');
    } else if (pattern === 'monthly') {
      setRecurrenceMonthDays((prev) => prev.length > 0 ? prev : [getDefaultRecurrenceMonthDay()]);
      setRecurrenceCustomPeriod('month');
    } else if (pattern === 'custom') {
      if (recurrenceCustomPeriod === 'month') {
        setRecurrenceMonthDays((prev) => prev.length > 0 ? prev : [getDefaultRecurrenceMonthDay()]);
      } else {
        setRecurrenceDays((prev) => prev.length > 0 ? prev : [getDefaultRecurrenceWeekday()]);
        setRecurrenceCustomPeriod('week');
      }
    }

    if (!pattern) {
      setRecurrenceEndType('never');
      setRecurrenceEndDate(undefined);
    }
  };

  // Handle end type change
  const handleEndTypeChange = (value: string) => {
    const endType = value as 'never' | 'on_date';
    setRecurrenceEndType(endType);
    if (endType === 'never') {
      setRecurrenceEndDate(undefined);
    }
  };

  const handleCustomPeriodChange = (period: 'week' | 'month') => {
    setRecurrenceCustomPeriod(period);
    if (period === 'week') {
      setRecurrenceDays((prev) => prev.length > 0 ? prev : [getDefaultRecurrenceWeekday()]);
    } else {
      setRecurrenceMonthDays((prev) => prev.length > 0 ? prev : [getDefaultRecurrenceMonthDay()]);
    }
  };

  const toggleRecurrenceDay = (day: number) => {
    const singleSelection = recurrencePattern === 'weekly' || recurrencePattern === 'biweekly';
    if (singleSelection) {
      setRecurrenceDays([day]);
      return;
    }

    setRecurrenceDays((prev) => {
      const isSelected = prev.includes(day);
      if (isSelected && prev.length === 1) return prev;
      const next = isSelected ? prev.filter((value) => value !== day) : [...prev, day];
      return next.sort((a, b) => a - b);
    });
  };

  const toggleRecurrenceMonthDay = (dayOfMonth: number) => {
    setRecurrenceMonthDays((prev) => {
      const isSelected = prev.includes(dayOfMonth);
      if (isSelected && prev.length === 1) return prev;
      const next = isSelected ? prev.filter((value) => value !== dayOfMonth) : [...prev, dayOfMonth];
      return next.sort((a, b) => a - b);
    });
  };

  const handleSave = () => {
    const normalizedRecurrenceDays =
      recurrencePattern === 'weekdays'
        ? [0, 1, 2, 3, 4]
        : recurrencePattern === 'weekly' || recurrencePattern === 'biweekly'
          ? recurrenceDays.slice(0, 1)
          : isCustomWeek
            ? recurrenceDays
            : [];
    const normalizedRecurrenceMonthDays =
      recurrencePattern === 'monthly' || isCustomMonth
        ? recurrenceMonthDays
        : [];

    const updated: ParsedTask = {
      ...parsed,
      text: text.trim() || parsed.text,
      scheduledDate: scheduledDate || null,
      scheduledTime: scheduledTime || null,
      estimatedDuration,
      difficulty,
      priority,
      notes: notes || null,
      reminderEnabled,
      reminderMinutesBefore: reminderEnabled ? reminderMinutes : null,
      recurrencePattern: recurrencePattern || null,
      recurrenceDays: normalizedRecurrenceDays,
      recurrenceMonthDays: normalizedRecurrenceMonthDays,
      recurrenceCustomPeriod: recurrencePattern === 'custom' ? recurrenceCustomPeriod : null,
      recurrenceEndDate: recurrenceEndType === 'on_date' && recurrenceEndDate 
        ? format(recurrenceEndDate, 'yyyy-MM-dd') 
        : null,
      contactId: parsed.contactId,
      autoLogInteraction: parsed.autoLogInteraction ?? true,
      imageUrl: attachments.find((attachment) => attachment.isImage)?.fileUrl ?? null,
      attachments,
    };
    onSave(updated);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-lg">Edit Quest Details</DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Task Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title" className="text-sm font-medium">Quest Title</Label>
            <Input
              id="task-title"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What do you want to accomplish?"
              className="bg-background/50"
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-celestial-blue" />
                Date
              </Label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-500" />
                Time
              </Label>
              <Input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-cyan-500" />
              Duration
            </Label>
            <div className="relative">
              <Button
                variant="outline"
                className="w-full justify-start bg-background/50"
                onClick={() => setShowDurationPicker(!showDurationPicker)}
              >
                {estimatedDuration 
                  ? (estimatedDuration >= 60 
                      ? `${Math.floor(estimatedDuration / 60)}h ${estimatedDuration % 60 ? `${estimatedDuration % 60}m` : ''}`
                      : `${estimatedDuration} min`)
                  : 'No duration set'}
              </Button>
              {showDurationPicker && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-10 p-1">
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md text-muted-foreground"
                    onClick={() => { setEstimatedDuration(null); setShowDurationPicker(false); }}
                  >
                    No duration
                  </button>
                  {durationOptions.map(opt => (
                    <button
                      key={opt.value}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md",
                        estimatedDuration === opt.value && "bg-primary/10 text-primary"
                      )}
                      onClick={() => { setEstimatedDuration(opt.value); setShowDurationPicker(false); }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Difficulty</Label>
            <div className="flex gap-2">
              {difficultyOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <Button
                    key={opt.value}
                    variant={difficulty === opt.value ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "flex-1 gap-1.5",
                      difficulty === opt.value && "bg-primary"
                    )}
                    onClick={() => setDifficulty(opt.value)}
                  >
                    <Icon className={cn("w-3.5 h-3.5", difficulty !== opt.value && opt.color)} />
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
              Priority
            </Label>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={priority === null ? "default" : "outline"}
                size="sm"
                onClick={() => setPriority(null)}
              >
                None
              </Button>
              {priorityOptions.map(opt => (
                <Button
                  key={opt.value}
                  variant={priority === opt.value ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    priority === opt.value && "bg-primary"
                  )}
                  onClick={() => setPriority(opt.value)}
                >
                  <span className={priority !== opt.value ? opt.color : undefined}>{opt.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Reminder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-amber-500" />
                Reminder
              </Label>
              <Switch
                checked={reminderEnabled}
                onCheckedChange={setReminderEnabled}
              />
            </div>
            {reminderEnabled && (
              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => setShowReminderPicker(!showReminderPicker)}
                >
                  {reminderOptions.find(o => o.value === reminderMinutes)?.label || `${reminderMinutes} min before`}
                </Button>
                {showReminderPicker && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-lg shadow-lg z-10 p-1">
                    {reminderOptions.map(opt => (
                      <button
                        key={opt.value}
                        className={cn(
                          "w-full text-left px-3 py-2 text-sm hover:bg-muted rounded-md",
                          reminderMinutes === opt.value && "bg-primary/10 text-primary"
                        )}
                        onClick={() => { setReminderMinutes(opt.value); setShowReminderPicker(false); }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recurrence */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-indigo-500" />
              Recurrence
            </Label>
            <div className="flex gap-2 flex-wrap">
              {['', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'custom'].map(pattern => (
                <Button
                  key={pattern || 'none'}
                  variant={recurrencePattern === pattern ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleRecurrenceChange(pattern)}
                >
                  {pattern === ''
                    ? 'None'
                    : pattern === 'biweekly'
                      ? 'Every 2 Weeks'
                      : pattern === 'custom'
                        ? 'Custom Days'
                        : pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                </Button>
              ))}
            </div>

            {(recurrencePattern === 'weekly' || recurrencePattern === 'biweekly' || isCustomWeek) && (
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAY_SHORT.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleRecurrenceDay(index)}
                    className={cn(
                      "h-8 rounded-md border text-xs font-medium transition-colors",
                      recurrenceDays.includes(index)
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-background border-border hover:bg-muted/60"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {recurrencePattern === 'custom' && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={recurrenceCustomPeriod === 'week' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCustomPeriodChange('week')}
                >
                  Week
                </Button>
                <Button
                  type="button"
                  variant={recurrenceCustomPeriod === 'month' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleCustomPeriodChange('month')}
                >
                  Month
                </Button>
              </div>
            )}

            {(recurrencePattern === 'monthly' || isCustomMonth) && (
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-1.5">
                  {MONTH_DAYS.map((dayOfMonth) => (
                    <button
                      key={dayOfMonth}
                      type="button"
                      onClick={() => toggleRecurrenceMonthDay(dayOfMonth)}
                      className={cn(
                        "h-8 rounded-md border text-xs font-medium transition-colors",
                        recurrenceMonthDays.includes(dayOfMonth)
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background border-border hover:bg-muted/60"
                      )}
                    >
                      {dayOfMonth}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Short months run on the last valid day.</p>
              </div>
            )}
            
            {/* End Date - only shown when recurrence is active */}
            {recurrencePattern && (
              <div className="space-y-2 mt-3 pl-1 border-l-2 border-indigo-500/30">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarOff className="w-3.5 h-3.5 text-muted-foreground" />
                  Ends
                </Label>
                <Select value={recurrenceEndType} onValueChange={handleEndTypeChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Never" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="on_date">On date</SelectItem>
                  </SelectContent>
                </Select>
                
                {recurrenceEndType === 'on_date' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !recurrenceEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {recurrenceEndDate ? format(recurrenceEndDate, "PPP") : <span>Pick end date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={recurrenceEndDate}
                        onSelect={setRecurrenceEndDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add additional details..."
              className="bg-background/50 min-h-[80px] resize-none"
            />
          </div>

          {/* Photo / Files */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              Photo / Files
            </Label>
            <QuestAttachmentPicker
              attachments={attachments}
              onAttachmentsChange={setAttachments}
            />
          </div>
        </div>

        <DrawerFooter className="flex-row gap-2 pt-2">
          <Button variant="outline" onClick={onCancel} className="flex-1 gap-1.5">
            <X className="w-4 h-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1 gap-1.5">
            <Check className="w-4 h-4" />
            Save Changes
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
