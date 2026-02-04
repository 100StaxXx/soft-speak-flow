
# Fix iOS Black Screen - React Context Initialization Error

## Root Cause Identified

The error **`TypeError: undefined is not an object (evaluating 'c.createContext')`** is caused by the `next-themes` package in `src/components/ui/sonner.tsx`.

The `next-themes` library is designed specifically for Next.js and uses context patterns that fail on iOS WKWebView when bundled with Vite. In the minified production build, React (`c`) is `undefined` when `next-themes` tries to call `createContext`.

## The Problem

```
src/components/ui/sonner.tsx
└── imports { useTheme } from "next-themes"  ← FAILS ON iOS
    └── next-themes tries to createContext before React is ready
        └── TypeError: c.createContext is undefined
```

## Solution

Replace the `next-themes` dependency with a simple hardcoded dark theme, since Cosmiq appears to always use dark mode. The Sonner toast component just needs a theme string - it doesn't need the full `next-themes` provider.

### Changes Required

**File: `src/components/ui/sonner.tsx`**

Remove the `next-themes` import and hardcode the theme to "dark":

```typescript
// Before (broken)
import { useTheme } from "next-themes";
const { theme = "system" } = useTheme();

// After (fixed)
// Remove next-themes import entirely
const theme = "dark"; // Cosmiq uses dark theme
```

## Why This Works

1. Cosmiq is a dark-themed app - it doesn't need theme switching
2. Removes a problematic dependency that's incompatible with Vite + Capacitor
3. Eliminates the context initialization race condition on iOS WKWebView
4. The Sonner toast component only uses the theme string for styling - no provider needed

## After Implementation

1. Pull the changes: `git pull`
2. Clean rebuild: `rm -rf dist && npm run build`
3. Sync to iOS: `npm run ios:sync`
4. In Xcode: Clean (Cmd+Shift+K), then Build & Run (Cmd+R)

The app should now display the Welcome screen instead of the black screen with JS error.

## Technical Notes

- The `next-themes` package creates a React context at module load time
- On iOS WKWebView, the module initialization order can differ from standard browsers
- When `next-themes` loads before React is fully initialized, `createContext` fails
- This is a known issue with Next.js-specific packages in Vite/Capacitor apps

## Cleanup After Fix

Once the app works, you can also:
1. Restore the console dropping in `vite.config.ts`
2. Remove the debug indicator from `index.html` (optional - it auto-hides)
