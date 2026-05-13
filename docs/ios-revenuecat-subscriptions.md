# RevenueCat Capacitor Subscription Setup

Use `ios/App/App.xcworkspace` in Xcode, not `ios/App/App.xcodeproj`.

Reference docs:

- Capacitor SDK installation: https://www.revenuecat.com/docs/getting-started/installation/capacitor
- Product and entitlement setup: https://www.revenuecat.com/docs/projects/configuring-products
- Customer info: https://www.revenuecat.com/docs/customers/customer-info
- Paywalls: https://www.revenuecat.com/docs/tools/paywalls
- Customer Center: https://www.revenuecat.com/docs/tools/customer-center

## SDK packages

This app is currently on Capacitor 7, so the RevenueCat packages are pinned to the latest Capacitor 7-compatible line:

```sh
npm install @revenuecat/purchases-capacitor@10.4.0 @revenuecat/purchases-capacitor-ui@10.4.0
npx cap sync ios
```

When the app migrates fully to Capacitor 8, upgrade both RevenueCat packages to the latest major version supported by that Capacitor version.

## App configuration

The RevenueCat setup lives behind the existing `StoreKitProvider` compatibility layer so the rest of the app can keep using `useStoreKit()` and `useAppleSubscription()`.

Constants are defined in `src/utils/appleIAP.ts`:

```ts
export const REVENUECAT_IOS_API_KEY = "test_dnpQRPYilwaMbsjfCuXLepwYhac";
export const COSMIQ_PRO_ENTITLEMENT_ID = "cosmiq_pro";
export const COSMIQ_PRO_ENTITLEMENT_NAME = "Cosmiq Pro";
export const REVENUECAT_PRODUCT_IDS = [
  "cosmiq_referral_yearly",
  "cosmiq_premium_yearly",
  "cosmiq_premium_monthly",
] as const;
```

The provider configures RevenueCat with the authenticated Supabase user id:

```ts
await Purchases.configure({
  apiKey: REVENUECAT_IOS_API_KEY,
  appUserID: user.id,
});
```

If a user switches accounts in the same native session, the provider calls `Purchases.logIn({ appUserID: user.id })`.

## RevenueCat dashboard setup

Create an entitlement for Cosmiq Pro. The code checks `cosmiq_pro` first and also accepts `Cosmiq Pro` as a compatibility alias. Prefer `cosmiq_pro` as the dashboard identifier and use `Cosmiq Pro` as the display name.

Attach these App Store products to that entitlement:

- `cosmiq_premium_monthly`
- `cosmiq_premium_yearly`
- `cosmiq_referral_yearly`

Recommended offering:

- `monthly` package -> `cosmiq_premium_monthly`
- `annual` package -> `cosmiq_premium_yearly`
- custom package `referral_yearly` -> `cosmiq_referral_yearly`

Make the offering current. Then create a RevenueCat Paywall for that current offering. If you want a separate creator-code experience, use RevenueCat targeting or a separate offering/paywall that includes the referral annual product.

## Customer info and entitlement checks

The provider retrieves and listens for `CustomerInfo`:

```ts
const { customerInfo } = await Purchases.getCustomerInfo();
const entitlement = customerInfo.entitlements.active[COSMIQ_PRO_ENTITLEMENT_ID];
const isPro = Boolean(entitlement?.isActive);
```

The app exposes this through:

- `useStoreKit().customerInfo`
- `useStoreKit().isPro`
- `useStoreKit().currentEntitlement`
- `useSubscription().customerInfo`

## Purchases and restores

The provider prefers RevenueCat offering packages when available, then falls back to direct RevenueCat store products:

```ts
const result = packageToPurchase
  ? await Purchases.purchasePackage({ aPackage: packageToPurchase })
  : await Purchases.purchaseStoreProduct({ product });
```

Restores use:

```ts
const { customerInfo } = await Purchases.restorePurchases();
```

After purchases, restores, paywall purchases, or Customer Center returns, the app refreshes CustomerInfo and invalidates the local subscription/access React Query caches.

## Referral yearly product

For users with an eligible creator code, the React purchase flow now buys `cosmiq_referral_yearly` directly when RevenueCat returns that product. If the referral product is not available, the app falls back to the legacy Apple offer-code redemption sheet.

## Paywalls and Customer Center

`useAppleSubscription()` exposes:

```ts
handlePresentRevenueCatPaywall("paywall_revenuecat_ui");
handlePresentCustomerCenter();
```

The main paywall and subscription-management screen both include a "View All Plans" action that calls the RevenueCat-hosted paywall with `presentPaywallIfNeeded({ requiredEntitlementIdentifier: "cosmiq_pro" })`.

Subscription management opens RevenueCat Customer Center through `RevenueCatUI.presentCustomerCenter()`. This makes sense for active or previously subscribed users because it centralizes restore, cancellation, billing, and support flows.

## Local verification

Run:

```sh
npm run build
npx cap sync ios
npm run ios:verify-assets
npx vitest run src/hooks/useSubscription.test.tsx src/hooks/useAppleSubscription.test.tsx src/components/Paywall.offerCodeEligibility.test.tsx src/components/SubscriptionManagement.test.tsx src/providers/StoreKitProvider.test.tsx
```

This machine currently does not have CocoaPods installed. After installing CocoaPods, run `cd ios/App && pod install` before opening the workspace in Xcode.
