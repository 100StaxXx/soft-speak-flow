import { DIFFICULTY_COLORS, QUEST_FORM_STYLES, getQuestOptionPillClasses, TIME_SLOTS, formatTime12 } from "@/components/quest-shared";
import { cn } from "@/lib/utils";

export type SchedulingFieldVariant = "default" | "quest-soft" | "compact";
export type SchedulingTone = keyof typeof DIFFICULTY_COLORS;

export interface DurationPreset {
  label: string;
  value: number;
}

export const DEFAULT_DURATION_PRESETS: DurationPreset[] = [
  { label: "15m", value: 15 },
  { label: "30m", value: 30 },
  { label: "45m", value: 45 },
  { label: "1h", value: 60 },
  { label: "1.5h", value: 90 },
  { label: "2h", value: 120 },
  { label: "3h", value: 180 },
  { label: "All Day", value: 1440 },
];

export function generateTimeSlotsForStep(stepMinutes: number): string[] {
  if (stepMinutes === 30) {
    return TIME_SLOTS;
  }

  const safeStep = Math.max(1, Math.min(60, stepMinutes));
  const slots: string[] = [];

  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += safeStep) {
      slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
    }
  }

  return slots;
}

export function getNextTimeForStep(stepMinutes = 30, baseDate = new Date()): string {
  const safeStep = Math.max(1, Math.min(60, stepMinutes));
  const rounded = new Date(baseDate);
  rounded.setSeconds(0, 0);

  const currentMinutes = rounded.getMinutes();
  const remainder = currentMinutes % safeStep;

  if (remainder !== 0) {
    rounded.setMinutes(currentMinutes + (safeStep - remainder));
  }

  return `${String(rounded.getHours()).padStart(2, "0")}:${String(rounded.getMinutes()).padStart(2, "0")}`;
}

