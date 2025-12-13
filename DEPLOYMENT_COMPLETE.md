# ✅ Firebase Functions Deployment Complete!

**Deployment Date:** 2025-01-13  
**Project:** cosmiq-prod  
**Status:** ✅ Successfully Deployed

---

## 🎉 Deployment Summary

### Functions Deployed
- ✅ **60+ Cloud Functions** successfully deployed
- ✅ All required secrets configured
- ✅ Functions running in `us-central1` region

### Critical Functions for TestFlight
- ✅ `appleWebhook` - Handles App Store Server Notifications
- ✅ `verifyAppleReceipt` - Verifies subscription receipts
- ✅ `checkAppleSubscription` - Returns subscription status
- ✅ All AI/content generation functions
- ✅ Scheduled jobs (daily pep talks, quotes, etc.)

---

## 🔗 Apple Webhook URL

**CRITICAL:** Use this URL in App Store Connect:

```
https://applewebhook-zs3c7nbqfq-uc.a.run.app
```

### How to Update App Store Connect

1. **Go to App Store Connect:**
   - https://appstoreconnect.apple.com
   - Navigate to your app

2. **Update Server Notification URL:**
   - Go to: **Your App** → **App Information**
   - Scroll to **Server Notification URL**
   - Paste: `https://applewebhook-zs3c7nbqfq-uc.a.run.app`
   - **Save**

3. **Verify:**
   - The URL should now point to Firebase (not Supabase)
   - Apple will send subscription events to this endpoint

---

## ✅ Secrets Status

All required secrets are configured:

- ✅ `APPLE_SHARED_SECRET` - Set
- ✅ `APPLE_SERVICE_ID` - Set (`com.darrylgraham.revolution.web`)
- ✅ `APPLE_IOS_BUNDLE_ID` - Set (`com.darrylgraham.revolution`)
- ✅ `APPLE_WEBHOOK_AUDIENCE` - Set (`appstoreconnect-v1`)
- ✅ `GEMINI_API_KEY` - Set
- ✅ `OPENAI_API_KEY` - Set
- ✅ `ELEVENLABS_API_KEY` - Set

---

## 🧪 Testing

### Test Subscription Flow

1. **Build iOS app** and upload to TestFlight
2. **Purchase a subscription** in TestFlight
3. **Verify webhook receives events:**
   ```powershell
   firebase functions:log --only appleWebhook
   ```
4. **Check subscription status** in app
5. **Verify Firestore** `subscriptions` collection updates

### Test Functions

```powershell
# View all function logs
firebase functions:log

# View specific function logs
firebase functions:log --only appleWebhook
firebase functions:log --only checkAppleSubscription

# List all functions
firebase functions:list
```

---

## 📱 Next Steps for TestFlight

### 1. Update App Store Connect ✅ (Do this now!)
- [ ] Update Server Notification URL with the webhook URL above

### 2. Verify In-App Purchase Products
- [ ] Monthly: `cosmiq_premium_monthly` ($9.99)
- [ ] Yearly: `cosmiq_premium_yearly` ($59.99)

### 3. Build & Upload to TestFlight
- [ ] Follow `QUICK_DEPLOY_TESTFLIGHT.md`
- [ ] Archive in Xcode
- [ ] Upload to App Store Connect
- [ ] Distribute to TestFlight testers

### 4. Test End-to-End
- [ ] Sign up/Sign in works
- [ ] Subscription purchase works
- [ ] Webhook receives notifications
- [ ] Subscription status syncs correctly
- [ ] AI features work (mentor chat, etc.)

---

## 🔍 Monitoring

### Firebase Console
- **Functions:** https://console.firebase.google.com/project/cosmiq-prod/functions
- **Logs:** https://console.firebase.google.com/project/cosmiq-prod/functions/logs
- **Firestore:** https://console.firebase.google.com/project/cosmiq-prod/firestore

### Check Webhook Activity

After a subscription purchase, check:
1. **Firebase Console** → Functions → appleWebhook → Logs
2. **Firestore** → `subscriptions` collection (should have user's subscription)
3. **App** → Subscription status should be active

---

## ⚠️ Notes

1. **Webhook URL:** The webhook URL uses the new format (`*.a.run.app`). This is correct for 2nd gen Cloud Functions.

2. **Quota Warning:** One function had a quota warning during deployment but completed successfully. All functions are deployed.

3. **Function Versions:** Some functions use 1st gen (`functions.https.onCall`) and some use 2nd gen (`onCall`). Both work, but consider migrating to 2nd gen for consistency.

4. **Cold Starts:** First invocation after deployment may take a few seconds (cold start). Subsequent calls will be faster.

---

## 🆘 Troubleshooting

### Webhook Not Receiving Events
1. Verify URL in App Store Connect matches exactly
2. Wait 5-10 minutes after updating URL (Apple propagation time)
3. Check logs: `firebase functions:log --only appleWebhook`
4. Test webhook manually (send OPTIONS request)

### Subscription Not Syncing
1. Check `checkAppleSubscription` function logs
2. Verify Firestore `subscriptions` collection
3. Check user's profile in Firestore
4. Verify receipt verification succeeds

### Function Errors
1. Check logs: `firebase functions:log`
2. Verify secrets are set: `firebase functions:secrets:access SECRET_NAME`
3. Check Firebase Console for detailed error messages

---

## ✅ Deployment Checklist

- [x] Functions built successfully
- [x] All required secrets configured
- [x] Functions deployed to Firebase
- [x] Webhook URL obtained
- [ ] **App Store Connect webhook URL updated** ← DO THIS NOW
- [ ] Test subscription purchase
- [ ] Verify webhook receives events
- [ ] Upload to TestFlight

---

**🎉 Your backend is now fully deployed and ready for TestFlight!**

The only remaining step is updating the webhook URL in App Store Connect, then you can upload your iOS app and test subscriptions.

---

**Last Updated:** 2025-01-13  
**Deployment Status:** ✅ Complete

