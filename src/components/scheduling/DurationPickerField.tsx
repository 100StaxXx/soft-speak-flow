import { type ButtonHTMLAttributes, type InputHTMLAttributes, useMemo, useState } from "react";
import { ChevronRight, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  DEFAULT_DURATION_PRESETS,
  type DurationPreset,
  type SchedulingFieldVariant,
  type SchedulingTone,
  formatDurationLabel,
  getSchedulingFieldStyles,
  getSchedulingOptionClasses,
} from "./shared";

export interface DurationPickerFieldProps {
  value: number | null;
  onChange: (duration: number | null) => void;
  label?: string;
  placeholder?: string;
  variant?: SchedulingFieldVariant;
  tone?: SchedulingTone;
  presets?: DurationPreset[];
  allowNone?: boolean;
  allowCustom?: boolean;
  customPlaceholder?: string;
  triggerProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  inputProps?: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange">;
  className?: string;
}

export function DurationPickerField({
  value,
  onChange,
  label,
  placeholder = "No duration",
  variant = "default",
  tone = "medium",
  presets = DEFAULT_DURATION_PRESETS,
  allowNone = true,
  allowCustom = true,
  customPlaceholder = "Minutes",
  triggerProps,
  inputProps,
  className,
}: DurationPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const styles = getSchedulingFieldStyles(variant);

  const isCustomValue = useMemo(
    () => value !== null && !presets.some((preset) => preset.value === value),
    [presets, value],
  );
  const showCustomInput = open && allowCustom && (isEditingCustom || isCustomValue);
  const customFieldValue = !isEditingCustom
    && isCustomValue
    && customInput.trim().length === 0
    && value !== null
    ? String(value)
    : customInput;

  return (
    <div className={cn(styles.root, className)}>
      {label ? (
        <Label className={styles.label}>{label}</Label>
      ) : null}
      <button
        type="button"
        {...triggerProps}
        onClick={(event) => {
          setOpen((current) => !current);
          triggerProps?.onClick?.(event);
        }}
        className={cn(styles.durationTrigger, open && styles.triggerOpen, triggerProps?.className)}
      >
        <span className={styles.durationTriggerContent}>
          <Timer className={styles.triggerIcon} />
          <span>{formatDurationLabel(value, placeholder)}</span>
        </span>
        <ChevronRight className={cn(styles.chevron, open && "rotate-90")} />
      </button>

      {open ? (
        <div className={styles.chipsWrapper}>
          <div className={styles.chipsRow}>
            {allowNone ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setCustomInput("");
                  setIsEditingCustom(false);
                }}
                className={getSchedulingOptionClasses(variant, value === null && !showCustomInput, tone)}
              >
                None
              </button>
            ) : null}

            {presets.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  onChange(preset.value);
                  setCustomInput("");
                  setIsEditingCustom(false);
                }}
                className={getSchedulingOptionClasses(
                  variant,
                  !showCustomInput && value === preset.value,
                  tone,
                )}
              >
                {preset.label}
              </button>
            ))}

            {allowCustom ? (
              <button
                type="button"
                onClick={() => {
                  setCustomInput("");
                  setIsEditingCustom(true);
                  onChange(null);
                }}
                className={getSchedulingOptionClasses(variant, showCustomInput, tone)}
              >
                Custom
              </button>
            ) : null}
          </div>

          {showCustomInput ? (
            <div className={styles.customPanel}>
              <Input
                type="number"
                inputMode="numeric"
                placeholder={customPlaceholder}
                value={customFieldValue}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setCustomInput(nextValue);
                  setIsEditingCustom(true);
                  const parsed = Number.parseInt(nextValue, 10);
                  onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
                }}
                autoFocus
                {...inputProps}
                className={cn(styles.customInput, inputProps?.className)}
              />
              <span className={styles.customSuffix}>min</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
