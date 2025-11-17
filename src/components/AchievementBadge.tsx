import { memo, useEffect, useState } from "react";
import { Trophy, Award, Medal, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

interface AchievementBadgeProps {
  tier: "bronze" | "silver" | "gold" | "platinum";
  title: string;
  description: string;
  icon: string;
  earnedAt?: string;
  size?: "sm" | "md" | "lg";
  isNew?: boolean;
}

const tierConfig = {
  bronze: {
    gradient: "from-orange-600 to-orange-800",
    shadow: "shadow-orange-500/20",
    icon: Medal,
    glowColor: "orange",
  },
  silver: {
    gradient: "from-gray-400 to-gray-600",
    shadow: "shadow-gray-500/20",
    icon: Award,
    glowColor: "gray",
  },
  gold: {
    gradient: "from-yellow-400 to-yellow-600",
    shadow: "shadow-yellow-500/20",
    icon: Trophy,
    glowColor: "yellow",
  },
  platinum: {
    gradient: "from-purple-400 to-purple-600",
    shadow: "shadow-purple-500/20",
    icon: Crown,
    glowColor: "purple",
  },
};

export const AchievementBadge = memo(({
  tier,
  title,
  description,
  earnedAt,
  size = "md",
  isNew = false,
}: AchievementBadgeProps) => {
  const config = tierConfig[tier];
  const Icon = config.icon;
  const [showUnlock, setShowUnlock] = useState(isNew);

  useEffect(() => {
    if (isNew) {
      // Achievement unlock celebration
      const colors = {
        bronze: ['#EA580C', '#F97316'],
        silver: ['#9CA3AF', '#D1D5DB'],
        gold: ['#FBBF24', '#F59E0B'],
        platinum: ['#A855F7', '#C084FC'],
      };

      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: colors[tier],
        ticks: 300,
      });

      setTimeout(() => setShowUnlock(false), 3000);
    }
  }, [isNew, tier]);

  const sizeClasses = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  const iconSizes = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <>
      <AnimatePresence>
        {showUnlock && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              className={cn(
                "relative p-8 rounded-2xl bg-gradient-to-br shadow-glow-lg",
                config.gradient
              )}
            >
              <div className="text-center space-y-4">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", delay: 0.2 }}
                >
                  <Icon className="h-20 w-20 text-white mx-auto drop-shadow-lg" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <h2 className="text-3xl font-heading font-black text-white mb-2">
                    ACHIEVEMENT UNLOCKED!
                  </h2>
                  <p className="text-xl font-bold text-white/90">{title}</p>
                  <p className="text-sm text-white/80 mt-2">{description}</p>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={isNew ? { scale: 0, rotate: -180 } : {}}
        animate={isNew ? { scale: 1, rotate: 0 } : {}}
        transition={{ type: "spring", damping: 15 }}
        className={cn(
          "relative rounded-xl bg-card border border-border/50 overflow-hidden group hover:scale-105 transition-all duration-300 cursor-pointer",
          config.shadow,
          sizeClasses[size]
        )}
        role="article"
        aria-label={`Achievement: ${title}`}
      >
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-10 group-hover:opacity-20 transition-opacity",
            config.gradient
          )}
        />
        {isNew && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-1 text-xs font-bold bg-gradient-to-r from-primary to-accent text-white rounded-full animate-pulse">
              NEW!
            </span>
          </div>
        )}
        <div className="relative space-y-2">
          <div className="flex items-center gap-3">
            <motion.div
              whileHover={{ rotate: 360 }}
              transition={{ duration: 0.6 }}
              className={cn(
                "rounded-full p-2 bg-gradient-to-br",
                config.gradient
              )}
            >
              <Icon className={cn("text-white", iconSizes[size])} aria-hidden="true" />
            </motion.div>
            <div className="flex-1">
              <h4 className="font-semibold text-foreground">{title}</h4>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          {earnedAt && (
            <p className="text-[10px] text-muted-foreground/60">
              Earned {new Date(earnedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      </motion.div>
    </>
  );
});
