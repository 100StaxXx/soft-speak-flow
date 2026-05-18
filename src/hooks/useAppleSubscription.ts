import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { isNativeIOS } from "@/utils/platformTargets";
import { useToast } from "./use-toast";
import { useAuth } from "./useAuth";
import { useAppliedReferralCodeState } from "./useAppliedReferralCodeState";
import { useStoreKit } from "./useStoreKit";
import { trackPaywallEvent } from "@/utils/paywallTelemetry";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { parseFunctionInvokeError, type ParsedFunctionInvokeError } from "@/utils/supabaseFunctionErrors";
import { getYearlyOfferDisplay, getYearlyOfferTier } from "@/utils/appleOfferPricing";
import type { StoreKitTransaction } from "@/types/subscription";
import {
  buildLocalSubscriptionAccessState,
  clearLocalSubscriptionAccess,
  rememberRejectedLocalSubscriptionTransaction,
  rememberLocalSubscriptionAccess,
} from "@/utils/localSubscriptionAccess";

const DEFERRED_VERIFICATION_RETRY_DELAYS_MS = [5_000, 30_000, 120_000] as const;
const APPLE_BINDING_CONFLICT_CODE = "APPLE_BINDING_CONFLICT";
export const APP_STORE_SUBSCRIPTION_ALREADY_LINKED_TITLE = "Subscription already linked";
export const APP_STORE_SUBSCRIPTION_ALREADY_LINKED_MESSAGE =
  "This App Store subscription is already linked to another Cosmiq account. Sign in to that account, or contact support if this is your purchase.";
const INACTIVE_ACCESS_STATE = {
  has_access: false,
  access_source: "none" as const,
  trial_ends_at: null,
  subscribed: false,
};

function isIAPAvailable(): boolean {
  return Capacitor.isNativePlatform() && isNativeIOS();
}

function isCancellationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const message = (error as { message?: string }).message ?? "";
  return message.includes("cancel") || message.includes("Cancel");
}

function getErrorMessage(error: unknown): string {
  if (typeof error === "string" && error) return error;
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong with subscriptions. Please try again.";
}

class SubscriptionVerificationError extends Error {
  parsed?: ParsedFunctionInvokeError;

  constructor(message: string, parsed?: ParsedFunctionInvokeError) {
    super(message);
    this.name = "SubscriptionVerificationError";
    this.parsed = parsed;
  }
}

function isAppleBindingConflict(error: unknown): boolean {
  if (!(error instanceof SubscriptionVerificationError)) return false;
  return error.parsed?.code === APPLE_BINDING_CONFLICT_CODE;
}

function getActivationErrorToast(error: unknown): { title: string; description: string } {
  if (isAppleBindingConflict(error)) {
    return {
      title: APP_STORE_SUBSCRIPTION_ALREADY_LINKED_TITLE,
      description: APP_STORE_SUBSCRIPTION_ALREADY_LINKED_MESSAGE,
    };
  }

  return {
    title: "Subscription activation failed",
    description: getErrorMessage(error),
  };
}

function canDeferServerVerification(error: unknown): boolean {
  if (!(error instanceof SubscriptionVerificationError)) return false;

  const parsed = error.parsed;
  if (!parsed) return false;

  if (parsed.code === "APPLE_BINDING_MISSING") return true;
  if (parsed.category === "network" || parsed.category === "relay") return true;
  if (typeof parsed.status === "number" && parsed.status >= 500) return true;

  return false;
}

