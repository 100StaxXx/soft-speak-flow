import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { retryWithBackoff } from "@/utils/retry";
import type { ApplyReferralCodeResult } from "@/types/referral-functions";

export const useReferrals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's referral stats
  const { data: referralStats, isLoading } = useQuery({
    queryKey: ["referral-stats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("referral_code, referral_count, referred_by")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch unlocked skins
  const { data: unlockedSkins } = useQuery({
    queryKey: ["unlocked-skins", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // FIX Bug #25: Add pagination limit for safety
      const { data, error } = await supabase
        .from("user_companion_skins")
        .select(`
          *,
          companion_skins (*)
        `)
        .eq("user_id", user.id)
        .order("acquired_at", { ascending: false })
        .limit(100); // Safety limit to prevent OOM with many skins

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch available skins (for display)
  const { data: availableSkins } = useQuery({
    queryKey: ["available-skins"],
    queryFn: async () => {
      // FIX Bug #25: Add pagination limit for safety
      const { data, error } = await supabase
        .from("companion_skins")
        .select("*")
        .eq("unlock_type", "referral")
        .order("unlock_requirement", { ascending: true })
        .limit(100); // Safety limit to prevent OOM if skin catalog grows

      if (error) throw error;
      return data;
    },
  });

  // Apply referral code
  const applyReferralCode = useMutation({
    mutationFn: async (code: string) => {
      if (!user) throw new Error("User not authenticated");

      // Validate code exists and get referrer
      const { data: referrer, error: referrerError } = await supabase
        .from("profiles")
        .select("id, referral_code")
        .eq("referral_code", code)
        .single();

      if (referrerError || !referrer) {
        throw new Error("Invalid referral code");
      }

      // FIX Bugs #15, #18, #21, #24: Use atomic function with retry logic and type safety
      const result = await retryWithBackoff<ApplyReferralCodeResult>(
        async () => {
          const { data, error } = await (supabase.rpc as any)(
            'apply_referral_code_atomic',
            {
              p_user_id: user.id,
              p_referrer_id: referrer.id,
              p_referral_code: code
            }
          );

          if (error) throw error;
          if (!data) throw new Error("No data returned from referral application");
          
          return data as unknown as ApplyReferralCodeResult;
        },
        {
          maxAttempts: 3,
          initialDelay: 1000,
          shouldRetry: (error: unknown) => {
            const msg = error instanceof Error ? error.message : String(error);
            
            // Don't retry business logic errors
            if (msg.includes('already_applied') ||
                msg.includes('invalid_code') ||
                msg.includes('self_referral')) {
              return false;
            }
            
            // Retry network/transient errors
            return msg.includes('network') ||
                   msg.includes('timeout') ||
                   msg.includes('temporarily unavailable') ||
                   msg.includes('connection') ||
                   msg.includes('ECONNRESET') ||
                   msg.includes('fetch');
          }
        }
      );

      if (!result || !result.success) {
        // Get user-friendly error message from database
        throw new Error(result?.message ?? "Failed to apply referral code");
      }

      return referrer;
    },
    onSuccess: () => {
      // Invalidate queries to trigger refetch (UI updates asynchronously)
      queryClient.invalidateQueries({ queryKey: ["referral-stats"] });
      toast.success("Referral code applied! Your friend will earn rewards when you reach Stage 3.");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Equip a skin
  const equipSkin = useMutation({
    mutationFn: async (skinId: string) => {
      if (!user) throw new Error("User not authenticated");

      // FIX Bug #13: Verify user owns this skin first
      const { data: ownedSkin, error: checkError } = await supabase
        .from("user_companion_skins")
        .select("id")
        .eq("user_id", user.id)
        .eq("skin_id", skinId)
        .maybeSingle();

      if (checkError) throw checkError;
      if (!ownedSkin) {
        throw new Error("You don't own this skin");
      }

      // Unequip all other skins first
      await supabase
        .from("user_companion_skins")
        .update({ is_equipped: false })
        .eq("user_id", user.id);

      // Equip the selected skin
      const { error } = await supabase
        .from("user_companion_skins")
        .update({ is_equipped: true })
        .eq("user_id", user.id)
        .eq("skin_id", skinId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unlocked-skins"] });
      toast.success("Skin equipped!");
    },
  });

  // Unequip current skin
  const unequipSkin = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("user_companion_skins")
        .update({ is_equipped: false })
        .eq("user_id", user.id)
        .eq("is_equipped", true);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unlocked-skins"] });
      toast.success("Skin unequipped");
    },
  });

  return {
    referralStats,
    unlockedSkins,
    availableSkins,
    isLoading,
    applyReferralCode,
    equipSkin,
    unequipSkin,
  };
};
