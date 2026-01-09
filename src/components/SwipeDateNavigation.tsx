import { ReactNode, useState } from "react";
import { motion, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { ChevronRight } from "lucide-react";

interface SwipeDateNavigationProps {
  children: ReactNode;
  onNext: () => void;
}

export function SwipeDateNavigation({ children, onNext }: SwipeDateNavigationProps) {
  const x = useMotionValue(0);
  const [isNavigating, setIsNavigating] = useState(false);
  
  const SWIPE_THRESHOLD = 100;
  const VELOCITY_THRESHOLD = 500;
  const DRAG_LIMIT = 120;
  
  // Visual feedback - show arrow indicator on left side as user swipes right
  const arrowOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const arrowScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const backgroundGlow = useTransform(
    x, 
    [0, SWIPE_THRESHOLD], 
    ["hsl(var(--primary) / 0)", "hsl(var(--primary) / 0.1)"]
  );
  
  const handleDragEnd = async (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isNavigating) return;
    
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
  };
  
  return (
    <div className="relative overflow-hidden">
      {/* Next day indicator (appears on left side during swipe right) */}
      <motion.div
        className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pointer-events-none z-10"
        style={{ opacity: arrowOpacity, scale: arrowScale }}
      >
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <ChevronRight className="w-6 h-6 text-primary" />
        </div>
        <span className="text-sm font-medium text-primary">Next Day</span>
      </motion.div>
      
      {/* Background glow effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: backgroundGlow }}
      />
      
      <motion.div
        drag={isNavigating ? false : "x"}
        dragConstraints={{ left: 0, right: DRAG_LIMIT }}
        dragElastic={0.3}
        dragDirectionLock
        style={{ x }}
        onDragEnd={handleDragEnd}
        className="relative touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
}
