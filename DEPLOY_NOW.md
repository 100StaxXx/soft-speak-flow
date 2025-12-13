# Quick Deploy Instructions

The automated script has syntax issues. Here's the manual process:

## Step 1: Build Functions

```powershell
cd functions
npm install
npm run build
cd ..
```

## Step 2: Set Secrets (if not already set)

For each secret, run:
```powershell
firebase functions:secrets:set SECRET_NAME
# It will prompt you for the value
```

**Required Secrets:**
- `APPLE_SHARED_SECRET` - From App Store Connect
- `APPLE_SERVICE_ID` - `com.darrylgraham.revolution.web`
- `APPLE_IOS_BUNDLE_ID` - `com.darrylgraham.revolution`
- `APPLE_WEBHOOK_AUDIENCE` - `appstoreconnect-v1`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`

## Step 3: Deploy

```powershell
firebase deploy --only functions
```

## Step 4: Get Webhook URL

After deployment, the webhook URL will be:
```
https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
```

Or check with:
```powershell
firebase functions:list
```

## Step 5: Update App Store Connect

1. Go to: https://appstoreconnect.apple.com
2. Your App → App Information
3. Update **Server Notification URL** with the Firebase webhook URL

---

**The script will be fixed, but you can deploy manually using the steps above.**

