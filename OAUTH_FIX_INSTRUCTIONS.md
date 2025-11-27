# OAuth Configuration Fix

## Problem
You're getting `validation_failed: provider is not enabled` because there's a mismatch between:
1. The Google Client IDs in your code
2. What's configured in Lovable Cloud Auth Settings

## Solution

### Step 1: Get Your Google Client IDs from Google Cloud Console

1. Go to https://console.cloud.google.com/apis/credentials
2. Find your **Web OAuth Client** - copy the Client ID
3. Find your **iOS OAuth Client** - copy the Client ID

### Step 2: Add Client IDs to Lovable Cloud

**Important**: The `.env` file is read-only in Lovable Cloud projects. You need to add these as **secrets** instead.

<lov-presentation-actions>
  <lov-presentation-open-backend>Open Backend Settings</lov-presentation-open-backend>
</lov-presentation-actions>

1. Click "Open Backend Settings" above
2. Navigate to **Secrets**
3. Add two new secrets:
   - Name: `VITE_GOOGLE_WEB_CLIENT_ID`
   - Value: Your Web Client ID from Step 1
   
   - Name: `VITE_GOOGLE_IOS_CLIENT_ID`
   - Value: Your iOS Client ID from Step 1

### Step 3: Configure Google Provider in Auth Settings

Still in Backend Settings:
1. Navigate to **Auth Settings** → **Google**
2. Make sure Google provider is **toggled ON**
3. Add these settings:
   - **Client ID**: Same as your Web Client ID from Step 1
   - **Client Secret**: Get this from Google Cloud Console (same page as Client ID)
   - **Authorized redirect URLs**: Add `com.revolution.app://`

### Step 4: Verify Google Cloud Console Setup

Back in Google Cloud Console (https://console.cloud.google.com/apis/credentials):

**For your Web OAuth Client:**
- Authorized JavaScript origins: Add `https://tffrgsaawvletgiztfry.supabase.co`
- Authorized redirect URIs: Add `https://tffrgsaawvletgiztfry.supabase.co/auth/v1/callback`

**For your iOS OAuth Client:**
- Bundle ID: `com.revolution.app`

### Step 5: Test Google Sign-In

1. Rebuild your app: `npm run build`
2. Sync to iOS: `npx cap sync ios`
3. Open in Xcode: `npx cap open ios`
4. Run on device/simulator
5. Check Xcode console for `[OAuth Init]` and `[Google OAuth]` logs

---

## About Apple Sign-In

Apple Sign-In uses a **different approach** - it doesn't go through Supabase OAuth like Google does.

### How Apple Sign-In Works:
1. Native iOS Sign-In (via Capacitor plugin)
2. Gets identity token from Apple
3. Passes token to Supabase using `signInWithIdToken()` 
4. Supabase validates the token with Apple directly

### Apple Configuration:

**In Lovable Cloud Backend:**
- Apple provider might not show up in Auth Settings UI
- But Apple credentials are already stored as secrets:
  - `APPLE_SERVICE_ID`
  - `APPLE_TEAM_ID`
  - `APPLE_KEY_ID`
  - `APPLE_PRIVATE_KEY`

**In Xcode:**
1. Open your project in Xcode
2. Select target → Signing & Capabilities
3. Add "Sign in with Apple" capability
4. Ensure it's checked/enabled

**In Apple Developer Portal:**
1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Find App ID: `com.revolution.app`
3. Ensure "Sign in with Apple" is enabled

### Test Apple Sign-In:

Apple Sign-In should work immediately if:
- ✅ Capability is enabled in Xcode
- ✅ App ID has Sign in with Apple enabled in Developer Portal
- ✅ Apple secrets are configured in Lovable Cloud (they already are)

---

## Expected Error Messages

### If Google Client IDs are missing:
```
[OAuth Init] Missing Google Client IDs in environment variables
```

### If Google provider not enabled in Supabase:
```
validation_failed: provider is not enabled
```

### If Google Client ID doesn't match:
```
[Google OAuth] Supabase response: { error: "Invalid OAuth credentials" }
```

### If Apple capability not enabled:
```
Error: Sign in with Apple is not available
```

---

## Quick Checklist

**Google:**
- [ ] Web Client ID added as secret `VITE_GOOGLE_WEB_CLIENT_ID`
- [ ] iOS Client ID added as secret `VITE_GOOGLE_IOS_CLIENT_ID`
- [ ] Google provider enabled in Auth Settings
- [ ] Client ID and Secret configured in Auth Settings
- [ ] Redirect URL `com.revolution.app://` added
- [ ] Google Cloud Console has correct redirect URIs

**Apple:**
- [ ] "Sign in with Apple" capability enabled in Xcode
- [ ] App ID has Sign in with Apple enabled in Developer Portal
- [ ] Apple secrets exist in Lovable Cloud (they do)

---

## Still Not Working?

1. Check Xcode console for detailed error logs
2. Verify exact Client ID match between:
   - Google Cloud Console
   - Lovable Cloud secrets
   - Lovable Cloud Auth Settings
3. Ensure redirect URLs are **exactly** `com.revolution.app://` (no trailing slash, no https)
4. Try signing in and share the full console output with all `[OAuth Debug]`, `[OAuth Init]`, `[Google OAuth]`, and `[Apple OAuth]` messages