export function useAppleSubscription() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { appliedReferralCodeState } = useAppliedReferralCodeState();
  const {
    isAvailable,
    products,
    productsLoading,
    purchase,
    redeemOfferCode,
    restorePurchases,
    manageSubscriptions,
    presentPaywallIfNeeded,
    presentCustomerCenter,
    refreshProducts,
  } = useStoreKit();
  const [loading, setLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [offerCodePurchaseReady, setOfferCodePurchaseReady] = useState(false);
  const deferredVerificationTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasOfferCode = appliedReferralCodeState.is_apple_offer_eligible;
  const hasAppliedReferralCode = Boolean(appliedReferralCodeState.code);
  const appliedReferralCode = appliedReferralCodeState.code;
  const activeYearlyOffer = hasOfferCode
    ? getYearlyOfferDisplay(
      getYearlyOfferTier(appliedReferralCodeState.apple_offer_campaign_identifier, appliedReferralCode),
    )
    : null;

  useEffect(() => {
    if (!hasOfferCode) {
      setOfferCodePurchaseReady(false);
    }
  }, [hasOfferCode]);

  const hasLoadedProducts = products.length > 0;

  const invalidateSubscriptionState = useCallback(async () => {
    if (!user?.id) return;

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.access.detail(user.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.subscription.detail(user.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.profile.detail(user.id) }),
      queryClient.invalidateQueries({ queryKey: ["subscription"] }),
      queryClient.invalidateQueries({ queryKey: ["referral-stats", user.id] }),
      queryClient.invalidateQueries({ queryKey: ["applied-referral-code-state", user.id] }),
    ]);
  }, [queryClient, user?.id]);

  const verifyStoreKitTransaction = useCallback(async (
    transaction: StoreKitTransaction,
    surface: string,
    plan: "monthly" | "yearly",
  ) => {
    const transactionId = transaction.transactionId?.trim();
    if (!transactionId) {
      throw new Error("Apple returned a purchase without a transaction identifier. Restore purchases and try again.");
    }

    trackPaywallEvent("purchase_verification_started", {
      surface,
      plan,
      productId: transaction.productId,
      transactionId,
      hasOfferCode,
    });

    const { data, error } = await supabase.functions.invoke("verify-apple-receipt", {
      body: { transactionId },
    });

    if (error) {
      const parsed = await parseFunctionInvokeError(error);
      const message = parsed.backendMessage ?? parsed.message ?? getErrorMessage(error);
      trackPaywallEvent("purchase_verification_failed", {
        surface,
        plan,
        productId: transaction.productId,
        transactionId,
        hasOfferCode,
        code: parsed.code,
        status: parsed.status,
        message,
      });
      throw new SubscriptionVerificationError(message, parsed);
    }

    const verification = data as { success?: boolean; error?: string; code?: string } | null;
    if (verification?.error) {
      trackPaywallEvent("purchase_verification_failed", {
        surface,
        plan,
        productId: transaction.productId,
        transactionId,
        hasOfferCode,
        code: verification.code,
        message: verification.error,
      });
      throw new Error(verification.error);
    }

    await invalidateSubscriptionState();
    trackPaywallEvent("purchase_verification_completed", {
      surface,
      plan,
      productId: transaction.productId,
      transactionId,
      hasOfferCode,
    });
  }, [hasOfferCode, invalidateSubscriptionState]);

  const grantLocalSubscriptionAccess = useCallback((
    transaction: StoreKitTransaction,
    plan: "monthly" | "yearly",
  ) => {
    if (!user?.id) return false;

    const accessState = buildLocalSubscriptionAccessState(transaction, user.id, plan, {
      trustCurrentSession: true,
      allowActivationGraceWithoutExpiration: true,
    });
    if (!accessState) return false;

    queryClient.setQueryData(queryKeys.access.detail(user.id), accessState);
    rememberLocalSubscriptionAccess(user.id, accessState, transaction);
    return true;
  }, [queryClient, user?.id]);

  const rejectLocalSubscriptionAccess = useCallback(async (
    transaction: StoreKitTransaction,
  ) => {
    if (!user?.id) return;

    clearLocalSubscriptionAccess(user.id);
    rememberRejectedLocalSubscriptionTransaction(user.id, transaction);
    queryClient.setQueryData(queryKeys.access.detail(user.id), INACTIVE_ACCESS_STATE);
    await invalidateSubscriptionState();
  }, [invalidateSubscriptionState, queryClient, user?.id]);

  const clearDeferredVerificationTimers = useCallback(() => {
    deferredVerificationTimersRef.current.forEach((timer) => clearTimeout(timer));
    deferredVerificationTimersRef.current = [];
  }, []);

  useEffect(() => clearDeferredVerificationTimers, [clearDeferredVerificationTimers]);

  const scheduleDeferredVerificationRetry = useCallback((
    transaction: StoreKitTransaction,
    surface: string,
    plan: "monthly" | "yearly",
  ) => {
    clearDeferredVerificationTimers();

    DEFERRED_VERIFICATION_RETRY_DELAYS_MS.forEach((delayMs) => {
      const timer = setTimeout(() => {
        void (async () => {
          try {
            await verifyStoreKitTransaction(transaction, `${surface}_deferred_retry`, plan);
            grantLocalSubscriptionAccess(transaction, plan);
            clearDeferredVerificationTimers();
          } catch (error) {
            if (isAppleBindingConflict(error)) {
              await rejectLocalSubscriptionAccess(transaction);
            }
            if (!canDeferServerVerification(error)) {
              clearDeferredVerificationTimers();
            }
          }
        })();
      }, delayMs);

      deferredVerificationTimersRef.current.push(timer);
    });
  }, [
    clearDeferredVerificationTimers,
    grantLocalSubscriptionAccess,
    rejectLocalSubscriptionAccess,
    verifyStoreKitTransaction,
  ]);

  const verifyCompletedTransaction = useCallback(async (
    transaction: StoreKitTransaction,
    surface: string,
    plan: "monthly" | "yearly",
  ) => {
    try {
      await verifyStoreKitTransaction(transaction, surface, plan);
      grantLocalSubscriptionAccess(transaction, plan);
      return true;
    } catch (error) {
      if (isAppleBindingConflict(error)) {
        clearDeferredVerificationTimers();
        await rejectLocalSubscriptionAccess(transaction);
      }

      if (canDeferServerVerification(error) && grantLocalSubscriptionAccess(transaction, plan)) {
        const parsed = error instanceof SubscriptionVerificationError ? error.parsed : undefined;
        trackPaywallEvent("purchase_verification_deferred", {
          surface,
          plan,
          productId: transaction.productId,
          hasOfferCode,
          code: parsed?.code,
          status: parsed?.status,
          message: getErrorMessage(error),
        });
        setProductError(null);
        scheduleDeferredVerificationRetry(transaction, surface, plan);
        return true;
      }

      const activationToast = getActivationErrorToast(error);
      setProductError(activationToast.description);
      toast({
        title: activationToast.title,
        description: activationToast.description,
        variant: "destructive",
      });
      return false;
    }
  }, [
    grantLocalSubscriptionAccess,
    hasOfferCode,
    clearDeferredVerificationTimers,
    rejectLocalSubscriptionAccess,
    scheduleDeferredVerificationRetry,
    toast,
    verifyStoreKitTransaction,
  ]);

  const reloadProducts = useCallback(async () => {
    setProductError(null);
    const loadedProducts = await refreshProducts();
    if (!loadedProducts.length && isAvailable) {
      setProductError("No products are available. Please try again later.");
    }
    return loadedProducts;
  }, [isAvailable, refreshProducts]);

  const handlePurchase = useCallback(async (productId: string, surface: string = "paywall") => {
    if (!isIAPAvailable()) {
      toast({
        title: "Not Available",
        description: "In-App Purchases are only available on iOS devices",
        variant: "destructive",
      });
      return false;
    }

    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in before purchasing Cosmiq.",
        variant: "destructive",
      });
      return false;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast({
        title: "Connection required",
        description: "This action requires a live connection. Try again when online.",
        variant: "destructive",
      });
      return false;
    }

    const plan = productId.includes("yearly") ? "yearly" : "monthly";
    const purchaseProductId = productId;
    const usesOfferCodeDiscount = hasOfferCode && plan === "yearly";

    setLoading(true);
    setProductError(null);
    try {
      if (usesOfferCodeDiscount && !offerCodePurchaseReady) {
        trackPaywallEvent("offer_code_redemption_started", {
          surface,
          plan,
          productId,
          hasOfferCode,
        });

        const redemption = await redeemOfferCode();

        trackPaywallEvent("offer_code_redemption_completed", {
          surface,
          plan,
          productId,
          hasOfferCode,
          status: redemption.status,
          entitlementActivated: Boolean(redemption.entitlement),
        });

        if (redemption.entitlement) {
          const verified = await verifyCompletedTransaction(redemption.entitlement, surface, plan);
          if (!verified) return false;

          toast({
            title: "Cosmiq unlocked",
            description: "Your discounted yearly access is now active.",
          });
          setOfferCodePurchaseReady(false);
          return true;
        }

        setOfferCodePurchaseReady(true);
        toast({
          title: "Finish redeeming with Apple",
          description: "Use the same code in Apple's redemption screen, then tap Subscribe Yearly to finish.",
        });
        return false;
      }

      trackPaywallEvent("purchase_started", {
        surface,
        plan,
        productId: purchaseProductId,
        hasOfferCode,
      });

      const result = await purchase(purchaseProductId);

      if (!result) {
        trackPaywallEvent("purchase_cancelled", { surface, plan, productId: purchaseProductId, hasOfferCode });
        return false;
      }

      setOfferCodePurchaseReady(false);
      const verified = await verifyCompletedTransaction(result, surface, plan);
      if (!verified) return false;

      trackPaywallEvent("purchase_completed", { surface, plan, productId: purchaseProductId, hasOfferCode });
      toast({
        title: "Cosmiq unlocked",
        description: usesOfferCodeDiscount
          ? "Your creator-code yearly discount is active on your account."
          : "Cosmiq is now active on your account.",
      });
      return true;
    } catch (error) {
      if (usesOfferCodeDiscount && !offerCodePurchaseReady) {
        trackPaywallEvent("offer_code_redemption_failed", {
          surface,
          plan,
          productId: purchaseProductId,
          hasOfferCode,
          message: getErrorMessage(error),
        });
      }
      if (isCancellationError(error)) {
        trackPaywallEvent("purchase_cancelled", { surface, plan, productId: purchaseProductId, hasOfferCode });
        return false;
      }

      const message = getErrorMessage(error);
      trackPaywallEvent("purchase_failed", { surface, plan, productId: purchaseProductId, hasOfferCode, message });
      setProductError(message);
      toast({
        title: "Purchase failed",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [
    hasOfferCode,
    offerCodePurchaseReady,
    purchase,
    redeemOfferCode,
    toast,
    user?.id,
    verifyCompletedTransaction,
  ]);

  const handleRestore = useCallback(async (surface: string = "paywall") => {
    if (!isIAPAvailable()) {
      toast({
        title: "Not Available",
        description: "Restore is only available on iOS devices",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      trackPaywallEvent("restore_started", { surface });
      const entitlement = await restorePurchases();

      if (entitlement) {
        const plan = entitlement.productId.includes("yearly") ? "yearly" : "monthly";
        const verified = await verifyCompletedTransaction(entitlement, surface, plan);
        if (!verified) return false;
      }

      trackPaywallEvent("restore_completed", { surface });
      toast({
        title: "Purchases restored",
        description: entitlement
          ? "Your App Store purchases have been restored successfully."
          : "No active subscriptions found.",
      });
      return Boolean(entitlement);
    } catch (error) {
      const message = getErrorMessage(error);
      trackPaywallEvent("restore_failed", { surface, message });
      toast({
        title: "Restore failed",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [restorePurchases, toast, verifyCompletedTransaction]);

  const handleManageSubscriptions = useCallback(async () => {
    if (!isIAPAvailable()) {
      toast({
        title: "Not Available",
        description: "Subscription management is only available in the iOS app",
        variant: "destructive",
      });
      return;
    }

    setManageLoading(true);
    try {
      await manageSubscriptions();
    } catch (error) {
      toast({
        title: "Unable to open subscription management",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setManageLoading(false);
    }
  }, [manageSubscriptions, toast]);

  const handlePresentRevenueCatPaywall = useCallback(async (surface: string = "revenuecat_paywall") => {
    if (!isIAPAvailable()) {
      toast({
        title: "Not Available",
        description: "RevenueCat Paywalls are only available in the native iOS app",
        variant: "destructive",
      });
      return false;
    }

    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in before purchasing Cosmiq.",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    setProductError(null);
    try {
      trackPaywallEvent("paywall_viewed", { surface, hasOfferCode });
      const purchasedOrRestored = await presentPaywallIfNeeded();
      await invalidateSubscriptionState();

      if (purchasedOrRestored) {
        toast({
          title: "Cosmiq unlocked",
          description: "Cosmiq is now active on your account.",
        });
      }

      return purchasedOrRestored;
    } catch (error) {
      const message = getErrorMessage(error);
      trackPaywallEvent("purchase_failed", { surface, hasOfferCode, message });
      setProductError(message);
      toast({
        title: "Unable to show paywall",
        description: message,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [hasOfferCode, invalidateSubscriptionState, presentPaywallIfNeeded, toast, user?.id]);

  const handlePresentCustomerCenter = useCallback(async () => {
    if (!isIAPAvailable()) {
      toast({
        title: "Not Available",
        description: "Customer Center is only available in the native iOS app",
        variant: "destructive",
      });
      return;
    }

    setManageLoading(true);
    try {
      await presentCustomerCenter();
      await invalidateSubscriptionState();
    } catch (error) {
      toast({
        title: "Unable to open Customer Center",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setManageLoading(false);
    }
  }, [invalidateSubscriptionState, presentCustomerCenter, toast]);

  return {
    handlePurchase,
    handleRestore,
    handleManageSubscriptions,
    handlePresentRevenueCatPaywall,
    handlePresentCustomerCenter,
    loading,
    manageLoading,
    isAvailable,
    products,
    productsLoading,
    productError,
    hasLoadedProducts,
    reloadProducts,
    hasOfferCode,
    activeYearlyOffer,
    hasAppliedReferralCode,
    appliedReferralCode,
    offerCodePurchaseReady,
  };
}
