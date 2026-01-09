import { ReactNode, useState } from "react";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Trash2, CalendarArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableTaskItemProps {
  children: ReactNode;
  onSwipeDelete: () => void;
  onSwipeMoveToNextDay?: () => void;
  disabled?: boolean;
}

export function SwipeableTaskItem({
  children,
  onSwipeDelete,
  onSwipeMoveToNextDay,
  disabled = false,
}: SwipeableTaskItemProps) {
  const x = useMotionValue(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  
  const THRESHOLD = 100;
  const VELOCITY_THRESHOLD = 500;
  const DRAG_LIMIT = 120;

  // Transform values for visual feedback - Delete (left swipe)
  const deleteOpacity = useTransform(x, [-THRESHOLD, 0], [1, 0]);
  const deleteScale = useTransform(x, [-THRESHOLD, 0], [1, 0.5]);
  const backgroundRed = useTransform(
    x, 
    [-THRESHOLD, 0], 
    ["hsl(0 84% 60% / 0.15)", "hsl(var(--background))"]
  );

  // Transform values for visual feedback - Move to next day (right swipe)
  const moveOpacity = useTransform(x, [0, THRESHOLD], [0, 1]);
  const moveScale = useTransform(x, [0, THRESHOLD], [0.5, 1]);
  const backgroundBlue = useTransform(
    x, 
    [0, THRESHOLD], 
    ["hsl(var(--background))", "hsl(var(--primary) / 0.15)"]
  );

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled || isDeleting || isMoving) return;

    const swipedLeft = info.offset.x < -THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD;
    const swipedRight = info.offset.x > THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD;

    if (swipedLeft) {
      setIsDeleting(true);
      setTimeout(() => {
        onSwipeDelete();
      }, 200);
    } else if (swipedRight && onSwipeMoveToNextDay) {
      setIsMoving(true);
      setTimeout(() => {
        onSwipeMoveToNextDay();
      }, 200);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Move to next day action background (right swipe) - Primary/Blue */}
      <motion.div
        className="absolute inset-0 flex items-center justify-start pl-5"
        style={{ 
          opacity: moveOpacity,
          background: backgroundBlue 
        }}
      >
        <motion.div 
          className="flex items-center gap-2"
          style={{ scale: moveScale }}
        >
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            <CalendarArrowUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-primary font-semibold text-sm">Tomorrow</span>
        </motion.div>
      </motion.div>

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
        drag={disabled || isDeleting || isMoving ? false : "x"}
        dragConstraints={{ left: -DRAG_LIMIT, right: onSwipeMoveToNextDay ? DRAG_LIMIT : 0 }}
        dragElastic={0.3}
        style={{ x }}
        onDragEnd={handleDragEnd}
        animate={
          isDeleting 
            ? { x: -500, opacity: 0 } 
            : isMoving 
              ? { x: 500, opacity: 0 } 
              : {}
        }
        transition={isDeleting || isMoving ? { duration: 0.2, ease: "easeOut" } : {}}
        className={cn(
          "relative touch-pan-y",
          !disabled && !isDeleting && !isMoving && "cursor-grab active:cursor-grabbing"
        )}
        whileTap={disabled || isDeleting || isMoving ? {} : { scale: 0.99 }}
      >
        {children}
      </motion.div>
    </div>
  );
}
