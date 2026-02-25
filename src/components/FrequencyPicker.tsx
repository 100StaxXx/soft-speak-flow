import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface FrequencyPickerProps {
  selectedDays: number[];
  onDaysChange: (days: number[]) => void;
  selectionMode?: "single" | "multiple";
}

export const FrequencyPicker = ({ selectedDays, onDaysChange, selectionMode = "multiple" }: FrequencyPickerProps) => {
  const toggleDay = (dayIndex: number) => {
    if (selectionMode === "single") {
      if (selectedDays.length === 1 && selectedDays[0] === dayIndex) return;
      onDaysChange([dayIndex]);
      return;
    }

    if (selectedDays.includes(dayIndex)) {
      onDaysChange(selectedDays.filter((d) => d !== dayIndex));
    } else {
      onDaysChange([...selectedDays, dayIndex].sort());
    }
  };

  const selectAll = () => {
    onDaysChange([0, 1, 2, 3, 4, 5, 6]);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">
          Select days ({selectedDays.length}/7)
        </h4>
        {selectionMode === "multiple" && (
          <button
            onClick={selectAll}
            className="text-xs text-primary hover:text-primary/80 font-medium"
          >
            Select all
          </button>
        )}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map((day, index) => (
          <button
            key={day}
            onClick={() => toggleDay(index)}
            aria-label={DAYS[index]}
            className={cn(
              "aspect-square rounded-full flex items-center justify-center text-xs font-bold transition-all border-2",
              selectedDays.includes(index)
                ? "bg-primary border-primary text-primary-foreground shadow-glow"
                : "border-border bg-card text-muted-foreground hover:border-primary/50"
            )}
          >
            {day.charAt(0)}
          </button>
        ))}
      </div>
    </div>
  );
};
