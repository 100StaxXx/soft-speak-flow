import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useAuth } from "./useAuth";
import { useStoreKit } from "./useStoreKit";
import {
  buildLocalSubscriptionAccessState,
  clearLocalSubscriptionAccess,
  readFreshLocalSubscriptionAccess,
  readLocalSubscriptionAccess,
  rememberLocalSubscriptionAccess,
  rememberRejectedLocalSubscriptionTransaction,
  storeKitTransactionMatchesUser,
} from "@/utils/localSubscriptionAccess";
import { parseFunctionInvokeError, type ParsedFunctionInvokeError } from "@/utils/supabaseFunctionErrors";
import type { AccessState } from "@/types/access";

export type { AccessSource, AccessState } from "@/types/access";

const DEFAULT_ACCESS_STATE: AccessState = {
  has_access: false,
  access_source: "none",
  trial_ends_at: null,
  subscribed: false,
};
const APPLE_BINDING_CONFLICT_CODE = "APPLE_BINDING_CONFLICT";
const APPLE_BINDING_MISSING_CODE = "APPLE_BINDING_MISSING";
const ACCESS_RECOVERY_RETRY_DELAYS_MS = [0, 5_000, 30_000, 120_000] as const;

function isInactiveSubscriptionAccessState(accessState: AccessState | null | undefined): boolean {
  return accessState?.access_source === "subscription" && !accessState.subscribed;
}

function isNeutralNoAccessState(accessState: AccessState | null | undefined): boolean {
  return Boolean(
    accessState &&
      accessState.access_source === "none" &&
      !accessState.has_access &&
      !accessState.subscribed,
  );
}

function canRetryAccessRecovery(parsed: ParsedFunctionInvokeError): boolean {
  if (parsed.code === APPLE_BINDING_MISSING_CODE) return true;
  if (parsed.category === "network" || parsed.category === "relay") return true;
  if (typeof parsed.status === "number" && parsed.status >= 500) return true;

  return false;
}

