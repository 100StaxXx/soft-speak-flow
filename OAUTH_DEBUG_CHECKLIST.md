# OAuth Sign-In Debug Checklist

## Current Status
- ✅ Native Apple Sign-In code implemented (Capacitor plugin)
- ✅ Native Google Sign-In code implemented (Capacitor plugin)
- ✅ Detailed logging added to Auth.tsx
- ⚠️ OAuth buttons currently hidden in UI (need to enable for testing)
- ❓ Google Cloud Console configuration - NEEDS VERIFICATION
- ❓ Apple Developer Portal configuration - NEEDS VERIFICATION

---

## Step 1: Enable OAuth Buttons for Testing

Uncomment the social login section in `src/pages/Auth.tsx` (lines ~300-337) to show the Google and Apple sign-in buttons.

---

## Step 2: Google Cloud Console Verification

### Required Setup:
1. **Go to**: https://console.cloud.google.com/apis/credentials

2. **OAuth Consent Screen** (APIs & Services → OAuth consent screen):
   - ✅ User Type: External (or Internal if G Suite)
   - ✅ App name: R-Evolution
   - ✅ User support email: your email
   - ✅ Developer contact: your email
   - ✅ Scopes: `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`
   - ✅ Test users: Add your testing email (if app not published)

3. **Create iOS OAuth Client** (APIs & Services → Credentials → Create Credentials → OAuth Client ID):
   - Application type: **iOS**
   - Bundle ID: `com.revolution.app`
   - Copy the **iOS Client ID** (format: `xxx-yyy.apps.googleusercontent.com`)

4. **Create Web OAuth Client** (for web fallback):
   - Application type: **Web application**
   - Authorized JavaScript origins: Add your Supabase project URL
     - `https://tffrgsaawvletgiztfry.supabase.co`
   - Authorized redirect URIs:
     - `https://tffrgsaawvletgiztfry.supabase.co/auth/v1/callback`
   - Copy the **Web Client ID**

5. **Update capacitor.config.ts** with the iOS Client ID:
   ```typescript
   google: {
     webClientId: 'YOUR-WEB-CLIENT-ID.apps.googleusercontent.com',
     iOSClientId: 'YOUR-IOS-CLIENT-ID.apps.googleusercontent.com',
     mode: 'online'
   }
   ```

6. **Supabase Google Provider Configuration**:
   - In Lovable Cloud backend → Auth Settings → Google
   - Add your **Web Client ID** and **Web Client Secret**
   - Add authorized redirect URL: `com.revolution.app://`

### Common Google OAuth Errors:
- **Error 403**: OAuth consent screen not configured or app not published
- **Error 401**: Client ID mismatch between code and Google Console
- **"idp_rejected"**: Wrong bundle ID or client ID
- **No ID token**: Scopes not properly configured

---

## Step 3: Apple Developer Portal Verification

### Required Setup:
1. **Go to**: https://developer.apple.com/account

2. **Enable "Sign in with Apple" Capability**:
   - Open Xcode
   - Select your app target → Signing & Capabilities
   - Click "+ Capability"
   - Add **"Sign in with Apple"**
   - Ensure it's enabled

3. **App ID Configuration** (Identifiers section):
   - Go to: https://developer.apple.com/account/resources/identifiers/list
   - Select your App ID: `com.revolution.app`
   - Ensure **"Sign in with Apple"** is checked in Capabilities
   - Click **"Edit"** if needed and save

4. **Services ID** (Optional - only for web fallback):
   - Go to: Identifiers → Services IDs
   - Create new Services ID if needed
   - Configure "Sign in with Apple"
   - Add Return URLs: `https://tffrgsaawvletgiztfry.supabase.co/auth/v1/callback`

5. **Keys** (for Supabase):
   - Go to: Keys section
   - Create new Key with "Sign in with Apple" enabled
   - Download the `.p8` file (you can only download once!)
   - Note the **Key ID**

6. **Supabase Apple Provider Configuration**:
   - In Lovable Cloud backend → Auth Settings → Apple
   - Service ID: Your Services ID (e.g., `com.revolution.app.signin`)
   - Team ID: Your Apple Team ID (10 characters, e.g., `B6VW78ABTR`)
   - Key ID: From the downloaded key
   - Private Key: Contents of the `.p8` file
   - Add authorized redirect URL: `com.revolution.app://`

### Common Apple OAuth Errors:
- **"invalid_client"**: Service ID or Team ID mismatch
- **"invalid_grant"**: Nonce mismatch or expired token
- **No identity token**: "Sign in with Apple" not enabled in Xcode
- **Error 1001**: User cancelled (this is normal, not an error)

---

## Step 4: Testing Procedure

### On iOS Device/Simulator:

1. **Build and deploy** the app with OAuth buttons visible:
   ```bash
   npm run build
   npx cap sync ios
   npx cap open ios
   ```

2. **Test Google Sign-In**:
   - Tap "Continue with Google"
   - Watch Xcode console logs for `[Google OAuth]` messages
   - Expected flow:
     - `[Google OAuth] Initiating native Google sign-in`
     - Google account picker appears
     - `[Google OAuth] ID token received`
     - `[Google OAuth] Calling Supabase signInWithIdToken`
     - `[Google OAuth] Sign-in successful`

3. **Test Apple Sign-In**:
   - Tap "Continue with Apple"
   - Watch Xcode console logs for `[Apple OAuth]` messages
   - Expected flow:
     - `[Apple OAuth] Initiating native Apple sign-in`
     - Apple Sign-In sheet appears
     - `[Apple OAuth] SignInWithApple result: {hasIdentityToken: true}`
     - `[Apple OAuth] Calling Supabase signInWithIdToken`
     - `[Apple OAuth] Sign-in successful`

### Common Issues:

**If Google fails immediately**:
- Check `capacitor.config.ts` has correct iOS Client ID
- Verify iOS Client ID in Google Cloud Console matches bundle ID `com.revolution.app`

**If Apple fails immediately**:
- Check "Sign in with Apple" capability is enabled in Xcode
- Verify App ID has "Sign in with Apple" enabled in Apple Developer Portal

**If sign-in succeeds but Supabase fails**:
- Check Supabase Auth Settings in Lovable Cloud backend
- Verify redirect URLs match exactly: `com.revolution.app://`
- Check console logs for specific Supabase error message

---

## Step 5: Share Debug Logs

When testing, copy the console output from Xcode and share:

1. All `[OAuth Debug]` messages
2. All `[Google OAuth]` or `[Apple OAuth]` messages
3. Any error messages or stack traces

This will help identify exactly where the flow is breaking.

---

## Environment Variables Check

Your current `.env` has:
```
VITE_SUPABASE_URL=https://tffrgsaawvletgiztfry.supabase.co
VITE_SUPABASE_PROJECT_ID=tffrgsaawvletgiztfry
```

Google OAuth Client IDs are hardcoded in `src/pages/Auth.tsx` lines 46-47:
```typescript
webClientId: '371878262982-tjcop6qvno6nsl68vurt44211g1835cp.apps.googleusercontent.com'
iOSClientId: '371878262982-msdt2oq5rl858ft64d33onhrg5l67ofu.apps.googleusercontent.com'
```

**ACTION REQUIRED**: Verify these Client IDs match your Google Cloud Console setup or update them.
