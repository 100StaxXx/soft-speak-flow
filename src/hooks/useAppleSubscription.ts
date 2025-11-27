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
      
      // Verify receipt with backend
      const { error } = await supabase.functions.invoke('verify-apple-receipt', {
        body: { receipt: purchase.receipt },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your subscription is now active",
      });

      return true;
    } catch (error: any) {
      console.error('Purchase error:', error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Please try again",
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
        // Verify the most recent receipt
        const latestPurchase = restored.purchases[0];
        await supabase.functions.invoke('verify-apple-receipt', {
          body: { receipt: latestPurchase.receipt },
        });

        toast({
          title: "Restored!",
          description: "Your subscription has been restored",
        });
      } else {
        toast({
          title: "No Purchases Found",
          description: "No previous purchases to restore",
        });
      }
    } catch (error: any) {
      console.error('Restore error:', error);
      toast({
        title: "Restore Failed",
        description: error.message || "Please try again",
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
