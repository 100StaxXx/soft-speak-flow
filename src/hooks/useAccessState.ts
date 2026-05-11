import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "./useAuth";
import { useStoreKit } from "./useStoreKit";
import {
  buildLocalSubscriptionAccessState,
  readLocalSubscriptionAccess,
  storeKitTransactionMatchesUser,
} from "@/utils/localSubscriptionAccess";

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

function isInactiveSubscriptionAccessState(accessState: AccessState | null | undefined): boolean {
  return accessState?.access_source === "subscription" && !accessState.subscribed;
}

export function useAccessState() {
  const { user, loading: authLoading } = useAuth();
  const {
    activePlan: storeKitPlan,
    currentEntitlement,
    entitlementError,
    isLoading: storeKitLoading,
  } = useStoreKit();

  const currentStoreKitAccessState = useMemo<AccessState | null>(() => {
    return buildLocalSubscriptionAccessState(currentEntitlement, user?.id, storeKitPlan);
  }, [currentEntitlement, storeKitPlan, user?.id]);

  const rememberedLocalAccessState = useMemo<AccessState | null>(() => (
    readLocalSubscriptionAccess(user?.id)
  ), [user?.id]);

  const hasContradictoryStoreKitEntitlement = Boolean(
    currentEntitlement &&
    (
      !storeKitTransactionMatchesUser(currentEntitlement, user?.id) ||
      (!storeKitLoading && !currentStoreKitAccessState)
    ),
  );
  const canUseRememberedLocalAccess = Boolean(
    rememberedLocalAccessState &&
    !hasContradictoryStoreKitEntitlement &&
    (storeKitLoading || entitlementError),
  );

  const query = useQuery({
    queryKey: user ? queryKeys.access.detail(user.id) : queryKeys.access.all,
    queryFn: async (): Promise<AccessState> => {
      if (!user) return DEFAULT_ACCESS_STATE;

      try {
        const { data, error } = await supabase.functions.invoke("check-apple-subscription");
        if (error) throw error;

        const response = {
          ...DEFAULT_ACCESS_STATE,
          ...((data ?? {}) as Partial<AccessState>),
        };

        return response.subscribed ||
          isInactiveSubscriptionAccessState(response) ||
          !currentStoreKitAccessState
          ? response
          : currentStoreKitAccessState;
      } catch (error) {
        const localAccessState = currentStoreKitAccessState ??
          (canUseRememberedLocalAccess ? rememberedLocalAccessState : null);
        if (localAccessState) {
          return localAccessState;
        }
        throw error;
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchInterval: false,
  });

  const backendHasInactiveSubscriptionAccess = isInactiveSubscriptionAccessState(query.data);
  const canUseRememberedLocalAccessForRender =
    canUseRememberedLocalAccess && !backendHasInactiveSubscriptionAccess;
  const accessState =
    (backendHasInactiveSubscriptionAccess ? query.data : null) ??
    currentStoreKitAccessState ??
    (query.data?.subscribed ? query.data : null) ??
    (canUseRememberedLocalAccessForRender ? rememberedLocalAccessState : null) ??
    query.data ??
    DEFAULT_ACCESS_STATE;
  const waitingForStoreKitFallback =
    !!user &&
    !query.data?.subscribed &&
    !currentStoreKitAccessState &&
    !canUseRememberedLocalAccessForRender &&
    storeKitLoading;

  return {
    accessState,
    isLoading: authLoading || (!!user && (query.isLoading || waitingForStoreKitFallback)),
    error: query.error,
    refetch: query.refetch,
  };
}
