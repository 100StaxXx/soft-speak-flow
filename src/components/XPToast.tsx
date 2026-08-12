import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star } from "lucide-react";
import confetti from "canvas-confetti";
import { haptics } from "@/utils/haptics";
import { PRODUCT } from "@/config/product";
import { getCompanionMotionEventTypeFromReason } from "@/config/companionMotion";

interface XPToastProps {
  xp: number;
  reason: string;
  show: boolean;
  onComplete: () => void;
}

export const XPToast = ({ xp, reason, show, onComplete }: XPToastProps) => {
  useEffect(() => {
    if (show) {
      // Light haptic feedback
      haptics.light();
      
      const motionType = getCompanionMotionEventTypeFromReason(reason);
      const isMilestone = motionType === "streak" || xp >= 40;
      if (isMilestone) {
        confetti({
          particleCount: PRODUCT.mode === "christian" ? 12 : 20,
          spread: 50,
          origin: { y: 0.72 },
          colors: PRODUCT.mode === "christian"
            ? ['#D6B86A', '#7DA37A']
            : ['#A76CFF', '#C084FC'],
          ticks: 100,
          gravity: 1.2,
        });
      }

      const timer = setTimeout(onComplete, 2000);
      return () => clearTimeout(timer);
    }
  }, [reason, show, onComplete, xp]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
              type: "spring",
              stiffness: 400,
              damping: 20
            }
          }}
          exit={{ 
            opacity: 0, 
            y: -10, 
            scale: 0.95,
            transition: { duration: 0.15 }
          }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50"
        >
          <motion.div 
            className="bg-black/70 backdrop-blur-sm border border-white/20 px-4 py-2 rounded-full"
            animate={{
              boxShadow: [
                "0 0 10px rgba(167, 108, 255, 0.3)",
                "0 0 20px rgba(167, 108, 255, 0.5)",
                "0 0 10px rgba(167, 108, 255, 0.3)",
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-stardust-gold" />
              <span className="text-sm font-semibold text-white">+{xp} XP</span>
              {reason && (
                <span className="text-xs text-white/70">{reason}</span>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
