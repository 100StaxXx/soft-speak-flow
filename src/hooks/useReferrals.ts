import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

// Secure response type from apply_referral_code_secure RPC
interface ApplyReferralResult {
  success: boolean;
  message: string;
}

export const useReferrals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's referral code from profiles table (auto-generated on signup)
  const { data: referralStats, isLoading } = useQuery({
    queryKey: ["referral-stats", user?.id],
    staleTime: 5 * 60 * 1000, // 5 minutes - referral stats don't change frequently
    queryFn: async () => {
      if (!user) return null;

      // Get referral code and count from profiles (code is auto-generated via trigger)
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("referral_code, referral_count, referred_by_code")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) return null;

      return {
        referral_code: profileData.referral_code || null,
        referral_count: profileData.referral_count || 0,
        referred_by: profileData.referred_by_code,
      };
    },
    enabled: !!user,
  });

  // Fetch unlocked skins
  const { data: unlockedSkins } = useQuery({
    queryKey: ["unlocked-skins", user?.id],
    staleTime: 5 * 60 * 1000, // 5 minutes
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
    staleTime: 10 * 60 * 1000, // 10 minutes - available skins rarely change
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

  // Apply referral code - uses secure server-side RPC
  const applyReferralCode = useMutation({
    mutationFn: async (code: string) => {
      if (!user) throw new Error("User not authenticated");

      const normalizedCode = code.trim().toUpperCase();

      // SECURITY FIX: Use secure RPC that handles everything server-side
      // This RPC validates the code, checks for self-referral, and applies it
      // without ever exposing owner_user_id or other sensitive data to the client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: result, error } = await (supabase.rpc as any)(
        "apply_referral_code_secure",
        { p_user_id: user.id, p_referral_code: normalizedCode }
      ) as { data: ApplyReferralResult[] | null; error: Error | null };

      if (error) {
        throw new Error("Unable to apply referral code. Please try again.");
      }

      const applyResult = (result?.[0] || result) as ApplyReferralResult | undefined;
      
      if (!applyResult?.success) {
        throw new Error(applyResult?.message || "Failed to apply referral code");
      }

      return { success: true };
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
