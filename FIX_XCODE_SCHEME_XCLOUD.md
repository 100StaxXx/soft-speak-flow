# Fix Xcode Scheme Issue on xcloud

## Problem
Error: "A scheme called App does not exist in App.xcworkspace"

## Solution Steps (Run on xcloud Mac)

### 1. Pull Latest Changes
```bash
cd /path/to/soft-speak-flow
git pull origin codex/list-database-read/write-operations
```

### 2. Verify Scheme File Exists
```bash
ls -la ios/App/App.xcworkspace/xcshareddata/xcschemes/
# Should show: App.xcscheme
```

### 3. Close Xcode Completely
```bash
# Kill any running Xcode processes
killall Xcode 2>/dev/null || true
```

### 4. Clean Xcode Derived Data (Optional but Recommended)
```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/*
```

### 5. Reinstall Pods (Important!)
```bash
cd ios/App
pod install
cd ../..
```

### 6. Re-sync Capacitor
```bash
npx cap sync ios
```

### 7. Open Workspace (NOT project)
```bash
open ios/App/App.xcworkspace
```

### 8. Verify Scheme in Xcode
1. In Xcode, look at the scheme dropdown (top toolbar, next to device selector)
2. Click on it - you should see "App" listed
3. If not visible:
   - Go to **Product → Scheme → Manage Schemes...**
   - Find "App" in the list
   - Check the checkbox next to it
   - Make sure "Shared" is checked (this is critical!)
   - Click "Close"

### 9. If Scheme Still Not Visible - Create It Manually
If the scheme still doesn't appear:

1. In Xcode, go to **Product → Scheme → New Scheme...**
2. Select "App" target
3. Name it "App"
4. **IMPORTANT**: Check "Shared" checkbox
5. Click "OK"
6. Close Xcode and reopen the workspace

### 10. Alternative: Use xcodebuild to Verify
```bash
cd ios/App
xcodebuild -list -workspace App.xcworkspace
```

This should show "App" in the Schemes section.

## If Still Not Working

### Check File Permissions
```bash
chmod 644 ios/App/App.xcworkspace/xcshareddata/xcschemes/App.xcscheme
```

### Verify Scheme File Content
```bash
cat ios/App/App.xcworkspace/xcshareddata/xcschemes/App.xcscheme
```

Should show XML with `<Scheme>` tag and references to "App" target.

### Force Xcode to Re-index
1. Close Xcode
2. Delete workspace user data:
   ```bash
   rm -rf ios/App/App.xcworkspace/xcuserdata
   ```
3. Reopen workspace

## Quick Test Command
After pulling and setting up, test if scheme is recognized:
```bash
cd ios/App
xcodebuild -scheme App -workspace App.xcworkspace -configuration Debug -sdk iphoneos -showBuildSettings | head -5
```

If this works, the scheme is properly configured.

## Notes
- Always open `.xcworkspace`, never `.xcodeproj` when using CocoaPods
- The scheme must be in `xcshareddata/xcschemes/` to be shared/committed
- User-specific schemes are in `xcuserdata/` and are NOT committed
