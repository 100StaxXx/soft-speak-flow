# 🔧 iOS CocoaPods Setup Required

**Issue:** Xcode error about missing Pods configuration files  
**Solution:** Run `pod install` on macOS

---

## The Problem

The error occurs because:
1. The `Pods/` directory doesn't exist
2. CocoaPods dependencies haven't been installed
3. Xcode project references Pods files that don't exist yet

**Note:** This requires macOS - CocoaPods can only run on macOS/Xcode.

---

## Solution Steps (On macOS)

### Option 1: Using Capacitor Sync (Recommended)

From project root on macOS:
```bash
npm run ios:build
```

This will:
1. Build web assets
2. Sync to iOS
3. Run `pod install` automatically

### Option 2: Manual Pod Install

```bash
# Navigate to iOS App directory
cd ios/App

# Install CocoaPods if needed
sudo gem install cocoapods

# Install pods
pod install

# Go back to root
cd ../..
```

### Option 3: Clean Reinstall

```bash
# Remove existing Pods
cd ios/App
rm -rf Pods Podfile.lock

# Reinstall
pod install

# Sync with Capacitor
cd ../..
npx cap sync ios
```

---

## Important Notes

1. **Always open the workspace:**
   - ✅ Open `ios/App/App.xcworkspace`
   - ❌ DON'T open `ios/App/App.xcodeproj` directly

2. **Workspace includes Pods:**
   - The `.xcworkspace` file includes both your app and Pods
   - Opening `.xcodeproj` directly won't include Pods dependencies

3. **First time setup:**
   ```bash
   # Install CocoaPods (if not installed)
   sudo gem install cocoapods
   
   # Install pods
   cd ios/App && pod install
   ```

---

## After Pod Install

Once `pod install` completes:

1. **Close Xcode** if it's open
2. **Open the workspace:**
   ```bash
   open ios/App/App.xcworkspace
   ```
   Or double-click `App.xcworkspace` in Finder

3. **Verify:**
   - Xcode should open without errors
   - Pods project should appear in the Project Navigator
   - No missing file errors

---

## If You're on Windows/Linux

You **cannot** run `pod install` on Windows/Linux. You need:

1. **Access to a Mac:**
   - Physical Mac
   - Mac VM (if allowed by license)
   - Remote Mac (if available)

2. **Or use CI/CD:**
   - GitHub Actions with macOS runner
   - Bitrise, CircleCI, etc.
   - Run `pod install` as part of build process

---

## Verify Pods Are Installed

After `pod install`, you should see:
```
ios/App/
  ├── Pods/                    # ✅ Should exist
  ├── Podfile.lock             # ✅ Should exist
  ├── App.xcworkspace/         # ✅ Should exist
  └── Podfile                  # ✅ Should exist
```

---

**Status:** Requires macOS to run `pod install`  
**Action:** Run `pod install` on macOS, then open `App.xcworkspace` in Xcode
