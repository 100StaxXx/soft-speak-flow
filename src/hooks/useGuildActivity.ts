import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocuments, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { useEffect } from "react";
import { onSnapshot, query, where, collection, orderBy, limit } from "firebase/firestore";
import { firebaseDb } from "@/lib/firebase";

export interface GuildActivity {
  id: string;
  epic_id: string;
  user_id: string;
  activity_type: string;
  activity_data: Record<string, any>;
  created_at: string;
}

export const useGuildActivity = (epicId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: activities, isLoading } = useQuery<GuildActivity[]>({
    queryKey: ["guild-activity", epicId],
    queryFn: async () => {
      if (!epicId) return [];

      const data = await getDocuments<GuildActivity>(
        "epic_activity_feed",
        [["epic_id", "==", epicId]],
        "created_at",
        "desc",
        20
      );

      return data.map(activity => ({
        ...activity,
        created_at: timestampToISO(activity.created_at as any) || activity.created_at || new Date().toISOString(),
      }));
    },
    enabled: !!epicId,
    staleTime: 30 * 1000,
  });

  // Real-time subscription for new activity
  useEffect(() => {
    if (!epicId) return;

    const activityQuery = query(
      collection(firebaseDb, "epic_activity_feed"),
      where("epic_id", "==", epicId),
      orderBy("created_at", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(activityQuery, () => {
      queryClient.invalidateQueries({ queryKey: ["guild-activity", epicId] });
    }, (error) => {
      console.warn('Guild activity subscription error:', error);
    });

    return () => {
      unsubscribe();
    };
  }, [epicId, queryClient]);

  return {
    activities,
    isLoading,
  };
};
