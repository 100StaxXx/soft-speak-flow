/**
 * Hook for managing epic completion rewards
 * Handles fetching, equipping, and rolling loot rewards
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { 
  EpicReward, 
  UserEpicReward, 
  EquippedRewards, 
  RewardRevealData,
  RewardRarity 
} from "@/types/epicRewards";
import { STORY_TYPE_BADGES } from "@/types/epicRewards";

export const useEpicRewards = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all available rewards
  const { data: allRewards = [] } = useQuery({
    queryKey: ['epic-rewards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('epic_rewards')
        .select('*')
        .order('rarity', { ascending: true });
      
      if (error) throw error;
      return data as EpicReward[];
    },
    staleTime: 1000 * 60 * 60, // Cache for 1 hour
  });

  // Fetch user's unlocked rewards
  const { data: userRewards = [], isLoading } = useQuery({
    queryKey: ['user-epic-rewards', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_epic_rewards')
        .select('*, epic_rewards(*)')
        .eq('user_id', user.id)
        .order('unlocked_at', { ascending: false });
      
      if (error) throw error;
      return data as UserEpicReward[];
    },
    enabled: !!user?.id,
  });

  // Get equipped rewards by type
  const equippedRewards: EquippedRewards = {
    background: userRewards.find(r => r.is_equipped && r.epic_rewards?.reward_type === 'background') || null,
    frame: userRewards.find(r => r.is_equipped && r.epic_rewards?.reward_type === 'frame') || null,
    effect: userRewards.find(r => r.is_equipped && r.epic_rewards?.reward_type === 'effect') || null,
  };

  // Equip/unequip reward mutation
  const equipMutation = useMutation({
    mutationFn: async ({ rewardId, equip }: { rewardId: string; equip: boolean }) => {
      if (!user?.id) throw new Error('Not authenticated');
      
      const reward = userRewards.find(r => r.reward_id === rewardId);
      if (!reward) throw new Error('Reward not found');
      
      const rewardType = reward.epic_rewards?.reward_type;
      
      // If equipping, first unequip any currently equipped reward of same type
      if (equip && rewardType) {
        await supabase
          .from('user_epic_rewards')
          .update({ is_equipped: false })
          .eq('user_id', user.id)
          .eq('is_equipped', true)
          .in('reward_id', 
            allRewards
              .filter(r => r.reward_type === rewardType)
              .map(r => r.id)
          );
      }
      
      // Update the target reward
      const { error } = await supabase
        .from('user_epic_rewards')
        .update({ is_equipped: equip })
        .eq('id', reward.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-epic-rewards'] });
    },
    onError: (error) => {
      console.error('Failed to equip reward:', error);
      toast.error('Failed to update equipped item');
    },
  });

  // Roll for loot reward
  const rollLootReward = async (
    storyTypeSlug: string | null,
    epicId: string
  ): Promise<{ reward: EpicReward | null; isDuplicate: boolean; bonusXP?: number }> => {
    if (!user?.id) return { reward: null, isDuplicate: false };
    
    // Get eligible campaign rewards (universal + story-specific).
    // Exclude astral/theme rewards so campaign completion doesn't pull from adversary loot pools.
    const eligibleRewards = allRewards.filter(r => 
      (r.story_type_slug === null || r.story_type_slug === storyTypeSlug) &&
      r.adversary_theme === null
    );
    
    if (eligibleRewards.length === 0) {
      return { reward: null, isDuplicate: false };
    }
    
    // Get user's already owned reward IDs
    const ownedRewardIds = new Set(userRewards.map(ur => ur.reward_id));
    
    // Roll with weighted random selection (up to 3 attempts to avoid duplicates)
    let selectedReward: EpicReward | null = null;
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      selectedReward = weightedRandomSelect(eligibleRewards);
      if (!selectedReward || !ownedRewardIds.has(selectedReward.id)) {
        break;
      }
      attempts++;
    }
    
    // If all attempts resulted in duplicates, award bonus XP instead
    if (selectedReward && ownedRewardIds.has(selectedReward.id)) {
      const bonusXP = getBonusXPForRarity(selectedReward.rarity);
      return { reward: selectedReward, isDuplicate: true, bonusXP };
    }
    
    // Award the reward
    if (selectedReward) {
      const { error } = await supabase
        .from('user_epic_rewards')
        .insert({
          user_id: user.id,
          reward_id: selectedReward.id,
          epic_id: epicId,
        });
      
      if (error) {
        console.error('Failed to award reward:', error);
        return { reward: null, isDuplicate: false };
      }
      
      queryClient.invalidateQueries({ queryKey: ['user-epic-rewards'] });
    }
    
    return { reward: selectedReward, isDuplicate: false };
  };

  // Generate reward reveal data for epic completion
  const generateRewardReveal = async (
    storyTypeSlug: string | null,
    epicId: string
  ): Promise<RewardRevealData> => {
    // Get badge info
    const badgeKey = storyTypeSlug || 'treasure_hunt';
    const badgeInfo = STORY_TYPE_BADGES[badgeKey] || STORY_TYPE_BADGES.treasure_hunt;
    
    // Roll for loot
    const { reward, isDuplicate, bonusXP } = await rollLootReward(storyTypeSlug, epicId);
    
    return {
      badge: {
        title: badgeInfo.title,
        description: badgeInfo.description,
        icon: badgeInfo.icon,
        tier: badgeInfo.tier,
      },
      loot: reward,
      isDuplicate,
      bonusXP,
    };
  };

  return {
    allRewards,
    userRewards,
    equippedRewards,
    isLoading,
    equipReward: equipMutation.mutate,
    isEquipping: equipMutation.isPending,
    rollLootReward,
    generateRewardReveal,
  };
};

// Helper: Weighted random selection
function weightedRandomSelect(rewards: EpicReward[]): EpicReward | null {
  if (rewards.length === 0) return null;
  
  const totalWeight = rewards.reduce((sum, r) => sum + r.drop_weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const reward of rewards) {
    random -= reward.drop_weight;
    if (random <= 0) {
      return reward;
    }
  }
  
  return rewards[rewards.length - 1];
}

// Helper: Bonus XP for duplicate rewards by rarity
function getBonusXPForRarity(rarity: RewardRarity): number {
  switch (rarity) {
    case 'common': return 25;
    case 'rare': return 50;
    case 'epic': return 100;
    case 'legendary': return 200;
    default: return 25;
  }
}
