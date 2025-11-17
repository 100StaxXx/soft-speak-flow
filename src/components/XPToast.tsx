import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import confetti from "canvas-confetti";

interface XPToastProps {
  xp: number;
  reason: string;
  show: boolean;
  onComplete: () => void;
}

export const XPToast = ({ xp, reason, show, onComplete }: XPToastProps) => {
  useEffect(() => {
    if (show) {
      // Small confetti burst
      confetti({
        particleCount: 30,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#FFD700', '#FFA500'],
      });

      const timer = setTimeout(onComplete, 2500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.8 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-6 py-3 rounded-full shadow-glow flex items-center gap-2">
            <Sparkles className="h-5 w-5 animate-pulse" />
            <span className="font-bold">+{xp} XP</span>
            <span className="text-sm opacity-90">{reason}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
