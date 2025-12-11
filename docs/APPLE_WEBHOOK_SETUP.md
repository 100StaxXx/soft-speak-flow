# Apple Webhook Setup for Firebase

## Overview
The Apple webhook has been migrated from Supabase to Firebase Cloud Functions.

## Firebase Function URL
```
https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
```

## App Store Connect Configuration

### Steps to Update:
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to your app: **Cosmiq**
3. Go to **App Information**
4. Scroll to **App Store Server Notifications**
5. Update the **Production Server URL** to:
   ```
   https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
   ```
6. Set **Version** to: **Version 2**
7. Save changes

## Required Firebase Secrets

The following secrets must be set in Firebase for the webhook to work:

```bash
firebase functions:secrets:set APPLE_SHARED_SECRET
firebase functions:secrets:set APPLE_SERVICE_ID
firebase functions:secrets:set APPLE_IOS_BUNDLE_ID
firebase functions:secrets:set APPLE_WEBHOOK_AUDIENCE
```

**Values:**
- `APPLE_SHARED_SECRET`: Your app-specific shared secret from App Store Connect
- `APPLE_SERVICE_ID`: `com.darrylgraham.revolution.web`
- `APPLE_IOS_BUNDLE_ID`: `com.darrylgraham.revolution`
- `APPLE_WEBHOOK_AUDIENCE`: `appstoreconnect-v1`

## Deployment

After setting the secrets, deploy the function:

```bash
firebase deploy --only functions:appleWebhook
```

Or deploy all functions:

```bash
firebase deploy --only functions
```

## Testing

After deployment, Apple will send test notifications to verify the webhook is working. Check the Firebase Functions logs:

```bash
firebase functions:log --only appleWebhook
```

## Notification Types Handled

The webhook handles the following Apple notification types:
- `INITIAL_BUY` - First-time subscription purchase
- `DID_RENEW` - Subscription renewal
- `DID_RECOVER` - Subscription recovered from billing issue
- `DID_CHANGE_RENEWAL_STATUS` - Auto-renewal enabled/disabled
- `DID_CHANGE_RENEWAL_PREF` - Plan changed (monthly ↔ yearly)
- `DID_FAIL_TO_RENEW` - Billing issue
- `CANCEL` / `REVOKE` - Subscription cancelled
- `REFUND` - Payment refunded

## Security

The webhook endpoint:
- Accepts POST requests from Apple's servers
- Returns 200 OK for all requests (to prevent retries)
- Logs all errors for debugging
- Updates Firestore subscriptions and profiles atomically

## Troubleshooting

### Webhook not receiving notifications
1. Verify the URL is correct in App Store Connect
2. Check Firebase Functions logs for errors
3. Ensure all secrets are set correctly
4. Verify the function is deployed

### Subscription not updating
1. Check Firestore `subscriptions` collection
2. Check Firestore `profiles` collection for `is_premium` status
3. Review function logs for errors
4. Verify transaction ID matches between Apple and Firestore

