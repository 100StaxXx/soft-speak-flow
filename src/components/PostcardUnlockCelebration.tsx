import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { playMissionComplete } from "@/utils/soundEffects";

interface PostcardUnlockCelebrationProps {
  show: boolean;
  milestoneTitle?: string;
  chapterNumber?: number;
  onDismiss: () => void;
}

export const PostcardUnlockCelebration = ({
  show,
  milestoneTitle,
  chapterNumber,
  onDismiss,
}: PostcardUnlockCelebrationProps) => {
  const [stage, setStage] = useState<"entering" | "main" | "exiting">("entering");

  useEffect(() => {
    if (show) {
      setStage("entering");
      
      // Play sound and haptics
      playMissionComplete();
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});

      // Trigger confetti with amber/gold colors
      const colors = ["#F59E0B", "#F97316", "#FBBF24", "#FCD34D", "#D97706"];
      
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors,
      });

      // Second burst
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors,
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors,
        });
      }, 200);

      // Transition to main stage
      setTimeout(() => setStage("main"), 300);
    }
  }, [show]);

  const handleDismiss = () => {
    setStage("exiting");
    setTimeout(() => {
      onDismiss();
    }, 300);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        onClick={handleDismiss}
      >
        <motion.div
          initial={{ scale: 0.8, rotateY: 180, opacity: 0 }}
          animate={
            stage === "exiting"
              ? { scale: 0.8, opacity: 0, y: 20 }
              : { scale: 1, rotateY: 0, opacity: 1 }
          }
          transition={{
            type: "spring",
            damping: 20,
            stiffness: 300,
            duration: 0.6,
          }}
          className="relative w-[85vw] max-w-sm p-6 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-yellow-500/20 border border-amber-500/30 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          style={{ perspective: 1000 }}
        >
          {/* Glow effect */}
          <div className="absolute inset-0 rounded-2xl bg-amber-500/10 blur-xl" />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center text-center space-y-4">
            {/* Postcard Icon with animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 500 }}
              className="relative"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                <Mail className="w-10 h-10 text-white" />
              </div>
              {/* Sparkle decorations */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute -top-2 -right-2"
              >
                <Sparkles className="w-6 h-6 text-amber-400" />
              </motion.div>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -bottom-1 -left-2"
              >
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </motion.div>
            </motion.div>

            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h2 className="text-xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-yellow-500 bg-clip-text text-transparent">
                Postcard Unlocked!
              </h2>
              {chapterNumber && (
                <p className="text-sm text-muted-foreground mt-1">
                  Chapter {chapterNumber}
                </p>
              )}
            </motion.div>

            {/* Milestone info */}
            {milestoneTitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-foreground/80 font-medium"
              >
                {milestoneTitle}
              </motion.p>
            )}

            {/* Companion message */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-xs text-muted-foreground italic"
            >
              Your companion is sending you a cosmic memory...
            </motion.p>

            {/* Continue button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="pt-2"
            >
              <Button
                onClick={handleDismiss}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white px-8"
              >
                Continue
              </Button>
            </motion.div>
          </div>

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Decorative corner sparkles */}
          <Sparkles className="absolute top-4 left-4 w-4 h-4 text-amber-400/50" />
          <Sparkles className="absolute bottom-4 right-4 w-4 h-4 text-orange-400/50" />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
