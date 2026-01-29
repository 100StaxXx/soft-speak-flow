import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useEffect } from "react";
import { getShoutByKey, ShoutType } from "@/data/shoutMessages";
import { getUserDisplayName } from "@/utils/getUserDisplayName";
import { logger } from "@/utils/logger";

export interface GuildShout {
  id: string;
  epic_id: string | null;
  community_id: string | null;
  sender_id: string;
  recipient_id: string;
  shout_type: ShoutType;
  message_key: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    email: string | null;
    onboarding_data?: unknown;
  };
  recipient?: {
    email: string | null;
    onboarding_data?: unknown;
  };
}

interface UseGuildShoutsOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildShouts = (options: UseGuildShoutsOptions | string = {}) => {
  // Support both old signature (epicId string) and new options object
  const { epicId, communityId } = typeof options === 'string' 
    ? { epicId: options, communityId: undefined } 
    : options;

  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const queryKeyId = communityId || epicId;
  const queryKeyType = communityId ? 'community' : 'epic';

  // Fetch shouts for an epic or community
  const { data: shouts, isLoading } = useQuery<GuildShout[]>({
    queryKey: ["guild-shouts", queryKeyType, queryKeyId],
    queryFn: async () => {
      if (!epicId && !communityId) return [];

      let query = supabase
        .from("guild_shouts")
        .select(`
          *,
          sender:profiles!guild_shouts_sender_id_fkey(email, onboarding_data),
          recipient:profiles!guild_shouts_recipient_id_fkey(email, onboarding_data)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (communityId) {
        query = query.eq("community_id", communityId);
      } else if (epicId) {
        query = query.eq("epic_id", epicId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as GuildShout[];
    },
    enabled: !!(epicId || communityId),
  });

  // Send a shout
  const sendShout = useMutation({
    mutationFn: async ({
      recipientId,
      shoutType,
      messageKey,
    }: {
      recipientId: string;
      shoutType: ShoutType;
      messageKey: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      if (!epicId && !communityId) throw new Error("No epic or community specified");

      // Prevent sending shouts to yourself
      if (recipientId === user.id) {
        throw new Error("You cannot send a shout to yourself");
      }

      const insertData = {
        sender_id: user.id,
        recipient_id: recipientId,
        shout_type: shoutType,
        message_key: messageKey,
        epic_id: epicId || null,
        community_id: communityId || null,
      };

      const { data, error } = await supabase
        .from("guild_shouts")
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Trigger push notification (fire and forget)
      const message = getShoutByKey(messageKey);
      
      // Fetch current user's profile to get their display name
      const { data: userProfile } = await supabase
        .from("profiles")
        .select("email, onboarding_data")
        .eq("id", user.id)
        .maybeSingle();
      
      const senderName = getUserDisplayName(userProfile);
      
      supabase.functions.invoke('send-shout-notification', {
        body: {
          shoutId: data.id,
          senderId: user.id,
          recipientId,
          epicId: epicId || null,
          communityId: communityId || null,
          senderName,
          shoutType,
          messageText: message?.text || 'Someone sent you a shout!',
        },
      }).catch(err => logger.error('Push notification failed', { error: err }));

      return data;
    },
    onSuccess: (_, variables) => {
      const message = getShoutByKey(variables.messageKey);
      toast.success(`Shout sent! ${message?.emoji || '📢'}`);
      queryClient.invalidateQueries({ queryKey: ["guild-shouts", queryKeyType, queryKeyId] });
    },
    onError: (error) => {
      toast.error("Failed to send shout");
      logger.error("Shout error", { error });
    },
  });

  // Mark shouts as read
  const markAsRead = useMutation({
    mutationFn: async (shoutIds: string[]) => {
      if (!user) return;

      const { error } = await supabase
        .from("guild_shouts")
        .update({ is_read: true })
        .in("id", shoutIds)
        .eq("recipient_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guild-shouts", queryKeyType, queryKeyId] });
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!epicId && !communityId) return;

    const filterColumn = communityId ? 'community_id' : 'epic_id';
    const filterValue = communityId || epicId;

    const channel = supabase
      .channel(`shouts-${filterColumn}-${filterValue}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guild_shouts',
          filter: `${filterColumn}=eq.${filterValue}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["guild-shouts", queryKeyType, queryKeyId] });
          
          // Show toast for received shouts
          if (payload.new && (payload.new as GuildShout).recipient_id === user?.id) {
            const message = getShoutByKey((payload.new as GuildShout).message_key);
            toast.info(`New shout: ${message?.emoji} ${message?.text || 'Someone sent you a shout!'}`);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.warn('Guild shouts subscription error', { status, error: err?.message });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [epicId, communityId, user?.id, queryClient, queryKeyType, queryKeyId]);

  const unreadCount = shouts?.filter(s => s.recipient_id === user?.id && !s.is_read).length || 0;
  const myShouts = shouts?.filter(s => s.recipient_id === user?.id) || [];

  return {
    shouts,
    myShouts,
    unreadCount,
    isLoading,
    sendShout,
    markAsRead,
    isSending: sendShout.isPending,
  };
};
