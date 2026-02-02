
# Fix Build Error: @capacitor/camera Version Mismatch

## Problem

The build fails with:
```
Rollup failed to resolve import "@capacitor/camera" from "src/hooks/useQuestImagePicker.ts"
```

This is caused by a **version mismatch** between Capacitor packages:
- `@capacitor/camera@8.0.0` requires Capacitor 8.x core
- `@capacitor/core@7.4.4` is Capacitor 7.x

The camera plugin isn't compatible with the installed core version, causing Rollup to fail when trying to resolve the dynamic import.

## Solution

Downgrade `@capacitor/camera` to a version compatible with Capacitor 7.x.

## Changes Required

### 1. Update package.json

Change the camera version from `^8.0.0` to `^7.0.0`:

```json
"@capacitor/camera": "^7.0.0",
```

### 2. After Syncing Changes

On your local machine, run these commands:

```bash
# Remove node_modules and reinstall to get correct versions
rm -rf node_modules package-lock.json
npm install

# Rebuild the project
npm run build

# Sync to iOS
npx cap sync ios
```

## Technical Details

| Package | Current | Fix |
|---------|---------|-----|
| `@capacitor/camera` | 8.0.0 | 7.0.0 |
| `@capacitor/core` | 7.4.4 | No change |
| `@capacitor/cli` | 8.0.2 | Should also be 7.x for consistency |

The CLI version (8.0.2) should also ideally match the core version, but this is less critical for the immediate build fix.

## Alternative Approach (If Upgrade Preferred)

If you'd rather upgrade everything to Capacitor 8.x, all `@capacitor/*` packages would need to be updated together. This is a larger change that may require additional testing.

## Result

After this fix, `npm run build` will complete successfully and the camera functionality will work on native iOS/Android.
