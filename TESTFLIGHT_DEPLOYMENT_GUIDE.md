# 🚀 Complete TestFlight Deployment Guide (MacInCloud)

**Step-by-step guide** to pull code, set up, build, and deploy to TestFlight from MacInCloud.

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:
- ✅ MacInCloud access (macOS environment)
- ✅ Xcode installed and updated
- ✅ Apple Developer account (paid membership required for TestFlight)
- ✅ App Store Connect access
- ✅ SSH/Git access to your repository

---

## 🔄 Step 1: Pull Latest Code

### 1.1 Connect to MacInCloud and Open Terminal

1. Log in to your MacInCloud session
2. Open Terminal (Applications → Utilities → Terminal)
3. Navigate to your project directory (or clone if needed)

### 1.2 Pull Latest Changes

```bash
# If you already have the repo cloned
cd ~/path/to/soft-speak-flow

# Pull latest changes
git pull origin codex/list-database-read/write-operations

# Or if you're on a different branch and want to switch
git checkout codex/list-database-read/write-operations
git pull origin codex/list-database-read/write-operations
```

**Verify:**
```bash
git log --oneline -5
# Should show your latest commits including the iOS fixes
```

---

## 🔧 Step 2: Install Dependencies

### 2.1 Install Node.js Dependencies

```bash
# Make sure you're in the project root
cd ~/path/to/soft-speak-flow

# Install npm packages
npm install

# Verify environment variables
npm run validate:env
```

**Expected output:**
```
✅ All required environment variables are present and valid.
```

**If validation fails:**
- Check that `.env` file exists
- Verify all `VITE_FIREBASE_*` variables are set
- See `IOS_FIXES_APPLIED.md` for required variables

### 2.2 Install CocoaPods (if not installed)

```bash
# Check if CocoaPods is installed
pod --version

# If not installed, install it
sudo gem install cocoapods
```

### 2.3 Install iOS Pods

```bash
# Navigate to iOS App directory
cd ios/App

# Install CocoaPods dependencies
pod install

# This will create the Pods/ directory and Podfile.lock
# Wait for it to complete (may take 2-5 minutes)
```

**Verify:**
```bash
# Check that Pods directory exists
ls -la Pods/

# Check Podfile.lock exists
ls -la Podfile.lock
```

### 2.4 Sync Capacitor (Updates web assets)

```bash
# Go back to project root
cd ../..

# Sync web assets to iOS
npx cap sync ios
```

---

## 🏗️ Step 3: Build for iOS

### 3.1 Build Web Assets

```bash
# From project root
npm run build
```

**Expected:** Build completes successfully, creates `dist/` folder

### 3.2 Sync to iOS (if not done above)

```bash
npx cap sync ios
```

---

## 📱 Step 4: Open in Xcode

### 4.1 Open the Workspace

**⚠️ CRITICAL: Always open the `.xcworkspace` file, NOT `.xcodeproj`**

```bash
# From project root
open ios/App/App.xcworkspace
```

Or manually:
- Navigate to `ios/App/` folder in Finder
- Double-click `App.xcworkspace` (NOT `App.xcodeproj`)

### 4.2 Verify Xcode Setup

In Xcode, verify:

1. **Select the App target:**
   - In the left sidebar, click on "App" (blue icon)
   - Select the "App" target in the project navigator

2. **Check Signing & Capabilities:**
   - Go to "Signing & Capabilities" tab
   - ✅ Team: Your Apple Developer Team (e.g., "B6VW78ABTR")
   - ✅ Bundle Identifier: `com.darrylgraham.revolution`
   - ✅ Signing Certificate: Should be selected

3. **Check Deployment Info:**
   - iOS Deployment Target: `16.0` or higher
   - Devices: iPhone, iPad selected

4. **Verify Pods:**
   - In Project Navigator, you should see "Pods" project
   - If missing, pods weren't installed (re-run `pod install`)

---

## 🧪 Step 5: Test Build Locally (Optional but Recommended)

### 5.1 Build and Run on Simulator

1. **Select a simulator:**
   - At the top of Xcode, click the device selector
   - Choose an iOS Simulator (e.g., "iPhone 15 Pro")

2. **Run the app:**
   - Click the Play button (▶️) or press `⌘R`
   - Wait for build to complete

3. **Verify:**
   - App launches without crashing
   - Splash screen appears and disappears
   - Auth screen or app content loads
   - Check Xcode console for any errors

### 5.2 Test on Physical Device (Recommended)

1. **Connect iPhone via USB**
2. **Trust computer** on iPhone if prompted
3. **Select your device** in Xcode device selector
4. **Run** (`⌘R`)
5. **Trust developer** on iPhone: Settings → General → VPN & Device Management → Trust

---

## 📦 Step 6: Create Archive for TestFlight

### 6.1 Clean Build Folder

1. In Xcode menu: **Product → Clean Build Folder** (or `⇧⌘K`)
2. Wait for clean to complete

### 6.2 Select "Any iOS Device (arm64)"

1. In device selector at top of Xcode
2. Select **"Any iOS Device (arm64)"** (NOT a simulator)

### 6.3 Create Archive

1. **Product → Archive**
2. Wait for archive to build (2-5 minutes)
3. When complete, Xcode Organizer will open automatically

**If archive fails:**
- Check Xcode console for errors
- Verify signing & capabilities
- Ensure "Any iOS Device" is selected (not simulator)

