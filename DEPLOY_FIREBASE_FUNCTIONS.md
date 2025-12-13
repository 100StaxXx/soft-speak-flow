# Deploy Firebase Functions - Step-by-Step Guide

This guide will help you deploy your Firebase Cloud Functions and configure all required secrets.

---

## 🚀 Quick Start (Automated - Recommended)

The easiest way to deploy is using the automated PowerShell script:

```powershell
.\scripts\deploy-firebase-functions.ps1
```

### Script Features:

- **Automatic Prerequisites Check**: Verifies Firebase CLI, login status, and Node.js version
- **Smart Secret Management**: 
  - Checks which secrets are already configured
  - Only prompts for missing required secrets
  - Shows clear status (✅ SET / ❌ NOT SET) for each secret
- **Intelligent Build Process**: 
  - Installs dependencies automatically if needed
  - Validates build output before deployment
- **Automatic Webhook URL Extraction**: 
  - Extracts the Apple webhook URL from deployment output
  - Copies it to your clipboard automatically
- **Deployment Summary**: Shows what will be deployed before starting
- **Error Handling**: Provides clear troubleshooting steps if deployment fails

### Script Options:

```powershell
# Interactive mode (default)
.\scripts\deploy-firebase-functions.ps1

# Skip secret setup (if already configured)
.\scripts\deploy-firebase-functions.ps1 -SkipSecrets

# Auto-deploy without prompts
.\scripts\deploy-firebase-functions.ps1 -AutoDeploy

# Non-interactive mode (for automation/CI)
.\scripts\deploy-firebase-functions.ps1 -NonInteractive
```

---

## 📋 Manual Deployment (Alternative)

If you prefer to deploy manually or the script doesn't work for your environment, follow the steps below.

---

## Prerequisites

1. **Firebase CLI installed:**
   ```powershell
   npm install -g firebase-tools
   ```

2. **Logged into Firebase:**
   ```powershell
   firebase login
   ```

3. **Project set correctly:**
   ```powershell
   firebase use cosmiq-prod
   ```

---

## Step 1: Build Functions

```powershell
cd functions
npm install
npm run build
cd ..
```

**Verify:** Check that `functions/lib/index.js` exists (compiled output).

---

## Step 2: Set Required Secrets

Secrets are stored securely in Firebase and accessed by your functions. Run these commands **one at a time**:

### Apple Subscription Secrets (CRITICAL for TestFlight)

```powershell
# Get this from App Store Connect → Your App → App Information → App-Specific Shared Secret
firebase functions:secrets:set APPLE_SHARED_SECRET

# Service ID for web Apple Sign In
firebase functions:secrets:set APPLE_SERVICE_ID
# Value: com.darrylgraham.revolution.web

# iOS Bundle ID
firebase functions:secrets:set APPLE_IOS_BUNDLE_ID
# Value: com.darrylgraham.revolution

# Apple Webhook Audience (for JWT verification)
firebase functions:secrets:set APPLE_WEBHOOK_AUDIENCE
# Value: appstoreconnect-v1
```

### AI API Keys (Required for AI features)

```powershell
# Gemini API Key (get from Google Cloud Console)
firebase functions:secrets:set GEMINI_API_KEY

# OpenAI API Key
firebase functions:secrets:set OPENAI_API_KEY

# ElevenLabs API Key (for text-to-speech)
firebase functions:secrets:set ELEVENLABS_API_KEY
```

### Push Notification Secrets (Required for push notifications)

#### VAPID Keys (Web Push)
```powershell
# VAPID Public Key
firebase functions:secrets:set VAPID_PUBLIC_KEY

# VAPID Private Key
firebase functions:secrets:set VAPID_PRIVATE_KEY

# VAPID Subject (email)
firebase functions:secrets:set VAPID_SUBJECT
# Value: mailto:admin@cosmiq.quest
```

