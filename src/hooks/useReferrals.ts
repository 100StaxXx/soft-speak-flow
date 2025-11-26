import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

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

      const { data, error } = await supabase
        .from("user_companion_skins")
        .select(`
          *,
          companion_skins (*)
        `)
        .eq("user_id", user.id);

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch available skins (for display)
  const { data: availableSkins } = useQuery({
    queryKey: ["available-skins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companion_skins")
        .select("*")
        .eq("unlock_type", "referral")
        .order("unlock_requirement", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Apply referral code
  const applyReferralCode = useMutation({
    mutationFn: async (code: string) => {
      if (!user) throw new Error("User not authenticated");

      // FIX: Check if user already has a referral code applied
      const { data: currentProfile } = await supabase
        .from("profiles")
        .select("referred_by")
        .eq("id", user.id)
        .single();

      if (currentProfile?.referred_by) {
        throw new Error("You have already used a referral code");
      }

      // Validate code exists and get referrer
      const { data: referrer, error: referrerError } = await supabase
        .from("profiles")
        .select("id, referral_code")
        .eq("referral_code", code)
        .single();

      if (referrerError || !referrer) {
        throw new Error("Invalid referral code");
      }

      // Can't refer yourself
      if (referrer.id === user.id) {
        throw new Error("You cannot use your own referral code");
      }

      // Update current user's referred_by (with extra safety check)
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ referred_by: referrer.id })
        .eq("id", user.id)
        .is("referred_by", null); // Only update if still null

      if (updateError) throw updateError;

      return referrer;
    },
    onSuccess: () => {
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
