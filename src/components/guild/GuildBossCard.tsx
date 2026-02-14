/**
 * GuildBossCard Component
 * Displays the active guild boss with animated HP bar and damage tracking
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Skull,
  Swords,
  Timer,
  Trophy,
  Flame,
  Crown,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BossEncounter, DamageLogEntry } from "@/hooks/useGuildBoss";
import { getUserDisplayName } from "@/utils/getUserDisplayName";

interface GuildBossCardProps {
  boss: BossEncounter;
  currentHp: number;
  hpPercentage: number;
  timeRemaining: string | null;
  damageLeaderboard: Array<{
    userId: string;
    totalDamage: number;
    profile?: { email: string | null; onboarding_data: unknown };
    isKillingBlow: boolean;
  }>;
  myTotalDamage: number;
  recentDamage?: DamageLogEntry[];
  onViewDetails?: () => void;
}

export const GuildBossCard = ({
  boss,
  currentHp,
  hpPercentage,
  timeRemaining,
  damageLeaderboard,
  myTotalDamage,
  recentDamage: _recentDamage,
  onViewDetails: _onViewDetails,
}: GuildBossCardProps) => {
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [animatedHp, setAnimatedHp] = useState(hpPercentage);

  // Animate HP changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimatedHp(hpPercentage);
    }, 100);
    return () => clearTimeout(timeout);
  }, [hpPercentage]);

  const getTierConfig = (tier: string) => {
    switch (tier) {
      case 'legendary':
        return {
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          glowColor: 'shadow-yellow-500/20',
        };
      case 'elite':
        return {
          color: 'text-purple-500',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/30',
          glowColor: 'shadow-purple-500/20',
        };
      default:
        return {
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          glowColor: 'shadow-red-500/20',
        };
    }
  };

  const tierConfig = getTierConfig(boss.boss_tier);

  const getHpColor = () => {
    if (hpPercentage > 50) return 'bg-green-500';
    if (hpPercentage > 25) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className={cn(
      "relative overflow-hidden",
      tierConfig.borderColor,
      "shadow-lg",
      tierConfig.glowColor
    )}>
      {/* Animated background effect */}
      <div className="absolute inset-0 opacity-30">
        <motion.div
          className={cn("absolute inset-0", tierConfig.bgColor)}
          animate={{
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <CardHeader className="relative pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              tierConfig.bgColor,
              tierConfig.borderColor,
              "border"
            )}>
              <Skull className={cn("h-6 w-6", tierConfig.color)} />
            </div>
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                {boss.boss_name}
                <Badge variant="outline" className={cn("text-xs capitalize", tierConfig.color)}>
                  {boss.boss_tier}
                </Badge>
              </CardTitle>
              {boss.boss_title && (
                <p className="text-sm text-muted-foreground italic">
                  "{boss.boss_title}"
                </p>
              )}
            </div>
          </div>
          
          {/* Time remaining */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Timer className="h-4 w-4" />
            {timeRemaining}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative space-y-4">
        {/* Boss image placeholder or lore */}
        {boss.boss_lore && (
          <p className="text-sm text-muted-foreground italic line-clamp-2">
            {boss.boss_lore}
          </p>
        )}

        {/* HP Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Health</span>
            <span className={cn("font-bold", tierConfig.color)}>
              {currentHp.toLocaleString()} / {boss.max_hp.toLocaleString()}
            </span>
          </div>
          
          <div className="relative h-6 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full", getHpColor())}
              initial={false}
              animate={{ width: `${animatedHp}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            
            {/* Damage flash effect */}
            <AnimatePresence>
              {animatedHp !== hpPercentage && (
                <motion.div
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-white/30"
                />
              )}
            </AnimatePresence>

            {/* HP percentage text */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white drop-shadow-md">
                {Math.round(hpPercentage)}%
              </span>
            </div>
          </div>
        </div>

        {/* My contribution */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg",
          "bg-primary/10 border border-primary/30"
        )}>
          <div className="flex items-center gap-2">
            <Swords className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Your Damage</span>
          </div>
          <span className="font-bold text-primary">
            {myTotalDamage.toLocaleString()}
          </span>
        </div>

        {/* Leaderboard toggle */}
        <Button
          variant="ghost"
          className="w-full justify-between"
          onClick={() => setShowLeaderboard(!showLeaderboard)}
        >
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span>Damage Leaderboard</span>
          </div>
          {showLeaderboard ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        {/* Leaderboard */}
        <AnimatePresence>
          {showLeaderboard && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {damageLeaderboard.slice(0, 10).map((entry, index) => (
                    <motion.div
                      key={entry.userId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-lg",
                        index === 0 && "bg-yellow-500/10 border border-yellow-500/30",
                        index === 1 && "bg-gray-400/10",
                        index === 2 && "bg-amber-600/10"
                      )}
                    >
                      {/* Rank */}
                      <div className="w-6 flex justify-center">
                        {index === 0 ? (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <span className="text-sm font-medium text-muted-foreground">
                            {index + 1}
                          </span>
                        )}
                      </div>

                      {/* Name */}
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {getUserDisplayName(entry.profile)}
                        </span>
                        {entry.isKillingBlow && (
                          <Badge variant="destructive" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Final Blow
                          </Badge>
                        )}
                      </div>

                      {/* Damage */}
                      <div className="flex items-center gap-1 text-sm font-bold">
                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                        {entry.totalDamage.toLocaleString()}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>

        {/* XP Reward indicator */}
        <div className="flex items-center justify-center gap-2 pt-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-yellow-500" />
          <span>Defeat to earn <strong className="text-yellow-500">{boss.xp_reward} XP</strong></span>
        </div>
      </CardContent>
    </Card>
  );
};
