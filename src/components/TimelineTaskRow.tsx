import { cn } from "@/lib/utils";

interface TimelineTaskRowProps extends React.HTMLAttributes<HTMLDivElement> {
  time?: string | null;
  overrideTime?: string | null;
  label?: string | null;
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
  showLine = true,
  isLast = false,
  isDragTarget = false,
  className,
  children,
  ...rootProps
}: TimelineTaskRowProps) {
  const displayTime = overrideTime ?? time;
  const isOverridden = overrideTime != null;

  return (
    <div
      className={cn("relative flex gap-2", isDragTarget && "rounded-lg", className)}
      {...rootProps}
    >
      {/* Time label column - fixed width */}
      <div className="w-9 flex-shrink-0 pt-[22px] text-left">
        {displayTime ? (
          <span className={cn(
            "text-[10px] font-medium leading-none transition-colors",
            isOverridden
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

      {/* Timeline dot + line */}
      <div className="relative flex flex-col items-center flex-shrink-0 w-3">
        {/* Top segment of line */}
        {showLine && (
          <div className="w-px flex-1 border-l border-dashed border-border/50 min-h-[8px]" />
        )}
        {!showLine && <div className="flex-1 min-h-[8px]" />}
        
        {/* Dot */}
        <div className={cn(
          "w-2 h-2 rounded-full flex-shrink-0 z-10",
          time 
            ? "bg-primary/70 ring-2 ring-primary/20" 
            : "bg-muted-foreground/40 ring-2 ring-muted/30"
        )} />
        
        {/* Bottom segment of line */}
        {!isLast ? (
          <div className="w-px flex-1 border-l border-dashed border-border/50 min-h-[8px]" />
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
