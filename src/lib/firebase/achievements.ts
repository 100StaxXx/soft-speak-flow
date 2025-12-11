import { getDocuments, timestampToISO } from "./firestore";

export interface Achievement {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  icon?: string;
  earned_at?: string;
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export const getAchievements = async (userId: string): Promise<Achievement[]> => {
  const achievements = await getDocuments<Achievement>(
    "achievements",
    [["user_id", "==", userId]],
    "earned_at",
    "desc"
  );

  return achievements.map((achievement) => ({
    ...achievement,
    earned_at: timestampToISO(achievement.earned_at as any) || achievement.earned_at || undefined,
    created_at: timestampToISO(achievement.created_at as any) || achievement.created_at || undefined,
  }));
};

