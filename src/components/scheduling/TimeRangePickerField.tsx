import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type SchedulingFieldVariant, type SchedulingTone } from "./shared";
import { TimePickerField } from "./TimePickerField";

interface TimeRangePickerFieldProps {
  startValue: string | null;
  endValue: string | null;
  onStartChange: (time: string | null) => void;
  onEndChange: (time: string | null) => void;
  startLabel?: string;
  endLabel?: string;
  startPlaceholder?: string;
  endPlaceholder?: string;
  variant?: SchedulingFieldVariant;
  tone?: SchedulingTone;
  stepMinutes?: number;
  className?: string;
  separator?: ReactNode;
}

export function TimeRangePickerField({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startLabel = "Start",
  endLabel = "End",
  startPlaceholder = "Start",
  endPlaceholder = "End",
  variant = "default",
  tone = "medium",
  stepMinutes = 30,
  className,
  separator,
}: TimeRangePickerFieldProps) {
  return (
    <div className={cn("flex items-end gap-2", className)}>
      <div className="flex-1">
        <TimePickerField
          value={startValue}
          onChange={onStartChange}
          label={startLabel}
          placeholder={startPlaceholder}
          variant={variant}
          tone={tone}
          stepMinutes={stepMinutes}
        />
      </div>
      {separator ?? <span className="pb-2 text-muted-foreground">-</span>}
      <div className="flex-1">
        <TimePickerField
          value={endValue}
          onChange={onEndChange}
          label={endLabel}
          placeholder={endPlaceholder}
          variant={variant}
          tone={tone}
          stepMinutes={stepMinutes}
        />
      </div>
    </div>
  );
}
