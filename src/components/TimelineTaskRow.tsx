import { cn } from "@/lib/utils";

interface TimelineTaskRowProps extends React.HTMLAttributes<HTMLDivElement> {
  time?: string | null;
  overrideTime?: string | null;
  label?: string | null;
  rowKind?: "task" | "marker";
  tone?: "default" | "now";
  durationMinutes?: number | null;
  laneIndex?: number;
  laneCount?: number;
  overlapCount?: number;
  showLine?: boolean;
  isLast?: boolean;
  isDragTarget?: boolean;
  children: React.ReactNode;
}

// Format "HH:mm" to "9:30 AM"
const formatTime12h = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'p' : 'a';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes}${ampm}`;
};

const clamp = (value: number, min: number, max: number) => {
  return Math.min(max, Math.max(min, value));
};

export function TimelineTaskRow({
  time,
  overrideTime,
  label,
  rowKind = "task",
  tone = "default",
  durationMinutes,
  laneIndex = 0,
  laneCount = 1,
  overlapCount = 0,
  showLine = true,
  isLast = false,
  isDragTarget = false,
  className,
  children,
  ...rootProps
}: TimelineTaskRowProps) {
  const displayTime = overrideTime ?? time;
  const isOverridden = overrideTime != null;
  const isNowTone = tone === "now";
  const isTaskRow = rowKind === "task";
  const isScheduledTaskRow = isTaskRow && !!displayTime;
  const effectiveDurationMinutes = Number.isFinite(durationMinutes) && (durationMinutes ?? 0) > 0
    ? Number(durationMinutes)
    : 30;
  const durationHeightPx = clamp(Math.round((effectiveDurationMinutes / 30) * 18), 16, 72);
  const visualLaneCount = clamp(
    Number.isFinite(laneCount) ? Math.round(Number(laneCount)) : 1,
    1,
    4,
  );
  const visualLaneIndex = clamp(
    Number.isFinite(laneIndex) ? Math.round(Number(laneIndex)) : 0,
    0,
    visualLaneCount - 1,
  );
  const durationWidthPx = (visualLaneCount * 4) + ((visualLaneCount - 1) * 1) + 4;
  const hasOverlap = overlapCount > 0;
  const hasMultipleLanes = laneCount > 1;
  const connectorClass = isScheduledTaskRow
    ? cn(
        "w-[2px] flex-1 min-h-[8px] rounded-full",
        isNowTone ? "bg-stardust-gold/45" : "bg-primary/35",
      )
    : "w-px flex-1 border-l border-dashed border-border/50 min-h-[8px]";

  return (
    <div
      className={cn("relative flex gap-2", isDragTarget && "rounded-lg", className)}
      data-timeline-lane={displayTime ? laneIndex : undefined}
      data-timeline-lane-count={displayTime ? laneCount : undefined}
      data-timeline-overlap={displayTime ? overlapCount : undefined}
      {...rootProps}
    >
      {/* Time label column - fixed width */}
      <div className="w-9 flex-shrink-0 pt-[22px] text-left">
        {displayTime ? (
          <span className={cn(
            "text-[10px] font-medium leading-none transition-colors",
            isNowTone
              ? "font-semibold text-stardust-gold"
              : isOverridden
              ? "text-primary font-bold"
              : "text-muted-foreground"
          )}>
            {formatTime12h(displayTime)}
          </span>
        ) : label ? (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/80">
            {label}
          </span>
        ) : null}
      </div>

      {/* Timeline column */}
      <div className={cn("relative flex flex-col items-center flex-shrink-0", isScheduledTaskRow ? "w-7" : "w-5")}>
        {/* Top segment of line */}
        {showLine && <div className={connectorClass} />}
        {!showLine && <div className="flex-1 min-h-[8px]" />}

        {/* Task duration rail */}
        {isScheduledTaskRow ? (
          <div
            className={cn(
              "relative mt-1 mb-1 overflow-hidden rounded-full border",
              isNowTone
                ? "border-stardust-gold/45 bg-stardust-gold/12 shadow-[0_0_0_1px_rgba(225,177,59,0.14)]"
                : hasOverlap
                ? "border-primary/45 bg-primary/20"
                : hasMultipleLanes
                  ? "border-primary/35 bg-primary/15"
                  : "border-primary/30 bg-primary/10",
            )}
            style={{
              height: `${durationHeightPx}px`,
              width: `${durationWidthPx}px`,
            }}
            data-testid="timeline-duration-indicator"
            data-duration-minutes={effectiveDurationMinutes}
            data-duration-height={durationHeightPx}
            data-duration-width={durationWidthPx}
            data-duration-lane-count={visualLaneCount}
            data-duration-lane-index={visualLaneIndex}
            aria-hidden
          >
            <div className="absolute inset-[2px] flex gap-px">
              {Array.from({ length: visualLaneCount }).map((_, lane) => {
                const isActiveLane = lane === visualLaneIndex;
                return (
                  <span
                    key={lane}
                    className={cn(
                      "flex-1 rounded-full",
                      isActiveLane
                        ? isNowTone
                          ? "bg-stardust-gold/95"
                          : "bg-primary/85"
                        : isNowTone
                          ? "bg-stardust-gold/25"
                          : "bg-primary/25",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "w-2 h-2 rounded-full flex-shrink-0 z-10",
              isNowTone
                ? "bg-stardust-gold ring-2 ring-stardust-gold/30"
                : time
                  ? "bg-primary/70 ring-2 ring-primary/20"
                  : "bg-muted-foreground/40 ring-2 ring-muted/30",
            )}
          />
        )}

        {/* Bottom segment of line */}
        {!isLast ? (
          <div className={connectorClass} />
        ) : (
          <div className="flex-1 min-h-[8px]" />
        )}
      </div>

      {/* Task card */}
      <div className="flex-1 min-w-0 py-1">
        {children}
      </div>
    </div>
  );
}
