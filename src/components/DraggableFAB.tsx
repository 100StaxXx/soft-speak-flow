import { motion } from "framer-motion";
import { JourneysCompanionLauncher } from "@/components/journeys/JourneysCompanionLauncher";
import { useDraggableFAB } from "@/hooks/useDraggableFAB";
import { cn } from "@/lib/utils";

interface DraggableFABProps {
  onOpenCompanionPlanner: () => void;
}

export const DraggableFAB = ({ onOpenCompanionPlanner }: DraggableFABProps) => {
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
      <JourneysCompanionLauncher
        variant="floating"
        aria-label="Open companion planner"
        data-tour="add-quest-fab"
        data-testid="journeys-companion-launcher-floating"
        onClick={() => {
          if (canTriggerTap) {
            onOpenCompanionPlanner();
          }
        }}
        onTouchStart={handleTouchStart}
        className="touch-none select-none"
        style={{
          boxShadow: isDragging
            ? "0 8px 30px rgba(0,0,0,0.3)"
            : "0 2px 8px rgba(0,0,0,0.1)",
        }}
      />
    </motion.div>
  );
};
