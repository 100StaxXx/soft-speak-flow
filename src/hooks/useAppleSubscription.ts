import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { purchaseProduct, restorePurchases, IAP_PRODUCTS, isIAPAvailable, checkIAPPluginAvailable } from '@/utils/appleIAP';
import { useToast } from './use-toast';

export function useAppleSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pluginReady, setPluginReady] = useState<boolean | null>(null);

  // Check if IAP plugin is available on mount
  useEffect(() => {
    const checkPlugin = async () => {
      if (isIAPAvailable()) {
        const available = await checkIAPPluginAvailable();
        setPluginReady(available);
        if (!available) {
          console.warn('IAP plugin not available - purchases will not work');
        }
      } else {
        setPluginReady(false);
      }
    };
    checkPlugin();
  }, []);

  const handlePurchase = async (productId: string) => {
    if (!isIAPAvailable()) {
      toast({
        title: "Not Available",
        description: "In-App Purchases are only available on iOS devices",
        variant: "destructive",
      });
      return false;
    }

    if (pluginReady === false) {
      toast({
        title: "Service Unavailable",
        description: "In-App Purchase service is temporarily unavailable. Please restart the app and try again.",
        variant: "destructive",
      });
      return false;
    }

    setLoading(true);
    try {
      const purchase = await purchaseProduct(productId);
      
      if (!purchase) {
        throw new Error("Purchase was cancelled or failed");
      }
      
      // Verify receipt with backend
      const receipt = purchase.receipt || purchase.transactionReceipt;
      if (!receipt) {
        throw new Error("No receipt data available. Please try again.");
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

      return true;
    } catch (error) {
      console.error('Purchase error:', error);
      const errorMessage = error instanceof Error ? error.message : "Please try again";
      
      // Don't show toast for cancellation
      if (errorMessage.toLowerCase().includes('cancel')) {
        return false;
      }
      
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

  return {
    handlePurchase,
    handleRestore,
    loading,
    products: IAP_PRODUCTS,
    isAvailable: isIAPAvailable() && pluginReady !== false,
  };
}
