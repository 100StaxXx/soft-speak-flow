/**
 * useGuildPresence Hook
 * Real-time presence tracking for guild members using Supabase Realtime
 */

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RealtimeChannel } from "@supabase/supabase-js";
import { logger } from "@/utils/logger";

export interface GuildMemberPresence {
  userId: string;
  onlineAt: string;
  status: 'online' | 'away' | 'busy';
  lastActivity?: string;
  companionImageUrl?: string;
  displayName?: string;
}

interface UseGuildPresenceOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildPresence = ({ epicId, communityId }: UseGuildPresenceOptions) => {
  const { user } = useAuth();
  const [onlineMembers, setOnlineMembers] = useState<GuildMemberPresence[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Get a unique channel name for this guild
  const channelName = epicId 
    ? `guild-presence-epic-${epicId}` 
    : communityId 
    ? `guild-presence-community-${communityId}`
    : null;

  // Fetch user display info for presence
  const fetchUserInfo = useCallback(async (userId: string) => {
    const [profileRes, companionRes] = await Promise.all([
      supabase.from("profiles").select("email, onboarding_data").eq("id", userId).maybeSingle(),
      supabase.from("user_companion").select("current_image_url").eq("user_id", userId).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const companion = companionRes.data;
    
    let displayName = "Adventurer";
    if (profile?.onboarding_data && typeof profile.onboarding_data === 'object') {
      const data = profile.onboarding_data as { nickname?: string };
      displayName = data.nickname || profile.email?.split('@')[0] || "Adventurer";
    } else if (profile?.email) {
      displayName = profile.email.split('@')[0];
    }

    return {
      displayName,
      companionImageUrl: companion?.current_image_url || undefined,
    };
  }, []);

  // Track presence
  useEffect(() => {
    if (!user || !channelName) return;

    const presenceChannel = supabase.channel(channelName, {
      config: {
        presence: { key: user.id },
      },
    });

    // Handle presence sync
    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const members: GuildMemberPresence[] = [];

      Object.entries(state).forEach(([userId, presences]) => {
        if (Array.isArray(presences) && presences.length > 0) {
          const presence = presences[0] as unknown as {
            online_at: string;
            status: 'online' | 'away' | 'busy';
            display_name?: string;
            companion_image_url?: string;
          };
          
          members.push({
            userId,
            onlineAt: presence.online_at,
            status: presence.status || 'online',
            displayName: presence.display_name,
            companionImageUrl: presence.companion_image_url,
          });
        }
      });

      setOnlineMembers(members);
    });

    // Handle join
    presenceChannel.on('presence', { event: 'join' }, async ({ key }) => {
      logger.debug('Guild member joined', { userId: key });
    });

    // Handle leave
    presenceChannel.on('presence', { event: 'leave' }, ({ key }) => {
      logger.debug('Guild member left', { userId: key });
    });

    // Subscribe and track presence
    presenceChannel.subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        
        // Get user info for presence
        const userInfo = await fetchUserInfo(user.id);
        
        // Track our presence
        await presenceChannel.track({
          online_at: new Date().toISOString(),
          status: 'online',
          display_name: userInfo.displayName,
          companion_image_url: userInfo.companionImageUrl,
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        logger.warn('Guild presence subscription error', { status, error: err?.message });
        setIsConnected(false);
      }
    });

    setChannel(presenceChannel);

    return () => {
      presenceChannel.unsubscribe();
      setIsConnected(false);
    };
  }, [user, channelName, fetchUserInfo]);

  // Update status
  const updateStatus = useCallback(async (status: 'online' | 'away' | 'busy') => {
    if (!channel || !user) return;

    const userInfo = await fetchUserInfo(user.id);
    
    await channel.track({
      online_at: new Date().toISOString(),
      status,
      display_name: userInfo.displayName,
      companion_image_url: userInfo.companionImageUrl,
    });
  }, [channel, user, fetchUserInfo]);

  // Get online count excluding self
  const onlineCount = onlineMembers.length;
  const othersOnlineCount = onlineMembers.filter(m => m.userId !== user?.id).length;

  return {
    onlineMembers,
    onlineCount,
    othersOnlineCount,
    isConnected,
    updateStatus,
    isUserOnline: (userId: string) => onlineMembers.some(m => m.userId === userId),
    getUserPresence: (userId: string) => onlineMembers.find(m => m.userId === userId),
  };
};
