# Authentication Fixes Checklist

## Current Issues
1. ❌ Google Sign-In: Using old client ID (`371878262982` instead of `636156363416`)
2. ❌ Email Sign-In: Not working
3. ❌ Apple Sign-In: Not working

## Root Cause
The `GoogleService-Info.plist` file exists but is **NOT added to the Xcode project**, so it's not included in the app bundle.

---

## Fix Steps

### 1. ✅ Add GoogleService-Info.plist to Xcode Project

**In Xcode:**
```bash
open ios/App/App.xcworkspace
```

1. Right-click **App** folder in Project Navigator
2. Select **"Add Files to 'App'..."**
3. Select `ios/App/App/GoogleService-Info.plist`
4. ✅ **UNCHECK** "Copy items if needed" (file already exists)
5. ✅ **CHECK** "Add to targets: App" (CRITICAL!)
6. Click **Add**

**Verify:**
- `GoogleService-Info.plist` appears in Project Navigator
- Select it → File Inspector shows it's in "App" target

---

### 2. ✅ Verify Environment Variables

**On MacInCloud, check `.env.local`:**
```bash
cat .env.local | grep VITE_GOOGLE
```

**Should see:**
```
VITE_GOOGLE_WEB_CLIENT_ID=636156363416-xxxxxxxxxxxxx.apps.googleusercontent.com
VITE_GOOGLE_IOS_CLIENT_ID=636156363416-jnfhktg28pviioilk907defbrms2qh3s.apps.googleusercontent.com
```

**If missing or wrong, update:**
```bash
nano .env.local
# Add/update:
VITE_GOOGLE_IOS_CLIENT_ID=636156363416-jnfhktg28pviioilk907defbrms2qh3s.apps.googleusercontent.com
```

---

### 3. ✅ Enable Apple Sign-In in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **cosmiq-prod**
3. **Authentication** → **Sign-in method**
4. Click **Apple**
5. Toggle **Enable** to ON
6. Click **Save**

---

### 4. ✅ Sync Capacitor & Rebuild

```bash
# Build web assets
npm run build

# Sync to iOS
npx cap sync ios

# In Xcode:
# 1. Product → Clean Build Folder (Shift+Cmd+K)
# 2. Delete app from device/simulator (long press → delete)
# 3. Build and Run (Cmd+R)
```

---

### 5. ✅ Test All Sign-In Methods

1. **Email/Password:** Should work (Firebase Auth enabled by default)
2. **Google:** Should use new client ID (`636156363416`)
3. **Apple:** Should work after enabling in Firebase

---

## Verification

**Check logs in Xcode Console:**
- Should see: `[OAuth Init] SocialLogin initialized successfully`
- Should NOT see old client ID (`371878262982`)

**If still seeing old client ID:**
1. Completely delete app from device
2. Clean Build Folder in Xcode
3. Rebuild and reinstall

---

## Expected Values

✅ **Correct Google Client ID:** `636156363416-jnfhktg28pviioilk907defbrms2qh3s`  
✅ **Correct URL Scheme:** `com.googleusercontent.apps.636156363416-jnfhktg28pviioilk907defbrms2qh3s`  
✅ **Bundle ID:** `com.darrylgraham.revolution`  
✅ **Firebase Project:** `cosmiq-prod` (Project Number: `636156363416`)

