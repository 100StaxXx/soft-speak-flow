import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Clock, Calendar as CalendarIcon, ChevronDown, Repeat, Bell, Info, Sparkles, Loader2, Star, MapPin } from "lucide-react";
import { FrequencyPicker } from "./FrequencyPicker";
import { QuestLocationAutocompleteInput } from "@/components/QuestLocationAutocompleteInput";
import { useSmartScheduling } from "@/hooks/useSmartScheduling";
import { hasScheduledTimeValue } from "@/utils/recurrenceValidation";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DIFFICULTY_COLORS, QUEST_FORM_STYLES, getQuestOptionPillClasses } from "@/components/quest-shared";
import { DurationPickerField, TimePickerField } from "@/components/scheduling";
import {
  MAX_QUEST_REMINDER_MINUTES,
  MAX_QUEST_REMINDER_OFFSETS,
  QUEST_REMINDER_PRESET_OPTIONS,
  formatQuestReminderOffset,
  getPrimaryQuestReminderOffset,
  normalizeQuestReminderOffsets,
  parseQuestReminderDateTime,
  resolveCustomQuestReminderOffset,
  resolveQuestReminderOffsets,
} from "@/utils/questReminders";

interface AdvancedQuestOptionsProps {
  scheduledTime: string | null;
  onScheduledTimeChange: (time: string | null) => void;
  estimatedDuration: number | null;
  onEstimatedDurationChange: (duration: number | null) => void;
  recurrencePattern: string | null;
  onRecurrencePatternChange: (pattern: string | null) => void;
  recurrenceDays: number[];
  onRecurrenceDaysChange: (days: number[]) => void;
  recurrenceMonthDays: number[];
  onRecurrenceMonthDaysChange: (days: number[]) => void;
  recurrenceCustomPeriod: "week" | "month" | null;
  onRecurrenceCustomPeriodChange: (period: "week" | "month" | null) => void;
  reminderEnabled: boolean;
  onReminderEnabledChange: (enabled: boolean) => void;
  reminderMinutesBefore: number;
  onReminderMinutesBeforeChange: (minutes: number) => void;
  reminderOffsetsMinutes?: number[];
  onReminderOffsetsMinutesChange?: (minutes: number[]) => void;
  moreInformation: string | null;
  onMoreInformationChange: (info: string | null) => void;
  location: string | null;
  onLocationChange: (location: string | null) => void;
  // New props for smart scheduling
  selectedDate?: Date;
  reminderDate?: Date | null;
  taskDifficulty?: 'easy' | 'medium' | 'hard';
  // Hide recurrence for rituals (they use FrequencyPresets instead)
  hideRecurrence?: boolean;
  // Hide fields that are already shown on the parent form
  hideScheduledTime?: boolean;
  hideDuration?: boolean;
  hideMoreInformation?: boolean;
  hideReminder?: boolean;
  hideLocation?: boolean;
  requireScheduledTimeForRecurrence?: boolean;
  visualStyle?: "default" | "quest-soft";
  portalClassName?: string;
}

// Helper to format 24h time to 12h
function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function toAppDayIndex(date: Date): number {
  const jsDay = date.getDay(); // 0 = Sun, 1 = Mon, ... 6 = Sat
  return jsDay === 0 ? 6 : jsDay - 1; // 0 = Mon, ... 6 = Sun
}

