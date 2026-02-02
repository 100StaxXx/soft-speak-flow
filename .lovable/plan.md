
# Fix Mentor Disconnection on iOS App Resume

## Problem Summary

The mentor section appears empty when the iOS app returns from background. This happens because:

1. Profile data becomes stale while app is in background
2. No explicit refresh is triggered when app resumes
3. `resolvedMentorId` returns `null` from stale profile data
4. Mentor image and content don't render

## Solution

Add an app state change listener that refreshes critical data when the app resumes from background on iOS/Android.

## Implementation

### 1. Create App Resume Hook

Create a new hook that listens for Capacitor app state changes and refreshes critical queries:

**File: `src/hooks/useAppResumeRefresh.ts`**

```typescript
import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { logger } from '@/utils/logger';

const RESUME_COOLDOWN_MS = 10000; // 10 second cooldown to prevent spam

export const useAppResumeRefresh = () => {
  const queryClient = useQueryClient();
  const lastResumeRef = useRef<number>(0);

  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) return;

    const handleAppStateChange = async ({ isActive }: { isActive: boolean }) => {
      if (!isActive) return; // Only care about resume

      const now = Date.now();
      const elapsed = now - lastResumeRef.current;

      // Apply cooldown to prevent refresh spam
      if (elapsed < RESUME_COOLDOWN_MS) {
        logger.debug('App resume refresh skipped (cooldown)');
        return;
      }

      lastResumeRef.current = now;
      logger.debug('App resumed - refreshing critical data');

      // Refetch profile first (mentor ID depends on it)
      await queryClient.refetchQueries({ queryKey: ['profile'] });
      
      // Then invalidate mentor-related queries
      queryClient.invalidateQueries({ queryKey: ['mentor-page-data'] });
      queryClient.invalidateQueries({ queryKey: ['mentor-personality'] });
    };

    App.addListener('appStateChange', handleAppStateChange);

    return () => {
      App.removeAllListeners();
    };
  }, [queryClient]);
};
```

### 2. Add Hook to App.tsx

**File: `src/App.tsx`**

Import and use the new hook in `AppContent`:

```typescript
import { useAppResumeRefresh } from '@/hooks/useAppResumeRefresh';

// Inside AppContent component:
const AppContent = memo(() => {
  // ... existing code ...
  
  // Refresh critical data on app resume (iOS/Android)
  useAppResumeRefresh();
  
  // ... rest of component ...
});
```

### 3. Also Add Web Visibility Change Handler

For web/PWA, add visibility change handling to ensure data is fresh when tab becomes visible:

**File: `src/hooks/useAppResumeRefresh.ts`** (extended)

```typescript
// Also handle web visibility changes
useEffect(() => {
  if (Capacitor.isNativePlatform()) return; // Skip on native

  const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;

    const now = Date.now();
    const elapsed = now - lastResumeRef.current;

    if (elapsed < RESUME_COOLDOWN_MS) return;

    lastResumeRef.current = now;
    logger.debug('Tab became visible - refreshing critical data');

    queryClient.refetchQueries({ queryKey: ['profile'] });
    queryClient.invalidateQueries({ queryKey: ['mentor-page-data'] });
    queryClient.invalidateQueries({ queryKey: ['mentor-personality'] });
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [queryClient]);
```

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useAppResumeRefresh.ts` | Create new hook with app state + visibility handling |
| `src/App.tsx` | Import and use the new hook in AppContent |

## Why This Fixes It

| Issue | How It's Fixed |
|-------|----------------|
| Stale profile data | Forced refetch on resume |
| Null mentor ID | Fresh profile ensures `resolvedMentorId` is resolved |
| Empty mentor section | `mentor-page-data` query re-runs with valid ID |
| iOS background resume | Native `appStateChange` listener |
| Web tab switch | `visibilitychange` handler |

## Testing

1. **iOS Test**: Open app → Switch to another app → Wait 30 seconds → Return → Mentor should appear
2. **Web Test**: Open tab → Switch to another tab → Wait 30 seconds → Return → Mentor data should refresh

## Result

The mentor will automatically reconnect and display properly when users return to the app after it's been in the background, whether on iOS native or web.
