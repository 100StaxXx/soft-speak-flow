import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Trophy, Crown, Star } from "lucide-react";
import confetti from "canvas-confetti";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface StreakMilestoneModalProps {
  open: boolean;
  streak: number;
  onClose: () => void;
}

const getMilestoneConfig = (streak: number) => {
  if (streak >= 100) {
    return {
      title: "LEGENDARY STREAK!",
      subtitle: `${streak} days of pure dedication`,
      icon: Crown,
      gradient: "from-yellow-400 via-orange-500 to-red-500",
      message: "You are unstoppable. This is what greatness looks like.",
      particles: 400,
    };
  } else if (streak >= 30) {
    return {
      title: "ELITE STREAK!",
      subtitle: `${streak} days strong`,
      icon: Trophy,
      gradient: "from-purple-400 via-pink-500 to-red-500",
      message: "You've built an unshakeable habit. This is discipline.",
      particles: 300,
    };
  } else if (streak >= 7) {
    return {
      title: "STREAK MILESTONE!",
      subtitle: `${streak} days in a row`,
      icon: Flame,
      gradient: "from-orange-400 via-red-500 to-pink-500",
      message: "Momentum is building. Keep the fire burning.",
      particles: 200,
    };
  }
  return null;
};

export const StreakMilestoneModal = ({ open, streak, onClose }: StreakMilestoneModalProps) => {
  const config = getMilestoneConfig(streak);

  useEffect(() => {
    if (open && config) {
      // Multi-wave confetti celebration
      const duration = 4000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: config.particles / 10,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493'],
        });
        confetti({
          particleCount: config.particles / 10,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ['#FFD700', '#FFA500', '#FF6347', '#FF1493'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [open, config]);

  if (!config) return null;

  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md border-0 bg-transparent shadow-none p-0">
        <DialogTitle className="sr-only">{config.title}</DialogTitle>
        <DialogDescription className="sr-only">{config.message}</DialogDescription>
        <AnimatePresence>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 15, stiffness: 300 }}
            className="relative"
          >
            {/* Glowing background */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/20 to-primary/20 blur-3xl animate-pulse" />
            
            {/* Main card */}
            <div className={`relative bg-gradient-to-br ${config.gradient} p-8 rounded-3xl shadow-neon`}>
              {/* Animated stars */}
              <div className="absolute inset-0 overflow-hidden rounded-3xl">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute"
                    initial={{ 
                      x: Math.random() * 100 + "%", 
                      y: Math.random() * 100 + "%",
                      scale: 0,
                      opacity: 0,
                    }}
                    animate={{
                      scale: [0, 1, 0],
                      opacity: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2,
                      delay: Math.random() * 2,
                      repeat: Infinity,
                    }}
                  >
                    <Star className="h-4 w-4 text-white" fill="white" />
                  </motion.div>
                ))}
              </div>

              <div className="relative space-y-6 text-center">
                {/* Icon */}
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", damping: 10, delay: 0.2 }}
                  className="mx-auto w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center shadow-glow-lg"
                >
                  <Icon className="h-16 w-16 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                </motion.div>

                {/* Title */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-2"
                >
                  <h2 className="text-4xl font-heading font-black text-white drop-shadow-lg">
                    {config.title}
                  </h2>
                  <p className="text-xl font-bold text-white/90">
                    {config.subtitle}
                  </p>
                </motion.div>

                {/* Message */}
                <motion.p
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-lg text-white/90 font-medium max-w-sm mx-auto"
                >
                  {config.message}
                </motion.p>

                {/* Button */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.8 }}
                >
                  <Button
                    onClick={onClose}
                    size="lg"
                    className="bg-white text-primary hover:bg-white/90 font-bold shadow-glow-lg"
                  >
                    Let's Go! 🔥
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
};