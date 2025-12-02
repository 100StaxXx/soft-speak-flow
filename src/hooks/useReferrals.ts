import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { retryWithBackoff } from "@/utils/retry";
import type { ApplyReferralCodeResult } from "@/types/referral-functions";

export const useReferrals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's referral code from referral_codes table
  const { data: referralStats, isLoading } = useQuery({
    queryKey: ["referral-stats", user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get user's referral code from referral_codes table
      const { data: codeData, error: codeError } = await supabase
        .from("referral_codes")
        .select("code")
        .eq("owner_user_id", user.id)
        .eq("owner_type", "user")
        .maybeSingle();

      if (codeError) throw codeError;

      // Get referral count from profiles
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("referral_count, referred_by_code")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) return null;

      return {
        referral_code: codeData?.code || null,
        referral_count: profileData.referral_count || 0,
        referred_by: profileData.referred_by_code,
      };
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

      // Validate code using secure RPC function (prevents full table scans)
      const { data: codeResults, error: codeError } = await supabase
        .rpc("validate_referral_code", { p_code: code });
      
      const codeData = codeResults?.[0] || null;

      if (codeError) {
        console.error("Error fetching referral code:", codeError);
        throw new Error("Unable to validate referral code. Please try again.");
      }
      
      if (!codeData) {
        throw new Error("Invalid referral code");
      }

      // Prevent self-referral for user codes
      if (codeData.owner_type === "user" && codeData.owner_user_id === user.id) {
        throw new Error("Cannot use your own referral code");
      }

      // Update profile with referred_by_code
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ referred_by_code: code })
        .eq("id", user.id);

      if (updateError) throw updateError;

      return codeData;
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
