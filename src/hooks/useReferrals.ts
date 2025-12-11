import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDocument, getDocuments, updateDocument, setDocument, timestampToISO } from "@/lib/firebase/firestore";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { retryWithBackoff } from "@/utils/retry";
import type { ApplyReferralCodeResult } from "@/types/referral-functions";

interface ReferralCodeData {
  id: string;
  code: string;
  owner_type: "user" | "influencer";
  owner_user_id: string | null;
  is_active: boolean;
}

export const useReferrals = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user's referral code from profiles table (auto-generated on signup)
  const { data: referralStats, isLoading } = useQuery({
    queryKey: ["referral-stats", user?.uid],
    queryFn: async () => {
      if (!user) return null;

      // Get referral code and count from profiles
      const profileData = await getDocument<{
        referral_code: string | null;
        referral_count: number;
        referred_by_code: string | null;
      }>("profiles", user.uid);

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
    queryKey: ["unlocked-skins", user?.uid],
    queryFn: async () => {
      if (!user) return [];

      const userSkins = await getDocuments(
        "user_companion_skins",
        [["user_id", "==", user.uid]],
        "acquired_at",
        "desc",
        100
      );

      // Fetch companion_skins details for each unlocked skin
      const skinsWithDetails = await Promise.all(
        userSkins.map(async (userSkin: any) => {
          const skinDetails = await getDocument("companion_skins", userSkin.skin_id);
          return {
            ...userSkin,
            companion_skins: skinDetails,
            acquired_at: timestampToISO(userSkin.acquired_at as any) || userSkin.acquired_at,
          };
        })
      );

      return skinsWithDetails;
    },
    enabled: !!user,
  });

  // Fetch available skins (for display)
  const { data: availableSkins } = useQuery({
    queryKey: ["available-skins"],
    queryFn: async () => {
      const skins = await getDocuments(
        "companion_skins",
        [["unlock_type", "==", "referral"]],
        "unlock_requirement",
        "asc",
        100
      );
      return skins;
    },
  });

  // Apply referral code
  const applyReferralCode = useMutation({
    mutationFn: async (code: string) => {
      if (!user) throw new Error("User not authenticated");

      const normalizedCode = code.trim().toUpperCase();

      // TODO: Migrate referral code validation to Firebase Cloud Function
      // Validate code - for now, check in referral_codes collection
      const referralCodes = await getDocuments(
        "referral_codes",
        [
          ["code", "==", normalizedCode],
          ["is_active", "==", true],
        ]
      );

      const codeData = referralCodes[0] as ReferralCodeData | undefined;

      if (!codeData) {
        throw new Error("Invalid referral code");
      }

      // Prevent self-referral for user codes
      if (codeData.owner_type === "user" && codeData.owner_user_id === user.uid) {
        throw new Error("Cannot use your own referral code");
      }

      if (codeData.owner_type === "user") {
        if (!codeData.owner_user_id) {
          throw new Error("Referral code is missing owner information");
        }

        // TODO: Migrate to Firebase Cloud Function for atomic operations
        // For now, update profile directly
        // const response = await fetch('https://YOUR-FIREBASE-FUNCTION/apply-referral-code', {
        //   method: 'POST',
        //   body: JSON.stringify({
        //     userId: user.uid,
        //     referrerId: codeData.owner_user_id,
        //     referralCode: normalizedCode,
        //   }),
        // });
        // const result = await response.json();
        // if (!result.success) {
        //   throw new Error(result.message ?? "Failed to apply referral code");
        // }
      }

      // Update profile with referred_by_code for payout tracking
      await updateDocument("profiles", user.uid, {
        referred_by_code: normalizedCode,
      });

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

      // Verify user owns this skin first
      const userSkins = await getDocuments(
        "user_companion_skins",
        [
          ["user_id", "==", user.uid],
          ["skin_id", "==", skinId],
        ]
      );

      if (userSkins.length === 0) {
        throw new Error("You don't own this skin");
      }

      // Unequip all other skins first
      const allUserSkins = await getDocuments(
        "user_companion_skins",
        [["user_id", "==", user.uid]]
      );

      for (const skin of allUserSkins) {
        await updateDocument("user_companion_skins", skin.id, {
          is_equipped: false,
        });
      }

      // Equip the selected skin
      await updateDocument("user_companion_skins", userSkins[0].id, {
        is_equipped: true,
      });
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

      const equippedSkins = await getDocuments(
        "user_companion_skins",
        [
          ["user_id", "==", user.uid],
          ["is_equipped", "==", true],
        ]
      );

      for (const skin of equippedSkins) {
        await updateDocument("user_companion_skins", skin.id, {
          is_equipped: false,
        });
      }
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
