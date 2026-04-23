import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "./useAuth";

export interface AppliedReferralCodeState {
  code: string | null;
  owner_type: string | null;
  affiliate_provider: string | null;
  is_active: boolean;
  apple_offer_code_status: string | null;
  apple_offer_campaign_identifier: string | null;
  apple_offer_code_expires_at: string | null;
  is_apple_offer_eligible: boolean;
}

const EMPTY_STATE: AppliedReferralCodeState = {
  code: null,
  owner_type: null,
  affiliate_provider: null,
  is_active: false,
  apple_offer_code_status: null,
  apple_offer_campaign_identifier: null,
  apple_offer_code_expires_at: null,
  is_apple_offer_eligible: false,
};

export const useAppliedReferralCodeState = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: queryKeys.referrals.appliedCodeState(user?.id),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!user?.id) {
        return EMPTY_STATE;
      }

      const { data, error } = await (supabase.rpc as any)(
        "get_applied_referral_code_state",
        { p_user_id: user.id },
      ) as { data: AppliedReferralCodeState[] | AppliedReferralCodeState | null; error: Error | null };

      if (error) {
        throw error;
      }

      const result = Array.isArray(data) ? data[0] : data;
      return result ?? EMPTY_STATE;
    },
  });

  return {
    appliedReferralCodeState: query.data ?? EMPTY_STATE,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};
