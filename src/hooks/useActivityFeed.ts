import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Json } from "@/integrations/supabase/types";

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
    queryKey: ['activity-feed', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('activity_feed')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data as ActivityFeedItem[];
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
      
      const { data: activity, error } = await supabase
        .from('activity_feed')
        .insert([{
          user_id: user.id,
          activity_type: type,
          activity_data: data as Json,
        }])
        .select()
        .maybeSingle();

      if (error) throw error;
      if (!activity) throw new Error("Failed to create activity");

      // Trigger AI comment generation in background (non-blocking)
      supabase.functions.invoke('generate-activity-comment', {
        body: { activityId: activity.id }
      }).then(({ error: invokeError }) => {
        if (invokeError) {
          console.error('Failed to generate activity comment:', invokeError);
        }
      }).catch((err) => {
        console.error('Activity comment generation failed:', err);
      });

      return activity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (activityId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from('activity_feed')
        .update({ is_read: true })
        .eq('id', activityId)
        .eq('user_id', user.id);
      
      if (error) throw error;
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
