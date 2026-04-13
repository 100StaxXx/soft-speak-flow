# iOS RevenueCat Subscription Setup

Use `ios/App/App.xcworkspace` in Xcode, not `ios/App/App.xcodeproj`.

## Current product IDs

- `cosmiq_premium_monthly` at `$9.99/month`
- `cosmiq_premium_yearly` at `$99.99/year`
- `cosmiq_referral_yearly` at `$69.99/year`

## App Store Connect

Create or confirm all three subscriptions under the `com.darrylgraham.revolution` app.

- Put `cosmiq_premium_yearly` and `cosmiq_referral_yearly` in the same subscription group.
- Keep `cosmiq_referral_yearly` as its own SKU. It is not a rename of premium yearly.
- Set pricing:
  - monthly: `$9.99`
  - premium yearly: `$99.99`
  - referral yearly: `$69.99`

## RevenueCat

Import all three App Store products into RevenueCat and map both yearly products to the `Cosmiq Pro` entitlement.

Recommended offering/package layout:

- monthly package -> `cosmiq_premium_monthly`
- annual package -> `cosmiq_premium_yearly`
- referral annual package -> `cosmiq_referral_yearly`

The app code expects the referral annual package to be a separate RevenueCat package that resolves to the `referral_yearly` purchase target.

## Xcode local testing

The shared Xcode scheme now points to `ios/App/App/CosmiqProducts.storekit` for simulator StoreKit testing.

In Xcode:

1. Open `ios/App/App.xcworkspace`
2. Select the `App` scheme
3. Edit Scheme -> Run -> Options
4. Confirm `CosmiqProducts.storekit` is selected as the StoreKit configuration

Use the simulator to verify:

- non-referred users purchase `cosmiq_premium_yearly`
- referred users purchase `cosmiq_referral_yearly`
- both unlock the same `Cosmiq Pro` entitlement

## Native project checks

The repo already has the expected iOS native setup:

- bundle ID: `com.darrylgraham.revolution`
- RevenueCat Capacitor pods in `ios/App/Podfile`
- no extra entitlement changes required for RevenueCat itself

If pods or Capacitor plugins change, resync the iOS workspace before opening Xcode.
