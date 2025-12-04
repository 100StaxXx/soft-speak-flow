import { Capacitor } from '@capacitor/core';

// Type definitions for IAP plugin responses
interface IAPPurchase {
  productId?: string;
  transactionId?: string;
  transactionDate?: number;
  receipt?: string;
  transactionReceipt?: string;
}

interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceAsDecimal: number;
  currency: string;
}

// NativePurchases plugin type
interface NativePurchasesPlugin {
  purchaseProduct(options: { productIdentifier: string }): Promise<IAPPurchase>;
  restorePurchases(): Promise<{ purchases?: IAPPurchase[] }>;
  getProducts(options: { productIdentifiers: string[] }): Promise<{ products?: IAPProduct[] }>;
}

// Lazy-loaded plugin reference
let _nativePurchases: NativePurchasesPlugin | null = null;
let _pluginLoadAttempted = false;

// Safely get the NativePurchases plugin
const getNativePurchases = async (): Promise<NativePurchasesPlugin | null> => {
  if (_pluginLoadAttempted) {
    return _nativePurchases;
  }
  
  _pluginLoadAttempted = true;
  
  try {
    const module = await import('@capgo/native-purchases');
    _nativePurchases = module.NativePurchases as NativePurchasesPlugin;
    return _nativePurchases;
  } catch (error) {
    console.error('Failed to load NativePurchases plugin:', error);
    return null;
  }
};

// Apple IAP Product IDs - configure these in App Store Connect
export const IAP_PRODUCTS = {
  MONTHLY: 'com.revolutions.app.premium.monthly',
  YEARLY: 'com.revolutions.app.premium.yearly',
};

// Check if IAP is available (iOS native only)
export const isIAPAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

// Check if the IAP plugin is properly loaded
export const checkIAPPluginAvailable = async (): Promise<boolean> => {
  if (!isIAPAvailable()) {
    return false;
  }
  
  const plugin = await getNativePurchases();
  return plugin !== null;
};

// Purchase a product
export const purchaseProduct = async (productId: string): Promise<IAPPurchase> => {
  if (!isIAPAvailable()) {
    throw new Error('In-App Purchases are only available on iOS devices');
  }

  const NativePurchases = await getNativePurchases();
  
  if (!NativePurchases) {
    throw new Error('In-App Purchase service is temporarily unavailable. Please try again later.');
  }

  try {
    const result = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
    });

    if (!result) {
      throw new Error('Purchase was cancelled or failed');
    }

    return result;
  } catch (error) {
    console.error('Purchase failed:', error);
    
    // Provide more user-friendly error messages
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (errorMessage.includes('cancel') || errorMessage.includes('Cancel')) {
      throw new Error('Purchase was cancelled');
    }
    
    if (errorMessage.includes('not found') || errorMessage.includes('invalid')) {
      throw new Error('This subscription is not available. Please try again later.');
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      throw new Error('Network error. Please check your connection and try again.');
    }
    
    throw new Error('Purchase failed. Please try again or contact support.');
  }
};

// Restore purchases
export const restorePurchases = async (): Promise<IAPPurchase[]> => {
  if (!isIAPAvailable()) {
    throw new Error('In-App Purchases are only available on iOS devices');
  }

  const NativePurchases = await getNativePurchases();
  
  if (!NativePurchases) {
    throw new Error('In-App Purchase service is temporarily unavailable. Please try again later.');
  }

  try {
    const result = await NativePurchases.restorePurchases();
    return result?.purchases || [];
  } catch (error) {
    console.error('Restore failed:', error);
    throw new Error('Failed to restore purchases. Please try again or contact support.');
  }
};

// Get product info
export const getProducts = async (productIds: string[]): Promise<IAPProduct[]> => {
  if (!isIAPAvailable()) {
    return [];
  }

  const NativePurchases = await getNativePurchases();
  
  if (!NativePurchases) {
    console.warn('NativePurchases plugin not available');
    return [];
  }

  try {
    const result = await NativePurchases.getProducts({
      productIdentifiers: productIds,
    });

    return result?.products || [];
  } catch (error) {
    console.error('Get products failed:', error);
    return [];
  }
};
