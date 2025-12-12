# Google OAuth iOS Error - Quick Fix Summary

## 🔴 Problem

Your iOS app is using a Google OAuth client ID from a **different Firebase project**:
- **Current (wrong):** `371878262982-msdt2oq5rl858ft64d33onhrg5l67ofu` (from project 371878262982)
- **Expected:** Should start with `636156363416-` (your Firebase project number)

## ✅ Solution Steps

**⚠️ IMPORTANT: You need to create an iOS app in Firebase Console first!**

1. **Create iOS App in Firebase Console** (if you don't have one)
   - Firebase Console → Project Settings → Your apps → **Add app** → **iOS**
   - Bundle ID: `com.darrylgraham.revolution`
   - Download `GoogleService-Info.plist`
   - See **`docs/ADD_IOS_APP_TO_FIREBASE.md`** for detailed instructions

2. **Download `GoogleService-Info.plist` from Firebase Console**
   - Firebase Console → Project Settings → Your apps → iOS app
   - Download the file

2. **Update `ios/App/App/Info.plist`**
   - Change line 30 from:
     ```xml
     <string>com.googleusercontent.apps.371878262982-msdt2oq5rl858ft64d33onhrg5l67ofu</string>
     ```
   - To (using the CLIENT_ID from GoogleService-Info.plist):
     ```xml
     <string>com.googleusercontent.apps.636156363416-xxxxxxxxxxxxx</string>
     ```
   - Replace `xxxxxxxxxxxxx` with the actual client ID suffix from `GoogleService-Info.plist`

3. **Add `GoogleService-Info.plist` to Xcode**
   - Open `ios/App/App.xcworkspace` in Xcode
   - Drag `GoogleService-Info.plist` into the App folder
   - Make sure "Copy items if needed" and "Add to targets: App" are checked

4. **Update `.env.local`**
   - Set `VITE_GOOGLE_IOS_CLIENT_ID` to the full client ID from `GoogleService-Info.plist`
   - Format: `636156363416-xxxxxxxxxxxxx.apps.googleusercontent.com`

5. **Rebuild the app**
   ```bash
   cd ios/App
   pod install
   cd ../..
   ```
   Then rebuild in Xcode.

## 📖 Detailed Instructions

See **`docs/FIX_GOOGLE_OAUTH_IOS_ERROR.md`** for step-by-step instructions with screenshots and troubleshooting.

## 🔍 How to Find the Correct Client ID

1. Open `GoogleService-Info.plist` (downloaded from Firebase)
2. Look for the `CLIENT_ID` key
3. The value should be: `636156363416-xxxxxxxxxxxxx.apps.googleusercontent.com`
4. For `Info.plist`, use: `com.googleusercontent.apps.636156363416-xxxxxxxxxxxxx`
5. For `.env.local`, use the full value: `636156363416-xxxxxxxxxxxxx.apps.googleusercontent.com`

## ⚠️ Important Notes

- The iOS OAuth client ID is **different** from the web OAuth client ID
- The URL scheme in `Info.plist` should **not** include `.apps.googleusercontent.com`
- Always use the client ID from the `GoogleService-Info.plist` downloaded from Firebase Console
- Make sure the bundle ID in Firebase Console matches: `com.darrylgraham.revolution`

