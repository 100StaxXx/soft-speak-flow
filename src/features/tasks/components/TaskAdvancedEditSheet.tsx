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
import { Calendar, Clock, Timer, Zap, Flame, Mountain, Battery, BatteryLow, BatteryFull, AlertTriangle, Repeat, Bell, Check, X, Users, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ParsedTask } from '../hooks/useNaturalLanguageParser';
import { format } from 'date-fns';
import { ContactPicker } from '@/components/tasks/ContactPicker';
import { QuestImagePicker } from '@/components/QuestImagePicker';
import { QuestImageThumbnail } from '@/components/QuestImageThumbnail';
import { useQuestImagePicker } from '@/hooks/useQuestImagePicker';

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

const energyOptions = [
  { value: 'low', label: 'Low', icon: BatteryLow, color: 'text-blue-400' },
  { value: 'medium', label: 'Medium', icon: Battery, color: 'text-blue-500' },
  { value: 'high', label: 'High', icon: BatteryFull, color: 'text-blue-600' },
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

export function TaskAdvancedEditSheet({
  open,
  onOpenChange,
  parsed,
  onSave,
  onCancel,
}: TaskAdvancedEditSheetProps) {
  const [text, setText] = useState(parsed.text);
  const [scheduledDate, setScheduledDate] = useState(parsed.scheduledDate || '');
  const [scheduledTime, setScheduledTime] = useState(parsed.scheduledTime || '');
  const [estimatedDuration, setEstimatedDuration] = useState<number | null>(parsed.estimatedDuration || null);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(parsed.difficulty || 'medium');
  const [energyLevel, setEnergyLevel] = useState<'low' | 'medium' | 'high'>(parsed.energyLevel || 'medium');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent' | null>(parsed.priority || null);
  const [notes, setNotes] = useState(parsed.notes || '');
  const [reminderEnabled, setReminderEnabled] = useState(parsed.reminderEnabled || false);
  const [reminderMinutes, setReminderMinutes] = useState(parsed.reminderMinutesBefore || 15);
  const [recurrencePattern, setRecurrencePattern] = useState(parsed.recurrencePattern || '');
  const [contactId, setContactId] = useState<string | null>(parsed.contactId || null);
  const [autoLogInteraction, setAutoLogInteraction] = useState(parsed.autoLogInteraction ?? true);
  const [imageUrl, setImageUrl] = useState<string | null>(parsed.imageUrl || null);
  
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  
  const { deleteImage } = useQuestImagePicker();

  const handleRemoveImage = async () => {
    if (imageUrl) {
      await deleteImage(imageUrl);
      setImageUrl(null);
    }
  };

  const handleSave = () => {
    const updated: ParsedTask = {
      ...parsed,
      text: text.trim() || parsed.text,
      scheduledDate: scheduledDate || null,
      scheduledTime: scheduledTime || null,
      estimatedDuration,
      difficulty,
      energyLevel,
      priority,
      notes: notes || null,
      reminderEnabled,
      reminderMinutesBefore: reminderEnabled ? reminderMinutes : null,
      recurrencePattern: recurrencePattern || null,
      contactId,
      autoLogInteraction,
      imageUrl,
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
                <Calendar className="w-3.5 h-3.5 text-celestial-blue" />
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

          {/* Energy Level */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Energy Required</Label>
            <div className="flex gap-2">
              {energyOptions.map(opt => {
                const Icon = opt.icon;
                return (
                  <Button
                    key={opt.value}
                    variant={energyLevel === opt.value ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "flex-1 gap-1.5",
                      energyLevel === opt.value && "bg-primary"
                    )}
                    onClick={() => setEnergyLevel(opt.value)}
                  >
                    <Icon className={cn("w-3.5 h-3.5", energyLevel !== opt.value && opt.color)} />
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
              {['', 'daily', 'weekly', 'weekdays'].map(pattern => (
                <Button
                  key={pattern || 'none'}
                  variant={recurrencePattern === pattern ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRecurrencePattern(pattern)}
                >
                  {pattern === '' ? 'None' : pattern.charAt(0).toUpperCase() + pattern.slice(1)}
                </Button>
              ))}
            </div>
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

          {/* Photo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-pink-500" />
              Photo
            </Label>
            <div className="flex items-center gap-2">
              {imageUrl && (
                <QuestImageThumbnail
                  imageUrl={imageUrl}
                  onRemove={handleRemoveImage}
                  size="md"
                />
              )}
              <QuestImagePicker
                onImageSelected={setImageUrl}
                variant="button"
                disabled={!!imageUrl}
              />
            </div>
          </div>

          {/* Contact Link */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-emerald-500" />
              Link to Contact
            </Label>
            <ContactPicker
              value={contactId}
              onChange={setContactId}
              placeholder="Select a contact..."
            />
            {contactId && (
              <div className="flex items-center justify-between mt-2">
                <Label className="text-sm text-muted-foreground">
                  Log as interaction when completed
                </Label>
                <Switch
                  checked={autoLogInteraction}
                  onCheckedChange={setAutoLogInteraction}
                />
              </div>
            )}
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
