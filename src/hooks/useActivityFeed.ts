import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ActivityFeedItem {
  id: string;
  activity_type: string;
  activity_data: any;
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
      data: any;
    }) => {
      if (!user) throw new Error("Not authenticated");
      
      const { data: activity, error } = await supabase
        .from('activity_feed')
        .insert({
          user_id: user.id,
          activity_type: type,
          activity_data: data,
        })
        .select()
        .single();

      if (error) throw error;

      // Trigger AI comment generation in background
      supabase.functions.invoke('generate-activity-comment', {
        body: { activityId: activity.id }
      });

      return activity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] });
    },
  });

  const markAsRead = useMutation({
    mutationFn: async (activityId: string) => {
      const { error } = await supabase
        .from('activity_feed')
        .update({ is_read: true })
        .eq('id', activityId);
      
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
