import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocuments, setDocument, updateDocument, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { generateActivityComment } from "@/lib/firebase/functions";

// Define activity data types based on activity types
export interface HabitActivityData {
  habitId?: string;
  habitName?: string;
  habit_title?: string;
  streak?: number;
}

export interface MissionActivityData {
  missionId?: string;
  missionTitle?: string;
  xpAwarded?: number;
}

export interface StreakActivityData {
  streak?: number;
  milestone?: number;
}

export interface EvolutionActivityData {
  newStage?: number;
  previousStage?: number;
}

export type ActivityData =
  | HabitActivityData
  | MissionActivityData
  | StreakActivityData
  | EvolutionActivityData
  | Record<string, unknown>;

export interface ActivityFeedItem {
  id: string;
  activity_type: string;
  activity_data: ActivityData;
  mentor_comment: string | null;
  mentor_voice_url: string | null;
  created_at: string;
  is_read: boolean;
}

export const useActivityFeed = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: activities, isLoading } = useQuery({
    queryKey: ['activity-feed', user?.uid],
    queryFn: async () => {
      if (!user) return [];
      const data = await getDocuments<ActivityFeedItem>(
        'activity_feed',
        [['user_id', '==', user.uid]],
        'created_at',
        'desc',
        50
      );
      
      // Convert Firestore timestamps to ISO strings
      return data.map(activity => ({
        ...activity,
        created_at: timestampToISO(activity.created_at as any) || activity.created_at || new Date().toISOString(),
      })) as ActivityFeedItem[];
    },
    enabled: !!user,
  });

  const logActivity = useMutation({
    mutationFn: async ({
      type,
      data
    }: {
      type: string;
      data: ActivityData;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      const activityId = `${user.uid}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const activity = {
        id: activityId,
        user_id: user.uid,
        activity_type: type,
        activity_data: data,
        mentor_comment: null,
        mentor_voice_url: null,
        is_read: false,
      };

      await setDocument('activity_feed', activityId, activity, false);

      // Trigger AI comment generation in background (non-blocking)
      generateActivityComment({
        activityData: activity,
        context: 'user_activity',
      }).catch((err) => {
      //   console.error('Activity comment generation failed:', err);
      // });

      return activity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (activityId: string) => {
      if (!user) throw new Error("Not authenticated");
      
      const activities = await getDocuments<{ user_id: string }>('activity_feed', [['id', '==', activityId]]);
      const activity = activities?.[0];
      if (!activity) throw new Error("Activity not found");
      if (activity.user_id !== user.uid) throw new Error("Unauthorized");
      
      await updateDocument('activity_feed', activityId, { is_read: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });

  return {
    activities: activities || [],
    isLoading,
    logActivity: logActivity.mutate,
    markAsRead: markAsRead.mutate,
  };
};
