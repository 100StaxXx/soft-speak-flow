import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { purchaseProduct, restorePurchases, IAP_PRODUCTS, isIAPAvailable, getProducts, IAPProduct } from '@/utils/appleIAP';
import { logger } from '@/utils/logger';
import { useToast } from './use-toast';

const PRODUCT_FETCH_ERROR_MESSAGE = "Premium subscriptions are temporarily unavailable. Please try again later.";
const log = logger.scope('useAppleSubscription');

const describeError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export function useAppleSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [hasAttemptedProductFetch, setHasAttemptedProductFetch] = useState(false);

  const fetchProducts = useCallback(async () => {
    const iapAvailable = isIAPAvailable();
    log.info('Fetching Apple IAP products', { iapAvailable });

    if (!iapAvailable) {
      setProducts([]);
      setProductError("In-App Purchases are only available on iOS devices");
      setHasAttemptedProductFetch(true);
      log.warn('Skipped product fetch because IAP is unavailable');
      return [];
    }

    setProductsLoading(true);
    setProductError(null);

    try {
      const productIds = Object.values(IAP_PRODUCTS);
      const loadedProducts = await getProducts(productIds);

      if (!loadedProducts.length) {
        throw new Error("No App Store products were returned");
      }

      setProducts(loadedProducts);
      log.info('Loaded Apple IAP products', {
        count: loadedProducts.length,
        productIds: loadedProducts.map((product) => product.productId),
      });
      return loadedProducts;
    } catch (error) {
      const details = describeError(error);
      log.error('Product load error', { details });
      setProducts([]);
      setProductError(`${PRODUCT_FETCH_ERROR_MESSAGE} (Details: ${details})`);
      return [];
    } finally {
      setProductsLoading(false);
      setHasAttemptedProductFetch(true);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const ensureProductsAvailable = useCallback(async () => {
    if (!hasAttemptedProductFetch || products.length === 0) {
      const loadedProducts = await fetchProducts();
      return loadedProducts.length ? loadedProducts : null;
    }

    return products;
  }, [fetchProducts, hasAttemptedProductFetch, products]);

  const handlePurchase = async (productId: string) => {
    log.info('Starting purchase flow', { productId });

    if (!isIAPAvailable()) {
      log.warn('handlePurchase called while IAP unavailable', { productId });
      toast({
        title: "Not Available",
        description: "In-App Purchases are only available on iOS devices",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      const availableProducts = await ensureProductsAvailable();
      if (!availableProducts) {
        log.warn('No products available during purchase attempt', { productId });
        toast({
          title: "Unavailable",
          description: PRODUCT_FETCH_ERROR_MESSAGE,
          variant: "destructive",
        });
        return false;
      }

      const productExists = availableProducts.some((product) => product.productId === productId);
      if (!productExists) {
        log.warn('Selected product missing from loaded products', {
          productId,
          availableProducts: availableProducts.map((product) => product.productId),
        });
        toast({
          title: "Unavailable",
          description: "Selected premium plan is not ready yet. Please try again in a moment.",
          variant: "destructive",
        });
        return false;
      }

      const purchase = await purchaseProduct(productId);
      
      if (!purchase) {
        throw new Error("Purchase returned no data");
      }
      
      // Verify receipt with backend
      const receipt = purchase.receipt ?? purchase.transactionReceipt;
      if (!receipt) {
        throw new Error("No receipt data available");
      }
      
      const { error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: { receipt },
      });

      if (error) throw error;

      // Invalidate subscription cache to unlock app immediately
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });

      toast({
        title: "Success!",
        description: "Your subscription is now active",
      });

      log.info('Purchase verified successfully', { productId });
      return true;
    } catch (error) {
      const details = describeError(error);
      log.error('Purchase error', { productId, details });
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      toast({
        title: "Purchase Failed",
        description: `${errorMessage}`,
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    log.info('Starting restore flow');

    if (!isIAPAvailable()) {
      log.warn('handleRestore called while IAP unavailable');
      toast({
        title: "Not Available",
        description: "In-App Purchases are only available on iOS devices",
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
        p.productId?.includes('premium')
      );
      
      if (!subscriptionPurchase) {
        toast({
          title: "No Subscription Found",
          description: "No active subscription to restore",
        });
        return;
      }

      // Safely access receipt field
      const receipt = subscriptionPurchase.transactionReceipt ?? subscriptionPurchase.receipt;
      if (!receipt) {
        throw new Error("No receipt data available for subscription");
      }

      // Verify with backend
      const { error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: { receipt },
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
      log.info('Subscription restored successfully', {
        productId: subscriptionPurchase.productId,
      });
    } catch (error) {
      const details = describeError(error);
      log.error('Restore error', { details });
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      toast({
        title: "Restore Failed",
        description: `${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    handlePurchase,
    handleRestore,
    loading,
    products,
    productsLoading,
    productError,
    hasLoadedProducts: hasAttemptedProductFetch,
    reloadProducts: fetchProducts,
    isAvailable: isIAPAvailable(),
  };
}
