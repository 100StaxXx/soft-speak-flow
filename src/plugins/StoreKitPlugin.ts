import { registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';

export interface StoreKitProduct {
  identifier: string;
  displayName: string;
  description: string;
  displayPrice: string;
  price: number;
  type: string;
  subscriptionPeriodUnit?: number;
  subscriptionPeriodValue?: number;
}

export interface StoreKitTransaction {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: string;
  expirationDate?: string;
  revocationDate?: string;
  appAccountToken?: string;
  isUpgraded?: boolean;
  cancelled?: boolean;
  pending?: boolean;
}

export interface PromoOfferParams {
  productId: string;
  appAccountToken?: string;
  offerID: string;
  keyID: string;
  nonce: string;
  signature: string;
  timestamp: number;
}

export interface StoreKitPluginInterface {
  getProducts(options: { productIds: string[] }): Promise<{ products: StoreKitProduct[] }>;
  purchase(options: { productId: string; appAccountToken?: string }): Promise<StoreKitTransaction>;
  purchaseWithPromoOffer(options: PromoOfferParams): Promise<StoreKitTransaction>;
  restorePurchases(): Promise<{ restored: boolean; entitlement: StoreKitTransaction | null }>;
  getCurrentEntitlement(): Promise<{ entitlement: StoreKitTransaction | null }>;
  manageSubscriptions(): Promise<void>;
  startTransactionListener(): Promise<{ started: boolean }>;
  addListener(
    eventName: 'transactionUpdate',
    listenerFunc: (transaction: StoreKitTransaction) => void,
  ): Promise<PluginListenerHandle>;
}

export const StoreKit = registerPlugin<StoreKitPluginInterface>('StoreKit', {
  web: () => import('./StoreKitWeb').then(m => new m.StoreKitWeb()),
});
