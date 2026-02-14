/**
 * Reward Inventory Component
 * View and equip earned epic rewards
 */

import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Image, Frame, Wand2, Gem, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEpicRewards } from "@/hooks/useEpicRewards";
import type { UserEpicReward, RewardType, RewardRarity } from "@/types/epicRewards";
import { RARITY_CONFIG } from "@/types/epicRewards";

interface RewardInventoryProps {
  className?: string;
}

const REWARD_TYPE_ICONS: Record<RewardType, typeof Image> = {
  background: Image,
  frame: Frame,
  effect: Wand2,
  artifact: Gem,
};

const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  background: 'Backgrounds',
  frame: 'Frames',
  effect: 'Effects',
  artifact: 'Artifacts',
};

export const RewardInventory = memo(({ className }: RewardInventoryProps) => {
  const { allRewards, userRewards, equipReward, isEquipping, isLoading } = useEpicRewards();
  const [activeTab, setActiveTab] = useState<RewardType>('background');

  // Group user rewards by type
  const groupedRewards = userRewards.reduce((acc, reward) => {
    const type = reward.epic_rewards?.reward_type;
    if (type) {
      if (!acc[type]) acc[type] = [];
      acc[type].push(reward);
    }
    return acc;
  }, {} as Record<RewardType, UserEpicReward[]>);

  // Get all possible rewards for showing locked items
  const allRewardsByType = allRewards.reduce((acc, reward) => {
    if (!acc[reward.reward_type]) acc[reward.reward_type] = [];
    acc[reward.reward_type].push(reward);
    return acc;
  }, {} as Record<RewardType, typeof allRewards>);

  const handleToggleEquip = (userReward: UserEpicReward) => {
    equipReward({ 
      rewardId: userReward.reward_id, 
      equip: !userReward.is_equipped 
    });
  };

  if (isLoading) {
    return (
      <Card className={cn("p-6 cosmiq-glass", className)}>
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("cosmiq-glass overflow-hidden", className)}>
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-lg">Reward Collection</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {userRewards.length} / {allRewards.length} rewards collected
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RewardType)}>
        <TabsList className="w-full justify-start rounded-none border-b border-border/50 bg-transparent p-0">
          {(Object.keys(REWARD_TYPE_LABELS) as RewardType[]).map((type) => {
            const Icon = REWARD_TYPE_ICONS[type];
            const count = groupedRewards[type]?.length || 0;
            return (
              <TabsTrigger
                key={type}
                value={type}
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent py-3"
              >
                <Icon className="w-4 h-4 mr-1.5" />
                <span className="hidden sm:inline">{REWARD_TYPE_LABELS[type]}</span>
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                    {count}
                  </Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {(Object.keys(REWARD_TYPE_LABELS) as RewardType[]).map((type) => (
          <TabsContent key={type} value={type} className="p-4 mt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {/* Unlocked rewards */}
                {groupedRewards[type]?.map((userReward) => (
                  <RewardCard
                    key={userReward.id}
                    userReward={userReward}
                    isEquipped={userReward.is_equipped}
                    onToggleEquip={() => handleToggleEquip(userReward)}
                    isEquipping={isEquipping}
                  />
                ))}
                
                {/* Locked rewards (silhouettes) */}
                {allRewardsByType[type]
                  ?.filter(reward => !userRewards.some(ur => ur.reward_id === reward.id))
                  .map((reward) => (
                    <LockedRewardCard key={reward.id} reward={reward} />
                  ))}
              </AnimatePresence>
            </div>

            {!groupedRewards[type]?.length && !allRewardsByType[type]?.length && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No {REWARD_TYPE_LABELS[type].toLowerCase()} available yet</p>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
});

RewardInventory.displayName = 'RewardInventory';

interface RewardCardProps {
  userReward: UserEpicReward;
  isEquipped: boolean;
  onToggleEquip: () => void;
  isEquipping: boolean;
}

const RewardCard = ({ userReward, isEquipped, onToggleEquip, isEquipping }: RewardCardProps) => {
  const reward = userReward.epic_rewards;
  if (!reward) return null;

  const rarityConfig = RARITY_CONFIG[reward.rarity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      <Card 
        className={cn(
          "relative p-3 cursor-pointer transition-all hover:scale-105",
          "border-2",
          isEquipped 
            ? "border-primary bg-primary/10" 
            : "border-border/50 hover:border-primary/50"
        )}
        onClick={onToggleEquip}
      >
        {/* Equipped indicator */}
        {isEquipped && (
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
            <Check className="w-4 h-4 text-primary-foreground" />
          </div>
        )}

        {/* Reward preview */}
        <div 
          className={cn(
            "aspect-square rounded-lg mb-2 flex items-center justify-center",
            "bg-gradient-to-br",
            rarityConfig.bgClass
          )}
          style={{
            boxShadow: isEquipped ? `0 0 20px ${rarityConfig.color}40` : undefined,
          }}
        >
          {reward.reward_type === 'artifact' && reward.css_effect?.icon ? (
            <span className="text-4xl">{reward.css_effect.icon}</span>
          ) : (
            <Sparkles 
              className="w-8 h-8" 
              style={{ color: rarityConfig.color }} 
            />
          )}
        </div>

        {/* Reward info */}
        <p className="font-medium text-sm truncate">{reward.name}</p>
        <p 
          className="text-xs truncate"
          style={{ color: rarityConfig.color }}
        >
          {rarityConfig.label}
        </p>

        {isEquipping && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center rounded-lg">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        )}
      </Card>
    </motion.div>
  );
};

interface LockedRewardCardProps {
  reward: { id: string; name: string; rarity: RewardRarity; reward_type: RewardType };
}

const LockedRewardCard = ({ reward: _reward }: LockedRewardCardProps) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Card className="relative p-3 border-2 border-dashed border-border/30 bg-muted/20">
        {/* Locked indicator */}
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-3 h-3 text-muted-foreground" />
        </div>

        {/* Silhouette preview */}
        <div className="aspect-square rounded-lg mb-2 flex items-center justify-center bg-muted/50">
          <Sparkles className="w-8 h-8 text-muted-foreground/30" />
        </div>

        {/* Reward info */}
        <p className="font-medium text-sm truncate text-muted-foreground">???</p>
        <p className="text-xs text-muted-foreground/50">
          Complete epics to unlock
        </p>
      </Card>
    </motion.div>
  );
};
