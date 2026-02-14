import { useState } from "react";
import { Plus, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuestDropZoneProps {
  isOver?: boolean;
  canDrop?: boolean;
  hasConflict?: boolean;
  onDrop: (e: React.DragEvent) => void;
  children?: React.ReactNode;
  time?: string;
  className?: string;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
}

export const QuestDropZone = ({
  isOver: _isOver,
  canDrop: _canDrop,
  hasConflict,
  onDrop,
  children,
  time: _time,
  className,
  onTouchStart,
  onTouchEnd,
  onMouseDown,
  onMouseUp,
  onMouseLeave: onMouseLeaveHandler
}: QuestDropZoneProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        onDrop(e);
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={() => {
        setIsDragOver(false);
        onMouseLeaveHandler?.();
      }}
      className={cn(
        "min-h-[80px] p-2 transition-all duration-300 relative overflow-hidden",
        isDragOver && !hasConflict && "bg-primary/10",
        isDragOver && hasConflict && "bg-destructive/10",
        !isDragOver && hasConflict && "bg-destructive/5",
        !isDragOver && !hasConflict && "hover:bg-muted/30",
        className
      )}
    >
      {/* Background animation on drag over */}
      {isDragOver && !hasConflict && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent animate-pulse" />
      )}

      {/* Drop hint */}
      {isDragOver && !children && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-primary animate-bounce">
            <Plus className="h-6 w-6" />
            <span className="text-xs font-medium">Drop quest here</span>
          </div>
        </div>
      )}

      {/* Sparkle effect on successful drop zone */}
      {isDragOver && !hasConflict && (
        <>
          <Sparkles className="absolute top-2 left-2 h-4 w-4 text-primary animate-pulse" />
          <Sparkles className="absolute bottom-2 right-2 h-4 w-4 text-primary animate-pulse" style={{ animationDelay: '300ms' }} />
        </>
      )}

      {/* Conflict warning */}
      {hasConflict && !isDragOver && (
        <div className="absolute top-1 right-1 bg-destructive/20 rounded-full p-1">
          <Target className="h-3 w-3 text-destructive" />
        </div>
      )}

      {children}
    </div>
  );
};
