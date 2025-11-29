import { Capacitor } from '@capacitor/core';

// Apple IAP Product IDs - configure these in App Store Connect
export const IAP_PRODUCTS = {
  MONTHLY: 'com.revolutions.app.premium.monthly',
  YEARLY: 'com.revolutions.app.premium.yearly',
};

// Check if IAP is available (iOS native only)
export const isIAPAvailable = () => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

// Purchase a product
export const purchaseProduct = async (productId: string): Promise<any> => {
  if (!isIAPAvailable()) {
    throw new Error('In-App Purchases are only available on iOS');
  }

  try {
    // Dynamically import to avoid build errors when package is not installed
    const InAppPurchase = (window as any).CapacitorInAppPurchases;
    
    if (!InAppPurchase) {
      throw new Error('In-App Purchase plugin not available. Please install @capacitor-community/in-app-purchases');
    }
    
    const result = await InAppPurchase.buy({
      productIdentifier: productId,
    });

    // Check transaction state - handle different purchase states
    if (result.state === 'deferred') {
      throw new Error('Purchase is pending approval. Please check with the account owner.');
    }
    
    if (result.state === 'failed') {
      throw new Error('Purchase failed. Please try again.');
    }
    
    if (result.state === 'cancelled') {
      throw new Error('Purchase was cancelled.');
    }
    
    // Only return if purchase was successful or restored
    if (result.state !== 'purchased' && result.state !== 'restored') {
      throw new Error(`Unexpected transaction state: ${result.state}`);
    }

    return result;
  } catch (error) {
    console.error('Purchase failed:', error);
    throw error;
  }
};

// Restore purchases
export const restorePurchases = async (): Promise<any> => {
  if (!isIAPAvailable()) {
    throw new Error('In-App Purchases are only available on iOS');
  }

  try {
    const InAppPurchase = (window as any).CapacitorInAppPurchases;
    
    if (!InAppPurchase) {
      throw new Error('In-App Purchase plugin not available. Please install @capacitor-community/in-app-purchases');
    }
    
    const result = await InAppPurchase.restorePurchases();
    
    // Validate restored purchases
    if (result.purchases) {
      result.purchases = result.purchases.filter((purchase: { productId?: string }) => {
        // Only include purchases that are in valid states
        return purchase.state === 'purchased' || purchase.state === 'restored';
      });
    }
    
    return result;
  } catch (error) {
    console.error('Restore failed:', error);
    throw error;
  }
};

// Get product info
export const getProducts = async (productIds: string[]): Promise<any> => {
  if (!isIAPAvailable()) {
    return [];
  }

  try {
    const InAppPurchase = (window as any).CapacitorInAppPurchases;
    
    if (!InAppPurchase) {
      console.warn('In-App Purchase plugin not available');
      return [];
    }
    
    const result = await InAppPurchase.getProducts({
      productIdentifiers: productIds,
    });

    return result.products || [];
  } catch (error) {
    console.error('Get products failed:', error);
    return [];
  }
};