export function formatDurationLabel(
  value: number | null | undefined,
  emptyLabel = "No duration",
): string {
  if (!value) return emptyLabel;
  if (value === 1440) return "All Day";
  if (value < 60) return `${value} min`;

  if (value % 60 === 0 || value % 30 === 0) {
    return `${value / 60}h`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${hours}h ${minutes}m`;
}

export function getTimeTriggerLabel(value: string | null | undefined, placeholder = "Time"): string {
  return value ? formatTime12(value) : placeholder;
}

export function getSchedulingOptionClasses(
  variant: SchedulingFieldVariant,
  active: boolean,
  tone: SchedulingTone = "medium",
): string {
  if (variant === "quest-soft") {
    return getQuestOptionPillClasses(active, DIFFICULTY_COLORS[tone].pill, false);
  }

  if (variant === "compact") {
    return cn(
      "rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
      active
        ? "border-celestial-blue/40 bg-celestial-blue/10 text-celestial-blue"
        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
    );
  }

  return cn(
    "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "border-celestial-blue/40 bg-celestial-blue/10 text-celestial-blue"
      : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
  );
}

export function getSchedulingFieldStyles(variant: SchedulingFieldVariant) {
  if (variant === "quest-soft") {
    return {
      root: "space-y-2",
      label: QUEST_FORM_STYLES.label,
      trigger:
        cn(
          "w-full flex items-center justify-center gap-2 text-sm font-semibold",
          QUEST_FORM_STYLES.selectorChip,
        ),
      triggerOpen: "border-stardust-gold/70",
      triggerMuted: QUEST_FORM_STYLES.selectorChipMuted,
      triggerRow: "flex gap-2",
      triggerIcon: "h-4 w-4",
      panel: "space-y-2",
      input: "h-11 rounded-[20px] border-[3px] border-celestial-blue/45 bg-card/80 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-stardust-gold/70 focus-visible:ring-stardust-gold/35",
      wheel: QUEST_FORM_STYLES.timeWheel,
      wheelFadeTop: QUEST_FORM_STYLES.timeWheelFadeTop,
      wheelFadeBottom: QUEST_FORM_STYLES.timeWheelFadeBottom,
      wheelInner: "flex flex-col items-center py-1",
      wheelSlot:
        "my-0.5 w-[85%] rounded-[20px] py-2.5 text-center text-sm font-semibold snap-center transition-all duration-150 motion-reduce:transition-none",
      wheelSlotInactive: "text-muted-foreground hover:bg-card/70 hover:text-foreground",
      durationTrigger:
        cn(
          "w-full flex items-center justify-between",
          QUEST_FORM_STYLES.selectorChip,
        ),
      durationTriggerContent: "flex items-center gap-2.5 text-sm font-semibold",
      chevron: "h-4 w-4 text-muted-foreground transition-transform",
      chipsWrapper: "space-y-2 px-1",
      chipsRow: "flex gap-2 flex-wrap",
      customPanel: cn("flex items-center gap-2 rounded-[20px] px-3 py-2", QUEST_FORM_STYLES.insetPanel),
      customInput: "h-10 w-28 border-[3px] border-celestial-blue/45 bg-card/80 text-sm text-foreground focus-visible:border-stardust-gold/70 focus-visible:ring-stardust-gold/35",
      customSuffix: "text-xs text-muted-foreground",
    } as const;
  }

  if (variant === "compact") {
    return {
      root: "space-y-1.5",
      label: "text-[10px] font-medium text-muted-foreground",
      trigger:
        "w-full flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent",
      triggerOpen: "border-celestial-blue/35 bg-celestial-blue/10",
      triggerMuted: "border-dashed text-muted-foreground",
      triggerRow: "flex gap-2",
      triggerIcon: "h-3.5 w-3.5",
      panel: "space-y-2",
      input: "h-9 rounded-lg bg-background text-sm",
      wheel: "relative h-[144px] overflow-y-auto rounded-lg border border-border bg-background shadow-sm snap-y snap-mandatory",
      wheelFadeTop: "sticky top-0 z-10 h-8 bg-gradient-to-b from-background via-background/85 to-transparent pointer-events-none",
      wheelFadeBottom: "sticky bottom-0 z-10 h-8 bg-gradient-to-t from-background via-background/85 to-transparent pointer-events-none",
      wheelInner: "flex flex-col items-center py-1",
      wheelSlot:
        "my-0.5 w-[88%] rounded-md py-2 text-center text-xs font-medium snap-center transition-colors",
      wheelSlotInactive: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
      durationTrigger:
        "w-full flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent",
      durationTriggerContent: "flex items-center gap-2 text-sm font-medium",
      chevron: "h-3.5 w-3.5 text-muted-foreground transition-transform",
      chipsWrapper: "space-y-2",
      chipsRow: "flex flex-wrap gap-1.5",
      customPanel: "flex items-center gap-2 rounded-lg border border-border bg-background/70 px-3 py-2",
      customInput: "h-8 w-24 rounded-md bg-background text-xs",
      customSuffix: "text-[11px] text-muted-foreground",
    } as const;
  }

  return {
    root: "space-y-2",
    label: "text-sm font-medium",
    trigger:
      "w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent/50",
    triggerOpen: "border-celestial-blue/35 bg-celestial-blue/10",
    triggerMuted: "border-dashed text-muted-foreground",
    triggerRow: "flex gap-2",
    triggerIcon: "h-4 w-4",
    panel: "space-y-2",
    input: "h-11 rounded-xl bg-background/60",
    wheel: "relative h-[180px] overflow-y-auto rounded-xl border border-border bg-background shadow-sm snap-y snap-mandatory",
    wheelFadeTop: "sticky top-0 z-10 h-10 bg-gradient-to-b from-background via-background/85 to-transparent pointer-events-none",
    wheelFadeBottom: "sticky bottom-0 z-10 h-10 bg-gradient-to-t from-background via-background/85 to-transparent pointer-events-none",
    wheelInner: "flex flex-col items-center py-1",
    wheelSlot:
      "my-0.5 w-[88%] rounded-lg py-2.5 text-center text-sm font-medium snap-center transition-colors",
    wheelSlotInactive: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
    durationTrigger:
      "w-full flex items-center justify-between rounded-xl border border-border bg-background/70 px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent/50",
    durationTriggerContent: "flex items-center gap-2.5 text-sm font-medium",
    chevron: "h-4 w-4 text-muted-foreground transition-transform",
    chipsWrapper: "space-y-2",
    chipsRow: "flex gap-2 flex-wrap",
    customPanel: "flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2",
    customInput: "h-10 w-28 rounded-lg bg-background text-sm",
    customSuffix: "text-xs text-muted-foreground",
  } as const;
}
