import { cn } from "@/lib/utils";

interface TimelineTaskRowProps {
  time?: string | null;
  showLine?: boolean;
  isLast?: boolean;
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

export function TimelineTaskRow({ time, showLine = true, isLast = false, children }: TimelineTaskRowProps) {
  return (
    <div className="relative flex gap-2">
      {/* Time label column - fixed width */}
      <div className="w-9 flex-shrink-0 pt-[26px] text-left">
        {time && (
          <span className="text-[10px] font-medium text-muted-foreground leading-none">
            {formatTime12h(time)}
          </span>
        )}
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
