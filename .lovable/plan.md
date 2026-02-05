

# Fix: iOS WKWebView Chunk Loading Race Condition

## Problem Summary

The app crashes on iOS with `TypeError: undefined is not an object (evaluating 'pt.useLayoutEffect')` at Line 3694. This occurs because JavaScript chunks load out of order in WKWebView, causing React-dependent code to execute before React is fully initialized.

## Root Causes Identified

### 1. `@react-three/fiber` Still in Separate Chunk
```javascript
// vite.config.ts line 98
if (id.includes('three') || id.includes('@react-three')) return 'three-vendor';
```
The `@react-three/fiber` library uses React hooks (`useFrame`, `useThree`, `useLayoutEffect`). Splitting it into a separate chunk causes the same race condition we just fixed for recharts.

### 2. Main App is Lazy-Loaded
```javascript
// main.tsx line 41
const App = lazy(() => import("./App.tsx"));
```
This creates an additional chunk boundary. When this chunk loads on iOS, libraries within it may try to access React before it's ready.

---

## Solution

### Change 1: Remove `@react-three/fiber` from Chunk Split

Update `vite.config.ts` to only split `three` (the pure 3D library) but NOT `@react-three` (which uses React):

```typescript
// Before (line 98):
if (id.includes('three') || id.includes('@react-three')) return 'three-vendor';

// After:
// Only split pure three.js - NOT @react-three/fiber which uses React hooks
if (id.includes('node_modules/three/')) return 'three-vendor';
```

### Change 2: Remove Lazy Loading of Main App

Update `main.tsx` to import App directly instead of lazy loading:

```typescript
// Before:
const App = lazy(() => import("./App.tsx"));

// After:
import App from "./App";
```

This ensures the App and all its React dependencies load synchronously with the main bundle, preventing race conditions.

---

## Files to Modify

| File | Change |
|------|--------|
| `vite.config.ts` | Remove `@react-three` from separate chunk split |
| `src/main.tsx` | Replace `lazy(() => import("./App.tsx"))` with direct import |

---

## Technical Details

### Why This Fixes the Issue

1. **Single Vendor Chunk**: By keeping `@react-three/fiber` in the main vendor chunk alongside React, we guarantee React is initialized before any React Three components execute.

2. **Synchronous App Loading**: Removing the lazy load of App.tsx eliminates a critical chunk boundary. The App and all its providers now load in the same execution context as React.

3. **Route-Level Code Splitting Preserved**: Individual pages (Home, Auth, Onboarding, etc.) inside App.tsx are still lazy-loaded, maintaining good bundle splitting for actual navigation.

### Build Impact

- **Bundle Size**: Slightly larger initial load (~50-100KB more)
- **Load Time**: Minimal impact since iOS loads from local disk
- **Stability**: Eliminates the WKWebView chunk race condition

---

## Verification Steps

After implementation:

1. Run `npm run build` - verify build succeeds
2. Run `npm run ios:testflight` - sync to Xcode
3. Increment build number (40 → 41)
4. Run on iOS Simulator or device
5. Verify app loads without crash
6. Test navigation to various routes

---

## Alternative Considered (Not Recommended)

We could disable ALL chunk splitting with `manualChunks: {}`, but this would:
- Create a massive single bundle (2-3MB+)
- Lose benefits of route-level code splitting
- Not address the root cause

The targeted fix above is more surgical and preserves performance benefits.

