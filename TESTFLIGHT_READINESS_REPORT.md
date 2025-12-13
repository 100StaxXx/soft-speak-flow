# TestFlight Readiness Report
**Date:** 2025-01-13  
**Project:** cosmiq-prod  
**Status:** ✅ Code Ready, ⚠️ Backend Deployment Needed

---

## ✅ Frontend Status: READY

### Firebase Configuration
- ✅ **Project ID:** `cosmiq-prod` (correctly configured in `.firebaserc`)
- ✅ **iOS Config:** `GoogleService-Info.plist` has correct project ID and bundle ID
- ✅ **Environment Variables:** Firebase config exists in `.env` (confirmed in conversation)
- ✅ **Code Migration:** All app code uses Firebase (Auth, Firestore, Functions)
- ⚠️ **Supabase Residue:** 
  - `src/integrations/supabase/` folder exists but **NOT imported anywhere** (safe to ignore)
  - Archived docs reference Supabase (historical only)

### Code Quality
- ✅ Performance optimizations implemented (cached subscription checks, reduced timeouts)
- ✅ Build errors fixed (getAll → Promise.all migration)
- ✅ Authentication flow using Firebase Auth exclusively

---

## ⚠️ Backend Status: FUNCTIONS NEED DEPLOYMENT

### Firebase Cloud Functions Status

#### ✅ Functions Implemented
All required functions exist in `functions/src/index.ts`:
- ✅ **Apple Subscriptions:**
  - `verifyAppleReceipt` - Verifies receipts and updates subscriptions
  - `checkAppleSubscription` - Returns current subscription status
  - `appleWebhook` - Handles App Store Server Notifications (HTTP endpoint)

- ✅ **AI/Content Generation:** 40+ functions for mentor content, companion generation, etc.
- ✅ **User Management:** `deleteUserAccount`, `resetCompanion`, etc.
- ✅ **Scheduled Jobs:** Daily pep talks, quotes, push notifications

#### ⚠️ Required Actions

1. **Deploy Functions to Firebase:**
   ```bash
   cd functions
   npm install
   npm run build
   firebase deploy --only functions
   ```

2. **Set Firebase Functions Secrets:**
   ```bash
   # Required for Apple Subscriptions
   firebase functions:secrets:set APPLE_SHARED_SECRET
   firebase functions:secrets:set APPLE_SERVICE_ID
   firebase functions:secrets:set APPLE_IOS_BUNDLE_ID
   firebase functions:secrets:set APPLE_WEBHOOK_AUDIENCE
   
   # Required for AI Features
   firebase functions:secrets:set OPENAI_API_KEY
   firebase functions:secrets:set ELEVENLABS_API_KEY
   firebase functions:secrets:set GEMINI_API_KEY
   
   # Required for Push Notifications
   firebase functions:secrets:set APNS_KEY_ID
   firebase functions:secrets:set APNS_TEAM_ID
   firebase functions:secrets:set APNS_BUNDLE_ID
   firebase functions:secrets:set APNS_AUTH_KEY
   firebase functions:secrets:set APNS_ENVIRONMENT
   firebase functions:secrets:set VAPID_PUBLIC_KEY
   firebase functions:secrets:set VAPID_PRIVATE_KEY
   firebase functions:secrets:set VAPID_SUBJECT
   
   # Required for Payments (if using)
   firebase functions:secrets:set PAYPAL_CLIENT_ID
   firebase functions:secrets:set PAYPAL_SECRET
   ```

3. **Get Apple Webhook URL:**
   After deployment, the webhook URL will be:
   ```
   https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
   ```
   (Verify in Firebase Console → Functions after deployment)

---

## 🔧 Firebase Console Checklist

### Authentication
- [ ] **Email/Password** sign-in method enabled
- [ ] **Google** OAuth provider configured
- [ ] **Apple** OAuth provider configured (iOS bundle ID: `com.darrylgraham.revolution`)

