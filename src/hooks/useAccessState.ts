import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "./useAuth";
import { useRevenueCat } from "./useRevenueCat";

export type AccessSource = "subscription" | "promo_code" | "trial" | "manual" | "none";

export interface AccessState {
  has_access: boolean;
  access_source: AccessSource;
  trial_ends_at: string | null;
  subscribed: boolean;
  status?: string;
  plan?: string;
  subscription_end?: string;
}

const DEFAULT_ACCESS_STATE: AccessState = {
  has_access: false,
  access_source: "none",
  trial_ends_at: null,
  subscribed: false,
};

export function useAccessState() {
  const { user, loading: authLoading } = useAuth();
  const { activeEntitlement, activePlan, isConfigured, isPro } = useRevenueCat();

  const query = useQuery({
    queryKey: user ? queryKeys.access.detail(user.id) : queryKeys.access.all,
    queryFn: async (): Promise<AccessState> => {
      if (!user) return DEFAULT_ACCESS_STATE;

      const { data, error } = await supabase.functions.invoke("check-apple-subscription");
      if (error) throw error;

      const response = (data ?? {}) as Partial<AccessState>;
      return {
        ...DEFAULT_ACCESS_STATE,
        ...response,
      };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
  });

  const accessState = useMemo(
    () => {
      const baseState = query.data ?? DEFAULT_ACCESS_STATE;

      if (!isConfigured || !activeEntitlement?.isActive || !isPro) {
        return baseState;
      }

      const status =
        activeEntitlement.billingIssueDetectedAt ? "past_due" :
        activeEntitlement.unsubscribeDetectedAt ? "cancelled" :
        activeEntitlement.periodType === "TRIAL" || activeEntitlement.periodType === "INTRO" ? "trialing" :
        "active";

      return {
        ...baseState,
        has_access: true,
        access_source: "subscription" as const,
        subscribed: true,
        status,
        plan: activePlan ?? baseState.plan,
        subscription_end: activeEntitlement.expirationDate,
      };
    },
    [activeEntitlement, activePlan, isConfigured, isPro, query.data],
  );

  return {
    accessState,
    isLoading: authLoading || (!!user && query.isLoading),
    error: query.error,
    refetch: query.refetch,
  };
}
