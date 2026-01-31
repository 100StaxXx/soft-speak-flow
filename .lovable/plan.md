

# Fix Build Error: Externalize Capacitor Contacts Plugin

## Problem

The build fails because Rollup cannot resolve the `@capacitor-community/contacts` import:

```
Rollup failed to resolve import "@capacitor-community/contacts" from 
"/Users/user287824/soft-speak-flow/soft-speak-flow/src/hooks/usePhoneContacts.ts"
```

This happens because native Capacitor plugins are designed to run on mobile devices, not in web builds. The plugin doesn't have a web implementation that Rollup can bundle.

## Current Configuration

In `vite.config.ts`, line 72:

```typescript
rollupOptions: {
  external: ['@capacitor/camera'],  // Only camera is externalized
  // ...
}
```

## Solution

Add `@capacitor-community/contacts` to the external array so Rollup skips bundling it:

```typescript
rollupOptions: {
  external: ['@capacitor/camera', '@capacitor-community/contacts'],
  // ...
}
```

## Why This Works

- Native Capacitor plugins are injected at runtime on mobile devices
- In web builds, the `usePhoneContacts` hook already handles this gracefully by checking `Capacitor.isNativePlatform()` and returning early if not on native
- Externalizing tells Rollup "don't try to bundle this - it will be provided at runtime"

## File to Modify

| File | Change |
|------|--------|
| `vite.config.ts` | Add `@capacitor-community/contacts` to `build.rollupOptions.external` array |

## Technical Note

The `usePhoneContacts.ts` hook already has proper platform detection:

```typescript
const isNative = Capacitor.isNativePlatform();
// Returns 'denied' early if not on native platform
```

So the externalization is purely a build-time fix - the runtime behavior is already correct.

