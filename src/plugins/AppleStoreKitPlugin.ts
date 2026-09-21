import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { StoreKitProduct, StoreKitTransaction } from "@/types/subscription";

export type ApplePurchaseStatus = "purchased" | "cancelled" | "pending";

export interface AppleStoreKitPlugin {
  loadProducts(options: { productIds: string[] }): Promise<{ products: StoreKitProduct[] }>;
  purchase(options: {
    productId: string;
    appAccountToken: string;
  }): Promise<{ status: ApplePurchaseStatus; transaction?: StoreKitTransaction }>;
  currentEntitlements(): Promise<{ transactions: StoreKitTransaction[] }>;
  restorePurchases(): Promise<{ transactions: StoreKitTransaction[] }>;
  presentCodeRedemptionSheet(): Promise<{ presented: boolean }>;
  manageSubscriptions(): Promise<void>;
  addListener(
    eventName: "transactionUpdated",
    listener: (transaction: StoreKitTransaction) => void,
  ): Promise<PluginListenerHandle>;
}

export const AppleStoreKit = registerPlugin<AppleStoreKitPlugin>("AppleStoreKit");
