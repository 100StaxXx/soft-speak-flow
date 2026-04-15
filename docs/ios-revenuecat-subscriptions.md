# iOS RevenueCat Subscription Setup

Use `ios/App/App.xcworkspace` in Xcode, not `ios/App/App.xcodeproj`.

## Current product IDs

- `cosmiq_premium_monthly` at `$9.99/month`
- `cosmiq_premium_yearly` at `$99.99/year`
- Apple offer-code campaign on `cosmiq_premium_yearly` at `$69.99/year`

## App Store Connect

Create or confirm the two subscriptions under the `com.darrylgraham.revolution` app.

- Set pricing:
  - monthly: `$9.99`
  - yearly: `$99.99`
- Add an offer-code campaign to `cosmiq_premium_yearly` for new subscribers:
  - reference name / identifier should match `APPLE_OFFER_CODE_IDENTIFIER`
  - discounted yearly price: `$69.99`
  - create custom codes that match your eligible creator codes when you want 1:1 parity between the app code and Apple redemption code
  - save the offer-code campaign resource ID for backend sync as `APPLE_SUBSCRIPTION_OFFER_CODE_ID`

## RevenueCat

Import both App Store products into RevenueCat and map them to the `Cosmiq Pro` entitlement.

Recommended offering/package layout:

- monthly package -> `cosmiq_premium_monthly`
- annual package -> `cosmiq_premium_yearly`

The discounted yearly flow is handled through Apple's offer-code redemption UI on `cosmiq_premium_yearly`, not through a separate referral annual SKU.

## Tolt and Apple code parity

The app now expects the creator discount to be backed by the same code in three places:

- Tolt partner link parameter value
- local `referral_codes.code`
- Apple custom offer code under the yearly offer-code campaign

Tolt partner sync is the trigger that provisions or refreshes the Apple custom code. Only Tolt-linked influencer codes with an active Apple custom-code sync are treated as discount-eligible in the paywall.

Required backend configuration:

- `APPLE_SUBSCRIPTION_OFFER_CODE_ID`
- `APPLE_OFFER_CODE_IDENTIFIER`
- `APPLE_KEY_ID`
- `APPLE_ISSUER_ID`
- `APPLE_PRIVATE_KEY`

Optional backend configuration:

- `APPLE_OFFER_CODE_MAX_REDEMPTIONS_PER_CUSTOM_CODE`
- `APPLE_OFFER_CODE_EXPIRATION_DATE`

## Xcode local testing

The shared Xcode scheme now points to `ios/App/App/CosmiqProducts.storekit` for simulator StoreKit testing.

In Xcode:

1. Open `ios/App/App.xcworkspace`
2. Select the `App` scheme
3. Edit Scheme -> Run -> Options
4. Confirm `CosmiqProducts.storekit` is selected as the StoreKit configuration

Use the simulator to verify:

- non-referred users purchase `cosmiq_premium_yearly`
- referred users redeem the Apple offer code, then purchase `cosmiq_premium_yearly`
- both unlock the same `Cosmiq Pro` entitlement

## Native project checks

The repo already has the expected iOS native setup:

- bundle ID: `com.darrylgraham.revolution`
- RevenueCat Capacitor pods in `ios/App/Podfile`
- no extra entitlement changes required for RevenueCat itself

If pods or Capacitor plugins change, resync the iOS workspace before opening Xcode.
