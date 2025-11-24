import { useState } from "react";
import { Clock, Calendar, Repeat, ChevronDown } from "lucide-react";
import { FrequencyPicker } from "./FrequencyPicker";
import { ReminderSettings } from "./ReminderSettings";
import { cn } from "@/lib/utils";

interface AdvancedQuestOptionsProps {
  scheduledTime: string | null;
  estimatedDuration: number | null;
  recurrencePattern: string | null;
  recurrenceDays: number[];
  reminderEnabled: boolean;
  reminderMinutesBefore: number;
  onScheduledTimeChange: (time: string | null) => void;
  onEstimatedDurationChange: (duration: number | null) => void;
  onRecurrencePatternChange: (pattern: string | null) => void;
  onRecurrenceDaysChange: (days: number[]) => void;
  onReminderEnabledChange: (enabled: boolean) => void;
  onReminderMinutesChange: (minutes: number) => void;
}

const DURATION_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

const RECURRENCE_OPTIONS = [
  { value: null, label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "custom", label: "Custom" },
];

export const AdvancedQuestOptions = ({
  scheduledTime,
  estimatedDuration,
  recurrencePattern,
  recurrenceDays,
  reminderEnabled,
  reminderMinutesBefore,
  onScheduledTimeChange,
  onEstimatedDurationChange,
  onRecurrencePatternChange,
  onRecurrenceDaysChange,
  onReminderEnabledChange,
  onReminderMinutesChange,
}: AdvancedQuestOptionsProps) => {
  const [showDurationMenu, setShowDurationMenu] = useState(false);
  const [showRecurrenceMenu, setShowRecurrenceMenu] = useState(false);

  const selectedDuration = DURATION_OPTIONS.find(opt => opt.value === estimatedDuration);
  const selectedRecurrence = RECURRENCE_OPTIONS.find(opt => opt.value === recurrencePattern);

  return (
    <div className="space-y-4 p-4 bg-card/50 rounded-lg border border-border/50">
      <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        Advanced Scheduling
      </h3>

      {/* Time Blocking */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Scheduled Time
        </label>
        <input
          type="time"
          value={scheduledTime || ""}
          onChange={(e) => onScheduledTimeChange(e.target.value || null)}
          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>

      {/* Estimated Duration */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground flex items-center gap-2">
          <Clock className="w-3 h-3" />
          Estimated Duration
        </label>
        <div className="relative">
          <button
            onClick={() => setShowDurationMenu(!showDurationMenu)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground flex items-center justify-between hover:border-primary/50 transition-colors"
          >
            <span>{selectedDuration?.label || "Select duration"}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {showDurationMenu && (
            <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={() => {
                  onEstimatedDurationChange(null);
                  setShowDurationMenu(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors text-muted-foreground"
              >
                No estimate
              </button>
              {DURATION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onEstimatedDurationChange(option.value);
                    setShowDurationMenu(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors",
                    estimatedDuration === option.value && "bg-primary/10 text-primary"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recurrence Pattern */}
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground flex items-center gap-2">
          <Repeat className="w-3 h-3" />
          Recurrence
        </label>
        <div className="relative">
          <button
            onClick={() => setShowRecurrenceMenu(!showRecurrenceMenu)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground flex items-center justify-between hover:border-primary/50 transition-colors"
          >
            <span>{selectedRecurrence?.label || "One-time"}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          
          {showRecurrenceMenu && (
            <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
              {RECURRENCE_OPTIONS.map((option) => (
                <button
                  key={option.value || "none"}
                  onClick={() => {
                    onRecurrencePatternChange(option.value);
                    setShowRecurrenceMenu(false);
                  }}
                  className={cn(
                    "w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors",
                    recurrencePattern === option.value && "bg-primary/10 text-primary"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custom Days Picker */}
      {recurrencePattern === "custom" && (
        <FrequencyPicker 
          selectedDays={recurrenceDays}
          onDaysChange={onRecurrenceDaysChange}
        />
      )}

      {recurrencePattern === "weekly" && (
        <FrequencyPicker 
          selectedDays={recurrenceDays}
          onDaysChange={onRecurrenceDaysChange}
        />
      )}

      {/* Smart Reminders */}
      {scheduledTime && (
        <ReminderSettings
          enabled={reminderEnabled}
          minutesBefore={reminderMinutesBefore}
          onEnabledChange={onReminderEnabledChange}
          onMinutesChange={onReminderMinutesChange}
        />
      )}
    </div>
  );
};
