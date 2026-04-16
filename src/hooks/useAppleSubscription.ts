import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { isNativeIOS } from "@/utils/platformTargets";
import { useToast } from "./use-toast";
import { useAuth } from "./useAuth";
import { useAppliedReferralCodeState } from "./useAppliedReferralCodeState";
import { useStoreKit } from "./useStoreKit";
import { trackPaywallEvent } from "@/utils/paywallTelemetry";

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

export function useAppleSubscription() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { appliedReferralCodeState } = useAppliedReferralCodeState();
  const {
    isAvailable,
    products,
    productsLoading,
    purchase,
    redeemOfferCode,
    restorePurchases,
    manageSubscriptions,
    refreshProducts,
  } = useStoreKit();
  const [loading, setLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [offerCodePurchaseReady, setOfferCodePurchaseReady] = useState(false);
  const hasOfferCode = appliedReferralCodeState.is_apple_offer_eligible;
  const hasAppliedReferralCode = Boolean(appliedReferralCodeState.code);
  const appliedReferralCode = appliedReferralCodeState.code;

  useEffect(() => {
    if (!hasOfferCode) {
      setOfferCodePurchaseReady(false);
    }
  }, [hasOfferCode]);

  const hasLoadedProducts = products.length > 0;

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
        description: "Please sign in before purchasing Cosmiq Pro.",
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
          toast({
            title: "Premium unlocked",
            description: "Your discounted yearly access is now active.",
          });
          setOfferCodePurchaseReady(false);
          return true;
        }

        setOfferCodePurchaseReady(true);
        toast({
          title: "Finish redeeming with Apple",
          description:
            redemption.status === "opened_url"
              ? "Complete the Apple offer-code redemption, then return and tap Subscribe Yearly."
              : "Use the same code in Apple's redemption screen, then tap Subscribe Yearly to finish.",
        });
        return false;
      }

      trackPaywallEvent("purchase_started", {
        surface,
        plan,
        productId,
        hasOfferCode,
      });

      const result = await purchase(productId);

      if (!result) {
        trackPaywallEvent("purchase_cancelled", { surface, plan, productId, hasOfferCode });
        return false;
      }

      setOfferCodePurchaseReady(false);
      trackPaywallEvent("purchase_completed", { surface, plan, productId, hasOfferCode });
      toast({
        title: "Premium unlocked",
        description: "Cosmiq Pro is now active on your account.",
      });
      return true;
    } catch (error) {
      if (usesOfferCodeDiscount && !offerCodePurchaseReady) {
        trackPaywallEvent("offer_code_redemption_failed", {
          surface,
          plan,
          productId,
          hasOfferCode,
          message: getErrorMessage(error),
        });
      }
      if (isCancellationError(error)) {
        trackPaywallEvent("purchase_cancelled", { surface, plan, productId, hasOfferCode });
        return false;
      }

      const message = getErrorMessage(error);
      trackPaywallEvent("purchase_failed", { surface, plan, productId, hasOfferCode, message });
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
  }, [hasOfferCode, offerCodePurchaseReady, purchase, redeemOfferCode, toast, user?.id]);

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
  }, [restorePurchases, toast]);

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

  return {
    handlePurchase,
    handleRestore,
    handleManageSubscriptions,
    loading,
    manageLoading,
    isAvailable,
    products,
    productsLoading,
    productError,
    hasLoadedProducts,
    reloadProducts,
    hasOfferCode,
    hasAppliedReferralCode,
    appliedReferralCode,
    offerCodePurchaseReady,
  };
}
