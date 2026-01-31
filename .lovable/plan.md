
# Fix Camera Module Resolution on iOS

## Problem

The error "Module name, '@capacitor/camera' does not resolve to a valid URL" occurs because:

1. `@capacitor/camera` is externalized from the Vite build (correctly, for web)
2. Your iOS app loads web content from the Lovable preview URL for hot-reload
3. When the dynamic import runs, the browser can't find the module since it's not bundled

This is a conflict between:
- **Development mode**: App loads from preview URL (needs camera bundled)
- **Production mode**: App loads from local `dist/` folder (camera provided by native)

## Solution

Instead of externalizing `@capacitor/camera`, we should **bundle it normally** but only execute it on native platforms (which the code already does with `Capacitor.isNativePlatform()` check).

The camera plugin actually has a web implementation that shows a file picker on web - so there's no need to externalize it.

## Changes

### File: `vite.config.ts`

| Change | Description |
|--------|-------------|
| Remove `@capacitor/camera` from external | Allow it to be bundled normally |
| Keep `@capacitor-community/contacts` external | This one truly has no web implementation |

**Before:**
```typescript
external: ['@capacitor/camera', '@capacitor-community/contacts'],
```

**After:**
```typescript
external: ['@capacitor-community/contacts'],
```

Also update the `manualChunks` skip list to only check for contacts.

## Why This Works

The `@capacitor/camera` package:
- Has a web fallback (file input picker)
- Can be safely bundled for both web and native
- The native implementation automatically takes over on iOS/Android

The `@capacitor-community/contacts` package:
- Has NO web implementation
- Must remain externalized to prevent build errors

## Files to Modify

| File | Changes |
|------|---------|
| `vite.config.ts` | Remove camera from external list, update manualChunks |

## Result

- Camera will work on iOS native app (loaded from preview URL during dev)
- Camera will work on web (using file picker fallback)
- No more "does not resolve to a valid URL" error
