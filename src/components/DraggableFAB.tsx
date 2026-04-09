import { motion } from "framer-motion";
import { Mic, Plus } from "lucide-react";
import { useDraggableFAB } from "@/hooks/useDraggableFAB";
import { cn } from "@/lib/utils";

interface DraggableFABProps {
  onTap: () => void;
  onVoiceTap?: () => void;
}

export const DraggableFAB = ({ onTap, onVoiceTap }: DraggableFABProps) => {
  const {
    position,
    isDragging,
    isLongPressing,
    dragControls,
    longPressHandlers,
    positionStyles,
  } = useDraggableFAB();

  const canTriggerTap = !isDragging && !isLongPressing;
  const isLeftAligned = position === "top-left" || position === "bottom-left";

  const handleTouchStart = (event: React.TouchEvent) => {
    event.preventDefault();
  };

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: isDragging ? 1.15 : 1,
        opacity: 1,
      }}
      style={{
        position: "fixed",
        zIndex: 50,
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        ...positionStyles,
      }}
      className={cn(
        "flex touch-none select-none flex-col gap-2",
        isLeftAligned ? "items-start" : "items-end",
      )}
      {...dragControls}
      {...longPressHandlers}
    >
      {onVoiceTap ? (
        <button
          type="button"
          aria-label="Add quest with voice"
          data-testid="voice-quest-fab"
          onClick={() => {
            if (canTriggerTap) {
              onVoiceTap();
            }
          }}
          onTouchStart={handleTouchStart}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-primary/90 text-primary-foreground shadow-[0_12px_24px_rgba(83,76,255,0.28)] transition-colors hover:bg-primary touch-none select-none"
        >
          <Mic className="h-5 w-5" />
        </button>
      ) : null}

      <button
        type="button"
        data-tour="add-quest-fab"
        data-testid="manual-quest-fab"
        onClick={() => {
          if (canTriggerTap) {
            onTap();
          }
        }}
        onTouchStart={handleTouchStart}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-border/50 bg-muted/60 backdrop-blur-sm transition-colors hover:bg-muted/80 touch-none select-none"
        style={{
          boxShadow: isDragging
            ? "0 8px 30px rgba(0,0,0,0.3)"
            : "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        <Plus className="h-5 w-5 text-muted-foreground" />
      </button>
    </motion.div>
  );
};
