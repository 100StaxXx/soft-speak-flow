import { memo } from "react";

import { cn } from "@/lib/utils";
import {
  COMPANION_PLANNING_MODE_OPTIONS,
  type CompanionPlanningMode,
} from "@/shared/companionPlanningMode";

type CompanionPlanningModeSelectorVariant = "journeys" | "companion";

interface CompanionPlanningModeSelectorProps {
  mode: CompanionPlanningMode;
  onChange: (mode: CompanionPlanningMode) => void;
  variant: CompanionPlanningModeSelectorVariant;
  className?: string;
}

const variantStyles = {
  journeys: {
    shell:
      "rounded-[1.5rem] border-[3px] border-[#4d2811] bg-[linear-gradient(180deg,rgba(255,247,229,0.9),rgba(255,218,144,0.88))] px-4 py-3 shadow-[0_8px_0_rgba(77,40,17,0.8),0_18px_34px_-28px_rgba(36,12,4,0.42)]",
    label:
      "text-[0.68rem] font-black uppercase tracking-[0.18em] text-[#8b4d1d]",
    hint: "text-sm text-[#6d3518]",
    button:
      "rounded-full border-[2px] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition-transform hover:-translate-y-0.5",
    idleButton:
      "border-[#7a4a21] bg-white/60 text-[#7a4a21]",
    activeButton:
      "border-[#4d2811] bg-[linear-gradient(180deg,#fff8ea_0%,#ffd36d_100%)] text-[#4d2811] shadow-[0_4px_0_rgba(77,40,17,0.72)]",
  },
  companion: {
    shell:
      "rounded-[1.35rem] border border-white/10 bg-white/[0.05] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
    label:
      "text-[0.68rem] font-black uppercase tracking-[0.18em] text-white/55",
    hint: "text-sm text-white/70",
    button:
      "rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] transition-transform hover:-translate-y-0.5",
    idleButton:
      "border-white/10 bg-white/[0.04] text-white/70",
    activeButton:
      "border-emerald-300/30 bg-emerald-400/15 text-emerald-50 shadow-[0_0_0_1px_rgba(110,231,183,0.08)]",
  },
} as const;

export const CompanionPlanningModeSelector = memo(
  function CompanionPlanningModeSelector({
    mode,
    onChange,
    variant,
    className,
  }: CompanionPlanningModeSelectorProps) {
    const styles = variantStyles[variant];

    return (
      <div
        className={cn(styles.shell, className)}
        data-testid="companion-planning-mode-selector"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className={styles.label}>Day Mode</p>
            <p className={cn("mt-1", styles.hint)}>
              Tell Cosmiq how hard today should push.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {COMPANION_PLANNING_MODE_OPTIONS.map((option) => {
              const active = option.id === mode;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    styles.button,
                    active ? styles.activeButton : styles.idleButton,
                  )}
                  onClick={() => onChange(option.id)}
                  aria-pressed={active}
                  data-testid={`companion-planning-mode-${option.id}`}
                  title={option.description}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
);