### Firestore Database
- [ ] Database created in production mode
- [ ] Security rules deployed (`firestore.rules`)
- [ ] Collections exist: `profiles`, `subscriptions`, `mentors`, `companions`, etc.

### Cloud Functions
- [ ] Functions deployed (check Functions dashboard)
- [ ] All secrets configured (see list above)
- [ ] `appleWebhook` function is accessible via HTTPS
- [ ] Functions have correct region (default: `us-central1`)

### Storage (if using)
- [ ] Storage bucket created
- [ ] Storage rules deployed

---

## 📱 App Store Connect Configuration

### Apple Webhook URL
**⚠️ CRITICAL:** Update the webhook URL from Supabase to Firebase:

1. Go to App Store Connect → Your App → App Information
2. Scroll to **Server Notification URL**
3. Update to:
   ```
   https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
   ```
   (Replace with actual URL from Firebase Console after deployment)

### In-App Purchase Products
- [ ] Monthly subscription created: `com.darrylgraham.revolution.monthly` (or your product ID)
- [ ] Yearly subscription created: `com.darrylgraham.revolution.yearly` (or your product ID)
- [ ] Prices set ($9.99/month, $59.99/year)

---

## 🚀 Deployment Steps

### 1. Deploy Firebase Functions
```bash
# From project root
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

### 2. Verify Deployment
```bash
# Check functions are live
firebase functions:list

# Test a function (optional)
firebase functions:shell
> checkAppleSubscription()
```

### 3. Get Webhook URL
```bash
# Or check in Firebase Console → Functions → appleWebhook → URL
```

### 4. Update App Store Connect
- Replace Supabase webhook URL with Firebase URL

### 5. Test Subscription Flow
1. Build iOS app in Xcode
2. Test subscription purchase
3. Verify webhook receives notifications
4. Check Firestore `subscriptions` collection updates

---

## 📋 Pre-TestFlight Checklist

### Code
- [x] All Supabase code removed (only unused imports remain)
- [x] Firebase configuration correct
- [x] Build errors fixed
- [x] Performance optimizations applied

### Firebase Backend
- [ ] Functions deployed
- [ ] All secrets configured
- [ ] Firestore database created
- [ ] Security rules deployed
- [ ] Authentication providers enabled

### App Store Connect
- [ ] Bundle ID: `com.darrylgraham.revolution`
- [ ] Apple Webhook URL updated to Firebase
- [ ] In-App Purchase products created
- [ ] TestFlight build uploaded

### Testing
- [ ] Sign up/Sign in works
- [ ] Subscription purchase works
- [ ] Webhook receives notifications
- [ ] Subscription status syncs correctly

---

## 🔗 Important URLs

- **Firebase Console:** https://console.firebase.google.com/project/cosmiq-prod
- **App Store Connect:** https://appstoreconnect.apple.com
- **Apple Developer:** https://developer.apple.com

---

## ⚠️ Known Issues / Notes

1. **Supabase Client File:** `src/integrations/supabase/client.ts` exists but is **NOT imported anywhere**. Safe to ignore or delete later.

2. **Supabase Folder:** The `supabase/` folder contains old config but is not used. Can be archived/deleted after confirming functions work.

3. **Webhook Migration:** The Apple webhook URL must be updated in App Store Connect from the old Supabase URL to the new Firebase URL.

4. **Functions Region:** Default Firebase Functions region is `us-central1`. If you need a different region, update `firebase.json`.

---

## ✅ Summary

**Frontend:** ✅ Ready for TestFlight  
**Backend:** ⚠️ Requires Firebase Functions deployment and secret configuration  
**App Store:** ⚠️ Requires webhook URL update after deployment

**Next Steps:**
1. Deploy Firebase Cloud Functions
2. Configure all required secrets
3. Update Apple webhook URL in App Store Connect
4. Test subscription flow end-to-end
5. Upload to TestFlight

---

**Last Updated:** 2025-01-13

