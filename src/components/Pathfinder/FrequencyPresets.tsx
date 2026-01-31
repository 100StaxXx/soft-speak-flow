import { cn } from "@/lib/utils";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const DAY_FULL = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type FrequencyType = 'daily' | '5x_week' | 'weekly' | 'custom';

interface FrequencyPresetsProps {
  frequency: FrequencyType;
  customDays: number[];
  onFrequencyChange: (frequency: FrequencyType, days: number[]) => void;
}

const presets: { value: FrequencyType; label: string; days: number[] }[] = [
  { value: 'daily', label: 'Daily', days: [0, 1, 2, 3, 4, 5, 6] },
  { value: '5x_week', label: 'Weekdays', days: [0, 1, 2, 3, 4] },
  { value: 'weekly', label: 'Weekly', days: [0] },
  { value: 'custom', label: 'Custom', days: [] },
];

export function FrequencyPresets({ frequency, customDays, onFrequencyChange }: FrequencyPresetsProps) {
  const showDayPicker = frequency === 'weekly' || frequency === 'custom';
  
  const handlePresetClick = (preset: typeof presets[0]) => {
    onFrequencyChange(preset.value, preset.days);
  };
  
  const toggleDay = (dayIndex: number) => {
    const newDays = customDays.includes(dayIndex)
      ? customDays.filter(d => d !== dayIndex)
      : [...customDays, dayIndex].sort((a, b) => a - b);
    onFrequencyChange(frequency, newDays);
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] text-muted-foreground block">Frequency</label>
      
      {/* Preset buttons */}
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
      
      {/* Day picker for weekly/custom */}
      {showDayPicker && (
        <div className="flex gap-1 pt-1">
          {DAYS.map((day, index) => (
            <button
              key={index}
              type="button"
              onClick={() => toggleDay(index)}
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
    </div>
  );
}

// Helper to get default days for a frequency
export function getDefaultDaysForFrequency(frequency: string): number[] {
  switch (frequency) {
    case 'daily': return [0, 1, 2, 3, 4, 5, 6];
    case 'weekdays': 
    case '5x_week': return [0, 1, 2, 3, 4];
    case 'weekly': return [0];
    default: return [];
  }
}

// Format days for display
export function formatDaysShort(days: number[]): string {
  if (!days || days.length === 0) return '';
  if (days.length === 7) return '';
  return days.map(d => DAYS[d]).join('');
}
