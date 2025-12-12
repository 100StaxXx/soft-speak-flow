# 🔧 Splash Screen & Auth Route Fix

**Issue:** App stuck on loading spinner, splash screen not hiding on /auth route  
**Fixes Applied:** 

---

## Changes Made

### 1. Hide Splash Screen on Auth Route

**File:** `src/App.tsx`

**Problem:** Splash screen only hid after `authLoading` became false. If auth check hangs, splash stays visible even on /auth route.

**Fix:** Added check to hide splash screen immediately when navigating to `/auth` route, regardless of auth loading state:

```typescript
// Hide immediately if on auth route (no need to wait for auth check)
const isAuthRoute = location.pathname === '/auth' || location.pathname.startsWith('/auth/');
if (isAuthRoute && !splashHidden) {
  const timer = setTimeout(() => {
    hideSplashScreen();
    setSplashHidden(true);
  }, 300);
  return () => clearTimeout(timer);
}
```

### 2. Auth Page Hides Splash Screen

**File:** `src/pages/Auth.tsx`

**Problem:** Auth page didn't explicitly hide splash screen, relying on App.tsx logic which waited for auth.

**Fix:** Added useEffect in Auth component to hide splash screen immediately on mount:

```typescript
// Hide splash screen immediately when Auth page loads
useEffect(() => {
  import('@/utils/capacitor').then(({ hideSplashScreen }) => {
    hideSplashScreen().catch(() => {
      // Ignore errors - splash screen might not be available on web
    });
  });
}, []);
```

---

## How It Works Now

### Before Fix:
1. User navigates to protected route (e.g., `/`)
2. ProtectedRoute waits for `authLoading` to become false
3. If auth check hangs, ProtectedRoute shows loading spinner
4. Splash screen also stays visible (waiting for `authLoading`)
5. User sees loading spinner indefinitely

### After Fix:
1. User navigates to protected route
2. ProtectedRoute waits for `authLoading` (max 10s timeout from useAuth hook)
3. If not authenticated, redirects to `/auth`
4. **Splash screen hides immediately when on /auth route**
5. **Auth page also explicitly hides splash screen**
6. User sees auth/login screen, not loading spinner

---

## Expected Behavior

### Scenario 1: User Not Authenticated
1. App loads → splash visible
2. Auth check completes (or times out after 10s)
3. Redirects to `/auth`
4. Splash hides immediately
5. Auth page renders

### Scenario 2: User Already Authenticated  
1. App loads → splash visible
2. Auth check completes
3. Navigates to protected route
4. Splash hides after auth loads
5. App content renders

### Scenario 3: Auth Check Hangs
1. App loads → splash visible
2. Auth check hangs (>10s)
3. useAuth timeout fires → `authLoading` becomes false
4. Redirects to `/auth` 
5. Splash hides immediately
6. Auth page renders

---

## Testing

After rebuilding, verify:

1. **Not logged in:**
   - App should show splash briefly
   - Then show auth/login screen
   - No infinite loading spinner

2. **Already logged in:**
   - App should show splash briefly
   - Then show app content
   - No infinite loading spinner

3. **Network issues:**
   - Even if Firebase hangs, should show auth screen after timeout
   - No infinite loading spinner

---

## Related Fixes

- ✅ useAuth hook timeout (10 seconds) - prevents infinite loading
- ✅ Splash screen hides on /auth route
- ✅ Auth page explicitly hides splash screen
- ✅ ProtectedRoute redirects to /auth when not authenticated

---

**Status:** Fixes applied  
**Next Step:** Rebuild and test: `npm run ios:build`
