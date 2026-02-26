import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  purchaseProduct,
  restorePurchases,
  IAP_PRODUCTS,
  isIAPAvailable,
  getProducts,
  IAPProduct,
  openManageSubscriptions,
  getAllIAPProductIds,
  getProductIdsForPlan,
  resolvePlanFromProductId,
} from '@/utils/appleIAP';
import { useToast } from './use-toast';

const PRODUCT_FETCH_ERROR_MESSAGE = "Premium subscriptions are temporarily unavailable. Please try again later.";
const PRODUCT_IDS = getAllIAPProductIds();

const toProductFetchErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (!message || message === 'undefined' || message === 'null') {
    return PRODUCT_FETCH_ERROR_MESSAGE;
  }
  if (/ios 15/i.test(message)) {
    return message;
  }
  return `${PRODUCT_FETCH_ERROR_MESSAGE} (${message})`;
};

export function useAppleSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [hasAttemptedProductFetch, setHasAttemptedProductFetch] = useState(false);
  const [manageLoading, setManageLoading] = useState(false);

  const fetchProducts = useCallback(async () => {
    console.log('[HOOK DEBUG] fetchProducts called');
    console.log('[HOOK DEBUG] IAP_PRODUCTS:', JSON.stringify(IAP_PRODUCTS));
    console.log('[HOOK DEBUG] isIAPAvailable:', isIAPAvailable());
    
    if (!isIAPAvailable()) {
      console.log('[HOOK DEBUG] IAP not available, setting error');
      setProducts([]);
      setProductError("In-App Purchases are only available on iOS devices");
      setHasAttemptedProductFetch(true);
      return [];
    }

    setProductsLoading(true);
    setProductError(null);

    try {
      console.log('[HOOK DEBUG] About to call getProducts...');
      const loadedProducts = await getProducts(PRODUCT_IDS);
      console.log('[HOOK DEBUG] getProducts returned:', loadedProducts.length, 'products');
      console.log('[HOOK DEBUG] Products:', JSON.stringify(loadedProducts));

      if (!loadedProducts.length) {
        console.log('[HOOK DEBUG] No products returned, throwing error');
        throw new Error(`No App Store products were returned for IDs: ${PRODUCT_IDS.join(', ')}`);
      }

      setProducts(loadedProducts);
      console.log('[HOOK DEBUG] Products set successfully');
      return loadedProducts;
    } catch (error) {
      console.error('[HOOK DEBUG] Product load error:', error);
      setProducts([]);
      setProductError(toProductFetchErrorMessage(error));
      return [];
    } finally {
      setProductsLoading(false);
      setHasAttemptedProductFetch(true);
      console.log('[HOOK DEBUG] fetchProducts complete');
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const ensureProductsAvailable = useCallback(async () => {
    console.log('[ENSURE DEBUG] ensureProductsAvailable called');
    console.log('[ENSURE DEBUG] hasAttemptedProductFetch:', hasAttemptedProductFetch);
    console.log('[ENSURE DEBUG] products.length:', products.length);
    
    if (!hasAttemptedProductFetch || products.length === 0) {
      console.log('[ENSURE DEBUG] Condition met - calling fetchProducts()');
      const loadedProducts = await fetchProducts();
      console.log('[ENSURE DEBUG] fetchProducts returned:', loadedProducts.length, 'products');
      const result = loadedProducts.length ? loadedProducts : null;
      console.log('[ENSURE DEBUG] Returning:', result ? 'products' : 'NULL');
      return result;
    }

    console.log('[ENSURE DEBUG] Using existing products:', products.length);
    return products;
  }, [fetchProducts, hasAttemptedProductFetch, products]);

  const handlePurchase = async (productId: string) => {
    console.log('[PURCHASE DEBUG] ========== handlePurchase START ==========');
    console.log('[PURCHASE DEBUG] productId:', productId);
    console.log('[PURCHASE DEBUG] isIAPAvailable():', isIAPAvailable());
    console.log('[PURCHASE DEBUG] Current products state:', products.length);
    console.log('[PURCHASE DEBUG] hasAttemptedProductFetch:', hasAttemptedProductFetch);
    
    if (!isIAPAvailable()) {
      console.log('[PURCHASE DEBUG] IAP not available - returning false');
      toast({
        title: "Not Available",
        description: "In-App Purchases are only available on iOS devices",
        variant: "destructive",
      });
      return false;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        title: "Connection required",
        description: "This action requires a live connection. Try again when online.",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      console.log('[PURCHASE DEBUG] Calling ensureProductsAvailable...');
      const availableProducts = await ensureProductsAvailable();
      console.log('[PURCHASE DEBUG] ensureProductsAvailable returned:', availableProducts ? availableProducts.length + ' products' : 'NULL');
      if (!availableProducts) {
        toast({
          title: "Unavailable",
          description: PRODUCT_FETCH_ERROR_MESSAGE,
          variant: "destructive",
        });
        return false;
      }

      console.log('[HOOK DEBUG] Checking productId:', productId);
      console.log('[HOOK DEBUG] Available identifiers:', availableProducts.map(p => p.identifier));
      const requestedPlan = resolvePlanFromProductId(productId);
      const candidateProductIds = requestedPlan ? getProductIdsForPlan(requestedPlan) : [productId];
      const matchedProduct = availableProducts.find((product) => candidateProductIds.includes(product.identifier));
      console.log('[HOOK DEBUG] matchedProduct:', matchedProduct?.identifier ?? 'none');
      if (!matchedProduct) {
        toast({
          title: "Unavailable",
          description: "Selected premium plan is not ready yet. Please try again in a moment.",
          variant: "destructive",
        });
        return false;
      }

      const purchase = await purchaseProduct(matchedProduct.identifier);
      
      console.log('[IAP] Purchase response:', JSON.stringify(purchase, null, 2));
      
      if (!purchase) {
        throw new Error("Purchase returned no data");
      }
      
      // Prefer transactionId for StoreKit 2 App Store Server API verification
      // Fall back to receipt for legacy verification
      const transactionId = purchase.transactionId;
      const receipt = purchase.receipt ?? purchase.transactionReceipt;
      
      console.log('[IAP] Verification payload:', { transactionId: !!transactionId, receipt: !!receipt });
      
      if (!transactionId && !receipt) {
        throw new Error("No transaction ID or receipt data available");
      }
      
      const { error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: transactionId ? { transactionId } : { receipt },
      });

      if (error) throw error;

      // Invalidate subscription cache to unlock app immediately
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });

      toast({
        title: "Success!",
        description: "Your subscription is now active",
      });

      return true;
    } catch (error) {
      console.error('Purchase error:', error);
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      toast({
        title: "Purchase Failed",
        description: errorMessage,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!isIAPAvailable()) {
      toast({
        title: "Not Available",
        description: "In-App Purchases are only available on iOS devices",
        variant: "destructive",
      });
      return;
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast({
        title: "Connection required",
        description: "This action requires a live connection. Try again when online.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const restored = await restorePurchases();
      
      if (!restored || !Array.isArray(restored) || restored.length === 0) {
        toast({
          title: "No Purchases Found",
          description: "No previous purchases to restore",
        });
        return;
      }

      // Type guard for purchase objects
      const isValidPurchase = (p: unknown): p is { 
        transactionDate?: number; 
        productId?: string;
        transactionId?: string;
        transactionReceipt?: string;
        receipt?: string;
      } => {
        return typeof p === 'object' && p !== null;
      };

      // Sort by date, newest first
      const sortedPurchases = [...restored]
        .filter(isValidPurchase)
        .sort((a, b) => {
          const dateA = a.transactionDate || 0;
          const dateB = b.transactionDate || 0;
          return dateB - dateA;
        });
      
      // Find subscription purchase (contains "premium" in product ID)
      const subscriptionPurchase = sortedPurchases.find(p => 
        resolvePlanFromProductId(p.productId) !== null
      );
      
      if (!subscriptionPurchase) {
        toast({
          title: "No Subscription Found",
          description: "No active subscription to restore",
        });
        return;
      }

      // Prefer transactionId for StoreKit 2 App Store Server API verification
      const transactionId = subscriptionPurchase.transactionId;
      const receipt = subscriptionPurchase.transactionReceipt ?? subscriptionPurchase.receipt;
      
      if (!transactionId && !receipt) {
        throw new Error("No transaction ID or receipt data available for subscription");
      }

      // Verify with backend - prefer transactionId for modern API
      const { error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: transactionId ? { transactionId } : { receipt },
      });

      if (error) {
        throw error;
      }

      // Invalidate subscription cache to unlock app immediately
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });

      toast({
        title: "Restored!",
        description: "Your subscription has been restored",
      });
    } catch (error) {
      console.error('Restore error:', error);
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      toast({
        title: "Restore Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscriptions = async () => {
    setManageLoading(true);

    try {
      await openManageSubscriptions();
      toast({
        title: "Manage Subscription",
        description: "Opening Apple's subscription settings...",
      });
    } catch (error) {
      console.error('Manage subscription error:', error);
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      toast({
        title: "Unable to open subscriptions",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setManageLoading(false);
    }
  };

  return {
    handlePurchase,
    handleRestore,
    handleManageSubscriptions,
    loading,
    manageLoading,
    products,
    productsLoading,
    productError,
    hasLoadedProducts: hasAttemptedProductFetch,
    reloadProducts: fetchProducts,
    isAvailable: isIAPAvailable(),
  };
}
