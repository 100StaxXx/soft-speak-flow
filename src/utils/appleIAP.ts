import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';

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

export type IAPPlan = 'monthly' | 'yearly';

const IAP_PRODUCT_IDS_BY_PLAN: Record<IAPPlan, readonly string[]> = {
  monthly: ['cosmiq_premium_monthly', 'com.darrylgraham.revolution.monthly'],
  yearly: ['cosmiq_premium_yearly', 'com.darrylgraham.revolution.yearly'],
};

// Apple IAP Product IDs - configure these in App Store Connect
export const IAP_PRODUCTS = {
  MONTHLY: IAP_PRODUCT_IDS_BY_PLAN.monthly[0],
  YEARLY: IAP_PRODUCT_IDS_BY_PLAN.yearly[0],
} as const;

export const getProductIdsForPlan = (plan: IAPPlan): string[] => [...IAP_PRODUCT_IDS_BY_PLAN[plan]];

export const getAllIAPProductIds = (): string[] => {
  const all = [...IAP_PRODUCT_IDS_BY_PLAN.monthly, ...IAP_PRODUCT_IDS_BY_PLAN.yearly];
  return Array.from(new Set(all));
};

export const resolvePlanFromProductId = (productId: string | null | undefined): IAPPlan | null => {
  if (!productId) return null;
  const normalized = productId.toLowerCase();

  if (IAP_PRODUCT_IDS_BY_PLAN.yearly.some((id) => normalized === id.toLowerCase())) {
    return 'yearly';
  }

  if (IAP_PRODUCT_IDS_BY_PLAN.monthly.some((id) => normalized === id.toLowerCase())) {
    return 'monthly';
  }

  if (normalized.includes('year') || normalized.includes('annual')) {
    return 'yearly';
  }

  if (normalized.includes('month')) {
    return 'monthly';
  }

  return null;
};

export const getProductForPlan = (plan: IAPPlan, products: IAPProduct[]): IAPProduct | undefined => {
  const ids = new Set(getProductIdsForPlan(plan));
  return products.find((product) => ids.has(product.identifier));
};

export const getPurchaseProductIdForPlan = (plan: IAPPlan, products: IAPProduct[]): string => {
  return getProductForPlan(plan, products)?.identifier ?? getProductIdsForPlan(plan)[0];
};

// Check if IAP is available (iOS native only)
export const isIAPAvailable = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
};

const extractErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '');
    if (message) return message;
  }
  return 'Unknown IAP error';
};

const ensureBillingSupported = async (): Promise<void> => {
  if (!isIAPAvailable()) {
    throw new Error('In-App Purchases are only available on iOS');
  }

  const support = await NativePurchases.isBillingSupported();
  if (!support?.isBillingSupported) {
    throw new Error('In-App Purchases require iOS 15 or later.');
  }
};

// Purchase a product
export const purchaseProduct = async (productId: string): Promise<IAPPurchase> => {
  if (!isIAPAvailable()) {
    throw new Error('In-App Purchases are only available on iOS');
  }

  try {
    const result = await NativePurchases.purchaseProduct({
      productIdentifier: productId,
      productType: PURCHASE_TYPE.SUBS,
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
    await NativePurchases.restorePurchases();

    // The restore API resolves void, so query purchases after sync.
    const result = await NativePurchases.getPurchases({
      productType: PURCHASE_TYPE.SUBS,
    }) as unknown;
    const purchases = ((result as { purchases?: unknown[] })?.purchases) || [];

    return purchases
      .map((purchase) => {
        if (typeof purchase !== 'object' || purchase === null) return {};
        const source = purchase as Record<string, unknown>;
        const transactionDateFromIso = typeof source.purchaseDate === 'string'
          ? Date.parse(source.purchaseDate)
          : NaN;
        const transactionDate = Number.isFinite(transactionDateFromIso)
          ? transactionDateFromIso
          : (typeof source.transactionDate === 'number' ? source.transactionDate : undefined);

        const productId = typeof source.productIdentifier === 'string'
          ? source.productIdentifier
          : (typeof source.productId === 'string' ? source.productId : undefined);

        const receipt = typeof source.receipt === 'string' ? source.receipt : undefined;
        const transactionReceipt = typeof source.transactionReceipt === 'string'
          ? source.transactionReceipt
          : receipt;

        return {
          productId,
          transactionId: typeof source.transactionId === 'string' ? source.transactionId : undefined,
          transactionDate,
          receipt,
          transactionReceipt,
        } satisfies IAPPurchase;
      })
      .filter((purchase) => Boolean(purchase.transactionId || purchase.productId));
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
    await ensureBillingSupported();
    const uniqueProductIds = Array.from(new Set(productIds.filter(Boolean)));

    console.log('[IAP DEBUG] Calling NativePurchases.getProducts...');
    const result = await NativePurchases.getProducts({
      productIdentifiers: uniqueProductIds,
      productType: PURCHASE_TYPE.SUBS,
    }) as unknown;

    console.log('[IAP DEBUG] Raw result from NativePurchases:', JSON.stringify(result, null, 2));
    
    const products = ((result as { products?: IAPProduct[] })?.products) || [];
    console.log('[IAP DEBUG] Parsed products count:', products.length);
    console.log('[IAP DEBUG] Parsed products:', JSON.stringify(products, null, 2));

    if (products.length > 0) {
      return products;
    }

    // Retry by ID to surface partial availability or invalid IDs.
    const perIdProducts = await Promise.all(uniqueProductIds.map(async (id) => {
      try {
        const single = await NativePurchases.getProduct({
          productIdentifier: id,
          productType: PURCHASE_TYPE.SUBS,
        }) as unknown;
        return ((single as { product?: IAPProduct })?.product) ?? null;
      } catch (error) {
        console.warn(`[IAP DEBUG] getProduct failed for ${id}:`, extractErrorMessage(error));
        return null;
      }
    }));

    const fallbackProducts = perIdProducts.filter((product): product is IAPProduct => product !== null);
    if (fallbackProducts.length > 0) {
      return fallbackProducts;
    }

    throw new Error(`No App Store products were returned for IDs: ${uniqueProductIds.join(', ')}`);
  } catch (error) {
    console.error('[IAP DEBUG] Get products failed:', error);
    if (typeof error === 'object' && error !== null) {
      console.error('[IAP DEBUG] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    }
    throw new Error(extractErrorMessage(error));
  }
};

export const openManageSubscriptions = async (): Promise<void> => {
  if (isIAPAvailable()) {
    await NativePurchases.manageSubscriptions();
    return;
  }

  window.open('https://apps.apple.com/account/subscriptions', '_blank');
};
