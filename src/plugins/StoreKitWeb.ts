import { WebPlugin } from '@capacitor/core';
import type {
  StoreKitPluginInterface,
  StoreKitProduct,
  StoreKitTransaction,
  PromoOfferParams,
} from './StoreKitPlugin';

export class StoreKitWeb extends WebPlugin implements StoreKitPluginInterface {
  async getProducts(_options: { productIds: string[] }): Promise<{ products: StoreKitProduct[] }> {
    if (import.meta.env.DEV) {
      console.debug('[StoreKit] Web fallback - no StoreKit support');
    }
    return { products: [] };
  }

  async purchase(_options: { productId: string; appAccountToken?: string }): Promise<StoreKitTransaction> {
    throw new Error('In-App Purchases are only available on iOS devices');
  }

  async purchaseWithPromoOffer(_options: PromoOfferParams): Promise<StoreKitTransaction> {
    throw new Error('In-App Purchases are only available on iOS devices');
  }

  async restorePurchases(): Promise<{ restored: boolean; entitlement: StoreKitTransaction | null }> {
    if (import.meta.env.DEV) {
      console.debug('[StoreKit] Web fallback - no restore support');
    }
    return { restored: false, entitlement: null };
  }

  async getCurrentEntitlement(): Promise<{ entitlement: StoreKitTransaction | null }> {
    return { entitlement: null };
  }

  async manageSubscriptions(): Promise<void> {
    throw new Error('Subscription management is only available on iOS devices');
  }

  async startTransactionListener(): Promise<{ started: boolean }> {
    return { started: false };
  }
}
