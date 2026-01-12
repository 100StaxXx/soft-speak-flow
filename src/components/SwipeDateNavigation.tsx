import { ReactNode, useState, useRef, useEffect } from "react";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { ChevronRight, Check } from "lucide-react";

interface SwipeDateNavigationProps {
  children: ReactNode;
  onNext: () => void;
}

export function SwipeDateNavigation({ children, onNext }: SwipeDateNavigationProps) {
  const x = useMotionValue(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [isPastThreshold, setIsPastThreshold] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const holdTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Increased thresholds for more deliberate swipes
  const SWIPE_THRESHOLD = 140;
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
  
  // Visual feedback - show arrow indicator on left side as user swipes right
  const arrowOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const arrowScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const backgroundGlow = useTransform(
    x, 
    [0, SWIPE_THRESHOLD], 
    ["hsl(var(--primary) / 0)", "hsl(var(--primary) / 0.1)"]
  );

  const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isNavigating) return;

    const pastThreshold = info.offset.x > SWIPE_THRESHOLD;

    if (pastThreshold && !isPastThreshold) {
      setIsPastThreshold(true);
      
      // Start hold timer
      holdTimerRef.current = setTimeout(async () => {
        setIsConfirmed(true);
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch (e) {
          // Haptics not available on web
        }
      }, HOLD_DURATION);
    } else if (!pastThreshold && isPastThreshold) {
      // User dragged back - cancel
      setIsPastThreshold(false);
      setIsConfirmed(false);
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }
  };
  
  const handleDragEnd = async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isNavigating) return;

    // Clear any pending timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    // Only execute action if user held long enough
    if (!isConfirmed) {
      setIsPastThreshold(false);
      return;
    }
    
    // Swipe RIGHT (positive x) = go to next day
    if (info.offset.x > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD) {
      setIsNavigating(true);
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } catch (e) {
        // Haptics not available on web
      }
      onNext();
      setTimeout(() => setIsNavigating(false), 300);
    }

    setIsPastThreshold(false);
    setIsConfirmed(false);
  };
  
  return (
    <div className="relative overflow-hidden">
      {/* Next day indicator (appears on left side during swipe right) */}
      <motion.div
        className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10"
        style={{ opacity: arrowOpacity, scale: arrowScale }}
      >
        <div className="relative w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          {isConfirmed ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <Check className="w-6 h-6 text-primary" />
            </motion.div>
          ) : (
            <ChevronRight className="w-6 h-6 text-primary" />
          )}
          {isPastThreshold && !isConfirmed && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-primary"
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.3, repeat: Infinity }}
            />
          )}
        </div>
        <span className="text-sm font-medium text-primary">
          {isConfirmed ? "Release!" : isPastThreshold ? "Hold..." : "Next Day"}
        </span>
      </motion.div>
      
      {/* Background glow effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: backgroundGlow }}
      />
      
      <motion.div
        drag={isNavigating ? false : "x"}
        dragConstraints={{ left: 0, right: DRAG_LIMIT }}
        dragElastic={0.15}
        dragDirectionLock
        style={{ x }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className="relative touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
