import { cn } from "@/lib/utils";
import {
  formatScheduleSelectionShort,
  getDefaultMonthDaysForFrequency,
  getDefaultWeekdaysForFrequency,
  inferCustomPeriod,
  type HabitCustomPeriod,
} from "@/utils/habitSchedule";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

type FrequencyType = 'daily' | '5x_week' | 'weekly' | 'monthly' | 'custom';

interface FrequencySelection {
  frequency: FrequencyType;
  customDays: number[];
  customMonthDays: number[];
  customPeriod: HabitCustomPeriod;
}

interface FrequencyPresetsProps {
  frequency: FrequencyType;
  customDays: number[];
  customMonthDays?: number[];
  customPeriod?: HabitCustomPeriod;
  onFrequencyChange: (selection: FrequencySelection) => void;
}

const presets: { value: FrequencyType; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: '5x_week', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
];

export function FrequencyPresets({
  frequency,
  customDays,
  customMonthDays = [],
  customPeriod,
  onFrequencyChange,
}: FrequencyPresetsProps) {
  const resolvedCustomPeriod = customPeriod ?? inferCustomPeriod({
    frequency,
    custom_days: customDays,
    custom_month_days: customMonthDays,
  });
  const showWeekPicker = frequency === 'weekly' || (frequency === 'custom' && resolvedCustomPeriod === 'week');
  const showMonthPicker = frequency === 'monthly' || (frequency === 'custom' && resolvedCustomPeriod === 'month');

  const emitChange = (next: Partial<FrequencySelection>) => {
    const nextFrequency = next.frequency ?? frequency;
    onFrequencyChange({
      frequency: nextFrequency,
      customDays: next.customDays ?? customDays,
      customMonthDays: next.customMonthDays ?? customMonthDays,
      customPeriod: next.customPeriod ?? resolvedCustomPeriod,
    });
  };

  const handlePresetClick = (preset: typeof presets[0]) => {
    if (preset.value === 'daily') {
      emitChange({
        frequency: 'daily',
        customDays: getDefaultWeekdaysForFrequency('daily'),
        customMonthDays: [],
      });
      return;
    }

    if (preset.value === '5x_week') {
      emitChange({
        frequency: '5x_week',
        customDays: getDefaultWeekdaysForFrequency('5x_week'),
        customMonthDays: [],
      });
      return;
    }

    if (preset.value === 'weekly') {
      emitChange({
        frequency: 'weekly',
        customDays: customDays.length > 0 ? [customDays[0]] : getDefaultWeekdaysForFrequency('weekly'),
        customMonthDays: [],
        customPeriod: 'week',
      });
      return;
    }

    if (preset.value === 'monthly') {
      emitChange({
        frequency: 'monthly',
        customDays: [],
        customMonthDays: customMonthDays.length > 0 ? [customMonthDays[0]] : getDefaultMonthDaysForFrequency('monthly'),
        customPeriod: 'month',
      });
      return;
    }

    emitChange({
      frequency: 'custom',
      customPeriod: resolvedCustomPeriod,
      customDays: resolvedCustomPeriod === 'week' ? customDays : [],
      customMonthDays: resolvedCustomPeriod === 'month' ? customMonthDays : [],
    });
  };

  const toggleWeekday = (dayIndex: number) => {
    if (frequency === 'weekly') {
      emitChange({ customDays: [dayIndex], customMonthDays: [] });
      return;
    }

    const nextDays = customDays.includes(dayIndex)
      ? customDays.filter(d => d !== dayIndex)
      : [...customDays, dayIndex].sort((a, b) => a - b);

    emitChange({ customDays: nextDays, customMonthDays: [] });
  };

  const toggleMonthDay = (dayOfMonth: number) => {
    if (frequency === 'monthly') {
      emitChange({ customMonthDays: [dayOfMonth], customDays: [] });
      return;
    }

    const nextDays = customMonthDays.includes(dayOfMonth)
      ? customMonthDays.filter(day => day !== dayOfMonth)
      : [...customMonthDays, dayOfMonth].sort((a, b) => a - b);

    emitChange({ customMonthDays: nextDays, customDays: [] });
  };

  const handleCustomPeriodChange = (period: HabitCustomPeriod) => {
    emitChange({
      frequency: 'custom',
      customPeriod: period,
      customDays: period === 'week' ? (customDays.length > 0 ? customDays : [0]) : [],
      customMonthDays: period === 'month' ? (customMonthDays.length > 0 ? customMonthDays : [1]) : [],
    });
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] text-muted-foreground block">Frequency</label>

      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => handlePresetClick(preset)}
            className={cn(
              "px-2 py-1 text-xs rounded-full border transition-all",
              frequency === preset.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-muted-foreground hover:border-primary/50"
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {frequency === 'custom' && (
        <div className="flex gap-1 pt-1">
          {(['week', 'month'] as HabitCustomPeriod[]).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => handleCustomPeriodChange(period)}
              className={cn(
                "px-2 py-1 text-[11px] rounded-full border transition-all",
                resolvedCustomPeriod === period
                  ? "bg-primary/15 border-primary text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50"
              )}
            >
              {period === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      )}

      {showWeekPicker && (
        <div className="flex gap-1 pt-1">
          {DAYS.map((day, index) => (
            <button
              key={index}
              type="button"
              onClick={() => toggleWeekday(index)}
              title={DAY_FULL[index]}
              className={cn(
                "w-7 h-7 rounded-full text-[10px] font-bold transition-all border",
                customDays.includes(index)
                  ? "bg-primary border-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/50"
              )}
            >
              {day}
            </button>
          ))}
        </div>
      )}

      {showMonthPicker && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-7 gap-1">
            {MONTH_DAYS.map((dayOfMonth) => (
              <button
                key={dayOfMonth}
                type="button"
                onClick={() => toggleMonthDay(dayOfMonth)}
                className={cn(
                  "h-8 rounded-md text-[11px] font-medium transition-all border",
                  customMonthDays.includes(dayOfMonth)
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                )}
              >
                {dayOfMonth}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Short months automatically run on the last valid day. {formatScheduleSelectionShort({
              frequency,
              custom_days: customDays,
              custom_month_days: customMonthDays,
              customPeriod: resolvedCustomPeriod,
            }) ? `Selected: ${formatScheduleSelectionShort({
              frequency,
              custom_days: customDays,
              custom_month_days: customMonthDays,
              customPeriod: resolvedCustomPeriod,
            })}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

export function getDefaultDaysForFrequency(frequency: string): number[] {
  return getDefaultWeekdaysForFrequency(frequency);
}

export function getDefaultMonthDays(frequency: string): number[] {
  return getDefaultMonthDaysForFrequency(frequency);
}

export function formatDaysShort(days: number[], monthDays: number[] = [], customPeriod: HabitCustomPeriod = 'week'): string {
  if (customPeriod === 'month') {
    return monthDays.join(',');
  }
  if (!days || days.length === 0) return '';
  if (days.length === 7) return '';
  return days.map(d => DAYS[d]).join('');
}
