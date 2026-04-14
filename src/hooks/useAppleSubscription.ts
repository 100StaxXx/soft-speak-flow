import { useCallback, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { isNativeIOSHandheld } from "@/utils/platformTargets";
import { useToast } from "./use-toast";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";
import { useStoreKit } from "./useStoreKit";
import { trackPaywallEvent } from "@/utils/paywallTelemetry";

function isIAPAvailable(): boolean {
  return Capacitor.isNativePlatform() && isNativeIOSHandheld();
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
  const { profile } = useProfile();
  const {
    isAvailable,
    products,
    productsLoading,
    purchase,
    purchaseWithPromoOffer,
    restorePurchases,
    manageSubscriptions,
    refreshProducts,
  } = useStoreKit();
  const [loading, setLoading] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const hasOfferCode = Boolean(profile?.referred_by_code);

  const hasLoadedProducts = products.length > 0;

  const reloadProducts = useCallback(async () => {
    setProductError(null);
    await refreshProducts();
    if (!products.length && isAvailable) {
      setProductError("No products are available. Please try again later.");
    }
    return products;
  }, [isAvailable, products, refreshProducts]);

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

    const selectedProduct = products.find((p) => p.identifier === productId);
    if (!selectedProduct) {
      toast({
        title: "Unavailable",
        description: "Selected premium plan is not ready yet. Please try again in a moment.",
        variant: "destructive",
      });
      return false;
    }

    const plan = productId.includes("yearly") ? "yearly" : "monthly";

    setLoading(true);
    setProductError(null);
    try {
      trackPaywallEvent("purchase_started", {
        surface,
        plan,
        productId,
        hasOfferCode,
      });

      // Use promotional offer for yearly if user has an offer code
      const usePromoOffer = hasOfferCode && productId.includes("yearly");
      const result = usePromoOffer
        ? await purchaseWithPromoOffer(productId)
        : await purchase(productId);

      if (!result) {
        trackPaywallEvent("purchase_cancelled", { surface, plan, productId, hasOfferCode });
        return false;
      }

      trackPaywallEvent("purchase_completed", { surface, plan, productId, hasOfferCode });
      toast({
        title: "Premium unlocked",
        description: "Cosmiq Pro is now active on your account.",
      });
      return true;
    } catch (error) {
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
  }, [hasOfferCode, products, purchase, purchaseWithPromoOffer, toast, user?.id]);

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
  };
}
