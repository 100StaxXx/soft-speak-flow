# 🔧 Fix: Xcode Pods Configuration Error

**Error:** `Unable to open base configuration reference file '/Volumes/workspace/repository/ios/App/Pods/...'`

**Cause:** CocoaPods dependencies not installed or stale Xcode project references

---

## Solution

You need to run `pod install` **on macOS** (since CocoaPods requires macOS/Xcode).

### On macOS (Local Development):

1. **Navigate to iOS directory:**
   ```bash
   cd ios/App
   ```

2. **Install CocoaPods (if not installed):**
   ```bash
   sudo gem install cocoapods
   ```

3. **Install pods:**
   ```bash
   pod install
   ```

4. **Open the workspace (NOT .xcodeproj):**
   ```bash
   open App.xcworkspace
   ```
   ⚠️ **Important:** Always open `App.xcworkspace`, never `App.xcodeproj`

### Alternative: Use Capacitor Sync

If you're on macOS, Capacitor sync should handle this:

```bash
npm run ios:build
# or
npx cap sync ios
```

But since you're on Windows, you'll need to either:

1. **Run on macOS machine** (Mac, MacBook, or Mac VM)
2. **Use CI/CD** (GitHub Actions, etc.)
3. **Remote macOS access** (if available)

---

## Why This Happens

The error path `/Volumes/workspace/repository/` suggests:
- This might be from a CI/CD environment
- Or a stale reference in the Xcode project file
- Or the project was moved/copied from another location

---

## Quick Fix (If on macOS)

```bash
# From project root
cd ios/App
rm -rf Pods Podfile.lock
pod install
cd ../..
npx cap sync ios
```

Then open `ios/App/App.xcworkspace` in Xcode (not the .xcodeproj file).

---

## Verify Fix

After running `pod install`, you should see:
- `Pods/` directory created
- `Podfile.lock` file created
- Xcode can open `App.xcworkspace` without errors

---

**Status:** Requires macOS/Xcode environment  
**Next Step:** Run `pod install` on macOS, then open `App.xcworkspace` in Xcode
