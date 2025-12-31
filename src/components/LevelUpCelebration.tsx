import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Star, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
import { playXPGain } from "@/utils/soundEffects";
import { haptics } from "@/utils/haptics";

interface LevelUpCelebrationProps {
  show: boolean;
  newLevel: number;
  onDismiss: () => void;
}

const getLevelTier = (level: number) => {
  if (level >= 50) return { name: "Legendary", color: "from-stardust-gold via-amber-400 to-stardust-gold", glow: "stardust-gold" };
  if (level >= 25) return { name: "Epic", color: "from-purple-500 via-fuchsia-400 to-purple-500", glow: "purple-500" };
  if (level >= 10) return { name: "Rare", color: "from-blue-500 via-cyan-400 to-blue-500", glow: "blue-500" };
  if (level >= 5) return { name: "Uncommon", color: "from-green-500 via-emerald-400 to-green-500", glow: "green-500" };
  return { name: "Common", color: "from-slate-400 via-zinc-300 to-slate-400", glow: "slate-400" };
};

export function LevelUpCelebration({
  show,
  newLevel,
  onDismiss,
}: LevelUpCelebrationProps) {
  const [stage, setStage] = useState<"entering" | "counting" | "main" | "exiting">("entering");
  const [displayLevel, setDisplayLevel] = useState(newLevel - 1);
  const tier = getLevelTier(newLevel);

  useEffect(() => {
    if (show) {
      setStage("entering");
      setDisplayLevel(Math.max(1, newLevel - 1));
      
      // Play effects
      playXPGain();
      haptics.success();
      
      // Confetti burst
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.5, x: 0.5 },
        colors: ["#A78BFA", "#C084FC", "#E879F9", "#F0ABFC"],
        startVelocity: 50,
        gravity: 0.9,
      });
      
      // Start counting animation after entrance
      setTimeout(() => {
        setStage("counting");
        
        // Animate level counter
        const countDuration = 600;
        const startTime = Date.now();
        const startLevel = Math.max(1, newLevel - 1);
        
        const countInterval = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / countDuration, 1);
          const easeOutProgress = 1 - Math.pow(1 - progress, 3);
          const currentDisplay = Math.round(startLevel + (newLevel - startLevel) * easeOutProgress);
          setDisplayLevel(currentDisplay);
          
          if (progress >= 1) {
            clearInterval(countInterval);
            setStage("main");
            
            // Final burst when level lands
            confetti({
              particleCount: 50,
              spread: 100,
              origin: { y: 0.4, x: 0.5 },
              colors: ["#FFD700", "#FFA500", "#A78BFA"],
              shapes: ["star"],
              scalar: 1.3,
            });
            haptics.medium();
          }
        }, 30);
        
        return () => clearInterval(countInterval);
      }, 400);
    }
  }, [show, newLevel]);

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
          <div className={cn(
            "absolute -inset-4 rounded-3xl opacity-40 blur-xl animate-pulse",
            `bg-gradient-to-r ${tier.color}`
          )} />
          
          {/* Main card */}
          <div className={cn(
            "relative rounded-2xl p-6 text-center overflow-hidden",
            "bg-gradient-to-b from-purple-950/90 via-violet-900/80 to-purple-950/90",
            "border-2 border-purple-500/50",
            "shadow-[0_0_60px_hsl(var(--primary)/0.4)]"
          )}>
            {/* Particle effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-purple-400 rounded-full"
                  initial={{ 
                    x: "50%", 
                    y: "50%", 
                    opacity: 0.8,
                    scale: 1
                  }}
                  animate={{ 
                    x: `${20 + Math.random() * 60}%`,
                    y: `${10 + Math.random() * 80}%`,
                    opacity: [0.8, 0.4, 0.8],
                    scale: [1, 1.5, 1]
                  }}
                  transition={{ 
                    duration: 3,
                    repeat: Infinity,
                    delay: i * 0.2
                  }}
                />
              ))}
            </div>
            
            {/* Decorative elements */}
            <div className="absolute top-3 left-4">
              <Star className="w-4 h-4 text-purple-400 fill-purple-400 animate-pulse" />
            </div>
            <div className="absolute top-5 right-3">
              <Sparkles className="w-4 h-4 text-fuchsia-400 animate-pulse" style={{ animationDelay: "0.5s" }} />
            </div>
            
            {/* Level up icon */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", delay: 0.2, damping: 10 }}
              className="mb-4"
            >
              <div className={cn(
                "inline-flex items-center justify-center w-20 h-20 rounded-full",
                `bg-gradient-to-br ${tier.color}`,
                "shadow-[0_0_40px_hsl(var(--primary)/0.6)]"
              )}>
                <TrendingUp className="w-10 h-10 text-white" />
              </div>
            </motion.div>
            
            {/* Title */}
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={cn(
                "text-3xl font-black mb-2 bg-clip-text text-transparent",
                `bg-gradient-to-r ${tier.color}`
              )}
            >
              LEVEL UP!
            </motion.h2>
            
            {/* Animated level counter */}
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: stage === "counting" ? [1, 1.1, 1] : 1 }}
              transition={{ duration: 0.3 }}
              className="mb-2"
            >
              <span className="text-7xl font-black text-white tabular-nums">
                {displayLevel}
              </span>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mb-6"
            >
              <span className={cn(
                "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold",
                "bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 border border-purple-500/30"
              )}>
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-purple-200">{tier.name} Tier</span>
              </span>
            </motion.div>
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-purple-200/70 text-sm mb-6"
            >
              New adventures await! Keep pushing your limits.
            </motion.p>
            
            {/* Continue button */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Button
                onClick={handleDismiss}
                className={cn(
                  "w-full font-bold text-white",
                  `bg-gradient-to-r ${tier.color} hover:opacity-90`
                )}
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
