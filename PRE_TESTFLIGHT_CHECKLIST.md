# Pre-TestFlight Deployment Checklist

## ✅ Already Done

- ✅ Google OAuth client ID updated in Info.plist
- ✅ GoogleService-Info.plist copied to project
- ✅ Firebase initialization added to AppDelegate
- ✅ All changes merged to main and pushed
- ✅ Environment variables updated

## ⚠️ Required Steps Before Building

### 1. Add GoogleService-Info.plist to Xcode

```bash
# Open Xcode
open ios/App/App.xcworkspace
```

**In Xcode:**
- Right-click **App** folder → **Add Files to "App"...**
- Select `ios/App/App/GoogleService-Info.plist`
- ✅ Check "Copy items if needed"
- ✅ Check "Add to targets: App"
- Click **Add**

**Verify:** File should appear in Project Navigator under App folder

### 2. Enable Apple Sign-In in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **cosmiq-prod**
3. Go to **Authentication** → **Sign-in method**
4. Click **Apple**
5. Toggle **Enable** to ON
6. Click **Save**

### 3. Regenerate Podfile.lock

```bash
cd ios/App
pod install
cd ../..
```

This ensures all CocoaPods dependencies are up to date.

### 4. Build Web Assets

```bash
npm run build
```

### 5. Sync to iOS

```bash
npx cap sync ios
```

This copies your web build to the iOS project.

## 🚀 Build and Archive in Xcode

### 1. Open Xcode

```bash
open ios/App/App.xcworkspace
```

### 2. Verify Configuration

- **Target:** Select "Any iOS Device (arm64)" (NOT simulator)
- **Team:** Verify your team is selected in Signing & Capabilities
- **Bundle ID:** Should be `com.darrylgraham.revolution`
- **Version:** Check your version number

### 3. Clean Build

- **Product** → **Clean Build Folder** (Shift+Cmd+K)

### 4. Build

- **Product** → **Build** (Cmd+B)

Fix any build errors before proceeding.

### 5. Archive

- **Product** → **Archive**

Wait for the archive to complete (may take a few minutes).

### 6. Distribute to TestFlight

1. In Organizer window, click **Distribute App**
2. Select **App Store Connect**
3. Click **Next**
4. Select **Upload**
5. Click **Next**
6. Follow the prompts to upload

## ✅ Verification Checklist

Before archiving, verify:

- [ ] GoogleService-Info.plist is in Xcode project (visible in Project Navigator)
- [ ] GoogleService-Info.plist is included in App target (check Target Membership)
- [ ] Apple Sign-In is enabled in Firebase Console
- [ ] Podfile.lock is regenerated (run `pod install`)
- [ ] Web assets are built (`npm run build`)
- [ ] iOS project is synced (`npx cap sync ios`)
- [ ] Team is selected in Xcode Signing & Capabilities
- [ ] Bundle ID is `com.darrylgraham.revolution`
- [ ] Target is "Any iOS Device (arm64)" (not simulator)
- [ ] App builds without errors

## 🧪 Testing After Upload

Once uploaded to TestFlight:

1. **Wait for processing** (15-30 minutes)
2. **Add testers** in App Store Connect
3. **Test Google Sign-In** - should work without "invalid-credential" error
4. **Test Apple Sign-In** - should work after enabling in Firebase
5. **Test email/password** - should work as before

## 📝 Quick Command Summary

```bash
# 1. Regenerate pods
cd ios/App
pod install
cd ../..

# 2. Build web assets
npm run build

# 3. Sync to iOS
npx cap sync ios

# 4. Open Xcode
open ios/App/App.xcworkspace
```

Then in Xcode: Clean → Build → Archive → Distribute

## 🐛 If You Get Errors

### Build Errors
- Check that GoogleService-Info.plist is in Xcode
- Verify pods are installed: `cd ios/App && pod install`
- Clean build folder and try again

### Signing Errors
- Verify team is selected in Signing & Capabilities
- Check bundle ID matches: `com.darrylgraham.revolution`

### OAuth Errors
- Verify GoogleService-Info.plist is in Xcode project
- Check Info.plist has correct Google OAuth URL scheme
- Verify Apple Sign-In is enabled in Firebase Console

