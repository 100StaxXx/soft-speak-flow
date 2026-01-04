import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { useDraggableFAB } from "@/hooks/useDraggableFAB";

interface DraggableFABProps {
  onTap: () => void;
}

export const DraggableFAB = ({ onTap }: DraggableFABProps) => {
  const {
    isDragging,
    isLongPressing,
    dragControls,
    longPressHandlers,
    positionStyles,
  } = useDraggableFAB();

  const handleClick = () => {
    // Only trigger tap if not dragging
    if (!isDragging && !isLongPressing) {
      onTap();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Prevent iOS text selection callout
    e.preventDefault();
  };

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: isDragging ? 1.15 : 1, 
        opacity: 1,
        boxShadow: isDragging 
          ? '0 8px 30px rgba(0,0,0,0.3)' 
          : '0 2px 8px rgba(0,0,0,0.1)'
      }}
      whileTap={!isLongPressing ? { scale: 0.9 } : undefined}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      style={{
        position: 'fixed',
        zIndex: 50,
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
        ...positionStyles,
      }}
      className="w-11 h-11 rounded-full bg-muted/60 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-muted/80 transition-colors touch-none select-none"
      {...dragControls}
      {...longPressHandlers}
    >
      <Plus className="w-5 h-5 text-muted-foreground" />
    </motion.button>
  );
};
