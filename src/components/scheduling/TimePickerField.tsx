import {
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type DataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined;
};

const TIME_VALUE_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function getTimeSlotSortValue(value: string): number {
  const match = value.match(TIME_VALUE_PATTERN);
  if (!match) return Number.POSITIVE_INFINITY;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

function includeSelectedTimeSlot(slots: string[], value: string | null | undefined): string[] {
  if (!value || slots.includes(value) || !TIME_VALUE_PATTERN.test(value)) {
    return slots;
  }

  return [...slots, value].sort((first, second) => getTimeSlotSortValue(first) - getTimeSlotSortValue(second));
}

export interface TimeWheelPickerProps {
  value: string | null;
  onChange: (time: string) => void;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  variant?: SchedulingFieldVariant;
  tone?: SchedulingTone;
  stepMinutes?: number;
  endTimeHint?: string | null;
  className?: string;
  getSlotButtonProps?: (slot: string) => (ButtonHTMLAttributes<HTMLButtonElement> & DataAttributes) | undefined;
}

export function TimeWheelPicker({
  value,
  onChange,
  ariaLabel,
  ariaLabelledBy,
  variant = "default",
  tone = "medium",
  stepMinutes = 30,
  endTimeHint,
  className,
  getSlotButtonProps,
}: TimeWheelPickerProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const styles = getSchedulingFieldStyles(variant);
  const timeSlots = useMemo(
    () => includeSelectedTimeSlot(generateTimeSlotsForStep(stepMinutes), value),
    [stepMinutes, value],
  );

  useEffect(() => {
    if (!value) return;

    const frameId = window.requestAnimationFrame(() => {
      centerSelectedTimeInWheel(wheelRef.current, value, "smooth");
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [value, timeSlots]);

  return (
    <div
      ref={wheelRef}
      role="group"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cn(styles.wheel, className)}
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
              aria-pressed={isSelected}
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
              style={{ ...slotProps?.style, opacity }}
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
  );
}

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
  triggerProps?: ButtonHTMLAttributes<HTMLButtonElement> & DataAttributes;
  panelProps?: HTMLAttributes<HTMLDivElement> & DataAttributes;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & DataAttributes;
  getSlotButtonProps?: (slot: string) => (ButtonHTMLAttributes<HTMLButtonElement> & DataAttributes) | undefined;
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
  panelProps,
  inputProps,
  getSlotButtonProps,
  className,
}: TimePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const styles = getSchedulingFieldStyles(variant);

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
        <div
          {...panelProps}
          className={cn(styles.panel, panelProps?.className)}
        >
          <Input
            type="time"
            step={60}
            value={value || ""}
            onChange={(event) => onChange(event.target.value || null)}
            {...inputProps}
            aria-label={inputAriaLabel}
            className={cn(styles.input, inputProps?.className)}
          />

          <TimeWheelPicker
            value={value}
            onChange={onChange}
            variant={variant}
            tone={tone}
            stepMinutes={stepMinutes}
            endTimeHint={endTimeHint}
            getSlotButtonProps={getSlotButtonProps}
          />
        </div>
      ) : null}
    </div>
  );
}

export function getDefaultSeedValue(stepMinutes = 30) {
  return getNextTimeForStep(stepMinutes);
}
