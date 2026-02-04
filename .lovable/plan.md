

# Fix iOS WKWebView Crash - Debug Systematic Isolation

## Problem Summary

The iOS app shows **"web process 0 crash"** - a complete WKWebView process failure. This is more severe than a JavaScript error; it means the entire rendering process crashed before React could mount.

## Root Cause Analysis

The `next-themes` fix was applied, but the **build may not have been synced** to iOS, OR there are additional crash points. The main suspects are:

| Suspect | Risk Level | Reason |
|---------|------------|--------|
| **Sentry `replayIntegration()`** | HIGH | Uses Session Replay APIs that can crash iOS WebView |
| **Service Worker registration** | HIGH | iOS WKWebView has limited/broken service worker support |
| **Lazy loading App.tsx** | MEDIUM | Dynamic imports can fail on iOS if paths aren't resolved correctly |

## Proposed Solution

Implement a **systematic isolation approach** - disable potential crash points one by one until the app loads:

### Step 1: Disable Sentry Replay Integration (Most Likely Culprit)

Modify `src/main.tsx` to remove the Replay integration which uses browser APIs incompatible with iOS WKWebView:

```typescript
// Before (lines 14-17)
integrations: [
  Sentry.browserTracingIntegration(),
  Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
],

// After - Remove replay integration
integrations: [
  Sentry.browserTracingIntegration(),
  // replayIntegration removed - causes WKWebView crashes on iOS
],
```

Also remove the replay sample rates:
```typescript
// Before (lines 19-20)
replaysSessionSampleRate: 0.1,
replaysOnErrorSampleRate: 1.0,

// After - Remove these lines entirely
```

### Step 2: Disable Service Worker on Capacitor Native

Modify `src/main.tsx` to skip service worker registration when running inside Capacitor:

```typescript
// Before (lines 33-39)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}

// After - Only register on web, not native
if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
  });
}
```

### Step 3: Ensure Build is Properly Synced

After making changes, user must run:

```bash
git pull
rm -rf dist ios/App/App/public
npm run build
npm run ios:sync
```

Then in Xcode:
- **Product → Clean Build Folder** (Cmd+Shift+K)
- **Product → Run** (Cmd+R)

### Step 4: Verify with Debug Indicator

The debug indicator added earlier should now show:
- "Loading Cosmiq..." if WebView loads but JS stalls
- Red error box if JavaScript throws
- Nothing (it disappears) if React mounts successfully

## Why These Changes Work

1. **Sentry Replay Integration** uses browser-specific APIs for session recording that don't exist in iOS WKWebView. The `browserTracingIntegration()` alone is safe.

2. **Service Workers** in Capacitor iOS are problematic because WKWebView's service worker support is limited. The registration attempt can crash the process.

3. **Capacitor detection** via `window.Capacitor?.isNativePlatform?.()` safely checks if we're in a native app context.

## Files to Modify

| File | Change |
|------|--------|
| `src/main.tsx` | Remove Sentry replay integration, skip service worker on native |

## Cleanup After Fix Works

Once the app loads successfully:
1. Restore console dropping in `vite.config.ts` (change `drop: []` back to `drop: mode === 'production' ? ['console', 'debugger'] : []`)
2. Remove the debug indicator from `index.html` (optional - it auto-hides anyway)

