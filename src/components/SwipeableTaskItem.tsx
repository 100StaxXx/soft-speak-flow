import { ReactNode, useState, useRef, useEffect } from "react";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Trash2, CalendarArrowUp, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

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
  const [isPastThreshold, setIsPastThreshold] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Increased thresholds for more deliberate swipes
  const THRESHOLD = 140;
  const VELOCITY_THRESHOLD = 1000;
  const DRAG_LIMIT = 180;
  const HOLD_DURATION = 300; // milliseconds to hold at threshold

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

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

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled || isDeleting || isMoving) return;

    const pastLeft = info.offset.x < -THRESHOLD;
    const pastRight = info.offset.x > THRESHOLD && onSwipeMoveToNextDay;
    const direction = pastLeft ? 'left' : pastRight ? 'right' : null;

    if ((pastLeft || pastRight) && !isPastThreshold) {
      setIsPastThreshold(true);
      setSwipeDirection(direction);
      
      // Start hold timer
      holdTimerRef.current = setTimeout(async () => {
        setIsConfirmed(true);
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch (e) {
          // Haptics not available on web
        }
      }, HOLD_DURATION);
    } else if (!pastLeft && !pastRight && isPastThreshold) {
      // User dragged back - cancel
      setIsPastThreshold(false);
      setIsConfirmed(false);
      setSwipeDirection(null);
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled || isDeleting || isMoving) return;

    // Clear any pending timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // Only execute action if user held long enough
    if (!isConfirmed) {
      setIsPastThreshold(false);
      setSwipeDirection(null);
      return;
    }

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

    setIsPastThreshold(false);
    setIsConfirmed(false);
    setSwipeDirection(null);
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
          <div className="relative w-10 h-10 rounded-full bg-primary flex items-center justify-center">
            {isConfirmed && swipeDirection === 'right' ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Check className="w-5 h-5 text-primary-foreground" />
              </motion.div>
            ) : (
              <CalendarArrowUp className="w-5 h-5 text-primary-foreground" />
            )}
            {isPastThreshold && !isConfirmed && swipeDirection === 'right' && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-primary-foreground"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 0.3, repeat: Infinity }}
              />
            )}
          </div>
          <span className="text-primary font-semibold text-sm">
            {isConfirmed && swipeDirection === 'right' 
              ? "Release!" 
              : isPastThreshold && swipeDirection === 'right'
                ? "Hold..."
                : "Tomorrow"}
          </span>
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
          <span className="text-red-500 font-semibold text-sm">
            {isConfirmed && swipeDirection === 'left'
              ? "Release!"
              : isPastThreshold && swipeDirection === 'left'
                ? "Hold..."
                : "Delete"}
          </span>
          <div className="relative w-10 h-10 rounded-full bg-red-500 flex items-center justify-center">
            {isConfirmed && swipeDirection === 'left' ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
              >
                <Check className="w-6 h-6 text-white" />
              </motion.div>
            ) : (
              <Trash2 className="w-6 h-6 text-white" />
            )}
            {isPastThreshold && !isConfirmed && swipeDirection === 'left' && (
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white"
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 0.3, repeat: Infinity }}
              />
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Draggable task content */}
      <motion.div
        drag={disabled || isDeleting || isMoving ? false : "x"}
        dragConstraints={{ left: -DRAG_LIMIT, right: onSwipeMoveToNextDay ? DRAG_LIMIT : 0 }}
        dragElastic={0.15}
        dragDirectionLock
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
