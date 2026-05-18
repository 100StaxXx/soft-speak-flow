export interface StoreKitProduct {
  identifier: string;
  displayName: string;
  description: string;
  displayPrice: string;
  price: number;
  type: string;
  pricePerMonthString?: string | null;
  pricePerYearString?: string | null;
  subscriptionPeriodUnit?: number;
  subscriptionPeriodValue?: number;
}

export interface StoreKitTransaction {
  transactionId: string;
  originalTransactionId?: string;
  productId: string;
  purchaseDate: string;
  expirationDate?: string;
  revocationDate?: string;
  appAccountToken?: string;
  revenueCatOriginalAppUserId?: string;
  isSandbox?: boolean;
  offerIdentifier?: string;
  offerType?: number;
  isUpgraded?: boolean;
  cancelled?: boolean;
  pending?: boolean;
}