---

## 🚀 Step 7: Upload to TestFlight

### 7.1 Distribute App

In Xcode Organizer (should open automatically after archive):

1. **Select your archive** (latest one)
2. Click **"Distribute App"** button
3. Select **"App Store Connect"**
4. Click **"Next"**

### 7.2 Distribution Options

1. **Select "Upload"** (not Export)
2. Click **"Next"**

### 7.3 Distribution Method

1. **Distribution options:**
   - ✅ Include bitcode (if available)
   - ✅ Upload your app's symbols (recommended)
   - ✅ Manage Version and Build Number (automatic)

2. Click **"Next"**

### 7.4 Signing

1. **Automatically manage signing** (recommended)
2. Click **"Next"**

### 7.5 Review and Upload

1. **Review the summary:**
   - App name: Cosmiq
   - Bundle ID: com.darrylgraham.revolution
   - Version: Check it's correct

2. Click **"Upload"**
3. Wait for upload to complete (5-15 minutes depending on app size)

---

## ⏳ Step 8: Wait for Processing

### 8.1 App Store Connect Processing

1. **Go to App Store Connect:**
   - https://appstoreconnect.apple.com
   - Navigate to: **My Apps → Cosmiq → TestFlight**

2. **Wait for processing:**
   - Status will show "Processing..."
   - Usually takes **15-30 minutes**
   - You'll receive an email when ready

### 8.2 Check Build Status

In App Store Connect:
- ✅ **Processing** = Build is being processed
- ✅ **Ready to Submit** = Build is ready for TestFlight
- ❌ **Invalid** = Build failed (check email for details)

---

## ✅ Step 9: TestFlight Testing

### 9.1 Add Testers

Once build is ready:

1. **Internal Testing:**
   - Go to TestFlight → Internal Testing
   - Add internal testers (up to 100)
   - They'll receive email invitations

2. **External Testing (Optional):**
   - Go to TestFlight → External Testing
   - Create a new group
   - Add external testers
   - Note: External testing requires App Review (can take 24-48 hours)

### 9.2 Monitor Crashes

1. **Check TestFlight crashes:**
   - App Store Connect → TestFlight → Your Build → Crashes
   - Look for crash reports
   - Check for `0xbadf00d` (watchdog timeout) - should be fixed ✅

2. **Check console logs:**
   - If you have device logs, check Xcode Organizer → Crashes
   - Look for the debugging logs we added

---

## 🔍 Step 10: Verify Everything Works

### 10.1 Test Flight Checklist

After installing from TestFlight:

- [ ] App launches successfully
- [ ] Splash screen appears and disappears
- [ ] Auth/login screen shows (if not logged in)
- [ ] Can log in/sign up
- [ ] App content loads
- [ ] No immediate crashes
- [ ] Network requests work
- [ ] Firebase initializes correctly

### 10.2 Common Issues to Check

**If app crashes on launch:**
- Check TestFlight crash logs
- Look for Firebase initialization errors
- Verify environment variables in build

**If app stuck on loading:**
- Check Xcode console logs (if testing locally)
- Look for `[useAuth]` logs
- Check for timeout messages

**If build fails to upload:**
- Verify signing certificate is valid
- Check App Store Connect for compliance issues
- Ensure bundle ID matches App Store Connect

---

## 📝 Quick Reference Commands

```bash
# Pull latest code
git pull origin codex/list-database-read/write-operations

# Install dependencies
npm install
npm run validate:env

# Install iOS pods
cd ios/App && pod install && cd ../..

# Build and sync
npm run build
npx cap sync ios

# Open in Xcode
open ios/App/App.xcworkspace
```

---

## 🎯 Complete Workflow (Copy-Paste)

```bash
# 1. Pull latest
git pull origin codex/list-database-read/write-operations

# 2. Install npm deps
npm install
npm run validate:env

# 3. Install iOS pods
cd ios/App
pod install
cd ../..

# 4. Build web assets
npm run build

# 5. Sync to iOS
npx cap sync ios

# 6. Open in Xcode (then manually archive and upload)
open ios/App/App.xcworkspace
```

---

## 📚 Additional Resources

- **iOS Fixes:** `IOS_FIXES_APPLIED.md`
- **Debugging:** `DEBUGGING_LOADING_ISSUE.md`
- **Pods Setup:** `IOS_PODS_SETUP.md`
- **Loading Fixes:** `IOS_LOADING_FIX.md`
- **Splash/Auth:** `SPLASH_AUTH_FIX.md`

---

## 🆘 Troubleshooting

### Issue: "No such module 'Capacitor'"

**Fix:**
```bash
cd ios/App
pod install
```

### Issue: Archive fails

**Fix:**
- Ensure "Any iOS Device (arm64)" is selected (not simulator)
- Clean build folder: Product → Clean Build Folder
- Verify signing & capabilities

### Issue: Upload fails

**Fix:**
- Check internet connection
- Verify Apple Developer account is active
- Check App Store Connect for account status

### Issue: Build rejected in App Store Connect

**Fix:**
- Check email for rejection reason
- Common issues: missing Info.plist keys, invalid bundle ID, etc.
- See our fixes: ATS configuration, network permissions (should be fixed ✅)

---

**Status:** Ready for deployment 🚀  
**Next:** Follow steps 1-9 to deploy to TestFlight