export const AdvancedQuestOptions = (props: AdvancedQuestOptionsProps) => {
  const { suggestedSlots, getSuggestedSlots, isLoading: isSuggestLoading } = useSmartScheduling();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customReminderInput, setCustomReminderInput] = useState("");
  const [customReminderDate, setCustomReminderDate] = useState<Date | undefined>();
  const [customReminderTime, setCustomReminderTime] = useState("");
  const [customReminderError, setCustomReminderError] = useState<string | null>(null);
  const [isEditingCustomReminder, setIsEditingCustomReminder] = useState(false);

  const durationOptions = [
    { value: 15, label: "15m" },
    { value: 30, label: "30m" },
    { value: 45, label: "45m" },
    { value: 60, label: "1h" },
    { value: 90, label: "1.5h" },
    { value: 120, label: "2h" },
  ];

  const reminderOptions = [
    { value: "none", label: "None" },
    ...QUEST_REMINDER_PRESET_OPTIONS,
  ];

  const monthDays = useMemo(() => Array.from({ length: 31 }, (_, index) => index + 1), []);
  const recurrenceOptions = [
    { value: 'none', label: 'None' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekdays', label: 'Weekdays' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'biweekly', label: 'Every 2 Weeks' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'custom', label: 'Custom Days' },
  ];

  const [showRecurrenceOptions, setShowRecurrenceOptions] = useState(false);
  const [showReminderOptions, setShowReminderOptions] = useState(false);
  const recurrenceSelectionDisabled = Boolean(
    props.requireScheduledTimeForRecurrence && !hasScheduledTimeValue(props.scheduledTime),
  );

  const reminderPresetValues = useMemo(
    () => reminderOptions
      .map((option) => option.value)
      .filter((value): value is number => typeof value === "number"),
    [],
  );
  const reminderOffsets = useMemo(
    () => resolveQuestReminderOffsets({
      reminderEnabled: props.reminderEnabled,
      reminderMinutesBefore: props.reminderMinutesBefore,
      reminderOffsetsMinutes: props.reminderOffsetsMinutes,
    }),
    [props.reminderEnabled, props.reminderMinutesBefore, props.reminderOffsetsMinutes],
  );
  const selectedReminderOffsets = useMemo(() => new Set(reminderOffsets), [reminderOffsets]);
  const customReminderOffsets = useMemo(
    () => reminderOffsets.filter((offset) => !reminderPresetValues.includes(offset)),
    [reminderOffsets, reminderPresetValues],
  );
  const reminderTriggerLabel = useMemo(() => {
    if (reminderOffsets.length === 0) return "None";
    if (reminderOffsets.length === 1) return formatQuestReminderOffset(reminderOffsets[0]);
    return `${reminderOffsets.length} reminders: ${reminderOffsets.map(formatQuestReminderOffset).join(", ")}`;
  }, [reminderOffsets]);
  const customReminderQuestDate = props.reminderDate === undefined ? props.selectedDate : props.reminderDate;
  const customReminderQuestStart = useMemo(
    () => parseQuestReminderDateTime(customReminderQuestDate, props.scheduledTime),
    [customReminderQuestDate, props.scheduledTime],
  );
  const usesCustomReminderDateTime = Boolean(customReminderQuestStart);
  const customReminderOffsetCandidate = useMemo(
    () => usesCustomReminderDateTime
      ? resolveCustomQuestReminderOffset({
        questDate: customReminderQuestDate,
        questTime: props.scheduledTime,
        reminderDate: customReminderDate,
        reminderTime: customReminderTime,
      })
      : null,
    [
      usesCustomReminderDateTime,
      customReminderQuestDate,
      props.scheduledTime,
      customReminderDate,
      customReminderTime,
    ],
  );
  const parsedCustomReminderInput = Number.parseInt(customReminderInput, 10);
  const customReminderApplyDisabled = usesCustomReminderDateTime
    ? !customReminderOffsetCandidate
      || (
        reminderOffsets.length >= MAX_QUEST_REMINDER_OFFSETS
        && !selectedReminderOffsets.has(customReminderOffsetCandidate)
      )
    : !customReminderInput.trim()
      || !Number.isFinite(parsedCustomReminderInput)
      || parsedCustomReminderInput <= 0
      || parsedCustomReminderInput > MAX_QUEST_REMINDER_MINUTES
      || (
        reminderOffsets.length >= MAX_QUEST_REMINDER_OFFSETS
        && !selectedReminderOffsets.has(parsedCustomReminderInput)
      );
  const isQuestSoft = props.visualStyle === "quest-soft";
  const tone = props.taskDifficulty ?? "medium";
  const toneColors = DIFFICULTY_COLORS[tone];
  const schedulingVariant = isQuestSoft ? "quest-soft" : "default";
  const rootClassName = isQuestSoft ? "space-y-3" : "space-y-4 border-t pt-4";
  const sectionClassName = isQuestSoft
    ? cn(QUEST_FORM_STYLES.sectionCard, "space-y-3 p-4")
    : "space-y-2";
  const blockClassName = isQuestSoft
    ? cn(QUEST_FORM_STYLES.sectionCard, "space-y-3 p-4")
    : "space-y-3";
  const labelClassName = isQuestSoft ? QUEST_FORM_STYLES.label : "text-sm font-medium";
  const helperClassName = isQuestSoft ? QUEST_FORM_STYLES.helperText : "text-xs text-muted-foreground";
  const triggerClassName = isQuestSoft
    ? cn("w-full px-4 py-3 text-sm text-left font-semibold flex items-center justify-between", QUEST_FORM_STYLES.selectorChip)
    : "w-full px-3 py-2 text-sm text-left border rounded-lg bg-background hover:bg-accent transition-colors flex items-center justify-between";
  const disabledTriggerClassName = isQuestSoft
    ? cn(
      "w-full cursor-not-allowed px-4 py-3 text-sm text-left font-semibold text-muted-foreground flex items-center justify-between opacity-70",
      QUEST_FORM_STYLES.selectorChip,
      "border-dashed",
    )
    : "w-full px-3 py-2 text-sm text-left border rounded-lg transition-colors flex items-center justify-between bg-muted text-muted-foreground cursor-not-allowed opacity-70";
  const inputClassName = isQuestSoft
    ? "border-[3px] border-celestial-blue/45 bg-card/80 text-foreground placeholder:text-muted-foreground focus-visible:border-stardust-gold/70 focus-visible:ring-stardust-gold/35"
    : "";
  const popoverClassName = isQuestSoft
    ? cn("w-[min(24rem,var(--radix-popover-trigger-width))] p-2", QUEST_FORM_STYLES.popover, props.portalClassName)
    : "w-[min(24rem,var(--radix-popover-trigger-width))] p-1";
  const reminderPopoverClassName = cn(
    popoverClassName,
    "z-[80] overflow-hidden",
  );
  const dropdownItemClassName = (selected: boolean) => cn(
    isQuestSoft
      ? "w-full rounded-[18px] px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 motion-reduce:transition-none"
      : "w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors",
    isQuestSoft
      ? selected
        ? cn(toneColors.pill, "shadow-[0_4px_0_hsl(var(--stardust-gold)_/_0.18)]")
        : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
      : selected
        ? "bg-accent"
        : "",
  );

  const seedCustomReminderDateTime = useCallback((minutesBefore = customReminderOffsets[0] ?? 60) => {
    if (!customReminderQuestStart) return;
    const boundedMinutes = Math.min(
      MAX_QUEST_REMINDER_MINUTES,
      Math.max(1, Math.trunc(minutesBefore)),
    );
    const reminderAt = new Date(customReminderQuestStart.getTime() - boundedMinutes * 60_000);

    setCustomReminderDate(reminderAt);
    setCustomReminderTime(format(reminderAt, "HH:mm"));
    setCustomReminderError(null);
  }, [customReminderOffsets, customReminderQuestStart]);

  useEffect(() => {
    if (recurrenceSelectionDisabled) {
      setShowRecurrenceOptions(false);
    }
  }, [recurrenceSelectionDisabled]);

  useEffect(() => {
    if (!showReminderOptions) {
      setIsEditingCustomReminder(false);
      setCustomReminderError(null);
      return;
    }

    if (customReminderOffsets.length > 0) {
      setCustomReminderInput(String(customReminderOffsets[0]));
    }
  }, [customReminderOffsets, showReminderOptions]);

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

  const selectedAppDay = useMemo(
    () => toAppDayIndex(props.selectedDate ?? new Date()),
    [props.selectedDate]
  );
  const selectedMonthDay = useMemo(
    () => {
      const day = (props.selectedDate ?? new Date()).getDate();
      return Math.min(31, Math.max(1, day));
    },
    [props.selectedDate]
  );

  const resolvedCustomPeriod = useMemo<"week" | "month">(() => {
    if (props.recurrenceCustomPeriod === "month") return "month";
    return "week";
  }, [props.recurrenceCustomPeriod]);

  const recurrencePatternForEditor = useMemo(() => {
    if (props.recurrencePattern === "weekly" && props.recurrenceDays.length > 1) {
      return "custom";
    }
    return props.recurrencePattern;
  }, [props.recurrencePattern, props.recurrenceDays]);

  useEffect(() => {
    if (props.recurrencePattern === "weekly" && props.recurrenceDays.length > 1) {
      props.onRecurrencePatternChange("custom");
      props.onRecurrenceCustomPeriodChange("week");
    }
  }, [props.recurrencePattern, props.recurrenceDays, props.onRecurrencePatternChange, props.onRecurrenceCustomPeriodChange]);

  useEffect(() => {
    if ((recurrencePatternForEditor !== "weekly" && recurrencePatternForEditor !== "biweekly")) return;
    if (props.recurrenceDays.length === 1) return;
    props.onRecurrenceDaysChange([selectedAppDay]);
  }, [recurrencePatternForEditor, props.recurrenceDays, props.onRecurrenceDaysChange, selectedAppDay]);

  useEffect(() => {
    if (recurrencePatternForEditor !== "monthly") return;
    if (props.recurrenceMonthDays.length > 0) return;
    props.onRecurrenceMonthDaysChange([selectedMonthDay]);
  }, [recurrencePatternForEditor, props.recurrenceMonthDays, props.onRecurrenceMonthDaysChange, selectedMonthDay]);

  useEffect(() => {
    if (recurrencePatternForEditor !== "custom") return;
    if (props.recurrenceCustomPeriod !== "week" && props.recurrenceCustomPeriod !== "month") {
      props.onRecurrenceCustomPeriodChange("week");
      return;
    }

    if (resolvedCustomPeriod === "week" && props.recurrenceDays.length === 0) {
      props.onRecurrenceDaysChange([selectedAppDay]);
      return;
    }

    if (resolvedCustomPeriod === "month" && props.recurrenceMonthDays.length === 0) {
      props.onRecurrenceMonthDaysChange([selectedMonthDay]);
    }
  }, [
    recurrencePatternForEditor,
    resolvedCustomPeriod,
    props.recurrenceCustomPeriod,
    props.recurrenceDays,
    props.recurrenceMonthDays,
    props.onRecurrenceCustomPeriodChange,
    props.onRecurrenceDaysChange,
    props.onRecurrenceMonthDaysChange,
    selectedAppDay,
    selectedMonthDay,
  ]);

  const handleSelectSuggestion = (time: string) => {
    props.onScheduledTimeChange(time);
    setShowSuggestions(false);
  };

  const handleRecurrenceOptionSelect = useCallback((value: string) => {
    if (recurrenceSelectionDisabled && value !== "none") {
      return;
    }

    if (value === "none") {
      props.onRecurrencePatternChange(null);
      props.onRecurrenceDaysChange([]);
      props.onRecurrenceMonthDaysChange([]);
      props.onRecurrenceCustomPeriodChange(null);
      setShowRecurrenceOptions(false);
      return;
    }

    props.onRecurrencePatternChange(value);

    if (value === "weekdays") {
      props.onRecurrenceDaysChange([0, 1, 2, 3, 4]);
      props.onRecurrenceMonthDaysChange([]);
      props.onRecurrenceCustomPeriodChange(null);
    } else if (value === "weekly" || value === "biweekly") {
      props.onRecurrenceDaysChange([selectedAppDay]);
      props.onRecurrenceMonthDaysChange([]);
      props.onRecurrenceCustomPeriodChange(null);
    } else if (value === "monthly") {
      props.onRecurrenceDaysChange([]);
      props.onRecurrenceMonthDaysChange(
        props.recurrenceMonthDays.length > 0 ? props.recurrenceMonthDays : [selectedMonthDay]
      );
      props.onRecurrenceCustomPeriodChange(null);
    } else if (value === "daily") {
      props.onRecurrenceDaysChange([]);
      props.onRecurrenceMonthDaysChange([]);
      props.onRecurrenceCustomPeriodChange(null);
    } else if (value === "custom") {
      const period = props.recurrenceCustomPeriod ?? "week";
      props.onRecurrenceCustomPeriodChange(period);
      if (period === "week" && props.recurrenceDays.length === 0) {
        props.onRecurrenceDaysChange([selectedAppDay]);
      }
      if (period === "month" && props.recurrenceMonthDays.length === 0) {
        props.onRecurrenceMonthDaysChange([selectedMonthDay]);
      }
    }

    setShowRecurrenceOptions(false);
  }, [props, recurrenceSelectionDisabled, selectedAppDay, selectedMonthDay]);

  const handleCustomPeriodChange = useCallback((period: "week" | "month") => {
    props.onRecurrenceCustomPeriodChange(period);
    if (period === "week" && props.recurrenceDays.length === 0) {
      props.onRecurrenceDaysChange([selectedAppDay]);
    }
    if (period === "month" && props.recurrenceMonthDays.length === 0) {
      props.onRecurrenceMonthDaysChange([selectedMonthDay]);
    }
  }, [props, selectedAppDay, selectedMonthDay]);

  const handleRecurrenceDaysChange = useCallback((days: number[]) => {
    if (days.length === 0) return;
    props.onRecurrenceDaysChange(Array.from(new Set(days)).sort((a, b) => a - b));
  }, [props]);

  const toggleMonthDay = useCallback((dayOfMonth: number) => {
    const isSelected = props.recurrenceMonthDays.includes(dayOfMonth);
    if (isSelected && props.recurrenceMonthDays.length === 1) return;

    const nextDays = isSelected
      ? props.recurrenceMonthDays.filter((day) => day !== dayOfMonth)
      : [...props.recurrenceMonthDays, dayOfMonth].sort((a, b) => a - b);
    props.onRecurrenceMonthDaysChange(nextDays);
  }, [props]);

  const applyReminderOffsets = useCallback((offsets: readonly unknown[]) => {
    const normalizedOffsets = normalizeQuestReminderOffsets(offsets);
    if (props.onReminderOffsetsMinutesChange) {
      props.onReminderOffsetsMinutesChange(normalizedOffsets);
      return;
    }

    props.onReminderEnabledChange(normalizedOffsets.length > 0);
    props.onReminderMinutesBeforeChange(getPrimaryQuestReminderOffset(normalizedOffsets));
  }, [props]);

  const toggleReminderOffset = useCallback((minutes: number) => {
    const isSelected = selectedReminderOffsets.has(minutes);
    const nextOffsets = isSelected
      ? reminderOffsets.filter((offset) => offset !== minutes)
      : [...reminderOffsets, minutes];

    if (!isSelected && reminderOffsets.length >= MAX_QUEST_REMINDER_OFFSETS) return;

    applyReminderOffsets(nextOffsets);
  }, [applyReminderOffsets, reminderOffsets, selectedReminderOffsets]);

  const applyCustomReminder = useCallback(() => {
    if (usesCustomReminderDateTime) {
      if (!customReminderOffsetCandidate) {
        setCustomReminderError("Choose a reminder before the quest starts, up to 1 week before.");
        return;
      }
      if (
        reminderOffsets.length >= MAX_QUEST_REMINDER_OFFSETS
        && !selectedReminderOffsets.has(customReminderOffsetCandidate)
      ) {
        setCustomReminderError("Remove an early reminder before adding another one.");
        return;
      }

      applyReminderOffsets([...reminderOffsets, customReminderOffsetCandidate]);
      setCustomReminderError(null);
      setIsEditingCustomReminder(false);
      return;
    }

    const minutes = Number.parseInt(customReminderInput, 10);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_QUEST_REMINDER_MINUTES) return;
    if (
      reminderOffsets.length >= MAX_QUEST_REMINDER_OFFSETS
      && !selectedReminderOffsets.has(minutes)
    ) {
      return;
    }

    applyReminderOffsets([...reminderOffsets, minutes]);
    setCustomReminderInput("");
    setIsEditingCustomReminder(false);
  }, [
    applyReminderOffsets,
    customReminderInput,
    customReminderOffsetCandidate,
    reminderOffsets,
    selectedReminderOffsets,
    usesCustomReminderDateTime,
  ]);

  const handleCustomReminderKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyCustomReminder();
  }, [applyCustomReminder]);

  return (
    <div className={rootClassName}>
      {/* Scheduled Time with Suggest Button */}
      {!props.hideScheduledTime && (
      <div className={sectionClassName}>
        <div className="flex items-center gap-2">
          <Clock className={cn("w-4 h-4", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")} />
          <Label className={labelClassName}>Scheduled Time</Label>
        </div>
        <TimePickerField
          value={props.scheduledTime}
          onChange={props.onScheduledTimeChange}
          ariaLabel="Advanced scheduled time"
          variant={schedulingVariant}
          tone={tone}
          stepMinutes={30}
          inputProps={{
            className: inputClassName,
          }}
          suggestionAction={props.selectedDate ? (
            <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleSuggestClick}
                  disabled={isSuggestLoading}
                  className={cn("shrink-0", isQuestSoft && QUEST_FORM_STYLES.secondaryButton)}
                >
                  {isSuggestLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className={cn("h-4 w-4", isQuestSoft ? "text-stardust-gold" : "text-primary")} />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={cn(isQuestSoft ? popoverClassName : "w-64 p-2", !isQuestSoft && "")} align="end">
                <div className="space-y-1">
                  <p className={cn("px-2 py-1 text-xs font-medium", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")}>
                    Suggested Times
                  </p>
                  {suggestions.length === 0 ? (
                    <p className={cn("px-2 py-2 text-sm", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")}>
                      No suggestions available
                    </p>
                  ) : (
                    suggestions.map((slot, index) => (
                      <button
                        key={slot.time}
                        type="button"
                        onClick={() => handleSelectSuggestion(slot.time)}
                        className={cn(
                          "w-full flex items-start gap-2 px-2 py-2 text-left transition-colors",
                          isQuestSoft ? "rounded-[18px] hover:bg-card/70" : "rounded-md hover:bg-accent",
                        )}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            {index === 0 && (
                              <Star className={cn("h-3 w-3", isQuestSoft ? "fill-stardust-gold text-stardust-gold" : "fill-primary text-primary")} />
                            )}
                            <span className={cn("text-sm font-medium", isQuestSoft && "text-foreground")}>
                              {formatTime(slot.time)}
                            </span>
                          </div>
                          <p className={cn("mt-0.5 text-xs", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")}>
                            {slot.reason}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ) : null}
        />
      </div>
      )}

      {/* Estimated Duration */}
      {!props.hideDuration && (
      <div className={sectionClassName}>
        <div className="flex items-center gap-2">
          <CalendarIcon className={cn("w-4 h-4", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")} />
          <Label className={labelClassName}>Estimated Duration</Label>
        </div>
        <DurationPickerField
          value={props.estimatedDuration}
          onChange={props.onEstimatedDurationChange}
          variant={schedulingVariant}
          tone={tone}
          presets={durationOptions}
          placeholder="Select duration"
        />
      </div>
      )}

      {/* Reminder Section - Only show if scheduled time is set */}
      {!props.hideReminder && props.scheduledTime && (
        <div className={blockClassName}>
          <div className="flex items-center gap-2">
            <Bell className={cn("w-4 h-4", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")} />
            <Label className={labelClassName}>Early Reminder</Label>
          </div>
          <p className={helperClassName}>
            You'll be notified when the quest starts. Add up to {MAX_QUEST_REMINDER_OFFSETS} early reminders for a little breathing room.
          </p>

          <Popover open={showReminderOptions} onOpenChange={setShowReminderOptions}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={triggerClassName}
              >
                <span>{reminderTriggerLabel}</span>
                <ChevronDown className={cn("w-4 h-4", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")} />
              </button>
            </PopoverTrigger>

            <PopoverContent
              data-testid="early-reminder-options"
              data-vaul-no-drag
              align="start"
              side="bottom"
              sideOffset={6}
              className={reminderPopoverClassName}
            >
              <div
                data-testid="early-reminder-options-scroll"
                className="max-h-[min(16rem,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain touch-pan-y space-y-1 pr-1"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <div className="space-y-1">
                  {reminderOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        if (option.value === "none") {
                          applyReminderOffsets([]);
                        } else if (typeof option.value === "number") {
                          toggleReminderOffset(option.value);
                        }
                        setIsEditingCustomReminder(false);
                      }}
                      className={dropdownItemClassName(
                        option.value === "none"
                          ? reminderOffsets.length === 0
                          : selectedReminderOffsets.has(option.value)
                      )}
                    >
                      {option.label}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingCustomReminder((current) => {
                        const next = !current;
                        if (next && usesCustomReminderDateTime) {
                          seedCustomReminderDateTime();
                        }
                        if (!next) {
                          setCustomReminderError(null);
                        }
                        return next;
                      });
                    }}
                    className={dropdownItemClassName(customReminderOffsets.length > 0)}
                  >
                    Custom
                  </button>
                </div>

                {reminderOffsets.length >= MAX_QUEST_REMINDER_OFFSETS && (
                  <p className={cn("px-2 pt-2 text-xs", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")}>
                    Limit reached
                  </p>
                )}

                {isEditingCustomReminder && (
                  <div className={cn("mt-1 space-y-2 border-t pt-3 px-2 pb-2", isQuestSoft ? "border-border/50" : "border-border/60")}>
                    {usesCustomReminderDateTime ? (
                      <div className="space-y-3">
                        <Label className={cn("text-xs font-medium", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")}>
                          Custom reminder date
                        </Label>
                        <CalendarPicker
                          mode="single"
                          selected={customReminderDate}
                          onSelect={(date) => {
                            setCustomReminderDate(date);
                            setCustomReminderError(null);
                          }}
                          className="pointer-events-auto rounded-md border"
                        />
                        <div className="space-y-1.5">
                          <Label htmlFor="custom-reminder-time" className={cn("text-xs font-medium", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")}>
                            Custom reminder time
                          </Label>
                          <Input
                            id="custom-reminder-time"
                            type="time"
                            value={customReminderTime}
                            onChange={(event) => {
                              setCustomReminderTime(event.target.value);
                              setCustomReminderError(null);
                            }}
                            onKeyDown={handleCustomReminderKeyDown}
                            className={cn("h-10 text-sm", inputClassName)}
                          />
                        </div>
                        {customReminderError ? (
                          <p className={cn("text-xs", isQuestSoft ? "text-destructive" : "text-destructive")}>
                            {customReminderError}
                          </p>
                        ) : (
                          <p className={cn("text-xs", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")}>
                            Pick a time before the quest starts.
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <Label htmlFor="custom-reminder-minutes" className={cn("text-xs font-medium", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")}>
                          Minutes before
                        </Label>
                        <Input
                          id="custom-reminder-minutes"
                          type="number"
                          min={1}
                          max={MAX_QUEST_REMINDER_MINUTES}
                          inputMode="numeric"
                          value={customReminderInput}
                          onChange={(event) => setCustomReminderInput(event.target.value)}
                          onKeyDown={handleCustomReminderKeyDown}
                          placeholder="e.g. 180"
                          className={cn("h-10 text-sm", inputClassName)}
                        />
                      </>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      onClick={applyCustomReminder}
                      disabled={customReminderApplyDisabled}
                      className={isQuestSoft ? cn("w-full font-fredoka", toneColors.primaryButton) : "w-full"}
                    >
                      Apply
                    </Button>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Recurrence Section - hide for rituals */}
      {!props.hideRecurrence && (
        <div className={blockClassName}>
          <div className="flex items-center gap-2">
            <Repeat className={cn("w-4 h-4", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")} />
            <Label className={labelClassName}>Recurrence</Label>
          </div>

          <Popover open={showRecurrenceOptions} onOpenChange={setShowRecurrenceOptions}>
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={recurrenceSelectionDisabled}
                className={recurrenceSelectionDisabled ? disabledTriggerClassName : triggerClassName}
              >
                <span>
                  {recurrenceOptions.find(opt => opt.value === (recurrencePatternForEditor || 'none'))?.label || "None"}
                </span>
                <ChevronDown className={cn("w-4 h-4", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="bottom"
              sideOffset={6}
              className={popoverClassName}
            >
              <div className={cn(isQuestSoft && "max-h-60 overflow-y-auto")}>
                {recurrenceOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleRecurrenceOptionSelect(option.value)}
                    className={dropdownItemClassName((recurrencePatternForEditor || 'none') === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {recurrenceSelectionDisabled && (
            <p className={helperClassName}>
              Set a time to enable recurrence.
            </p>
          )}
          
          {recurrencePatternForEditor === 'custom' && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant={isQuestSoft ? "outline" : resolvedCustomPeriod === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => handleCustomPeriodChange("week")}
                className={isQuestSoft ? getQuestOptionPillClasses(resolvedCustomPeriod === "week", toneColors.pill, true) : undefined}
              >
                Week
              </Button>
              <Button
                type="button"
                variant={isQuestSoft ? "outline" : resolvedCustomPeriod === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => handleCustomPeriodChange("month")}
                className={isQuestSoft ? getQuestOptionPillClasses(resolvedCustomPeriod === "month", toneColors.pill, true) : undefined}
              >
                Month
              </Button>
            </div>
          )}

          {(recurrencePatternForEditor === 'weekly'
            || recurrencePatternForEditor === 'biweekly'
            || (recurrencePatternForEditor === 'custom' && resolvedCustomPeriod === 'week')) && (
            <FrequencyPicker
              selectedDays={props.recurrenceDays}
              onDaysChange={handleRecurrenceDaysChange}
              selectionMode={recurrencePatternForEditor === 'custom' ? 'multiple' : 'single'}
              variant={isQuestSoft ? "quest-soft" : "default"}
              activeTone={toneColors.pill}
            />
          )}

          {(recurrencePatternForEditor === "monthly" || (recurrencePatternForEditor === "custom" && resolvedCustomPeriod === "month")) && (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-1.5">
                {monthDays.map((dayOfMonth) => (
                  <button
                    key={dayOfMonth}
                    type="button"
                    onClick={() => toggleMonthDay(dayOfMonth)}
                    className={cn(
                      "h-8 rounded-md text-xs font-medium border transition-colors",
                      isQuestSoft
                        ? props.recurrenceMonthDays.includes(dayOfMonth)
                          ? cn(toneColors.pill, "shadow-[0_4px_0_hsl(var(--stardust-gold)_/_0.18)]")
                          : "border-border/60 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground"
                        : props.recurrenceMonthDays.includes(dayOfMonth)
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-background border-border hover:bg-accent",
                    )}
                  >
                    {dayOfMonth}
                  </button>
                ))}
              </div>
              <p className={helperClassName}>
                Short months run on the last valid day.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Location */}
      {!props.hideLocation && (
        <div className={sectionClassName}>
          <div className="flex items-center gap-2">
            <MapPin className={cn("w-4 h-4", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")} />
            <Label className={labelClassName}>Location</Label>
          </div>
          <QuestLocationAutocompleteInput
            value={props.location || ''}
            onChange={props.onLocationChange}
            placeholder="Address or place name (optional)"
            className={cn(isQuestSoft ? inputClassName : "bg-muted/30 border-border/50")}
          />
        </div>
      )}

      {/* More Information */}
      {!props.hideMoreInformation && (
      <div className={blockClassName}>
        <div className="flex items-center gap-2">
          <Info className={cn("w-4 h-4", isQuestSoft ? "text-muted-foreground" : "text-muted-foreground")} />
          <Label className={labelClassName}>More Information</Label>
        </div>
        <Textarea
          value={props.moreInformation || ''}
          onChange={(e) => props.onMoreInformationChange(e.target.value || null)}
          placeholder="Add extra context, notes, or details (optional)"
          className={cn(
            "min-h-[100px] resize-none",
            isQuestSoft
              ? "border-[3px] border-celestial-blue/45 bg-card/80 text-foreground placeholder:text-muted-foreground focus-visible:border-stardust-gold/70 focus-visible:ring-stardust-gold/35"
              : "bg-muted/30 border-border/50",
          )}
          style={{ touchAction: 'pan-y', WebkitTapHighlightColor: 'transparent' }}
          data-vaul-no-drag
        />
      </div>
      )}
    </div>
  );
};
