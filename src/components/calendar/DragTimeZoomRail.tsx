import { cn } from "@/lib/utils";
import { DragZoomRailState } from "./dragSnap";

interface DragTimeZoomRailProps {
  rail: DragZoomRailState | null;
  className?: string;
}

const formatCenterTime = (minute: number) => {
  const hour24 = Math.floor(minute / 60);
  const mins = minute % 60;
  const hour12 = hour24 % 12 || 12;
  const suffix = hour24 >= 12 ? "PM" : "AM";
  return `${hour12}:${String(mins).padStart(2, "0")} ${suffix}`;
};

export function DragTimeZoomRail({ rail, className }: DragTimeZoomRailProps) {
  if (!rail) return null;

  return (
    <div
      data-testid="drag-time-zoom-rail"
      className={cn("pointer-events-none fixed right-3 z-[80]", className)}
      style={{ top: `${rail.clientY}px`, transform: "translateY(-50%)" }}
      aria-hidden
    >
      <div className="rounded-xl border border-border/70 bg-background/95 px-2 py-1.5 shadow-xl backdrop-blur">
        <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">
          {rail.mode === "fine" ? "Precision" : "Coarse"}
        </div>
        <div className="mb-1 text-center text-xs font-semibold text-primary">
          {formatCenterTime(rail.snappedMinute)}
        </div>
        <div className="space-y-0.5">
          {rail.ticks.map((tick) => (
            <div key={`${tick.minute}-${tick.label}`} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-px w-3",
                  tick.isCenter
                    ? "bg-primary"
                    : tick.isMajor
                      ? "bg-muted-foreground/60"
                      : "bg-muted-foreground/30",
                )}
              />
              <span
                className={cn(
                  "text-[10px] leading-none",
                  tick.isCenter
                    ? "font-semibold text-primary"
                    : tick.isMajor
                      ? "text-muted-foreground"
                      : "text-muted-foreground/70",
                )}
              >
                {tick.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
