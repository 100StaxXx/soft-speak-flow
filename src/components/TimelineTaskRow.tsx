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

export function TimelineTaskRow({
  time,
  overrideTime,
  label,
  rowKind = "task",
  tone = "default",
  durationMinutes: _durationMinutes,
  laneIndex = 0,
  laneCount = 1,
  overlapCount = 0,
  showLine: _showLine = true,
  isLast: _isLast = false,
  isDragTarget = false,
  className,
  children,
  ...rootProps
}: TimelineTaskRowProps) {
  const displayTime = overrideTime ?? time;
  const isOverridden = overrideTime != null;
  const isNowTone = tone === "now";
  const isTaskRow = rowKind === "task";
  const isMarkerRow = rowKind === "marker";
  const showTimelineMetadata = isTaskRow && !!displayTime;

  return (
    <div
      className={cn("relative flex gap-2", isDragTarget && "rounded-lg", className)}
      data-timeline-lane={showTimelineMetadata ? laneIndex : undefined}
      data-timeline-lane-count={showTimelineMetadata ? laneCount : undefined}
      data-timeline-overlap={showTimelineMetadata ? overlapCount : undefined}
      {...rootProps}
    >
      {/* Time label column - fixed width */}
      <div className={cn("w-9 flex-shrink-0 text-left", isMarkerRow ? "pt-[8px]" : "pt-[22px]")}>
        {displayTime ? (
          <span className={cn(
            isMarkerRow ? "text-[9px]" : "text-[10px]",
            "font-medium leading-none transition-colors",
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

      {/* Task card */}
      <div className={cn("flex-1 min-w-0", isMarkerRow ? "py-0" : "py-1")}>
        {children}
      </div>
    </div>
  );
}
