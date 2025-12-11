import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { purchaseProduct, restorePurchases, IAP_PRODUCTS, isIAPAvailable, getProducts, IAPProduct, openManageSubscriptions } from '@/utils/appleIAP';
import { useToast } from './use-toast';

const PRODUCT_FETCH_ERROR_MESSAGE = "Premium subscriptions are temporarily unavailable. Please try again later.";

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
    if (!isIAPAvailable()) {
      setProducts([]);
      setProductError("In-App Purchases are only available on iOS devices");
      setHasAttemptedProductFetch(true);
      return [];
    }

    setProductsLoading(true);
    setProductError(null);

    try {
      const loadedProducts = await getProducts(Object.values(IAP_PRODUCTS));

      if (!loadedProducts.length) {
        throw new Error("No App Store products were returned");
      }

      setProducts(loadedProducts);
      return loadedProducts;
    } catch (error) {
      console.error('Product load error:', error);
      setProducts([]);
      setProductError(PRODUCT_FETCH_ERROR_MESSAGE);
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
    if (!isIAPAvailable()) {
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
        toast({
          title: "Unavailable",
          description: PRODUCT_FETCH_ERROR_MESSAGE,
          variant: "destructive",
        });
        return false;
      }

      const productExists = availableProducts.some((product) => product.productId === productId);
      if (!productExists) {
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
      
      // TODO: Migrate to Firebase Cloud Function
      // const response = await fetch('https://YOUR-FIREBASE-FUNCTION/verify-apple-receipt', {
      //   method: 'POST',
      //   body: JSON.stringify({ receipt }),
      // });
      // if (!response.ok) throw new Error('Receipt verification failed');
      
      throw new Error("Apple receipt verification needs Firebase Cloud Function migration");

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

      // TODO: Migrate to Firebase Cloud Function
      // const response = await fetch('https://YOUR-FIREBASE-FUNCTION/verify-apple-receipt', {
      //   method: 'POST',
      //   body: JSON.stringify({ receipt }),
      // });
      // if (!response.ok) throw new Error('Receipt verification failed');
      
      throw new Error("Apple receipt verification needs Firebase Cloud Function migration");

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
