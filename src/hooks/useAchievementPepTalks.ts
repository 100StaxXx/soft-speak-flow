import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface AchievementPepTalk {
  id: string;
  title: string;
  tier: string;
  earnedAt: string;
  pepTalkDuration?: string;
  pepTalkMessage?: string;
  pepTalkCategory?: string;
}

export const useAchievementPepTalks = () => {
  const { user } = useAuth();

  const { data: unlockedPepTalks = [], isLoading } = useQuery({
    queryKey: ["achievement-pep-talks", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("user_id", user.id)
        .not("metadata->>pepTalkMessage", "is", null)
        .order("earned_at", { ascending: false });

      if (error) throw error;

      return data.map((achievement) => {
        const metadata = achievement.metadata as Record<string, any> | null;
        return {
          id: achievement.id,
          title: achievement.title,
          tier: achievement.tier,
          earnedAt: achievement.earned_at,
          pepTalkDuration: metadata?.pepTalkDuration,
          pepTalkMessage: metadata?.pepTalkMessage,
          pepTalkCategory: metadata?.pepTalkCategory,
        };
      }) as AchievementPepTalk[];
    },
    enabled: !!user,
  });

  const getPepTalksByTier = (tier: string) => {
    return unlockedPepTalks.filter((pt) => pt.tier === tier);
  };

  const getLatestPepTalk = () => {
    return unlockedPepTalks[0];
  };

  return {
    unlockedPepTalks,
    isLoading,
    getPepTalksByTier,
    getLatestPepTalk,
  };
};
