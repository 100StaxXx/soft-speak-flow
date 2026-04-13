import { useCallback, useMemo, useState } from "react";
import { getProductsFromOfferings, isIAPAvailable, type IAPProduct } from "@/utils/appleIAP";
import { useToast } from "./use-toast";
import { useAuth } from "./useAuth";
import { useProfile } from "./useProfile";
import { useRevenueCat } from "./useRevenueCat";
import { getRevenueCatErrorMessage, isRevenueCatCancellationError } from "@/services/revenueCat";
import { trackPaywallEvent } from "@/utils/paywallTelemetry";

export function useAppleSubscription() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile } = useProfile();
  const {
    isAvailable,
    offerings,
    offeringsLoading,
    purchasePlan,
    restorePurchases,
    presentCustomerCenter,
  } = useRevenueCat();
  const [loading, setLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [manageLoading, setManageLoading] = useState(false);
  const hasReferralPricing = Boolean(profile?.referred_by_code);

  const products = useMemo<IAPProduct[]>(() => getProductsFromOfferings(offerings), [offerings]);
  const hasLoadedProducts = Boolean(offerings);
  const productsLoading = offeringsLoading;

  const reloadProducts = useCallback(async () => {
    setProductError(null);
    if (!products.length && isAvailable) {
      setProductError("No RevenueCat packages are available in the current offering.");
    }
    return products;
  }, [isAvailable, products]);

  const handlePurchase = useCallback(async (productId: string, surface: "trial_gate" | "premium" = "premium") => {
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

    const selectedProduct = products.find((product) => product.identifier === productId);
    if (!selectedProduct) {
      toast({
        title: "Unavailable",
        description: "Selected premium plan is not ready yet. Please try again in a moment.",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    setProductError(null);
    try {
      trackPaywallEvent("purchase_started", {
        surface,
        plan: selectedProduct.plan,
        packageTarget: selectedProduct.packageTarget,
        productId: selectedProduct.identifier,
        hasReferralPricing,
      });
      const customerInfo = await purchasePlan(selectedProduct.packageTarget);
      if (!customerInfo) {
        trackPaywallEvent("purchase_cancelled", {
          surface,
          plan: selectedProduct.plan,
          packageTarget: selectedProduct.packageTarget,
          productId: selectedProduct.identifier,
          hasReferralPricing,
        });
        return false;
      }

      trackPaywallEvent("purchase_completed", {
        surface,
        plan: selectedProduct.plan,
        packageTarget: selectedProduct.packageTarget,
        productId: selectedProduct.identifier,
        hasReferralPricing,
      });
      toast({
        title: "Premium unlocked",
        description: "Cosmiq Pro is now active on your account.",
      });
      return true;
    } catch (error) {
      if (isRevenueCatCancellationError(error)) {
        trackPaywallEvent("purchase_cancelled", {
          surface,
          plan: selectedProduct.plan,
          packageTarget: selectedProduct.packageTarget,
          productId: selectedProduct.identifier,
          hasReferralPricing,
        });
        return false;
      }

      const message = getRevenueCatErrorMessage(error);
      trackPaywallEvent("purchase_failed", {
        surface,
        plan: selectedProduct.plan,
        packageTarget: selectedProduct.packageTarget,
        productId: selectedProduct.identifier,
        hasReferralPricing,
        message,
      });
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
  }, [hasReferralPricing, products, purchasePlan, toast, user?.id]);

  const handleRestore = useCallback(async (surface: "trial_gate" | "premium" = "premium") => {
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
      const customerInfo = await restorePurchases();
      if (!customerInfo) {
        return false;
      }

      trackPaywallEvent("restore_completed", {
        surface,
        activeProductIdentifiers: customerInfo.allPurchasedProductIdentifiers,
      });
      toast({
        title: "Purchases restored",
        description: "Your App Store purchases have been restored successfully.",
      });
      return true;
    } catch (error) {
      const message = getRevenueCatErrorMessage(error);
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
      await presentCustomerCenter();
    } catch (error) {
      toast({
        title: "Unable to open Customer Center",
        description: getRevenueCatErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setManageLoading(false);
    }
  }, [presentCustomerCenter, toast]);

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
    hasReferralPricing,
  };
}
