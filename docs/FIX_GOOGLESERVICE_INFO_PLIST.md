# Fix: Add GoogleService-Info.plist to Xcode Project

## Problem
The `GoogleService-Info.plist` file exists in the filesystem but is **not added to the Xcode project**, so it's not included in the app bundle. This causes Google Sign-In to use the wrong (old) client ID.

## Solution: Add File to Xcode Project

### Option 1: Via Xcode UI (Recommended)

1. **Open Xcode workspace:**
   ```bash
   open ios/App/App.xcworkspace
   ```

2. **In Xcode:**
   - In the Project Navigator (left sidebar), right-click on the **App** folder
   - Select **"Add Files to 'App'..."**
   - Navigate to and select: `ios/App/App/GoogleService-Info.plist`
   - **IMPORTANT:** Make sure these options are checked:
     - ✅ **"Copy items if needed"** (UNCHECK - file already exists in the right place)
     - ✅ **"Add to targets: App"** (CHECK - this is critical!)
   - Click **Add**

3. **Verify it's added:**
   - You should see `GoogleService-Info.plist` in the Project Navigator under the App folder
   - Select it and check the File Inspector (right sidebar) - it should show it's included in the App target

### Option 2: Quick Terminal Check (Verify File Location)

```bash
# Verify file exists
ls -la ios/App/App/GoogleService-Info.plist

# Check if it's referenced in project (should return nothing if not added)
grep -i "GoogleService-Info" ios/App/App.xcodeproj/project.pbxproj
```

If the grep returns nothing, the file is not in the Xcode project.

## After Adding the File

1. **Clean Build Folder:**
   - In Xcode: **Product** → **Clean Build Folder** (Shift+Cmd+K)

2. **Delete the app from your device/simulator:**
   - Long press the app icon → Delete (this removes cached configuration)

3. **Rebuild and Run:**
   - Build and install the app again

4. **Test Google Sign-In:**
   - The error should be gone and Google Sign-In should work

## Verification

The correct client ID should be:
- **CLIENT_ID:** `636156363416-jnfhktg28pviioilk907defbrms2qh3s.apps.googleusercontent.com`
- **URL Scheme in Info.plist:** `com.googleusercontent.apps.636156363416-jnfhktg28pviioilk907defbrms2qh3s`

If you still see the old client ID (`371878262982-...`), the file wasn't added correctly or the app needs to be completely rebuilt.

