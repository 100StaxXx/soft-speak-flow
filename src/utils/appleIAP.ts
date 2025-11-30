import { Capacitor } from '@capacitor/core';

// Type definitions for IAP plugin
interface IAPTransactionResult {
  state: 'purchased' | 'restored' | 'deferred' | 'failed' | 'cancelled';
  productId?: string;
  transactionId?: string;
  receipt?: string;
}

interface IAPRestoreResult {
  purchases: Array<{
    productId?: string;
    state?: string;
    transactionId?: string;
  }>;
}

interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAsDecimal: number;
  currency: string;
}

interface IAPPlugin {
  buy: (options: { productIdentifier: string }) => Promise<IAPTransactionResult>;
  restorePurchases: () => Promise<IAPRestoreResult>;
  getProducts: (options: { productIdentifiers: string[] }) => Promise<{ products: IAPProduct[] }>;
}

// Dynamically import IAP plugin to avoid build errors if not installed
let InAppPurchase: IAPPlugin | null = null;
try {
  // @ts-expect-error - Dynamic import for optional plugin
  InAppPurchase = (window as unknown as { CapacitorInAppPurchases?: IAPPlugin }).CapacitorInAppPurchases ?? null;
interface CapacitorInAppPurchasesPlugin {
  buy: (options: { productIdentifier: string }) => Promise<any>;
  restorePurchases: () => Promise<any>;
  getProducts: (options: { productIdentifiers: string[] }) => Promise<any>;
}

let InAppPurchase: CapacitorInAppPurchasesPlugin | null = null;
try {
  InAppPurchase = (window as unknown as { CapacitorInAppPurchases?: CapacitorInAppPurchasesPlugin }).CapacitorInAppPurchases || null;
} catch (e) {
  console.warn('In-App Purchase plugin not loaded');
}

// Apple IAP Product IDs - configure these in App Store Connect
export const IAP_PRODUCTS = {
  MONTHLY: 'com.revolutions.app.premium.monthly',
  YEARLY: 'com.revolutions.app.premium.yearly',
};

// Check if IAP is available (iOS native only)
export const isIAPAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

// Purchase a product
export const purchaseProduct = async (productId: string): Promise<IAPTransactionResult> => {
  if (!isIAPAvailable()) {
    throw new Error('In-App Purchases are only available on iOS');
  }

  try {
    if (!InAppPurchase) {
      throw new Error('In-App Purchase plugin not available');
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
export const restorePurchases = async (): Promise<IAPRestoreResult> => {
  if (!isIAPAvailable()) {
    throw new Error('In-App Purchases are only available on iOS');
  }

  try {
    if (!InAppPurchase) {
      throw new Error('In-App Purchase plugin not available');
    }
    
    const result = await InAppPurchase.restorePurchases();
    
    // Validate restored purchases - filter to only valid states
    const validatedResult: IAPRestoreResult = {
      purchases: result.purchases.filter((purchase) => {
        // Only include purchases that are in valid states
        return purchase.state === 'purchased' || purchase.state === 'restored';
      })
    };
    
    return validatedResult;
  } catch (error) {
    console.error('Restore failed:', error);
    throw error;
  }
};

// Get product info
export const getProducts = async (productIds: string[]): Promise<IAPProduct[]> => {
  if (!isIAPAvailable()) {
    return [];
  }

  try {
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
