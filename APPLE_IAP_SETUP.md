# Apple In-App Purchases Setup Guide

## Overview

R-Evolution uses **Apple In-App Purchases** for subscription management on iOS. Users subscribe directly through the App Store, and all billing/cancellation is handled by Apple via iOS Settings.

## Features Implemented

✅ **Native iOS Integration** - Uses Capacitor IAP plugin for native purchases
✅ **Receipt Verification** - Server-side verification with Apple's API
✅ **Subscription Status** - Real-time subscription checking
✅ **Restore Purchases** - Users can restore previous purchases
✅ **iOS Settings Management** - Users manage subscriptions in iOS Settings (industry standard)

---

## Setup Instructions

### 1. Install IAP Plugin

```bash
npm install @capacitor-community/in-app-purchases
npx cap sync ios
```

### 2. App Store Connect Configuration

#### Create In-App Purchase Products

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Select your app
3. Go to **In-App Purchases**
4. Create two **Auto-Renewable Subscription** products:

**Product 1: Monthly Subscription**
- Product ID: `com.revolutions.app.premium.monthly`
- Reference Name: "R-Evolution Premium (Monthly)"
- Subscription Duration: 1 month
- Price: $9.99 USD

**Product 2: Yearly Subscription** (optional)
- Product ID: `com.revolutions.app.premium.yearly`
- Reference Name: "R-Evolution Premium (Yearly)"
- Subscription Duration: 1 year
- Price: $99.99 USD

5. Add localizations (title, description) for each product
6. Submit products for review

#### Create Subscription Group

1. Create a subscription group (e.g., "R-Evolution Premium")
2. Add both products to this group
3. Configure intro offers (7-day free trial):
   - Duration: 7 days
   - Type: Free trial
   - Eligibility: New subscribers only

#### Get Shared Secret

1. In App Store Connect, go to your app
2. Navigate to **In-App Purchases > App-Specific Shared Secret**
3. Generate and copy the shared secret
4. Add to Supabase secrets (see step 3)

### 3. Configure Supabase Secret

Add the Apple shared secret to your Supabase project:

```bash
# Already added via the secrets tool
APPLE_SHARED_SECRET=<your-shared-secret>
```

### 4. Test with TestFlight

Apple IAP **only works on physical iOS devices** or TestFlight builds. It does NOT work in:
- Xcode Simulator
- Web browsers
- Android devices

To test:

1. Build the app for iOS
2. Upload to TestFlight
3. Install on a physical device via TestFlight
4. Use a Sandbox test account:
   - Go to App Store Connect > Users and Access > Sandbox Testers
   - Create a test account
   - Sign in with this account on your device (Settings > App Store > Sandbox Account)
5. Test purchase flow in the app

#### Sandbox Test Cards

When testing with sandbox accounts:
- Purchases are free (sandbox mode)
- Subscriptions auto-renew every few minutes (for testing)
- You can test cancellation and restoration flows

---

## How It Works

### Purchase Flow

```
User taps "Subscribe Now"
  ↓
App calls Apple StoreKit API via Capacitor
  ↓
Native iOS purchase sheet appears
  ↓
User completes purchase (Face ID/Touch ID)
  ↓
Receipt returned to app
  ↓
App sends receipt to verify-apple-receipt function
  ↓
Function verifies with Apple's servers
  ↓
Database updated: is_premium = true
  ↓
Premium features unlocked
```

### Subscription Management

Users manage subscriptions entirely through iOS Settings:
1. Open **Settings** app
2. Tap their name at the top
3. Tap **Subscriptions**
4. Select **R-Evolution**
5. Cancel, change plan, or view billing

**This is Apple's required user flow** - apps cannot implement custom cancellation UIs.

### Receipt Verification

The app verifies purchases server-side:
- Receipt sent to `/verify-apple-receipt` edge function
- Function calls Apple's verification API
- Production URL: `https://buy.itunes.apple.com/verifyReceipt`
- Sandbox URL: `https://sandbox.itunes.apple.com/verifyReceipt`
- Auto-fallback: tries production first, then sandbox if needed

---

## File Structure

### Edge Functions
- `/supabase/functions/verify-apple-receipt/index.ts` - Receipt verification
- `/supabase/functions/check-apple-subscription/index.ts` - Check subscription status

### Frontend
- `/src/utils/appleIAP.ts` - IAP utility functions
- `/src/hooks/useAppleSubscription.ts` - Subscription hook
- `/src/hooks/useSubscription.ts` - Status checking hook
- `/src/pages/Premium.tsx` - Subscription page
- `/src/components/SubscriptionManagement.tsx` - Management UI

### Configuration
- `/capacitor.config.ts` - Capacitor config (no special IAP config needed)
- Product IDs defined in `src/utils/appleIAP.ts`

---

## Database Schema

Uses existing subscription tables:
- `subscriptions` - Stores subscription data
- `profiles.is_premium` - Premium status flag
- `profiles.subscription_status` - Current status
- `profiles.subscription_expires_at` - Renewal date

---

## Pricing

- **Monthly**: $9.99/month
- **Yearly**: $99.99/year (optional)
- **Trial**: 7 days free (configured in App Store Connect)

**Note**: Apple takes 30% commission (15% after first year with same subscriber)

---

## Security

✅ **Server-side verification** - All receipts verified with Apple servers
✅ **No client-side trust** - Never trust client claims without verification
✅ **RLS policies** - Row Level Security on subscription tables
✅ **Authentication required** - All subscription operations require auth

---

## Production Checklist

Before launching:

- [ ] All IAP products approved in App Store Connect
- [ ] Shared secret configured in Supabase
- [ ] Tested purchase flow with sandbox account
- [ ] Tested restore purchases
- [ ] Tested cancellation via iOS Settings
- [ ] Verified receipt validation works
- [ ] Confirmed premium features unlock correctly
- [ ] App Store listing includes IAP pricing info
- [ ] Privacy policy mentions subscriptions

---

## Troubleshooting

### "In-App Purchases are only available on iOS"

This is correct - IAP only works on native iOS devices. Web version shows this message intentionally.

### Purchase doesn't complete

1. Verify product IDs match exactly (case-sensitive)
2. Check product status in App Store Connect (must be approved)
3. Ensure you're signed in with sandbox test account
4. Check device date/time is correct

### Subscription not activating

1. Check edge function logs (`verify-apple-receipt`)
2. Verify APPLE_SHARED_SECRET is set correctly
3. Check receipt verification response
4. Ensure subscription row was created in database

### Restore doesn't find purchases

1. Verify using same Apple ID as original purchase
2. Check if subscription is still active in App Store
3. Look for previous purchases in database

---

## Important Notes

⚠️ **Simulator Limitation**: Apple IAP does NOT work in iOS Simulator. You must test on a physical device via TestFlight.

⚠️ **Review Guidelines**: Ensure your app complies with Apple's IAP guidelines:
- Must use IAP for digital content/features
- Cannot link to external payment methods
- Must clearly disclose subscription terms

⚠️ **Subscription Receipts**: Apple provides unified receipts that contain all transaction history. Always use the `latest_receipt_info` array.

---

## Support Resources

- [Apple IAP Documentation](https://developer.apple.com/in-app-purchase/)
- [Capacitor IAP Plugin](https://github.com/capacitor-community/in-app-purchases)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Receipt Validation Guide](https://developer.apple.com/documentation/appstorereceipts/verifyreceipt)
