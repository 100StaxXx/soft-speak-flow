import { useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Brain, Zap, Heart } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlanetaryCardProps {
  planet: 'mercury' | 'mars' | 'venus';
  sign: string;
  description: string;
  delay?: number;
}

const planetConfig = {
  mercury: {
    icon: Brain,
    name: "Mercury",
    aspect: "Mind",
    subtitle: "Communication & Thought",
    gradient: "from-cyan-500/20 to-teal-500/20",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  },
  mars: {
    icon: Zap,
    name: "Mars",
    aspect: "Body",
    subtitle: "Drive & Action",
    gradient: "from-red-500/20 to-orange-500/20",
    badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
  },
  venus: {
    icon: Heart,
    name: "Venus",
    aspect: "Soul",
    subtitle: "Values & Connection",
    gradient: "from-pink-500/20 to-rose-500/20",
    badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/30",
  },
};

export const PlanetaryCard = ({ planet, sign, description, delay = 0 }: PlanetaryCardProps) => {
  const config = planetConfig[planet];
  const Icon = config.icon;
  const navigate = useNavigate();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const MOVE_THRESHOLD = 10;

  const handleClick = () => {
    navigate(`/cosmic/${planet}/${sign.toLowerCase()}`);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    
    // Only navigate if finger moved less than threshold (tap, not scroll)
    if (deltaX < MOVE_THRESHOLD && deltaY < MOVE_THRESHOLD) {
      e.preventDefault();
      handleClick();
    }
    
    touchStartRef.current = null;
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="cursor-pointer select-none"
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'pan-y' }}
    >
      <Card className="bg-obsidian/60 border-royal-purple/30 hover:border-royal-purple/50 transition-all hover:shadow-lg hover:shadow-accent-purple/10 hover:scale-[1.02]">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <motion.div
              animate={{ rotate: planet === 'mars' ? [0, 5, -5, 0] : 0 }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              className={`w-12 h-12 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 border border-royal-purple/30`}
            >
              <Icon className="w-6 h-6 text-pure-white" />
            </motion.div>

            {/* Content */}
            <div className="flex-1 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-pure-white">{config.name}</h4>
                  <p className="text-xs text-steel">{config.subtitle}</p>
                </div>
                <Badge className={`${config.badgeColor} border`}>
                  {config.aspect}
                </Badge>
              </div>

              <p className="text-lg font-semibold text-accent-purple capitalize">
                {sign}
              </p>

              <p className="text-sm text-cloud-white leading-relaxed">
                {description}
              </p>
              <p className="text-xs text-accent-purple mt-2 font-medium">
                Tap to explore →
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
