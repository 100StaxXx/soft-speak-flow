# Apple In-App Purchase Setup Guide

## Overview
This guide will walk you through setting up Apple In-App Purchases for Cosmiq Premium subscriptions.

## Step 1: Create Subscription Products in App Store Connect

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to your app: **Cosmiq** (com.darrylgraham.revolution)
3. Go to **Features** → **In-App Purchases**
4. Click the **+** button to create a new subscription

### Create Monthly Subscription:
- **Type**: Auto-Renewable Subscription
- **Reference Name**: Cosmiq Premium Monthly
- **Product ID**: `cosmiq_premium_monthly` (must match exactly)
- **Subscription Group**: Create a new group called "Cosmiq Premium" (or use existing)
- **Subscription Duration**: 1 Month
- **Price**: Set to $9.99 (or your desired price)
- **Localization**: Add description and display name

### Create Yearly Subscription:
- **Type**: Auto-Renewable Subscription
- **Reference Name**: Cosmiq Premium Yearly
- **Product ID**: `cosmiq_premium_yearly` (must match exactly)
- **Subscription Group**: Same group as monthly ("Cosmiq Premium")
- **Subscription Duration**: 1 Year
- **Price**: Set to $59.99 (or your desired price)
- **Localization**: Add description and display name
- **Free Trial**: Optional - you can add a 7-day free trial here

### Important Notes:
- Product IDs must match exactly: `cosmiq_premium_monthly` and `cosmiq_premium_yearly`
- Both subscriptions must be in the same subscription group
- You can add a free trial to the yearly subscription if desired
- Save all changes and wait for Apple to review (if needed)

## Step 2: Get Your App-Specific Shared Secret

1. In App Store Connect, go to your app
2. Navigate to **App Information**
3. Scroll down to **App-Specific Shared Secret**
4. Click **Generate** if you don't have one, or copy the existing one
5. **Save this value** - you'll need it for Firebase secrets

## Step 3: Set Up App Store Server Notifications (Webhook)

1. In App Store Connect, go to your app → **App Information**
2. Scroll to **App Store Server Notifications**
3. Click **Configure**
4. Set **Production Server URL** to:
   ```
   https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
   ```
5. Set **Version** to: **Version 2**
6. Click **Save**

**Note**: Apple will send a test notification to verify the webhook is working. Check Firebase logs after saving.

## Step 4: Set Firebase Secrets

Run these commands to set the required secrets in Firebase:

```bash
# Set the shared secret (you'll be prompted to enter the value)
firebase functions:secrets:set APPLE_SHARED_SECRET

# Set the iOS bundle ID (this is your app's bundle identifier)
firebase functions:secrets:set APPLE_IOS_BUNDLE_ID
# Enter: com.darrylgraham.revolution

# Set the service ID (for webhook verification)
firebase functions:secrets:set APPLE_SERVICE_ID
# Enter: com.darrylgraham.revolution.web

# Set the webhook audience (standard value for App Store Connect)
firebase functions:secrets:set APPLE_WEBHOOK_AUDIENCE
# Enter: appstoreconnect-v1
```

### Quick Setup (Copy-Paste):
```bash
# When prompted, paste your shared secret from App Store Connect
echo "YOUR_SHARED_SECRET_HERE" | firebase functions:secrets:set APPLE_SHARED_SECRET

# These are standard values - just press Enter when prompted
echo "com.darrylgraham.revolution" | firebase functions:secrets:set APPLE_IOS_BUNDLE_ID
echo "com.darrylgraham.revolution.web" | firebase functions:secrets:set APPLE_SERVICE_ID
echo "appstoreconnect-v1" | firebase functions:secrets:set APPLE_WEBHOOK_AUDIENCE
```

## Step 5: Verify Product IDs in Code

Make sure your product IDs match in `src/utils/appleIAP.ts`:

```typescript
export const IAP_PRODUCTS = {
  MONTHLY: 'cosmiq_premium_monthly',
  YEARLY: 'cosmiq_premium_yearly',
};
```

These must match exactly what you created in App Store Connect.

## Step 6: Test Your Setup

### Testing in Sandbox:
1. Create a sandbox tester account in App Store Connect → **Users and Access** → **Sandbox Testers**
2. Sign out of your Apple ID on your test device
3. In your app, attempt to purchase a subscription
4. When prompted, sign in with your sandbox tester account
5. The purchase should complete (it's free in sandbox)

### Testing Receipt Verification:
1. After a test purchase, check Firebase Functions logs:
   ```bash
   firebase functions:log --only verifyAppleReceipt
   ```
2. Check Firestore to see if subscription was created:
   - Collection: `subscriptions`
   - Document ID: Your user ID
   - Should have `status: "active"` and `plan: "monthly"` or `"yearly"`

### Testing Webhook:
1. After setting up the webhook URL in App Store Connect, Apple will send a test notification
2. Check Firebase Functions logs:
   ```bash
   firebase functions:log --only appleWebhook
   ```
3. You should see a log entry showing the test notification was received

## Troubleshooting

### Products Not Showing in App
- **Issue**: Products don't appear when trying to purchase
- **Solution**: 
  - Verify product IDs match exactly (case-sensitive)
  - Make sure products are approved in App Store Connect
  - Check that you're signed in with a sandbox tester (for testing)
  - Verify the app's bundle ID matches: `com.darrylgraham.revolution`

### Receipt Verification Failing
- **Issue**: Receipt verification returns an error
- **Solution**:
  - Verify `APPLE_SHARED_SECRET` is set correctly in Firebase
  - Check Firebase Functions logs for specific error messages
  - Ensure the shared secret matches the one in App Store Connect

### Webhook Not Receiving Notifications
- **Issue**: Apple webhook not receiving notifications
- **Solution**:
  - Verify the webhook URL is correct in App Store Connect
  - Check that all secrets are set: `APPLE_SERVICE_ID`, `APPLE_IOS_BUNDLE_ID`, `APPLE_WEBHOOK_AUDIENCE`
  - Check Firebase Functions logs for errors
  - Wait a few minutes - Apple may take time to send test notifications

### Subscription Status Not Updating
- **Issue**: User purchases but subscription status doesn't update
- **Solution**:
  - Check Firestore `subscriptions` collection for the user
  - Check Firestore `profiles` collection - `is_premium` should be `true`
  - Verify `verifyAppleReceipt` function is being called
  - Check Firebase Functions logs for errors

## Summary Checklist

- [ ] Created monthly subscription product in App Store Connect
- [ ] Created yearly subscription product in App Store Connect
- [ ] Product IDs match: `cosmiq_premium_monthly` and `cosmiq_premium_yearly`
- [ ] Got app-specific shared secret from App Store Connect
- [ ] Set `APPLE_SHARED_SECRET` in Firebase
- [ ] Set `APPLE_IOS_BUNDLE_ID` to `com.darrylgraham.revolution`
- [ ] Set `APPLE_SERVICE_ID` to `com.darrylgraham.revolution.web`
- [ ] Set `APPLE_WEBHOOK_AUDIENCE` to `appstoreconnect-v1`
- [ ] Configured webhook URL in App Store Connect
- [ ] Tested purchase flow in sandbox
- [ ] Verified receipt verification works
- [ ] Verified webhook receives notifications

## Next Steps

Once everything is set up:
1. Test the full purchase flow in sandbox
2. Test subscription restoration
3. Test subscription cancellation
4. Monitor Firebase Functions logs for any issues
5. When ready, submit your app for review with in-app purchases enabled

