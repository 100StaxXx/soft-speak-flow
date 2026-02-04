
# Fix iOS WKWebView Black Screen - Chunk Loading Order Issue

## Problem Summary

The iOS app crashes with **`TypeError: undefined is not an object (evaluating 'c.createContext')`** at Line 1. This is happening because:

1. The `manualChunks` configuration in `vite.config.ts` splits React into a separate `react-vendor` chunk
2. On iOS WKWebView, chunk loading order can differ from desktop browsers
3. When a component chunk loads before `react-vendor`, React (`c` in minified code) is undefined
4. Any `createContext` call fails because React isn't loaded yet

## Root Cause

The aggressive manual chunking strategy is incompatible with iOS WKWebView's script loading behavior. While this optimization works on desktop browsers, iOS may load chunks out of order or fail to properly sequence them.

## Solution

### Step 1: Simplify the Chunk Strategy

Modify `vite.config.ts` to use a safer chunking approach that keeps React as part of the main bundle, ensuring it's always loaded first:

```typescript
// In vite.config.ts, change the manualChunks configuration

manualChunks: (id) => {
  // Skip externalized modules
  if (id.includes('@capacitor-community/contacts')) {
    return undefined;
  }
  
  // CRITICAL: Do NOT split React into a separate chunk on iOS
  // This causes WKWebView loading order issues where React is undefined
  // when other chunks try to use createContext
  
  // Keep all vendor modules in a single chunk for iOS compatibility
  if (id.includes('node_modules')) {
    // Only split very large libraries that don't depend on React context
    if (id.includes('recharts')) return 'charts-vendor';
    if (id.includes('date-fns')) return 'date-vendor';
    if (id.includes('three') || id.includes('@react-three')) return 'three-vendor';
    
    // Everything else stays in the main vendor chunk
    return 'vendor';
  }
}
```

### Step 2: Remove `next-themes` from `package.json`

Even though it's not imported anywhere, having it in dependencies is unnecessary:

```json
// Remove this line from package.json dependencies
"next-themes": "^0.3.0",
```

### Step 3: Add Capacitor Build Optimizations

Add iOS-specific optimizations to ensure proper module loading:

```typescript
// In vite.config.ts, add to optimizeDeps
optimizeDeps: {
  include: [
    'react', 
    'react-dom', 
    'react-router-dom', 
    '@supabase/supabase-js',
    '@tanstack/react-query',
    'framer-motion'
  ],
  // Force pre-bundling of these critical dependencies
},
```

### Step 4: Full Rebuild Sequence

After the code changes, the user must run:

```bash
# Pull latest changes
git pull

# Clean all cached artifacts
rm -rf node_modules/.vite
rm -rf dist
rm -rf ios/App/App/public

# Reinstall dependencies (will remove next-themes)
npm install

# Build fresh
npm run build

# Sync to iOS
npm run ios:sync
```

Then in Xcode:
- **Product → Clean Build Folder** (Cmd+Shift+K)
- **Product → Run** (Cmd+R)

## Why This Works

1. **Single vendor chunk**: Keeps React and React-dependent libraries together, ensuring React is always available when contexts are created

2. **Safer splitting**: Only splits libraries that don't use React contexts (recharts for charts, date-fns for dates, three.js for 3D)

3. **Removed dead dependency**: Eliminates `next-themes` from the dependency tree entirely

4. **Pre-bundling critical deps**: Forces Vite to pre-bundle core dependencies, ensuring consistent loading order

## Technical Details

The original config had 12+ separate vendor chunks:
- `react-vendor` (React, ReactDOM, React Router)
- `supabase-vendor`
- `query-vendor`
- `animation-vendor`
- `icons-vendor`
- `radix-dialogs`
- `radix-overlays`
- `radix-ui`
- `forms-vendor`
- `charts-vendor`
- `date-vendor`
- `capacitor-vendor`

This created a complex dependency graph where chunks could load in unpredictable order. On iOS WKWebView, the browser's parallel script loading doesn't guarantee order, causing React to be undefined when other chunks try to access it.

The new config consolidates all React-dependent code into a single `vendor` chunk, with only standalone utilities split out:
- `vendor` (React, Radix, React Query, Framer Motion, etc.)
- `charts-vendor` (Recharts - standalone)
- `date-vendor` (date-fns - standalone)
- `three-vendor` (Three.js - standalone)

## Files to Modify

| File | Change |
|------|--------|
| `vite.config.ts` | Simplify manualChunks to keep React together |
| `package.json` | Remove `next-themes` dependency |

## Rollback Plan

If this doesn't work, the next step would be to completely disable `manualChunks` and let Vite handle chunking automatically:

```typescript
rollupOptions: {
  external: ['@capacitor-community/contacts'],
  // Remove manualChunks entirely
},
```

This would create larger initial bundles but guarantee correct loading order.
