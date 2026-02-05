

# Fix: iOS WKWebView "useLayoutEffect" Crash

## Problem Diagnosis

The error `TypeError: undefined is not an object (evaluating 'pt.useLayoutEffect')` appears on iOS when loading the app. The minified code `pt.useLayoutEffect` indicates that a library is trying to access `React.useLayoutEffect` but React itself is undefined at that moment.

## Root Cause

The issue is in `vite.config.ts` where `recharts` is split into a separate chunk:

```javascript
// Line 96 - vite.config.ts
if (id.includes('recharts')) return 'charts-vendor';
```

The `chart.tsx` component uses `React.useLayoutEffect` (line 115):
```javascript
React.useLayoutEffect(() => {
  if (!colorConfig.length || !styleRef.current) return;
  // ...
}, [colorConfig, safeId]);
```

On iOS WKWebView, JavaScript chunks can load out of order. When `charts-vendor.js` loads before the main `vendor.js` chunk (which contains React), the `React.useLayoutEffect` call fails because React is undefined.

## Solution

Remove `recharts` from the separate chunk split so it stays in the main `vendor` chunk alongside React:

```text
File: vite.config.ts
Location: Line 96

Before:
  if (id.includes('recharts')) return 'charts-vendor';

After:
  // REMOVED - recharts uses React.useLayoutEffect and must load with React
```

## Changes Required

### 1. Update vite.config.ts

Remove line 96 that separates recharts into its own chunk. The updated `manualChunks` function will only split:
- `date-fns` (pure utility, no React dependency)
- `three` / `@react-three` (optional 3D visualization)

All other libraries (React, Radix, React Query, Framer Motion, and now Recharts) will stay in the single `vendor` chunk for iOS compatibility.

---

## Technical Context

The vite.config.ts already has a comment explaining this pattern (lines 90-92):

```javascript
// CRITICAL: Keep React and all React-dependent libraries in a SINGLE chunk
// iOS WKWebView can load chunks out of order, causing "createContext" errors
// when React isn't loaded before components that use it
```

The `recharts` line was likely added later without recognizing that recharts also uses React hooks internally.

---

## Verification Steps

After the fix:

1. Run `npm run build` to verify the build succeeds
2. Run `npm run ios:testflight` to sync and test in Xcode
3. Deploy to TestFlight and verify no crash on iOS launch

## Expected Outcome

- The `charts-vendor.js` chunk will no longer be generated
- `recharts` will be bundled in the main `vendor.js` chunk alongside React
- iOS will load React before recharts initializes, preventing the undefined access

