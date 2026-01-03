import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import confetti from "canvas-confetti";
import { haptics } from "@/utils/haptics";

interface XPToastProps {
  xp: number;
  reason: string;
  show: boolean;
  onComplete: () => void;
}

export const XPToast = ({ xp, reason, show, onComplete }: XPToastProps) => {
  useEffect(() => {
    if (show) {
      // Haptic feedback for XP gain
      haptics.success();
      
      // Enhanced confetti burst
      const isBigXP = xp >= 50;
      
      confetti({
        particleCount: isBigXP ? 100 : 50,
        spread: isBigXP ? 120 : 70,
        origin: { y: 0.6 },
        colors: ['#A76CFF', '#C084FC', '#E879F9', '#FFD700', '#FFA500'],
        ticks: isBigXP ? 300 : 200,
        gravity: isBigXP ? 0.8 : 1,
        scalar: isBigXP ? 1.2 : 1,
      });

      let confettiTimeout: number | undefined;
      if (isBigXP) {
        // Second burst for big XP
        confettiTimeout = window.setTimeout(() => {
          confetti({
            particleCount: 50,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#A76CFF', '#E879F9'],
            startVelocity: 45,
          });
        }, 150);
      }

      const timer = setTimeout(onComplete, 3000);
      return () => {
        clearTimeout(timer);
        if (confettiTimeout !== undefined) {
          clearTimeout(confettiTimeout);
        }
      };
    }
  }, [show, onComplete, xp]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.7 }}
          animate={{ 
            opacity: 1, 
            y: 0, 
            scale: 1,
            transition: {
              type: "spring",
              stiffness: 300,
              damping: 15
            }
          }}
          exit={{ 
            opacity: 0, 
            y: -30, 
            scale: 0.8,
            transition: { duration: 0.2 }
          }}
          className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50"
        >
          <motion.div 
            className="relative bg-gradient-to-r from-stardust-gold via-amber-400 to-stardust-gold text-black px-8 py-4 rounded-full shadow-neon border-2 border-stardust-gold/50"
            animate={{
              boxShadow: [
                "0 0 20px hsl(var(--stardust-gold) / 0.8), 0 0 40px hsl(var(--stardust-gold) / 0.5)",
                "0 0 30px hsl(var(--stardust-gold) / 0.9), 0 0 60px hsl(var(--stardust-gold) / 0.6)",
                "0 0 20px hsl(var(--stardust-gold) / 0.8), 0 0 40px hsl(var(--stardust-gold) / 0.5)",
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {/* Animated background */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/10 to-primary/0 animate-[shimmer_2s_infinite] rounded-full" />
            
            <div className="relative flex items-center gap-3">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="h-6 w-6 text-amber-700 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              </motion.div>
              <span className="text-2xl font-heading font-black tracking-wider text-amber-900">+{xp} XP</span>
              <span className="text-base font-medium text-amber-800">{reason}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
