import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { playXPGain } from "@/utils/soundEffects";
import { haptics } from "@/utils/haptics";

interface PerfectDayCelebrationProps {
  show: boolean;
  totalXP: number;
  tasksCompleted: number;
  currentStreak: number;
  onDismiss: () => void;
}

export function PerfectDayCelebration({
  show,
  totalXP,
  tasksCompleted,
  currentStreak,
  onDismiss,
}: PerfectDayCelebrationProps) {
  const [stage, setStage] = useState<"entering" | "main" | "exiting">("entering");

  useEffect(() => {
    if (show) {
      setStage("entering");
      
      // Play celebration effects
      playXPGain();
      haptics.success();
      
      // Multi-wave confetti
      const duration = 3000;
      const end = Date.now() + duration;
      
      // Golden confetti burst from center
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.5, x: 0.5 },
        colors: ["#FFD700", "#FFA500", "#FFEC8B", "#FFE135"],
        startVelocity: 45,
        gravity: 0.8,
        scalar: 1.2,
      });
      
      // Star-shaped particles
      setTimeout(() => {
        confetti({
          particleCount: 50,
          spread: 100,
          origin: { y: 0.4, x: 0.5 },
          colors: ["#FFD700", "#FFFFFF", "#FFA500"],
          shapes: ["star"],
          scalar: 1.5,
        });
      }, 300);
      
      // Side cannons
      const interval = setInterval(() => {
        if (Date.now() > end) {
          clearInterval(interval);
          return;
        }
        
        confetti({
          particleCount: 30,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ["#FFD700", "#FFA500"],
        });
        confetti({
          particleCount: 30,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ["#FFD700", "#FFA500"],
        });
      }, 400);
      
      // Transition to main stage
      setTimeout(() => setStage("main"), 300);
      
      return () => clearInterval(interval);
    }
  }, [show]);

  const handleDismiss = () => {
    setStage("exiting");
    haptics.light();
    setTimeout(onDismiss, 300);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md"
        onClick={handleDismiss}
      >
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: 50 }}
          animate={{ 
            scale: stage === "exiting" ? 0.8 : 1, 
            opacity: stage === "exiting" ? 0 : 1,
            y: stage === "exiting" ? 30 : 0
          }}
          transition={{ type: "spring", damping: 15, stiffness: 300 }}
          className="relative mx-4 max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow ring */}
          <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-stardust-gold via-amber-400 to-stardust-gold opacity-30 blur-xl animate-pulse" />
          
          {/* Main card */}
          <div className={cn(
            "relative rounded-2xl p-6 text-center overflow-hidden",
            "bg-gradient-to-b from-amber-950/90 via-amber-900/80 to-amber-950/90",
            "border-2 border-stardust-gold/50",
            "shadow-[0_0_60px_hsl(var(--stardust-gold)/0.4)]"
          )}>
            {/* Decorative stars */}
            <div className="absolute top-3 left-3 animate-pulse">
              <Star className="w-4 h-4 text-stardust-gold fill-stardust-gold" />
            </div>
            <div className="absolute top-4 right-4 animate-pulse" style={{ animationDelay: "0.3s" }}>
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            </div>
            <div className="absolute bottom-8 left-6 animate-pulse" style={{ animationDelay: "0.6s" }}>
              <Sparkles className="w-4 h-4 text-stardust-gold" />
            </div>
            <div className="absolute bottom-10 right-5 animate-pulse" style={{ animationDelay: "0.9s" }}>
              <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
            </div>
            
            {/* Trophy icon */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.2, damping: 10 }}
              className="mb-4"
            >
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-stardust-gold to-amber-500 shadow-[0_0_40px_hsl(var(--stardust-gold)/0.6)]">
                <Trophy className="w-10 h-10 text-amber-950" />
              </div>
            </motion.div>
            
            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-black mb-2 bg-gradient-to-r from-stardust-gold via-amber-300 to-stardust-gold bg-clip-text text-transparent"
            >
              PERFECT DAY!
            </motion.h2>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-amber-200/80 mb-6"
            >
              You crushed every quest today!
            </motion.p>
            
            {/* Stats */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-3 gap-3 mb-6"
            >
              <div className="bg-amber-950/50 rounded-xl p-3 border border-stardust-gold/20">
                <div className="text-2xl font-black text-stardust-gold">+{totalXP}</div>
                <div className="text-xs text-amber-300/70">XP Earned</div>
              </div>
              <div className="bg-amber-950/50 rounded-xl p-3 border border-stardust-gold/20">
                <div className="text-2xl font-black text-stardust-gold">{tasksCompleted}</div>
                <div className="text-xs text-amber-300/70">Quests</div>
              </div>
              <div className="bg-amber-950/50 rounded-xl p-3 border border-stardust-gold/20">
                <div className="text-2xl font-black text-stardust-gold">{currentStreak}</div>
                <div className="text-xs text-amber-300/70">Day Streak</div>
              </div>
            </motion.div>
            
            {/* Continue button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Button
                onClick={handleDismiss}
                className="w-full bg-gradient-to-r from-stardust-gold to-amber-500 text-amber-950 font-bold hover:from-amber-400 hover:to-stardust-gold"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Continue
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
