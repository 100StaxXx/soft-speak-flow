/**
 * ActiveBlessingsDisplay Component
 * Shows active blessings/buffs the user has received
 */

import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Clock, Flame, Shield, Zap, Moon, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Blessing } from "@/hooks/useGuildBlessings";
import { formatDistanceToNow } from "date-fns";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getUserDisplayName } from "@/utils/getUserDisplayName";

interface ActiveBlessingsDisplayProps {
  blessings: Blessing[];
  className?: string;
  compact?: boolean;
}

export const ActiveBlessingsDisplay = ({
  blessings,
  className,
  compact = false,
}: ActiveBlessingsDisplayProps) => {
  if (!blessings || blessings.length === 0) return null;

  const getEffectIcon = (effectType: string) => {
    switch (effectType) {
      case 'xp_boost':
        return Flame;
      case 'streak_shield':
      case 'streak_revive':
        return Shield;
      case 'boss_damage':
        return Zap;
      case 'energy_restore':
        return Moon;
      case 'bond_boost':
        return Star;
      default:
        return Sparkles;
    }
  };

  if (compact) {
    return (
        <TooltipProvider>
          <div className={cn("flex items-center gap-1", className)}>
          {blessings.slice(0, 4).map((blessing, index) => {
            return (
              <Tooltip key={blessing.id}>
                <TooltipTrigger asChild>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center",
                      "bg-gradient-to-br from-yellow-500/20 to-orange-500/20",
                      "border border-yellow-500/30"
                    )}
                  >
                    <span className="text-sm">{blessing.blessing_type?.icon}</span>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{blessing.blessing_type?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    From {getUserDisplayName(blessing.sender)}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {blessings.length > 4 && (
            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              +{blessings.length - 4}
            </div>
          )}
        </div>
      </TooltipProvider>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("space-y-2", className)}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-yellow-500">
        <Sparkles className="h-4 w-4" />
        Active Blessings
      </div>
      
      <AnimatePresence>
        {blessings.map((blessing, index) => {
          const Icon = getEffectIcon(blessing.blessing_type?.effect_type || '');
          const expiresAt = new Date(blessing.expires_at);
          const timeLeft = formatDistanceToNow(expiresAt, { addSuffix: false });

          return (
            <motion.div
              key={blessing.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center gap-3 p-2 rounded-lg",
                "bg-gradient-to-r from-yellow-500/10 to-orange-500/10",
                "border border-yellow-500/20"
              )}
            >
              <div className="text-xl">{blessing.blessing_type?.icon}</div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{blessing.blessing_type?.name}</span>
                  <Icon className="h-3.5 w-3.5 text-yellow-500" />
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  From {getUserDisplayName(blessing.sender)}
                </p>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {timeLeft}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
};
