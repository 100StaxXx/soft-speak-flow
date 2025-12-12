# Fix Google OAuth iOS Error

## Problem

You're seeing this error when trying to sign in with Google on iOS:

```
Firebase: Invalid Idp Response: the Google id_token is not authorized to be used with this application. 
Its audience (OAuth 2.0 371878262982-msdt2oq5r1858ft64d33onhrg5167ofu.apps.googleusercontent.com) 
which is not authorized to be used in the project with project_number: 636156363416. 
(auth/invalid-credential)
```

This happens because the Google OAuth client ID configured in your iOS app doesn't match the one authorized in your Firebase project.

## Root Cause

The `Info.plist` file has a hardcoded Google OAuth client ID that doesn't match your Firebase project's iOS OAuth client configuration.

## Solution

### Step 0: Create iOS App in Firebase (If You Don't Have One)

**⚠️ If you only have a web app, you MUST create an iOS app first!**

If you don't see an iOS app in Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **cosmiq-prod** (or your project name)
3. Click the gear icon ⚙️ → **Project Settings**
4. Scroll down to **Your apps** section
5. Click **Add app** → Select **iOS** (🍎 icon)
6. Enter Bundle ID: `com.darrylgraham.revolution`
7. Click **Register app**
8. **Download GoogleService-Info.plist**

**See `docs/ADD_IOS_APP_TO_FIREBASE.md` for detailed step-by-step instructions.**

### Step 1: Get the Correct iOS OAuth Client ID from Firebase

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **cosmiq-prod** (or your project name)
3. Click the gear icon ⚙️ → **Project Settings**
4. Go to the **General** tab
5. Scroll down to **Your apps** section
6. Find your **iOS app** (you should have created it in Step 0)
   - Bundle ID should be: `com.darrylgraham.revolution`
7. Click **Download GoogleService-Info.plist** (if you haven't already)
8. Open the downloaded `GoogleService-Info.plist` file
9. Find the `CLIENT_ID` value - this is your iOS OAuth client ID
   - It should look like: `636156363416-xxxxxxxxxxxxx.apps.googleusercontent.com`

### Step 2: Update Info.plist

1. Open `ios/App/App/Info.plist`
2. Find the `CFBundleURLSchemes` array under `google-signin`
3. Update the URL scheme to match your Firebase iOS OAuth client ID:
   - Current: `com.googleusercontent.apps.371878262982-msdt2oq5rl858ft64d33onhrg5l67ofu`
   - New: `com.googleusercontent.apps.636156363416-xxxxxxxxxxxxx` (use the client ID from Step 1, but remove `.apps.googleusercontent.com`)

**Example:**
```xml
<key>CFBundleURLSchemes</key>
<array>
    <string>com.googleusercontent.apps.636156363416-xxxxxxxxxxxxx</string>
</array>
```

### Step 3: Add GoogleService-Info.plist to Xcode

1. Open Xcode: `open ios/App/App.xcworkspace`
2. In Xcode, right-click on the `App` folder in the Project Navigator
3. Select **Add Files to "App"...**
4. Navigate to and select the `GoogleService-Info.plist` file you downloaded
5. Make sure:
   - ✅ **Copy items if needed** is checked
   - ✅ **Add to targets: App** is checked
6. Click **Add**

### Step 4: Update Environment Variable

1. Open your `.env.local` file (or `.env` file)
2. Find or add `VITE_GOOGLE_IOS_CLIENT_ID`
3. Set it to the full iOS OAuth client ID from `GoogleService-Info.plist`:
   ```env
   VITE_GOOGLE_IOS_CLIENT_ID=636156363416-xxxxxxxxxxxxx.apps.googleusercontent.com
   ```

### Step 5: Verify Firebase Console Configuration

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Click on **Google**
3. Make sure **Google** is enabled
4. Under **Authorized domains**, verify your domains are listed
5. Under **OAuth 2.0 Client IDs**, verify you have:
   - ✅ **Web client** (for web sign-in)
   - ✅ **iOS client** with bundle ID: `com.darrylgraham.revolution`

### Step 6: Verify Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your Firebase project
3. Go to **APIs & Services** → **Credentials**
4. Find your **OAuth 2.0 Client IDs**
5. Verify you have an **iOS client** with:
   - Bundle ID: `com.darrylgraham.revolution`
   - Client ID matches what's in `GoogleService-Info.plist`

### Step 7: Rebuild and Test

1. Clean the build:
   ```bash
   cd ios/App
   pod install
   cd ../..
   ```

2. Rebuild the app in Xcode:
   - Product → Clean Build Folder (Shift+Cmd+K)
   - Product → Build (Cmd+B)

3. Test Google Sign-In on a physical iOS device or TestFlight

## Verification Checklist

- [ ] `GoogleService-Info.plist` is added to Xcode project
- [ ] `Info.plist` has the correct Google OAuth URL scheme
- [ ] `VITE_GOOGLE_IOS_CLIENT_ID` environment variable is set correctly
- [ ] Firebase Console shows iOS app with bundle ID `com.darrylgraham.revolution`
- [ ] Google Cloud Console has iOS OAuth client with matching bundle ID
- [ ] App rebuilds successfully
- [ ] Google Sign-In works without errors

## Common Issues

### Issue: "GoogleService-Info.plist not found"
**Solution:** Make sure the file is added to the Xcode project and included in the App target.

### Issue: "Still getting invalid-credential error"
**Solution:** 
- Double-check that the OAuth client ID in `Info.plist` matches the one in `GoogleService-Info.plist`
- Verify the bundle ID in Firebase Console matches `com.darrylgraham.revolution`
- Make sure you're using the iOS OAuth client ID, not the web client ID

### Issue: "Environment variable not loading"
**Solution:**
- Make sure `.env.local` is in the project root
- Restart your dev server after changing environment variables
- For production builds, ensure environment variables are set in your build system

## Additional Notes

- The iOS OAuth client ID is different from the web OAuth client ID
- The URL scheme in `Info.plist` should be the client ID without `.apps.googleusercontent.com`
- Always use the client ID from `GoogleService-Info.plist` downloaded from Firebase Console
- Never commit `GoogleService-Info.plist` to version control if it contains sensitive data (though client IDs are public)

