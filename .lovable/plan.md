
# Fix iOS Black Screen Issue - Debugging Plan

## Problem Summary

The iOS app displays a black screen despite successful build and asset sync. The web assets ARE present in `ios/App/App/public/`, but the JavaScript application fails to render.

## Root Cause

A JavaScript runtime error is occurring that prevents React from mounting. Since production builds strip all `console.*` statements (via `esbuild.drop` in vite.config.ts), the error is invisible in Xcode's console.

## Solution: Two-Phase Approach

### Phase 1: Enable Production Debugging

Temporarily modify `vite.config.ts` to keep console statements in production so we can see what's failing:

**File:** `vite.config.ts`

Change line 166:
```javascript
// Before
drop: mode === 'production' ? ['console', 'debugger'] : [],

// After (temporary for debugging)
drop: [],  // Keep console statements to debug iOS black screen
```

### Phase 2: Add Visible Debug Indicators

Add a visible debug element to `index.html` that confirms the WebView is loading correctly, and add error handling to catch and display JavaScript errors:

**File:** `index.html`

Add inside `<body>` before the root div:
```html
<!-- Debug indicator - shows if WebView loads but JS fails -->
<div id="debug-indicator" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);color:white;font-size:24px;z-index:9999;">
  Loading Cosmiq...
</div>
<script>
  // Log all errors to the DOM for debugging
  window.onerror = function(msg, url, line, col, error) {
    document.getElementById('debug-indicator').innerHTML = 
      '<div style="background:red;padding:20px;border-radius:10px;">' +
      '<strong>JS Error:</strong><br>' + msg + '<br>Line: ' + line +
      '</div>';
    return false;
  };
</script>
```

**File:** `src/main.tsx`

Add at the top of the render to hide the debug indicator once React mounts:
```javascript
// Hide debug indicator once React takes over
document.getElementById('debug-indicator')?.remove();
```

### Phase 3: Rebuild and Test

After making these changes:

1. Pull the latest code: `git pull`
2. Clean and rebuild: `rm -rf dist && npm run build`
3. Sync to iOS: `npm run ios:sync`
4. In Xcode: Clean (Cmd+Shift+K), then Build & Run (Cmd+R)

The debug indicator will now show:
- "Loading Cosmiq..." if WebView loads but JS hasn't executed
- A red error box if JavaScript throws an error
- Nothing (disappears) if React mounts successfully

### Phase 4: Identify the Specific Error

Check the Xcode console for any errors. Common culprits:
- Capacitor plugin not properly initialized
- Missing environment variable at runtime
- Service worker registration failure on iOS
- Orientation lock timing issue

### Phase 5: Cleanup After Fix

Once the issue is identified and fixed:
1. Remove the debug indicator from `index.html`
2. Restore console dropping in `vite.config.ts`:
   ```javascript
   drop: mode === 'production' ? ['console', 'debugger'] : [],
   ```

---

## Technical Notes

### Why This Happens

1. **Console stripping**: Production builds remove all `console.*` calls for performance, but this hides errors
2. **ErrorBoundary limitations**: React's ErrorBoundary only catches errors during render, not during:
   - Module initialization
   - Async operations in useEffect
   - Native plugin calls

### Likely Suspects

Based on code analysis, these are the most likely failure points:

| Location | Issue |
|----------|-------|
| `src/App.tsx:340` | `lockToPortrait()` called in useEffect - may fail if plugin not ready |
| `src/main.tsx:36` | Service worker registration may fail on iOS WKWebView |
| `src/integrations/supabase/client.ts:10` | Throws if env vars missing at runtime |

### Alternative Quick Fix

If you want to skip debugging and try a quick fix, disable the orientation lock temporarily:

**File:** `src/App.tsx` (lines 338-341)

```javascript
// Comment out orientation lock temporarily
// useEffect(() => {
//   lockToPortrait();
// }, []);
```

This removes one potential failure point without affecting functionality.
