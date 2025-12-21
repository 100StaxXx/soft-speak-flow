/**
 * useGuildArtifacts Hook
 * Manages guild artifacts and unlocks
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Json } from "@/integrations/supabase/types";

export interface GuildArtifact {
  id: string;
  name: string;
  description: string;
  icon: string;
  artifact_type: string;
  rarity: string;
  css_effect: Record<string, unknown> | null;
  unlock_requirement_type: string;
  unlock_requirement_value: number;
  image_url: string | null;
  created_at: string;
}

export interface UnlockedArtifact {
  id: string;
  artifact_id: string;
  community_id: string | null;
  epic_id: string | null;
  unlocked_by: string;
  unlocked_at: string;
  artifact: GuildArtifact;
  unlocker?: {
    email: string | null;
    onboarding_data: unknown;
  };
}

interface UseGuildArtifactsOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildArtifacts = ({ epicId, communityId }: UseGuildArtifactsOptions) => {
  // Fetch all artifacts
  const { data: allArtifacts, isLoading: isLoadingArtifacts } = useQuery({
    queryKey: ["guild-artifacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guild_artifacts")
        .select("*")
        .order("rarity", { ascending: false });

      if (error) throw error;
      
      return data.map(artifact => ({
        ...artifact,
        css_effect: artifact.css_effect as Record<string, unknown> | null,
      })) as GuildArtifact[];
    },
  });

  // Fetch unlocked artifacts for this guild
  const { data: unlockedArtifacts, isLoading: isLoadingUnlocked } = useQuery({
    queryKey: ["guild-unlocked-artifacts", epicId, communityId],
    queryFn: async () => {
      let query = supabase
        .from("guild_artifact_unlocks")
        .select(`
          *,
          artifact:guild_artifacts(*),
          unlocker:profiles!guild_artifact_unlocks_unlocked_by_fkey(email, onboarding_data)
        `)
        .order("unlocked_at", { ascending: false });

      if (epicId) {
        query = query.eq("epic_id", epicId);
      } else if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      return data.map(unlock => ({
        ...unlock,
        artifact: {
          ...unlock.artifact,
          css_effect: (unlock.artifact as { css_effect: Json }).css_effect as Record<string, unknown> | null,
        },
      })) as UnlockedArtifact[];
    },
    enabled: !!(epicId || communityId),
  });

  // Get rarity config
  const getRarityConfig = (rarity: string) => {
    switch (rarity) {
      case 'common':
        return {
          color: 'text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/30',
        };
      case 'rare':
        return {
          color: 'text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
        };
      case 'epic':
        return {
          color: 'text-purple-400',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/30',
        };
      case 'legendary':
        return {
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
        };
      default:
        return {
          color: 'text-primary',
          bgColor: 'bg-primary/10',
          borderColor: 'border-primary/30',
        };
    }
  };

  return {
    allArtifacts,
    unlockedArtifacts,
    getRarityConfig,
    isLoading: isLoadingArtifacts || isLoadingUnlocked,
    unlockedCount: unlockedArtifacts?.length || 0,
    totalCount: allArtifacts?.length || 0,
  };
};