export function useAccessState() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [sessionRejectedTransactionId, setSessionRejectedTransactionId] = useState<string | null>(null);
  const recoveryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const recoveryKeyRef = useRef<string | null>(null);
  const {
    activePlan: storeKitPlan,
    currentEntitlement,
    entitlementError,
    isLoading: storeKitLoading,
  } = useStoreKit();

  const currentStoreKitAccessState = useMemo<AccessState | null>(() => {
    if (
      currentEntitlement?.transactionId &&
      currentEntitlement.transactionId === sessionRejectedTransactionId
    ) {
      return null;
    }

    return buildLocalSubscriptionAccessState(currentEntitlement, user?.id, storeKitPlan, {
      trustCurrentSession: true,
    });
  }, [currentEntitlement, sessionRejectedTransactionId, storeKitPlan, user?.id]);

  const rememberedLocalAccessState = readLocalSubscriptionAccess(user?.id);
  const freshLocalActivationAccessState = readFreshLocalSubscriptionAccess(user?.id);

  const hasDifferentUserStoreKitEntitlement = Boolean(
    currentEntitlement && !storeKitTransactionMatchesUser(currentEntitlement, user?.id),
  );
  const canUseFreshLocalActivationAccess = Boolean(
    freshLocalActivationAccessState &&
    !hasDifferentUserStoreKitEntitlement,
  );
  const hasContradictoryStoreKitEntitlement = Boolean(
    currentEntitlement &&
    (
      hasDifferentUserStoreKitEntitlement ||
      (!storeKitLoading && !currentStoreKitAccessState && !canUseFreshLocalActivationAccess)
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

        return response;
      } catch (error) {
        const localAccessState = currentStoreKitAccessState ??
          (canUseFreshLocalActivationAccess ? freshLocalActivationAccessState : null) ??
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
  const backendHasNeutralNoAccess = isNeutralNoAccessState(query.data);
  const backendHasRecoverableNoAccess = backendHasNeutralNoAccess || backendHasInactiveSubscriptionAccess;
  const canUseFreshLocalActivationAccessForRender =
    canUseFreshLocalActivationAccess && !backendHasInactiveSubscriptionAccess;
  const canUseRememberedLocalAccessForRender =
    canUseRememberedLocalAccess && !backendHasInactiveSubscriptionAccess;
  const graceAccessState =
    backendHasRecoverableNoAccess
      ? currentStoreKitAccessState ??
        (backendHasNeutralNoAccess && canUseFreshLocalActivationAccessForRender ? freshLocalActivationAccessState : null) ??
        (backendHasNeutralNoAccess && canUseRememberedLocalAccessForRender ? rememberedLocalAccessState : null)
      : null;
  const accessState =
    graceAccessState ??
    query.data ??
    (canUseFreshLocalActivationAccessForRender ? freshLocalActivationAccessState : null) ??
    (canUseRememberedLocalAccessForRender ? rememberedLocalAccessState : null) ??
    DEFAULT_ACCESS_STATE;
  const waitingForStoreKitFallback =
    !!user &&
    !query.data?.subscribed &&
    !currentStoreKitAccessState &&
    !canUseFreshLocalActivationAccessForRender &&
    !canUseRememberedLocalAccessForRender &&
    storeKitLoading;
  useEffect(() => {
    return () => {
      recoveryTimersRef.current.forEach((timer) => clearTimeout(timer));
      recoveryTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!user?.id || !backendHasInactiveSubscriptionAccess) return;
    clearLocalSubscriptionAccess(user.id);
  }, [backendHasInactiveSubscriptionAccess, user?.id]);

  useEffect(() => {
    if (!user?.id || !backendHasRecoverableNoAccess || !currentStoreKitAccessState) return;

    const transactionId = currentEntitlement?.transactionId?.trim();
    if (!transactionId) return;

    const recoveryKey = `${user.id}:${transactionId}`;
    if (recoveryKeyRef.current === recoveryKey) return;
    recoveryKeyRef.current = recoveryKey;

    recoveryTimersRef.current.forEach((timer) => clearTimeout(timer));
    recoveryTimersRef.current = [];
    let cancelled = false;

    const rejectLocalAccess = async () => {
      clearLocalSubscriptionAccess(user.id);
      rememberRejectedLocalSubscriptionTransaction(user.id, currentEntitlement);
      setSessionRejectedTransactionId(transactionId);
      queryClient.setQueryData(queryKeys.access.detail(user.id), DEFAULT_ACCESS_STATE);
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.detail(user.id) });
    };

    ACCESS_RECOVERY_RETRY_DELAYS_MS.forEach((delayMs) => {
      const timer = setTimeout(() => {
        void (async () => {
          if (cancelled) return;

          const { data, error } = await supabase.functions.invoke("verify-apple-receipt", {
            body: { transactionId },
          });

          if (cancelled) return;

          if (!error && !(data as { error?: unknown } | null)?.error) {
            recoveryTimersRef.current.forEach((pendingTimer) => clearTimeout(pendingTimer));
            recoveryTimersRef.current = [];
            await queryClient.invalidateQueries({ queryKey: queryKeys.access.detail(user.id) });
            return;
          }

          const parsed = await parseFunctionInvokeError(
            error ?? new Error(String((data as { error?: unknown })?.error ?? "Subscription verification failed")),
          );

          if (cancelled) return;

          if (parsed.code === APPLE_BINDING_CONFLICT_CODE) {
            recoveryTimersRef.current.forEach((pendingTimer) => clearTimeout(pendingTimer));
            recoveryTimersRef.current = [];
            if (currentEntitlement.isSandbox) {
              return;
            }
            await rejectLocalAccess();
            return;
          }

          if (!canRetryAccessRecovery(parsed)) {
            recoveryTimersRef.current.forEach((pendingTimer) => clearTimeout(pendingTimer));
            recoveryTimersRef.current = [];
          }
        })();
      }, delayMs);

      recoveryTimersRef.current.push(timer);
    });

    return () => {
      cancelled = true;
    };
  }, [
    backendHasRecoverableNoAccess,
    currentEntitlement,
    currentStoreKitAccessState,
    queryClient,
    user?.id,
  ]);

  return {
    accessState,
    isLoading: authLoading ||
      (!!user && (
        query.isLoading ||
        waitingForStoreKitFallback
      )),
    error: query.error,
    refetch: query.refetch,
  };
}
