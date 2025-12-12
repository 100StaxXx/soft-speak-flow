import { useQuery } from "@tanstack/react-query";
import { getDocuments, timestampToISO } from "@/lib/firebase/firestore";
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
    queryKey: ["achievement-pep-talks", user?.uid],
    queryFn: async () => {
      if (!user) return [];

      const allAchievements = await getDocuments(
        "achievements",
        [["user_id", "==", user.uid]],
        "earned_at",
        "desc"
      );

      // Filter achievements that have pepTalkMessage in metadata
      return allAchievements
        .filter(achievement => {
          const metadata = achievement.metadata as Record<string, any> | null;
          return metadata?.pepTalkMessage;
        })
        .map((achievement) => {
          const metadata = achievement.metadata as Record<string, any> | null;
          return {
            id: achievement.id,
            title: achievement.title,
            tier: achievement.tier,
            earnedAt: timestampToISO(achievement.earned_at as any) || achievement.earned_at || new Date().toISOString(),
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
