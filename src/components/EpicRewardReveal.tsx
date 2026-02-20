/**
 * Epic Reward Reveal Modal
 * Shows mystery reward reveal after boss victory with animations
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Gift, Star, Trophy } from "lucide-react";
import { cn, formatDisplayLabel } from "@/lib/utils";
import type { RewardRevealData, RewardRarity } from "@/types/epicRewards";
import { RARITY_CONFIG } from "@/types/epicRewards";
import confetti from "canvas-confetti";

// Safe rarity config access with fallback
const getRarityConfig = (rarity: string) => {
  return RARITY_CONFIG[rarity as RewardRarity] || RARITY_CONFIG.common;
};

interface EpicRewardRevealProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rewardData: RewardRevealData | null;
  onClaim?: () => void;
}

type RevealPhase = 'chest' | 'badge' | 'loot' | 'complete';

export const EpicRewardReveal = ({
  open,
  onOpenChange,
  rewardData,
  onClaim,
}: EpicRewardRevealProps) => {
  const [phase, setPhase] = useState<RevealPhase>('chest');

  // Reset phase when modal opens
  useEffect(() => {
    if (open) {
      setPhase('chest');
    }
  }, [open]);

  // Auto-advance phases
  useEffect(() => {
    if (!open || !rewardData) return;

    const timers: NodeJS.Timeout[] = [];

    if (phase === 'chest') {
      timers.push(setTimeout(() => setPhase('badge'), 2000));
    } else if (phase === 'badge') {
      // Trigger confetti for badge
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.4 },
        colors: ['#FFD700', '#FFA500', '#FF6347'],
      });
      timers.push(setTimeout(() => setPhase('loot'), 2500));
    } else if (phase === 'loot' && rewardData.loot) {
      // Trigger confetti for loot based on rarity
      const colors = getRarityColors(rewardData.loot.rarity);
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.5 },
        colors,
      });
      timers.push(setTimeout(() => setPhase('complete'), 2500));
    } else if (phase === 'loot' && !rewardData.loot) {
      timers.push(setTimeout(() => setPhase('complete'), 1500));
    }

    return () => timers.forEach(clearTimeout);
  }, [phase, open, rewardData]);

  const handleClaim = useCallback(() => {
    onClaim?.();
    onOpenChange(false);
  }, [onClaim, onOpenChange]);

  if (!rewardData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-0 bg-transparent shadow-none p-0 overflow-visible">
        <div className="relative min-h-[500px] flex items-center justify-center">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-radial from-primary/20 via-transparent to-transparent blur-3xl" />
          
          {/* Star particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-primary/60 rounded-full"
                initial={{ 
                  x: Math.random() * 400 - 200,
                  y: Math.random() * 500 - 250,
                  opacity: 0,
                  scale: 0 
                }}
                animate={{ 
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Chest Phase */}
            {phase === 'chest' && (
              <motion.div
                key="chest"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  animate={{ 
                    rotateY: [0, 10, -10, 0],
                    y: [0, -10, 0],
                  }}
                  transition={{ 
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="relative"
                >
                  <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-yellow-500/50">
                    <Gift className="w-16 h-16 text-white" />
                  </div>
                  <motion.div
                    className="absolute -inset-4 rounded-3xl border-2 border-yellow-400/50"
                    animate={{ opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-6 text-lg font-medium text-foreground/80"
                >
                  Opening rewards...
                </motion.p>
              </motion.div>
            )}

            {/* Badge Phase */}
            {phase === 'badge' && (
              <motion.div
                key="badge"
                initial={{ scale: 0, opacity: 0, rotateY: -180 }}
                animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                exit={{ scale: 0.8, opacity: 0, y: -50 }}
                transition={{ type: "spring", damping: 15 }}
                className="flex flex-col items-center"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative"
                >
                  <div className={cn(
                    "w-28 h-28 rounded-full flex items-center justify-center text-5xl",
                    "bg-gradient-to-br shadow-2xl",
                    rewardData.badge.tier === 'platinum' 
                      ? "from-purple-400 to-purple-600 shadow-purple-500/50"
                      : "from-yellow-400 to-yellow-600 shadow-yellow-500/50"
                  )}>
                    {rewardData.badge.icon}
                  </div>
                  <motion.div
                    className="absolute -inset-2 rounded-full"
                    animate={{ 
                      boxShadow: [
                        '0 0 20px hsl(45, 90%, 50%)',
                        '0 0 40px hsl(45, 90%, 50%)',
                        '0 0 20px hsl(45, 90%, 50%)',
                      ]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 text-center"
                >
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Badge Earned</p>
                  <h3 className="text-2xl font-bold text-foreground mt-1">{rewardData.badge.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{rewardData.badge.description}</p>
                </motion.div>
              </motion.div>
            )}

            {/* Loot Phase */}
            {phase === 'loot' && (
              <motion.div
                key="loot"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", damping: 15 }}
                className="flex flex-col items-center"
              >
                {rewardData.loot ? (
                  <>
                    <motion.div
                      animate={{ 
                        rotate: [0, 5, -5, 0],
                        y: [0, -8, 0],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="relative"
                    >
                      <div className={cn(
                        "w-32 h-32 rounded-2xl flex items-center justify-center",
                        "bg-gradient-to-br shadow-2xl",
                        getRarityConfig(rewardData.loot.rarity).bgClass,
                        getRarityConfig(rewardData.loot.rarity).glowClass
                      )}>
                        {rewardData.loot.reward_type === 'artifact' && rewardData.loot.css_effect?.icon ? (
                          <span className="text-5xl">{rewardData.loot.css_effect.icon}</span>
                        ) : (
                          <Star className="w-14 h-14" style={{ color: getRarityConfig(rewardData.loot.rarity).color }} />
                        )}
                      </div>
                      <motion.div
                        className="absolute -inset-3 rounded-3xl"
                        animate={{ 
                          boxShadow: [
                            `0 0 20px ${getRarityConfig(rewardData.loot.rarity).color}`,
                            `0 0 40px ${getRarityConfig(rewardData.loot.rarity).color}`,
                            `0 0 20px ${getRarityConfig(rewardData.loot.rarity).color}`,
                          ]
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="mt-6 text-center"
                    >
                      <p 
                        className="text-sm font-medium uppercase tracking-wider"
                        style={{ color: getRarityConfig(rewardData.loot.rarity).color }}
                      >
                        {getRarityConfig(rewardData.loot.rarity).label} {formatDisplayLabel(rewardData.loot.reward_type)}
                      </p>
                      <h3 className="text-2xl font-bold text-foreground mt-1">{rewardData.loot.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{rewardData.loot.description}</p>
                      {rewardData.isDuplicate && rewardData.bonusXP && (
                        <p className="text-sm text-yellow-500 mt-2">
                          Already owned! +{rewardData.bonusXP} XP instead
                        </p>
                      )}
                    </motion.div>
                  </>
                ) : (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground"
                  >
                    No additional loot this time
                  </motion.p>
                )}
              </motion.div>
            )}

            {/* Complete Phase */}
            {phase === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center w-full max-w-sm"
              >
                <div className="w-full cosmiq-glass rounded-2xl p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <Trophy className="w-6 h-6 text-yellow-500" />
                    <h3 className="text-xl font-bold">Rewards Earned!</h3>
                  </div>
                  
                  {/* Badge summary */}
                  <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl">
                    <span className="text-3xl">{rewardData.badge.icon}</span>
                    <div>
                      <p className="font-medium">{rewardData.badge.title}</p>
                      <p className="text-xs text-muted-foreground">Badge</p>
                    </div>
                  </div>
                  
                  {/* Loot summary */}
                  {rewardData.loot && (
                    <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl">
                      {rewardData.loot.reward_type === 'artifact' && rewardData.loot.css_effect?.icon ? (
                        <span className="text-3xl">{rewardData.loot.css_effect.icon}</span>
                      ) : (
                        <div 
                          className="w-10 h-10 rounded-lg flex items-center justify-center"
                          style={{ background: getRarityConfig(rewardData.loot.rarity).color + '30' }}
                        >
                          <Sparkles 
                            className="w-5 h-5" 
                            style={{ color: getRarityConfig(rewardData.loot.rarity).color }} 
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-medium">{rewardData.loot.name}</p>
                        <p 
                          className="text-xs"
                          style={{ color: getRarityConfig(rewardData.loot.rarity).color }}
                        >
                          {getRarityConfig(rewardData.loot.rarity).label} {formatDisplayLabel(rewardData.loot.reward_type)}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {rewardData.isDuplicate && rewardData.bonusXP && (
                    <p className="text-center text-sm text-yellow-500">
                      +{rewardData.bonusXP} XP (duplicate reward)
                    </p>
                  )}
                  
                  <Button 
                    onClick={handleClaim}
                    className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Claim Rewards
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Helper to get confetti colors by rarity
function getRarityColors(rarity: string): string[] {
  switch (rarity) {
    case 'common': return ['#9CA3AF', '#6B7280', '#4B5563'];
    case 'rare': return ['#3B82F6', '#2563EB', '#1D4ED8'];
    case 'epic': return ['#A855F7', '#9333EA', '#7C3AED'];
    case 'legendary': return ['#F59E0B', '#FBBF24', '#FCD34D', '#EF4444'];
    default: return ['#9CA3AF'];
  }
}
