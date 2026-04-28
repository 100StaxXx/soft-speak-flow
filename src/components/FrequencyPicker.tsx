import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface FrequencyPickerProps {
  selectedDays: number[];
  onDaysChange: (days: number[]) => void;
  selectionMode?: "single" | "multiple";
  variant?: "default" | "quest-soft";
  activeTone?: string;
}

export const FrequencyPicker = ({
  selectedDays,
  onDaysChange,
  selectionMode = "multiple",
  variant = "default",
  activeTone,
}: FrequencyPickerProps) => {
  const isQuestSoft = variant === "quest-soft";

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
        <h4 className={cn("text-sm font-medium", isQuestSoft ? "text-[#4f240c]" : "text-foreground")}>
          Select days ({selectedDays.length}/7)
        </h4>
        {selectionMode === "multiple" && (
          <button
            onClick={selectAll}
            className={cn(
              "text-xs font-medium",
              isQuestSoft ? "text-[#6b3416] hover:text-[#4f240c]" : "text-primary hover:text-primary/80",
            )}
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
              "aspect-square flex items-center justify-center text-xs font-bold transition-all",
              isQuestSoft ? "rounded-[14px] border" : "rounded-full border-2",
              selectedDays.includes(index)
                ? cn(
                  isQuestSoft
                    ? "border-transparent shadow-[0_4px_0_rgba(77,40,17,0.2)]"
                    : "bg-primary border-primary text-primary-foreground shadow-glow",
                  isQuestSoft && activeTone ? activeTone : "",
                )
                : isQuestSoft
                  ? "border-[#6b3416]/35 bg-white/55 text-[#6b3416] hover:bg-white/75 hover:text-[#4f240c]"
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
