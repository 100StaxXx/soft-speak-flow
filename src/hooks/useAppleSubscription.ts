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
      return;
    }

    setLoading(true);
    try {
      const purchase = await purchaseProduct(productId);
      
      // Verify receipt with backend - use correct field from Capacitor IAP
      const { error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: { receipt: purchase.transactionReceipt || purchase.receipt },
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
      
      if (restored.purchases && restored.purchases.length > 0) {
        // Sort by date, newest first
        const sortedPurchases = [...restored.purchases].sort((a, b) => {
          const dateA = (a as { transactionDate?: number }).transactionDate || 0;
          const dateB = (b as { transactionDate?: number }).transactionDate || 0;
          return dateB - dateA;
        });
        
        // Find subscription purchase (contains "premium" in product ID)
        const subscriptionPurchase = sortedPurchases.find(p => 
          (p as { productId?: string }).productId?.includes('premium')
        );
        
        if (subscriptionPurchase) {
          // Verify with correct receipt field
          const { error } = await supabase.functions.invoke('verify-apple-receipt', {
            body: { receipt: subscriptionPurchase.transactionReceipt || subscriptionPurchase.receipt },
          });

          if (error) {
            throw error;
          }

          toast({
            title: "Restored!",
            description: "Your subscription has been restored",
          });
        } else {
          toast({
            title: "No Subscription Found",
            description: "No active subscription to restore",
          });
        }
      } else {
        toast({
          title: "No Purchases Found",
          description: "No previous purchases to restore",
        });
      }
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
