import { Capacitor } from '@capacitor/core';
import { NativePurchases } from '@capgo/native-purchases';

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
    const result = await NativePurchases.restorePurchases();
    return (result as any) || [];
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
    const result = await NativePurchases.getProducts({
      productIdentifiers: productIds,
    });

    return (result as any).products || [];
  } catch (error) {
    console.error('Get products failed:', error);
    return [];
  }
};
