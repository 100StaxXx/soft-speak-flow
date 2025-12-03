import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useEffect } from "react";
import { getShoutByKey, ShoutType } from "@/data/shoutMessages";
import { getUserDisplayName } from "@/utils/getUserDisplayName";

export interface GuildShout {
  id: string;
  epic_id: string;
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

export const useGuildShouts = (epicId?: string) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch shouts for an epic
  const { data: shouts, isLoading } = useQuery<GuildShout[]>({
    queryKey: ["guild-shouts", epicId],
    queryFn: async () => {
      if (!epicId) return [];

      const { data, error } = await supabase
        .from("guild_shouts")
        .select(`
          *,
          sender:profiles!guild_shouts_sender_id_fkey(email, onboarding_data),
          recipient:profiles!guild_shouts_recipient_id_fkey(email, onboarding_data)
        `)
        .eq("epic_id", epicId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as GuildShout[];
    },
    enabled: !!epicId,
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
      if (!user || !epicId) throw new Error("Not authenticated or no epic");

      // Prevent sending shouts to yourself
      if (recipientId === user.id) {
        throw new Error("You cannot send a shout to yourself");
      }

      const { data, error } = await supabase
        .from("guild_shouts")
        .insert({
          epic_id: epicId,
          sender_id: user.id,
          recipient_id: recipientId,
          shout_type: shoutType,
          message_key: messageKey,
        })
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
        .single();
      
      const senderName = getUserDisplayName(userProfile);
      
      supabase.functions.invoke('send-shout-notification', {
        body: {
          shoutId: data.id,
          senderId: user.id,
          recipientId,
          epicId,
          senderName,
          shoutType,
          messageText: message?.text || 'Someone sent you a shout!',
        },
      }).catch(err => console.error('Push notification failed:', err));

      return data;
    },
    onSuccess: (_, variables) => {
      const message = getShoutByKey(variables.messageKey);
      toast.success(`Shout sent! ${message?.emoji || '📢'}`);
      queryClient.invalidateQueries({ queryKey: ["guild-shouts", epicId] });
    },
    onError: (error) => {
      toast.error("Failed to send shout");
      console.error("Shout error:", error);
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
      queryClient.invalidateQueries({ queryKey: ["guild-shouts", epicId] });
    },
  });

  // Real-time subscription
  useEffect(() => {
    if (!epicId) return;

    const channel = supabase
      .channel(`shouts-${epicId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'guild_shouts',
          filter: `epic_id=eq.${epicId}`,
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ["guild-shouts", epicId] });
          
          // Show toast for received shouts
          if (payload.new && (payload.new as GuildShout).recipient_id === user?.id) {
            const message = getShoutByKey((payload.new as GuildShout).message_key);
            toast.info(`New shout: ${message?.emoji} ${message?.text || 'Someone sent you a shout!'}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [epicId, user?.id, queryClient]);

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
