import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { purchaseProduct, restorePurchases, IAP_PRODUCTS, isIAPAvailable } from '@/utils/appleIAP';
import { useToast } from './use-toast';
import { useAuth } from './useAuth';
import { retryWithBackoff } from '@/utils/retry';
import { logger } from '@/utils/logger';

export function useAppleSubscription() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
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
    
    // Track original subscription state for rollback
    const originalSubscriptionData = queryClient.getQueryData(['subscription', user?.id]);
    
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

      // OPTIMISTIC UPDATE: Set subscription active immediately for better UX
      queryClient.setQueryData(['subscription', user?.id], (old: any) => ({
        ...old,
        subscribed: true,
        status: 'active',
        plan: productId.includes('yearly') ? 'yearly' : 'monthly',
      }));

      logger.info('Apple IAP purchase completed, verifying receipt...', { productId });

      // Verify receipt with retry logic (network issues are common on mobile)
      const { error } = await retryWithBackoff(
        () => supabase.functions.invoke('verify-apple-receipt', {
          body: { receipt },
        }),
        {
          maxAttempts: 3,
          initialDelay: 1000,
          shouldRetry: (error: unknown) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Retry on network errors, timeout errors
            return errorMessage.includes('fetch') || 
                   errorMessage.includes('network') ||
                   errorMessage.includes('timeout');
          }
        }
      );

      if (error) {
        // Rollback optimistic update on verification failure
        queryClient.setQueryData(['subscription', user?.id], originalSubscriptionData);
        throw error;
      }

      // Force immediate refetch to get server state (includes subscription_end, etc.)
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      await queryClient.refetchQueries({ queryKey: ['subscription', user?.id] });

      logger.info('Apple IAP verification successful', { productId });

      toast({
        title: "Success! 🎉",
        description: "Your subscription is now active",
      });

      return true;
    } catch (error) {
      logger.error('Apple IAP purchase error:', error);
      
      // Rollback optimistic update on error
      queryClient.setQueryData(['subscription', user?.id], originalSubscriptionData);
      
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
    
    // Track original state for rollback
    const originalSubscriptionData = queryClient.getQueryData(['subscription', user?.id]);
    
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

      // OPTIMISTIC UPDATE: Set active immediately
      queryClient.setQueryData(['subscription', user?.id], (old: any) => ({
        ...old,
        subscribed: true,
        status: 'active',
      }));

      logger.info('Restoring Apple IAP purchase...');

      // Verify with backend with retry
      const { error } = await retryWithBackoff(
        () => supabase.functions.invoke('verify-apple-receipt', {
          body: { receipt },
        }),
        {
          maxAttempts: 3,
          initialDelay: 1000,
        }
      );

      if (error) {
        // Rollback on error
        queryClient.setQueryData(['subscription', user?.id], originalSubscriptionData);
        throw error;
      }

      // Force refetch to get complete server state
      await queryClient.invalidateQueries({ queryKey: ['subscription'] });
      await queryClient.refetchQueries({ queryKey: ['subscription', user?.id] });

      logger.info('Apple IAP restore successful');

      toast({
        title: "Restored! 🎉",
        description: "Your subscription has been restored",
      });
    } catch (error) {
      logger.error('Apple IAP restore error:', error);
      
      // Rollback on error
      queryClient.setQueryData(['subscription', user?.id], originalSubscriptionData);
      
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
