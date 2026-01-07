import { Capacitor } from '@capacitor/core';
import { NativePurchases } from '@capgo/native-purchases';

// Type definitions for IAP plugin responses
export interface IAPPurchase {
  productId?: string;
  transactionId?: string;
  transactionDate?: number;
  receipt?: string;
  transactionReceipt?: string;
}

export interface IAPProduct {
  identifier: string;
  title: string;
  description: string;
  price: number;
  priceString: string;
  currencyCode: string;
}

// Apple IAP Product IDs - configure these in App Store Connect
export const IAP_PRODUCTS = {
  MONTHLY: 'cosmiq_premium_monthly',
  YEARLY: 'cosmiq_premium_yearly',
};

// Check if IAP is available (iOS native only)
export const isIAPAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

// Purchase a product
export const purchaseProduct = async (productId: string): Promise<IAPPurchase> => {
  if (!isIAPAvailable()) {
    throw new Error('In-App Purchases are only available on iOS');
  }

  try {
    const result = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
    });

    return result as IAPPurchase;
  } catch (error) {
    console.error('Purchase failed:', error);
    throw error;
  }
};

// Restore purchases
export const restorePurchases = async (): Promise<IAPPurchase[]> => {
  if (!isIAPAvailable()) {
    throw new Error('In-App Purchases are only available on iOS');
  }

  try {
    const result = await NativePurchases.restorePurchases() as unknown;
    return ((result as { purchases?: IAPPurchase[] })?.purchases) || [];
  } catch (error) {
    console.error('Restore failed:', error);
    throw error;
  }
};

// Get product info
export const getProducts = async (productIds: string[]): Promise<IAPProduct[]> => {
  console.log('[IAP DEBUG] getProducts called with:', productIds);
  console.log('[IAP DEBUG] isIAPAvailable:', isIAPAvailable());
  console.log('[IAP DEBUG] Platform:', Capacitor.getPlatform());
  console.log('[IAP DEBUG] isNative:', Capacitor.isNativePlatform());
  
  if (!isIAPAvailable()) {
    console.log('[IAP DEBUG] IAP not available, returning empty array');
    return [];
  }

  try {
    console.log('[IAP DEBUG] Calling NativePurchases.getProducts...');
    const result = await NativePurchases.getProducts({
      productIdentifiers: productIds,
    }) as unknown;

    console.log('[IAP DEBUG] Raw result from NativePurchases:', JSON.stringify(result, null, 2));
    
    const products = ((result as { products?: IAPProduct[] })?.products) || [];
    console.log('[IAP DEBUG] Parsed products count:', products.length);
    console.log('[IAP DEBUG] Parsed products:', JSON.stringify(products, null, 2));
    
    return products;
  } catch (error) {
    console.error('[IAP DEBUG] Get products failed:', error);
    console.error('[IAP DEBUG] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return [];
  }
};

export const openManageSubscriptions = async (): Promise<void> => {
  if (isIAPAvailable()) {
    await NativePurchases.manageSubscriptions();
    return;
  }

  window.open('https://apps.apple.com/account/subscriptions', '_blank');
};
