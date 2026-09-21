import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

export type DailyChapterStatus = "unstarted" | "active" | "completed" | "reflected";

const CHAPTER_STEPS = [
  { key: "intention", label: "Intention" },
  { key: "action", label: "Action" },
  { key: "reflection", label: "Reflection" },
] as const;

const completedStepCount = (status: DailyChapterStatus): number => {
  if (status === "reflected") return 3;
  if (status === "completed") return 2;
  if (status === "active") return 1;
  return 0;
};

export function DailyChapterConstellation({
  status,
  compact = false,
}: {
  status: DailyChapterStatus;
  compact?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const completed = completedStepCount(status);

  return (
    <div
      className={cn("rounded-2xl border border-cyan-200/10 bg-black/15", compact ? "px-3 py-3" : "px-4 py-3.5")}
      role="img"
      aria-label={`Daily Chapter: ${completed} of 3 steps complete`}
    >
      <div className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2" aria-hidden="true">
        {CHAPTER_STEPS.map((step, index) => {
          const isLit = index < completed;
          return (
            <div key={step.key} className="contents">
              <motion.span
                initial={false}
                animate={isLit && !prefersReducedMotion
                  ? { scale: [1, 1.16, 1], boxShadow: "0 0 18px rgba(103,232,249,0.72)" }
                  : { scale: 1, boxShadow: isLit ? "0 0 12px rgba(103,232,249,0.5)" : "none" }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={cn(
                  "h-3 w-3 rounded-full border",
                  isLit
                    ? "border-cyan-100 bg-cyan-200"
                    : "border-white/25 bg-white/[0.04]",
                )}
              />
              {index < CHAPTER_STEPS.length - 1 ? (
                <span className="relative h-px overflow-hidden bg-white/10">
                  <motion.span
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-200 to-violet-300"
                    initial={false}
                    animate={{ width: index + 1 < completed ? "100%" : "0%" }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: "easeOut" }}
                  />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {!compact ? (
        <div className="mt-2 grid grid-cols-3 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {CHAPTER_STEPS.map((step, index) => (
            <span key={step.key} className={cn(index === 1 && "text-center", index === 2 && "text-right", index < completed && "text-cyan-100/85")}>
              {step.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
