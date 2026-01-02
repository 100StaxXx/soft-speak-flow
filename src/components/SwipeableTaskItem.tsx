import { ReactNode, useState } from "react";
import { motion, PanInfo, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import { Check, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableTaskItemProps {
  children: ReactNode;
  onSwipeComplete: () => void;
  onSwipeUndo?: () => void;
  isComplete: boolean;
  disabled?: boolean;
  xpReward?: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
}

export function SwipeableTaskItem({
  children,
  onSwipeComplete,
  onSwipeUndo,
  isComplete,
  disabled = false,
  xpReward = 0,
}: SwipeableTaskItemProps) {
  const x = useMotionValue(0);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showXpBurst, setShowXpBurst] = useState(false);
  
  const SWIPE_THRESHOLD = 80;
  const VELOCITY_THRESHOLD = 500;
  const DRAG_LIMIT = 120;

  // Transform values for visual feedback
  const completeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
  const undoOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);
  const completeScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.5, 1]);
  const undoScale = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0.5]);
  const backgroundGreen = useTransform(
    x, 
    [0, SWIPE_THRESHOLD], 
    ["hsl(var(--background))", "hsl(142 76% 36% / 0.15)"]
  );
  const backgroundOrange = useTransform(
    x, 
    [-SWIPE_THRESHOLD, 0], 
    ["hsl(25 95% 53% / 0.15)", "hsl(var(--background))"]
  );

  const spawnParticles = () => {
    const newParticles: Particle[] = Array.from({ length: 8 }, (_, i) => ({
      id: Date.now() + i,
      x: (Math.random() - 0.5) * 80,
      y: Math.random() * -50 - 10,
    }));
    setParticles(newParticles);
    setShowXpBurst(true);
    setTimeout(() => {
      setParticles([]);
      setShowXpBurst(false);
    }, 800);
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled) return;

    const swipedRight = info.offset.x > SWIPE_THRESHOLD || info.velocity.x > VELOCITY_THRESHOLD;
    const swipedLeft = info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -VELOCITY_THRESHOLD;

    if (swipedRight && !isComplete) {
      spawnParticles();
      onSwipeComplete();
    } else if (swipedLeft && isComplete && onSwipeUndo) {
      onSwipeUndo();
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Complete action background (right swipe) - Green */}
      <motion.div
        className="absolute inset-0 flex items-center pl-5"
        style={{ 
          opacity: completeOpacity,
          background: backgroundGreen 
        }}
      >
        <motion.div 
          className="flex items-center gap-2"
          style={{ scale: completeScale }}
        >
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
            <Check className="w-6 h-6 text-white" />
          </div>
          <span className="text-green-500 font-semibold text-sm">Complete</span>
        </motion.div>
      </motion.div>

      {/* Undo action background (left swipe) - Orange */}
      {isComplete && onSwipeUndo && (
        <motion.div
          className="absolute inset-0 flex items-center justify-end pr-5"
          style={{ 
            opacity: undoOpacity,
            background: backgroundOrange 
          }}
        >
          <motion.div 
            className="flex items-center gap-2"
            style={{ scale: undoScale }}
          >
            <span className="text-orange-500 font-semibold text-sm">Undo</span>
            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
              <Undo2 className="w-6 h-6 text-white" />
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Draggable task content */}
      <motion.div
        drag={disabled ? false : "x"}
        dragConstraints={{ left: isComplete ? -DRAG_LIMIT : 0, right: isComplete ? 0 : DRAG_LIMIT }}
        dragElastic={0.3}
        style={{ x }}
        onDragEnd={handleDragEnd}
        className={cn(
          "relative touch-pan-y",
          !disabled && "cursor-grab active:cursor-grabbing"
        )}
        whileTap={disabled ? {} : { scale: 0.99 }}
      >
        {children}
      </motion.div>

      {/* Stardust particles on completion */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 1, x: 20, y: 0, scale: 1 }}
            animate={{ 
              opacity: 0, 
              x: 20 + p.x, 
              y: p.y, 
              scale: 0,
              rotate: Math.random() * 360 
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="absolute top-1/2 left-4 w-2 h-2 rounded-full bg-stardust-gold pointer-events-none"
            style={{
              boxShadow: "0 0 6px hsl(var(--stardust-gold))"
            }}
          />
        ))}
      </AnimatePresence>

      {/* XP Burst animation */}
      <AnimatePresence>
        {showXpBurst && xpReward > 0 && (
          <motion.div
            initial={{ opacity: 1, y: 0, scale: 1 }}
            animate={{ opacity: 0, y: -40, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute top-1/2 left-12 text-stardust-gold font-bold text-lg pointer-events-none"
            style={{
              textShadow: "0 0 10px hsl(var(--stardust-gold) / 0.5)"
            }}
          >
            +{xpReward} XP
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
