import { ReactNode, useState } from "react";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Trash2, CalendarArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

interface SwipeableTaskItemProps {
  children: ReactNode;
  onSwipeDelete: () => void;
  onSwipeMoveToNextDay?: () => void;
  disabled?: boolean;
}

const THRESHOLD = 100;
const VELOCITY_THRESHOLD = 800;
const DRAG_LIMIT = 160;

const triggerHaptic = async (style: ImpactStyle) => {
  try {
    await Haptics.impact({ style });
  } catch {}
};

export function SwipeableTaskItem({
  children,
  onSwipeDelete,
  onSwipeMoveToNextDay,
  disabled = false,
}: SwipeableTaskItemProps) {
  const x = useMotionValue(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [hasTriggeredHaptic, setHasTriggeredHaptic] = useState(false);

  // Delete (left swipe) transforms
  const deleteOpacity = useTransform(x, [-THRESHOLD, -40, 0], [1, 0.3, 0]);
  const deleteScale = useTransform(x, [-THRESHOLD, -40, 0], [1, 0.7, 0.5]);
  const backgroundRed = useTransform(
    x,
    [-THRESHOLD, 0],
    ["hsl(0 84% 60% / 0.15)", "hsl(var(--background))"]
  );

  // Move to next day (right swipe) transforms
  const moveOpacity = useTransform(x, [0, 40, THRESHOLD], [0, 0.3, 1]);
  const moveScale = useTransform(x, [0, 40, THRESHOLD], [0.5, 0.7, 1]);
  const backgroundBlue = useTransform(
    x,
    [0, THRESHOLD],
    ["hsl(var(--background))", "hsl(var(--primary) / 0.15)"]
  );

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled || isDeleting || isMoving) return;

    const pastThreshold =
      info.offset.x < -THRESHOLD ||
      (info.offset.x > THRESHOLD && onSwipeMoveToNextDay);

    if (pastThreshold && !hasTriggeredHaptic) {
      setHasTriggeredHaptic(true);
      triggerHaptic(ImpactStyle.Medium);
    } else if (!pastThreshold && hasTriggeredHaptic) {
      setHasTriggeredHaptic(false);
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled || isDeleting || isMoving) return;
    setHasTriggeredHaptic(false);

    const swipedLeft =
      info.offset.x < -THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD;
    const swipedRight =
      (info.offset.x > THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) &&
      onSwipeMoveToNextDay;

    if (swipedLeft) {
      setIsDeleting(true);
      triggerHaptic(ImpactStyle.Heavy);
      setTimeout(() => onSwipeDelete(), 200);
    } else if (swipedRight) {
      setIsMoving(true);
      triggerHaptic(ImpactStyle.Heavy);
      setTimeout(() => onSwipeMoveToNextDay!(), 200);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Move to next day background (right swipe) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-start pl-5"
        style={{ opacity: moveOpacity, background: backgroundBlue }}
      >
        <motion.div className="flex items-center gap-2" style={{ scale: moveScale }}>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <CalendarArrowUp className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="text-primary font-semibold text-sm">Tomorrow</span>
        </motion.div>
      </motion.div>

      {/* Delete background (left swipe) */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end pr-5"
        style={{ opacity: deleteOpacity, background: backgroundRed }}
      >
        <motion.div className="flex items-center gap-2" style={{ scale: deleteScale }}>
          <span className="text-red-500 font-semibold text-sm">Delete</span>
          <div className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center">
            <Trash2 className="w-4.5 h-4.5 text-white" />
          </div>
        </motion.div>
      </motion.div>

      {/* Draggable content */}
      <motion.div
        drag={disabled || isDeleting || isMoving ? false : "x"}
        dragConstraints={{
          left: -DRAG_LIMIT,
          right: onSwipeMoveToNextDay ? DRAG_LIMIT : 0,
        }}
        dragElastic={0.1}
        dragDirectionLock
        dragSnapToOrigin={!isDeleting && !isMoving}
        style={{ x }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={
          isDeleting
            ? { x: -500, opacity: 0 }
            : isMoving
              ? { x: 500, opacity: 0 }
              : {}
        }
        transition={
          isDeleting || isMoving
            ? { duration: 0.2, ease: "easeOut" }
            : {}
        }
        className={cn(
          "relative",
          !disabled && !isDeleting && !isMoving && "cursor-grab active:cursor-grabbing"
        )}
      >
        {children}
      </motion.div>
    </div>
  );
}
