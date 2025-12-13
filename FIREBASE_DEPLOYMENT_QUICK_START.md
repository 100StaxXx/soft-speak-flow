# Firebase Deployment Quick Start

**Project:** cosmiq-prod  
**Goal:** Deploy Cloud Functions for TestFlight

---

## 🚀 Quick Deployment (Automated)

Run the PowerShell script:

```powershell
# Interactive mode (recommended for first-time setup)
.\scripts\deploy-firebase-functions.ps1

# Skip secret setup (if secrets are already configured)
.\scripts\deploy-firebase-functions.ps1 -SkipSecrets

# Auto-deploy without prompts (for CI/CD)
.\scripts\deploy-firebase-functions.ps1 -AutoDeploy

# Non-interactive mode (for automation)
.\scripts\deploy-firebase-functions.ps1 -NonInteractive
```

### What the script does:

1. ✅ **Checks prerequisites**
   - Verifies Firebase CLI is installed
   - Checks login status
   - Validates Node.js version

2. ✅ **Builds functions**
   - Installs dependencies if needed
   - Compiles TypeScript
   - Verifies build output

3. ✅ **Manages secrets intelligently**
   - Checks which secrets are already set
   - Only prompts for missing required secrets
   - Shows status of all secrets (SET/NOT SET)
   - Validates required secrets before deployment

4. ✅ **Deploys functions**
   - Shows deployment summary
   - Automatically extracts webhook URL
   - Copies webhook URL to clipboard
   - Provides next steps with clear instructions

---

## 📋 Required Secrets Checklist

### Critical (Required for TestFlight)
- [ ] `APPLE_SHARED_SECRET` - From App Store Connect
- [ ] `APPLE_SERVICE_ID` - `com.darrylgraham.revolution.web`
- [ ] `APPLE_IOS_BUNDLE_ID` - `com.darrylgraham.revolution`
- [ ] `APPLE_WEBHOOK_AUDIENCE` - `appstoreconnect-v1`

### AI Features (Required for app functionality)
- [ ] `GEMINI_API_KEY` - From Google Cloud Console
- [ ] `OPENAI_API_KEY` - From OpenAI
- [ ] `ELEVENLABS_API_KEY` - From ElevenLabs

### Push Notifications (Optional but recommended)
- [ ] `VAPID_PUBLIC_KEY` - For web push
- [ ] `VAPID_PRIVATE_KEY` - For web push
- [ ] `VAPID_SUBJECT` - `mailto:admin@cosmiq.quest`
- [ ] `APNS_KEY_ID` - For iOS push
- [ ] `APNS_TEAM_ID` - Apple Developer Team ID
- [ ] `APNS_BUNDLE_ID` - `com.darrylgraham.revolution`
- [ ] `APNS_AUTH_KEY` - Contents of .p8 file
- [ ] `APNS_ENVIRONMENT` - `production`

### Payments (Optional)
- [ ] `PAYPAL_CLIENT_ID`
- [ ] `PAYPAL_SECRET`

---

## 🔧 Manual Deployment Steps

### 1. Install & Login
```powershell
npm install -g firebase-tools
firebase login
firebase use cosmiq-prod
```

### 2. Build Functions
```powershell
cd functions
npm install
npm run build
cd ..
```

### 3. Set Secrets (One at a time)
```powershell
firebase functions:secrets:set SECRET_NAME
# It will prompt you for the value
```

### 4. Deploy
```powershell
firebase deploy --only functions
```

### 5. Get Webhook URL
After deployment, find it in:
- Deployment output
- Firebase Console → Functions → appleWebhook → Trigger URL
- Or run: `firebase functions:list`

**Expected URL:**
```
https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
```

### 6. Update App Store Connect
1. Go to: https://appstoreconnect.apple.com
2. Your App → App Information
3. Update **Server Notification URL** with Firebase webhook URL
4. Save

---

## ✅ Verify Deployment

### Check Functions
```powershell
firebase functions:list
```

### View Logs
```powershell
firebase functions:log
firebase functions:log --only appleWebhook
```

### Test Webhook
```powershell
# Should return OK for OPTIONS request
curl -X OPTIONS https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
```

---

## 🔍 Important Notes

### Product IDs
Your app uses these product IDs (configured in `src/utils/appleIAP.ts`):
- **Monthly:** `cosmiq_premium_monthly`
- **Yearly:** `cosmiq_premium_yearly`

The function automatically detects plan type by checking if product ID contains "year", "annual", or "yearly".

### Pricing
- Monthly: $9.99 (999 cents)
- Yearly: $59.99 (5999 cents)

These are hardcoded defaults in the function. Make sure your App Store Connect prices match.

---

## 🆘 Troubleshooting

### "Secret not found" error
- Verify secret is set: `firebase functions:secrets:access SECRET_NAME`
- Redeploy after setting secrets: `firebase deploy --only functions`

### Webhook not receiving events
1. Verify URL in App Store Connect matches deployed function URL exactly
2. Check function logs: `firebase functions:log --only appleWebhook`
3. Wait 5-10 minutes after updating URL (Apple can take time to propagate)

### Functions won't deploy
1. Check build errors: `cd functions && npm run build`
2. Verify TypeScript compiles
3. Check Node.js version (should be 20)
4. Ensure all required secrets are set

---

## 📚 Full Documentation

- **Detailed Guide:** `DEPLOY_FIREBASE_FUNCTIONS.md`
- **TestFlight Readiness:** `TESTFLIGHT_READINESS_REPORT.md`
- **Deployment Script:** `scripts/deploy-firebase-functions.ps1`

---

**Last Updated:** 2025-01-13

