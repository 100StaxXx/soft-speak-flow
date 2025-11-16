import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useEffect } from "react";

interface AchievementToastProps {
  title: string;
  description: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  onClose: () => void;
}

export const AchievementToast = ({ title, description, icon, tier, onClose }: AchievementToastProps) => {
  const tierColors = {
    bronze: "from-amber-700 to-amber-900",
    silver: "from-gray-400 to-gray-600",
    gold: "from-yellow-400 to-yellow-600",
    platinum: "from-purple-400 to-purple-600",
  };

  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 50 }}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
    >
      <Card className={`p-4 bg-gradient-to-br ${tierColors[tier]} border-none shadow-2xl`}>
        <div className="flex items-start gap-3">
          <div className="text-4xl">{icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="h-4 w-4 text-white" />
              <span className="text-xs font-bold text-white/90 uppercase">Achievement Unlocked!</span>
            </div>
            <h3 className="font-bold text-white mb-1">{title}</h3>
            <p className="text-sm text-white/80">{description}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20 h-8 w-8"
          >
            ×
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};
