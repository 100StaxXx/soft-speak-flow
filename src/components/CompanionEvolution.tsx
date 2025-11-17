import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { haptics } from "@/utils/haptics";
import { Sparkles, Zap } from "lucide-react";

interface CompanionEvolutionProps {
  isEvolving: boolean;
  newStage: number;
  newImageUrl: string;
  onComplete: () => void;
}

export const CompanionEvolution = ({ 
  isEvolving, 
  newStage, 
  newImageUrl,
  onComplete 
}: CompanionEvolutionProps) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!isEvolving) return;

    haptics.heavy();

    const timers = [
      setTimeout(() => {
        setStage(1);
        haptics.medium();
      }, 200),
      setTimeout(() => {
        setStage(2);
        haptics.heavy();
        // First confetti burst
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF69B4', '#00CED1']
        });
      }, 600),
      setTimeout(() => {
        setStage(3);
        haptics.success();
        // Second confetti burst
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF69B4', '#00CED1']
        });
      }, 1200),
      setTimeout(() => {
        setStage(4);
      }, 2000),
      setTimeout(() => {
        setStage(0);
        onComplete();
      }, 3500),
    ];

    return () => timers.forEach(clearTimeout);
  }, [isEvolving, onComplete]);

  if (!isEvolving) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center"
      >
        {/* Animated background glow */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/20"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Particle effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-primary/60 rounded-full"
              initial={{
                x: Math.random() * window.innerWidth,
                y: window.innerHeight + 50,
              }}
              animate={{
                y: -50,
                x: Math.random() * window.innerWidth,
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="flex flex-col items-center gap-8 max-w-md text-center px-6 relative z-10">
          {stage >= 1 && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="relative"
            >
              <Sparkles className="absolute -top-6 -left-6 w-8 h-8 text-primary animate-pulse" />
              <Sparkles className="absolute -top-6 -right-6 w-8 h-8 text-accent animate-pulse" />
              <Zap className="absolute -bottom-6 -left-6 w-8 h-8 text-primary animate-pulse" />
              <Zap className="absolute -bottom-6 -right-6 w-8 h-8 text-accent animate-pulse" />
              
              <motion.div
                className="w-40 h-40 rounded-2xl overflow-hidden border-4 border-primary shadow-2xl"
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(var(--primary), 0.5)",
                    "0 0 60px rgba(var(--primary), 0.8)",
                    "0 0 20px rgba(var(--primary), 0.5)",
                  ],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                }}
              >
                {stage >= 2 && (
                  <motion.img
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    src={newImageUrl}
                    alt="Evolved companion"
                    className="w-full h-full object-cover"
                  />
                )}
              </motion.div>
            </motion.div>
          )}

          {stage >= 3 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <motion.h1
                className="text-5xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ["0%", "100%", "0%"],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                }}
                style={{
                  backgroundSize: "200% 200%",
                }}
              >
                EVOLUTION!
              </motion.h1>
              <p className="text-2xl font-bold text-foreground">
                Your companion evolved to Stage {newStage}!
              </p>
            </motion.div>
          )}

          {stage >= 4 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-lg text-muted-foreground"
            >
              Your journey continues...
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
