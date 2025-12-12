# Apple Sign-In Firebase Setup

## Quick Answer: Do You Need GoogleService-Info.plist for Apple Sign-In?

**No!** Apple Sign-In works differently than Google Sign-In:

- ✅ **Google Sign-In** requires `GoogleService-Info.plist` (for iOS OAuth client ID)
- ✅ **Apple Sign-In** uses your **bundle ID** directly (`com.darrylgraham.revolution`)
- ✅ **Apple Sign-In** is already configured in your code and entitlements

However, you **do** need to enable Apple Sign-In in Firebase Console.

## Current Status

Your Apple Sign-In is already configured in code:
- ✅ Bundle ID: `com.darrylgraham.revolution` (used as client ID)
- ✅ Entitlements: `App.entitlements` has Apple Sign-In capability
- ✅ Code: `src/pages/Auth.tsx` uses bundle ID for Apple Sign-In

## Required: Enable Apple Sign-In in Firebase Console

### Step 1: Go to Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **cosmiq-prod**

### Step 2: Enable Apple Sign-In

1. Go to **Authentication** → **Sign-in method**
2. Find **Apple** in the list
3. Click on **Apple**
4. Toggle **Enable** to ON
5. Click **Save**

### Step 3: Configure Apple Sign-In (Optional but Recommended)

If you want to customize the Apple Sign-In experience:

1. **Service ID** (optional): You can create a service ID in Apple Developer Console
   - This is only needed for web Apple Sign-In
   - For native iOS, the bundle ID is used automatically

2. **OAuth redirect URI** (for web only):
   - Format: `https://YOUR_AUTH_DOMAIN/__/auth/handler`
   - Example: `https://cosmiq-prod.firebaseapp.com/__/auth/handler`

### Step 4: Verify Bundle ID in Firebase

1. Go to **Project Settings** → **General**
2. Under **Your apps**, find your **iOS app**
3. Verify the **Bundle ID** is: `com.darrylgraham.revolution`
4. If it's different, you may need to update it or create a new iOS app

## How Apple Sign-In Works

### Native iOS (What You're Using)

1. User taps "Continue with Apple"
2. iOS shows Apple Sign-In dialog
3. User authenticates with Face ID/Touch ID/password
4. Apple returns an identity token
5. Your app sends the token to Firebase
6. Firebase verifies the token and creates/signs in the user

**Key Points:**
- Uses bundle ID: `com.darrylgraham.revolution` (already configured)
- No separate OAuth client ID needed
- Works automatically on iOS devices
- Requires Apple Sign-In capability in entitlements (✅ already set)

### Web (If You Add It Later)

For web Apple Sign-In, you would need:
- Service ID from Apple Developer Console
- OAuth redirect URI configured in Apple Developer Console
- Service ID configured in Firebase Console

But for now, your native iOS setup is complete!

## Verification Checklist

- [ ] Apple Sign-In is **Enabled** in Firebase Console (Authentication → Sign-in method)
- [ ] iOS app bundle ID in Firebase matches: `com.darrylgraham.revolution`
- [ ] `App.entitlements` has `com.apple.developer.applesignin` (✅ already done)
- [ ] Code uses bundle ID for Apple Sign-In (✅ already done in `Auth.tsx`)

## Testing

After enabling Apple Sign-In in Firebase Console:

1. Build and run your app on a physical iOS device (Apple Sign-In doesn't work in simulator)
2. Tap "Continue with Apple"
3. Authenticate with Face ID/Touch ID
4. You should be signed in successfully!

## Troubleshooting

### "Apple Sign-In not available"
- Make sure you're testing on a **physical iOS device** (not simulator)
- Verify Apple Sign-In is enabled in Firebase Console
- Check that your bundle ID matches in Firebase Console

### "Invalid client" error
- Verify bundle ID in Firebase Console matches `com.darrylgraham.revolution`
- Make sure the iOS app is registered in Firebase Console

### Apple Sign-In button doesn't appear
- Check that `App.entitlements` has the Apple Sign-In capability
- Verify the app is signed with a valid provisioning profile that includes Apple Sign-In

## Summary

✅ **Google Sign-In:** Needs `GoogleService-Info.plist` (already done)  
✅ **Apple Sign-In:** Uses bundle ID directly (already configured)  
⚠️ **Action Required:** Enable Apple Sign-In in Firebase Console  

Once you enable it in Firebase Console, Apple Sign-In will work perfectly!

