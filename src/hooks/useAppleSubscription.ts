import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { purchaseProduct, restorePurchases, IAP_PRODUCTS, isIAPAvailable } from '@/utils/appleIAP';
import { useToast } from './use-toast';

export function useAppleSubscription() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

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
      const purchase = await purchaseProduct(productId);
      
      if (!purchase) {
        throw new Error("Purchase returned no data");
      }
      
      // Verify receipt with backend
      const receipt = purchase.receipt;
      if (!receipt) {
        throw new Error("No receipt data available");
      }
      
      const { error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: { receipt },
      });

      if (error) throw error;

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
      
      if (!restored?.purchases || restored.purchases.length === 0) {
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
      const sortedPurchases = [...restored.purchases]
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
    isAvailable: isIAPAvailable(),
  };
}
