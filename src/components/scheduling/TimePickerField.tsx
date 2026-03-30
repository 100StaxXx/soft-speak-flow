import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Clock } from "lucide-react";
import { centerSelectedTimeInWheel } from "@/components/quest-shared";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  type SchedulingFieldVariant,
  type SchedulingTone,
  generateTimeSlotsForStep,
  getNextTimeForStep,
  getSchedulingFieldStyles,
  getSchedulingOptionClasses,
  getTimeTriggerLabel,
} from "./shared";

export interface TimePickerFieldProps {
  value: string | null;
  onChange: (time: string | null) => void;
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  variant?: SchedulingFieldVariant;
  tone?: SchedulingTone;
  stepMinutes?: number;
  seedValueOnOpen?: string | (() => string);
  endTimeHint?: string | null;
  suggestionAction?: ReactNode;
  triggerProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange">;
  getSlotButtonProps?: (slot: string) => ButtonHTMLAttributes<HTMLButtonElement> | undefined;
  className?: string;
}

export function TimePickerField({
  value,
  onChange,
  label,
  placeholder = "Time",
  ariaLabel = "Custom time",
  variant = "default",
  tone = "medium",
  stepMinutes = 30,
  seedValueOnOpen,
  endTimeHint,
  suggestionAction,
  triggerProps,
  inputProps,
  getSlotButtonProps,
  className,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const wheelRef = useRef<HTMLDivElement>(null);
  const styles = getSchedulingFieldStyles(variant);
  const timeSlots = useMemo(() => generateTimeSlotsForStep(stepMinutes), [stepMinutes]);

  useEffect(() => {
    if (!open || !value) return;

    const frameId = window.requestAnimationFrame(() => {
      centerSelectedTimeInWheel(wheelRef.current, value, "smooth");
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open, value]);

  const handleToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!open && !value && seedValueOnOpen) {
      const seededValue = typeof seedValueOnOpen === "function"
        ? seedValueOnOpen()
        : seedValueOnOpen;

      if (seededValue) {
        onChange(seededValue);
      }
    }

    setOpen((current) => !current);
    triggerProps?.onClick?.(event);
  };

  const inputAriaLabel = inputProps?.["aria-label"] ?? ariaLabel;

  return (
    <div className={cn(styles.root, className)}>
      {label ? (
        <Label className={styles.label}>{label}</Label>
      ) : null}
      <div className={styles.triggerRow}>
        <button
          type="button"
          {...triggerProps}
          onClick={handleToggle}
          className={cn(
            "flex-1",
            styles.trigger,
            open && styles.triggerOpen,
            !value && styles.triggerMuted,
            triggerProps?.className,
          )}
        >
          <Clock className={styles.triggerIcon} />
          <span>{getTimeTriggerLabel(value, placeholder)}</span>
          <ChevronRight className={cn(styles.chevron, open && "rotate-90")} />
        </button>
        {suggestionAction}
      </div>

      {open ? (
        <div className={styles.panel}>
          <Input
            type="time"
            step={60}
            value={value || ""}
            onChange={(event) => onChange(event.target.value || null)}
            {...inputProps}
            aria-label={inputAriaLabel}
            className={cn(styles.input, inputProps?.className)}
          />

          <div
            ref={wheelRef}
            className={styles.wheel}
            style={{ scrollbarWidth: "none" }}
          >
            <div className={styles.wheelFadeTop} />
            <div className={styles.wheelInner}>
              {timeSlots.map((slot) => {
                const slotProps = getSlotButtonProps?.(slot);
                const isSelected = value === slot;
                const selectedIndex = value ? timeSlots.indexOf(value) : -1;
                const slotIndex = timeSlots.indexOf(slot);
                const distance = selectedIndex >= 0 ? Math.abs(slotIndex - selectedIndex) : 0;
                const opacity = isSelected ? 1 : Math.max(0.25, 1 - distance * 0.15);

                return (
                  <button
                    key={slot}
                    type="button"
                    data-time-slot={slot}
                    {...slotProps}
                    onClick={(event) => {
                      onChange(slot);
                      slotProps?.onClick?.(event);
                    }}
                    className={cn(
                      styles.wheelSlot,
                      isSelected
                        ? cn(getSchedulingOptionClasses(variant, true, tone), "scale-[1.02]")
                        : styles.wheelSlotInactive,
                      slotProps?.className,
                    )}
                    style={{ opacity: isSelected ? 1 : opacity }}
                  >
                    {isSelected && endTimeHint
                      ? `${getTimeTriggerLabel(slot, slot)} - ${getTimeTriggerLabel(endTimeHint, endTimeHint)}`
                      : getTimeTriggerLabel(slot, slot)}
                  </button>
                );
              })}
            </div>
            <div className={styles.wheelFadeBottom} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function getDefaultSeedValue(stepMinutes = 30) {
  return getNextTimeForStep(stepMinutes);
}
