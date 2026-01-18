import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Clock, Calendar, ChevronDown, Repeat, Bell, Info, Sparkles, Loader2, Star } from "lucide-react";
import { FrequencyPicker } from "./FrequencyPicker";
import { useSmartScheduling } from "@/hooks/useSmartScheduling";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface AdvancedQuestOptionsProps {
  scheduledTime: string | null;
  onScheduledTimeChange: (time: string | null) => void;
  estimatedDuration: number | null;
  onEstimatedDurationChange: (duration: number | null) => void;
  recurrencePattern: string | null;
  onRecurrencePatternChange: (pattern: string | null) => void;
  recurrenceDays: number[];
  onRecurrenceDaysChange: (days: number[]) => void;
  reminderEnabled: boolean;
  onReminderEnabledChange: (enabled: boolean) => void;
  reminderMinutesBefore: number;
  onReminderMinutesBeforeChange: (minutes: number) => void;
  moreInformation: string | null;
  onMoreInformationChange: (info: string | null) => void;
  // New props for smart scheduling
  selectedDate?: Date;
  taskDifficulty?: 'easy' | 'medium' | 'hard';
}

// Helper to format 24h time to 12h
function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export const AdvancedQuestOptions = (props: AdvancedQuestOptionsProps) => {
  const { suggestedSlots, getSuggestedSlots, isLoading: isSuggestLoading } = useSmartScheduling();
  const [showSuggestions, setShowSuggestions] = useState(false);

  const durationOptions = [
    { value: 15, label: "15 min" },
    { value: 30, label: "30 min" },
    { value: 45, label: "45 min" },
    { value: 60, label: "1 hr" },
    { value: 90, label: "1.5 hrs" },
    { value: 120, label: "2 hrs" },
  ];

  const reminderOptions = [
    { value: 5, label: "5 minutes before" },
    { value: 10, label: "10 minutes before" },
    { value: 15, label: "15 minutes before" },
    { value: 30, label: "30 minutes before" },
    { value: 60, label: "1 hour before" },
    { value: 120, label: "2 hours before" },
    { value: 1440, label: "1 day before" },
    { value: 10080, label: "1 week before" },
  ];

  const recurrenceOptions = [
    { value: 'none', label: 'None' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'custom', label: 'Custom Days' },
  ];

  const [showDurationOptions, setShowDurationOptions] = useState(false);
  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [showReminderOptions, setShowReminderOptions] = useState(false);

  const handleSuggestClick = async () => {
    if (!props.selectedDate) return;
    
    await getSuggestedSlots(
      props.selectedDate,
      props.estimatedDuration || 30,
      props.taskDifficulty
    );
    
    setShowSuggestions(true);
  };

  const suggestions = suggestedSlots.slice(0, 3);

  const handleSelectSuggestion = (time: string) => {
    props.onScheduledTimeChange(time);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-4 border-t pt-4">
      {/* Scheduled Time with Suggest Button */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Scheduled Time</Label>
        </div>
        <div className="flex gap-2">
          <Input
            type="time"
            value={props.scheduledTime || ''}
            onChange={(e) => props.onScheduledTimeChange(e.target.value || null)}
            className="flex-1"
          />
          {props.selectedDate && (
            <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSuggestClick}
                  disabled={isSuggestLoading}
                  className="shrink-0"
                >
                  {isSuggestLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 text-primary" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="end">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                    Suggested Times
                  </p>
                  {suggestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground px-2 py-2">
                      No suggestions available
                    </p>
                  ) : (
                    suggestions.map((slot, index) => (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => handleSelectSuggestion(slot.time)}
                        className="w-full flex items-start gap-2 px-2 py-2 text-left rounded-md hover:bg-accent transition-colors"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            {index === 0 && (
                              <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                            )}
                            <span className="font-medium text-sm">
                              {formatTime(slot.time)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {slot.reason}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Estimated Duration */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Estimated Duration</Label>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDurationOptions(!showDurationOptions)}
            className="w-full px-3 py-2 text-sm text-left border rounded-lg bg-background hover:bg-accent transition-colors flex items-center justify-between"
          >
            <span>
              {props.estimatedDuration 
                ? durationOptions.find(opt => opt.value === props.estimatedDuration)?.label || `${props.estimatedDuration} min`
                : "Select duration"}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          
          {showDurationOptions && (
            <div className="absolute z-10 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {durationOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    props.onEstimatedDurationChange(option.value);
                    setShowDurationOptions(false);
                  }}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
                    props.estimatedDuration === option.value ? 'bg-accent' : ''
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reminder Section - Only show if scheduled time is set */}
      {props.scheduledTime && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Early Reminder</Label>
            </div>
            <Switch
              checked={props.reminderEnabled}
              onCheckedChange={props.onReminderEnabledChange}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            You'll be notified when the quest starts. Add an early reminder to prepare ahead.
          </p>
        
          {props.reminderEnabled && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowReminderOptions(!showReminderOptions)}
                className="w-full px-3 py-2 text-sm text-left border rounded-lg bg-background hover:bg-accent transition-colors flex items-center justify-between"
              >
                <span>
                  {reminderOptions.find(opt => opt.value === props.reminderMinutesBefore)?.label || "Select time"}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>
              
              {showReminderOptions && (
                <div className="absolute z-10 w-full mt-1 bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {reminderOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        props.onReminderMinutesBeforeChange(option.value);
                        setShowReminderOptions(false);
                      }}
                      className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
                        props.reminderMinutesBefore === option.value ? 'bg-accent' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Recurrence Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Repeat className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Recurrence</Label>
        </div>
        
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowRecurrenceOptions(!showRecurrenceOptions)}
            className="w-full px-3 py-2 text-sm text-left border rounded-lg bg-background hover:bg-accent transition-colors flex items-center justify-between"
          >
            <span>
              {recurrenceOptions.find(opt => opt.value === (props.recurrencePattern || 'none'))?.label || "None"}
            </span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          
          {showRecurrenceOptions && (
            <div className="absolute z-10 w-full mt-1 bg-popover border rounded-lg shadow-lg">
              {recurrenceOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    props.onRecurrencePatternChange(option.value === 'none' ? null : option.value);
                    setShowRecurrenceOptions(false);
                  }}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors ${
                    (props.recurrencePattern || 'none') === option.value ? 'bg-accent' : ''
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {(props.recurrencePattern === 'custom' || props.recurrencePattern === 'weekly') && (
          <FrequencyPicker
            selectedDays={props.recurrenceDays}
            onDaysChange={props.onRecurrenceDaysChange}
          />
        )}
      </div>

      {/* More Information */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">More Information</Label>
        </div>
        <Textarea
          value={props.moreInformation || ''}
          onChange={(e) => props.onMoreInformationChange(e.target.value || null)}
          placeholder="Add extra context, notes, or details (optional)"
          className="min-h-[100px] resize-none bg-muted/30 border-border/50"
          style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}
          data-vaul-no-drag
        />
      </div>
    </div>
  );
};
