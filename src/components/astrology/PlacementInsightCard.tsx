import { useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Brain, Zap, Heart, Sun, Moon, ArrowUpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PlacementInsightCardProps {
  placement: 'sun' | 'moon' | 'rising' | 'mercury' | 'mars' | 'venus';
  sign: string;
  dailyInsight?: string;
  delay?: number;
}

const PLACEMENT_CONFIG = {
  sun: {
    icon: Sun,
    name: "Sun",
    label: "Your Core",
    gradient: "from-yellow-500/20 to-orange-500/20",
    badgeColor: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    iconColor: "text-yellow-400",
  },
  moon: {
    icon: Moon,
    name: "Moon",
    label: "Your Emotions",
    gradient: "from-blue-500/20 to-indigo-500/20",
    badgeColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    iconColor: "text-blue-400",
  },
  rising: {
    icon: ArrowUpCircle,
    name: "Rising",
    label: "Your Outer Self",
    gradient: "from-purple-500/20 to-pink-500/20",
    badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    iconColor: "text-purple-400",
  },
  mercury: {
    icon: Brain,
    name: "Mercury",
    label: "Your Mind",
    gradient: "from-cyan-500/20 to-teal-500/20",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    iconColor: "text-cyan-400",
  },
  mars: {
    icon: Zap,
    name: "Mars",
    label: "Your Drive",
    gradient: "from-red-500/20 to-orange-500/20",
    badgeColor: "bg-red-500/20 text-red-300 border-red-500/30",
    iconColor: "text-red-400",
  },
  venus: {
    icon: Heart,
    name: "Venus",
    label: "Your Love",
    gradient: "from-pink-500/20 to-rose-500/20",
    badgeColor: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    iconColor: "text-pink-400",
  },
};

export const PlacementInsightCard = ({ 
  placement, 
  sign, 
  dailyInsight,
  delay = 0 
}: PlacementInsightCardProps) => {
  const config = PLACEMENT_CONFIG[placement];
  const Icon = config.icon;
  const navigate = useNavigate();
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const MOVE_THRESHOLD = 10;

  const handleClick = () => {
    navigate(`/cosmic/${placement}/${sign.toLowerCase()}`);
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="button"
      tabIndex={0}
      className="cursor-pointer select-none"
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'pan-y' }}
    >
      <Card className="bg-gray-900/60 border-purple-500/30 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10 sm:hover:scale-[1.02] active:scale-[0.98] p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div 
            className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center flex-shrink-0 border border-purple-500/30`}
          >
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-white text-sm">{config.name}</h4>
                <Badge className={`${config.badgeColor} border text-xs px-1.5 py-0`}>
                  {config.label}
                </Badge>
              </div>
            </div>

            <p className="text-purple-300 font-semibold text-sm capitalize mb-2">
              {sign}
            </p>

            {dailyInsight && (
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
                {dailyInsight}
              </p>
            )}
            
            <p className="text-xs text-purple-400 mt-2 font-medium">
              Tap to explore →
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
