/**
 * useGuildBlessings Hook
 * Manages blessing types, sending blessings, and active blessing effects
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface BlessingType {
  id: string;
  name: string;
  icon: string;
  description: string;
  effect_type: string;
  effect_value: number;
  effect_duration_hours: number;
  rarity: string;
  theme_color: string;
}

export interface Blessing {
  id: string;
  community_id: string | null;
  epic_id: string | null;
  sender_id: string;
  recipient_id: string;
  blessing_type_id: string;
  message: string | null;
  expires_at: string;
  is_active: boolean;
  created_at: string;
  blessing_type?: BlessingType;
  sender?: {
    email: string | null;
    onboarding_data: unknown;
  };
}

export interface BlessingCharges {
  charges_remaining: number;
  max_charges: number;
  last_refresh_at: string;
}

interface UseGuildBlessingsOptions {
  epicId?: string;
  communityId?: string;
}

export const useGuildBlessings = ({ epicId, communityId }: UseGuildBlessingsOptions) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch blessing types
  const { data: blessingTypes, isLoading: isLoadingTypes } = useQuery({
    queryKey: ["blessing-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guild_blessing_types")
        .select("*")
        .order("rarity", { ascending: true });

      if (error) throw error;
      return data as BlessingType[];
    },
  });

  // Fetch user's blessing charges
  const { data: charges, isLoading: isLoadingCharges } = useQuery({
    queryKey: ["blessing-charges", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("guild_blessing_charges")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      // If no charges exist, create them
      if (!data) {
        const { data: newCharges, error: insertError } = await supabase
          .from("guild_blessing_charges")
          .insert({ user_id: user.id })
          .select()
          .single();

        if (insertError) throw insertError;
        return newCharges as BlessingCharges;
      }

      // Check if charges should be refreshed (new day)
      const lastRefresh = new Date(data.last_refresh_at);
      const now = new Date();
      const isNewDay = lastRefresh.toDateString() !== now.toDateString();

      if (isNewDay && data.charges_remaining < data.max_charges) {
        const { data: refreshed, error: refreshError } = await supabase
          .from("guild_blessing_charges")
          .update({
            charges_remaining: data.max_charges,
            last_refresh_at: now.toISOString(),
          })
          .eq("user_id", user.id)
          .select()
          .single();

        if (refreshError) throw refreshError;
        return refreshed as BlessingCharges;
      }

      return data as BlessingCharges;
    },
    enabled: !!user,
    refetchInterval: 60000, // Check every minute for refresh
  });

  // Fetch active blessings for the user
  const { data: myBlessings, isLoading: isLoadingBlessings } = useQuery({
    queryKey: ["my-blessings", user?.id, epicId, communityId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("guild_blessings")
        .select(`
          *,
          blessing_type:guild_blessing_types(*),
          sender:profiles!guild_blessings_sender_id_fkey(email, onboarding_data)
        `)
        .eq("recipient_id", user.id)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (epicId) {
        query = query.eq("epic_id", epicId);
      } else if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Blessing[];
    },
    enabled: !!user,
  });

  // Fetch recent blessings in the guild (feed)
  const { data: recentBlessings } = useQuery({
    queryKey: ["guild-blessings-feed", epicId, communityId],
    queryFn: async () => {
      let query = supabase
        .from("guild_blessings")
        .select(`
          *,
          blessing_type:guild_blessing_types(*),
          sender:profiles!guild_blessings_sender_id_fkey(email, onboarding_data)
        `)
        .order("created_at", { ascending: false })
        .limit(20);

      if (epicId) {
        query = query.eq("epic_id", epicId);
      } else if (communityId) {
        query = query.eq("community_id", communityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Blessing[];
    },
    enabled: !!(epicId || communityId),
  });

  // Send a blessing
  const sendBlessing = useMutation({
    mutationFn: async ({
      recipientId,
      blessingTypeId,
      message,
    }: {
      recipientId: string;
      blessingTypeId: string;
      message?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      if (!charges || charges.charges_remaining <= 0) {
        throw new Error("No blessing charges remaining");
      }

      const blessingType = blessingTypes?.find(t => t.id === blessingTypeId);
      if (!blessingType) throw new Error("Invalid blessing type");

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + blessingType.effect_duration_hours);

      // Insert blessing
      const { data: blessing, error: blessingError } = await supabase
        .from("guild_blessings")
        .insert({
          community_id: communityId || null,
          epic_id: epicId || null,
          sender_id: user.id,
          recipient_id: recipientId,
          blessing_type_id: blessingTypeId,
          message,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single();

      if (blessingError) throw blessingError;

      // Decrement charges
      const { error: chargeError } = await supabase
        .from("guild_blessing_charges")
        .update({ charges_remaining: charges.charges_remaining - 1 })
        .eq("user_id", user.id);

      if (chargeError) throw chargeError;

      return blessing;
    },
    onSuccess: () => {
      toast({
        title: "Blessing sent! ✨",
        description: "Your ally has been blessed with magical power!",
      });
      queryClient.invalidateQueries({ queryKey: ["blessing-charges"] });
      queryClient.invalidateQueries({ queryKey: ["guild-blessings-feed"] });
      queryClient.invalidateQueries({ queryKey: ["my-blessings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send blessing",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate active buff effects
  const getActiveBuffs = () => {
    if (!myBlessings) return { xpMultiplier: 1, bossDamageMultiplier: 1, hasStreakShield: false };

    let xpMultiplier = 1;
    let bossDamageMultiplier = 1;
    let hasStreakShield = false;

    myBlessings.forEach(blessing => {
      const type = blessing.blessing_type;
      if (!type) return;

      switch (type.effect_type) {
        case 'xp_boost':
        case 'bond_boost':
          xpMultiplier *= type.effect_value;
          break;
        case 'boss_damage':
          bossDamageMultiplier *= type.effect_value;
          break;
        case 'streak_shield':
        case 'streak_revive':
          hasStreakShield = true;
          break;
      }
    });

    return { xpMultiplier, bossDamageMultiplier, hasStreakShield };
  };

  return {
    blessingTypes,
    charges,
    myBlessings,
    recentBlessings,
    sendBlessing,
    getActiveBuffs,
    isLoading: isLoadingTypes || isLoadingCharges || isLoadingBlessings,
    isSending: sendBlessing.isPending,
    canSendBlessing: (charges?.charges_remaining ?? 0) > 0,
  };
};
