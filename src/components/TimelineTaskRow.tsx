import { cn } from "@/lib/utils";

interface TimelineTaskRowProps {
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
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

export function TimelineTaskRow({
  time,
  overrideTime,
  label,
  showLine = true,
  isLast = false,
  isDragTarget = false,
  children,
}: TimelineTaskRowProps) {
  const displayTime = overrideTime ?? time;
  const isOverridden = overrideTime != null;

  return (
    <div className={cn("relative flex gap-3", isDragTarget && "rounded-2xl bg-black/30")}>
      {/* Time label column - fixed width */}
      <div className="w-[84px] flex-shrink-0 pt-[18px] text-left">
        {displayTime ? (
          <span className={cn(
            "text-[16px] italic leading-none transition-colors",
            isOverridden
              ? "text-white font-semibold"
              : "text-white/70"
          )}>
            {formatTime12h(displayTime)}
          </span>
        ) : label ? (
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
            {label}
          </span>
        ) : null}
      </div>

      {/* Timeline dot + line */}
      <div className="relative flex flex-col items-center flex-shrink-0 w-6">
        {/* Top segment of line */}
        {showLine && (
          <div className="w-px flex-1 border-l border-dashed border-[#ef8a8a]/60 min-h-[8px]" />
        )}
        {!showLine && <div className="flex-1 min-h-[8px]" />}
        
        {/* Dot */}
        <div className={cn(
          "w-3.5 h-3.5 rounded-full flex-shrink-0 z-10 border",
          time 
            ? "bg-[#ef8a8a] border-[#ef8a8a] ring-4 ring-[#ef8a8a]/30" 
            : "bg-transparent border-white/35"
        )} />
        
        {/* Bottom segment of line */}
        {!isLast ? (
          <div className="w-px flex-1 border-l border-dashed border-[#ef8a8a]/60 min-h-[8px]" />
        ) : (
          <div className="flex-1 min-h-[8px]" />
        )}
      </div>

      {/* Task card */}
      <div className="flex-1 min-w-0 py-1.5">
        {children}
      </div>
    </div>
  );
}
