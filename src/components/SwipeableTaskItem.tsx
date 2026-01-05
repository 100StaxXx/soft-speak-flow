import { ReactNode, useState } from "react";
import { motion, PanInfo, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableTaskItemProps {
  children: ReactNode;
  onSwipeDelete: () => void;
  disabled?: boolean;
}

export function SwipeableTaskItem({
  children,
  onSwipeDelete,
  disabled = false,
}: SwipeableTaskItemProps) {
  const x = useMotionValue(0);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const DELETE_THRESHOLD = 100;
  const VELOCITY_THRESHOLD = 500;
  const DRAG_LIMIT = 120;

  // Transform values for visual feedback - Delete (left swipe)
  const deleteOpacity = useTransform(x, [-DELETE_THRESHOLD, 0], [1, 0]);
  const deleteScale = useTransform(x, [-DELETE_THRESHOLD, 0], [1, 0.5]);
  const backgroundRed = useTransform(
    x, 
    [-DELETE_THRESHOLD, 0], 
    ["hsl(0 84% 60% / 0.15)", "hsl(var(--background))"]
  );

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled || isDeleting) return;

    const swipedLeft = info.offset.x < -DELETE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD;

    if (swipedLeft) {
      setIsDeleting(true);
      setTimeout(() => {
        onSwipeDelete();
      }, 200);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Delete action background (left swipe) - Red */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-5"
        style={{ 
          opacity: deleteOpacity,
          background: backgroundRed 
        }}
      >
        <motion.div 
          className="flex items-center gap-2"
          style={{ scale: deleteScale }}
        >
          <span className="text-red-500 font-semibold text-sm">Delete</span>
          <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
            <Trash2 className="w-6 h-6 text-white" />
          </div>
        </motion.div>
      </motion.div>

      {/* Draggable task content */}
      <motion.div
        drag={disabled || isDeleting ? false : "x"}
        dragConstraints={{ left: -DRAG_LIMIT, right: 0 }}
        dragElastic={0.3}
        style={{ x }}
        onDragEnd={handleDragEnd}
        animate={isDeleting ? { x: -500, opacity: 0 } : {}}
        transition={isDeleting ? { duration: 0.2, ease: "easeOut" } : {}}
        className={cn(
          "relative touch-pan-y",
          !disabled && !isDeleting && "cursor-grab active:cursor-grabbing"
        )}
        whileTap={disabled || isDeleting ? {} : { scale: 0.99 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