#### APNS Keys (iOS Push Notifications)
```powershell
# APNS Key ID (from Apple Developer portal)
firebase functions:secrets:set APNS_KEY_ID

# APNS Team ID (your Apple Developer Team ID)
firebase functions:secrets:set APNS_TEAM_ID

# APNS Bundle ID
firebase functions:secrets:set APNS_BUNDLE_ID
# Value: com.darrylgraham.revolution

# APNS Auth Key (contents of .p8 file)
firebase functions:secrets:set APNS_AUTH_KEY

# APNS Environment (production or sandbox)
firebase functions:secrets:set APNS_ENVIRONMENT
# Value: production (for TestFlight/App Store)
```

### PayPal Secrets (Optional - only if using PayPal)

```powershell
firebase functions:secrets:set PAYPAL_CLIENT_ID
firebase functions:secrets:set PAYPAL_SECRET
```

---

## Step 3: Deploy Functions

After all secrets are set, deploy the functions:

```powershell
# From project root
firebase deploy --only functions
```

**This will:**
- Build the functions (if not already built)
- Deploy all functions to Firebase
- Make them accessible via HTTPS

**Expected output:** You'll see URLs for each deployed function.

---

## Step 4: Get Apple Webhook URL

After deployment, find your webhook URL:

### Option 1: From Deployment Output
Look for:
```
✔  functions[appleWebhook(us-central1)]: Successful create operation.
https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
```

### Option 2: From Firebase Console
1. Go to: https://console.firebase.google.com/project/cosmiq-prod/functions
2. Click on `appleWebhook` function
3. Copy the **Trigger URL**

### Option 3: Using CLI
```powershell
firebase functions:list
# Look for appleWebhook function URL
```

**Your webhook URL will be:**
```
https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
```
*(Region may vary if you configured a different region)*

---

## Step 5: Update App Store Connect

1. Go to: https://appstoreconnect.apple.com
2. Navigate to: **Your App** → **App Information**
3. Scroll to **Server Notification URL**
4. Paste your Firebase webhook URL:
   ```
   https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
   ```
5. Save

**⚠️ IMPORTANT:** This replaces any old Supabase webhook URL. Apple will now send subscription events to Firebase.

---

## Step 6: Verify Deployment

### Test a Function

```powershell
# Test checkAppleSubscription (requires auth token)
# This is better tested from the app itself
```

### Check Function Logs

```powershell
# View all function logs
firebase functions:log

# View logs for specific function
firebase functions:log --only appleWebhook
```

### Verify in Firebase Console

1. Go to: https://console.firebase.google.com/project/cosmiq-prod/functions
2. You should see all your functions listed
3. Check that `appleWebhook`, `checkAppleSubscription`, `verifyAppleReceipt` are deployed

---

## Troubleshooting

### "Secret not found" errors

If functions fail with secret errors:
1. Verify secrets are set: `firebase functions:secrets:access SECRET_NAME`
2. Ensure function code uses `defineSecret()` and includes the secret in the `secrets` array
3. Redeploy after setting secrets: `firebase deploy --only functions`

### "Function deployment failed"

1. Check build errors: `cd functions && npm run build`
2. Check TypeScript errors
3. Ensure Node.js version matches (should be 20): `node --version`

### Webhook not receiving events

1. Verify webhook URL in App Store Connect matches deployed function URL
2. Check function logs: `firebase functions:log --only appleWebhook`
3. Test webhook manually (see below)

### Test Webhook Manually

```powershell
# Test webhook endpoint (should return OK for OPTIONS)
curl -X OPTIONS https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
```

---

## Quick Checklist

- [ ] Firebase CLI installed and logged in
- [ ] Project set to `cosmiq-prod`
- [ ] Functions built successfully
- [ ] All required secrets set (check list above)
- [ ] Functions deployed successfully
- [ ] Apple webhook URL copied
- [ ] App Store Connect webhook URL updated
- [ ] Functions visible in Firebase Console

---

## Next Steps

After deployment:
1. ✅ Test subscription purchase in TestFlight
2. ✅ Verify webhook receives events (check logs)
3. ✅ Verify subscription status syncs correctly
4. ✅ Test other functions (AI generation, etc.)

---

## Support

If you encounter issues:
1. Check function logs: `firebase functions:log`
2. Check Firebase Console for error details
3. Verify all secrets are set correctly
4. Ensure functions are deployed to the correct region

---

**Last Updated:** 2025-01-13

