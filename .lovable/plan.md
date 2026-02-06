
# Fix: Tutorial Modals Not Showing for New Users

## Problem Summary
Tutorial modals (Companion, Mentor, Epics, etc.) are not appearing for new users after completing onboarding, despite the code looking correct.

## Root Cause
The `useFirstTimeModal` hook at `src/hooks/useFirstTimeModal.ts` has a **module-level cache** (`checkedModals`) that causes problems:

```typescript
// Module-level cache to track which modals have been checked this session
const checkedModals = new Set<string>();
```

**Issues with this approach:**
1. The Set persists across navigation and Hot Module Replacement (HMR)
2. Once a key is added, it's never removed - even if the modal didn't actually show
3. The early return `if (!userId) return;` prevents the modal from showing, but subsequent effect runs skip due to the cache

## Solution
Remove the module-level cache entirely. The localStorage check is sufficient - we don't need session-level caching because:
- localStorage already prevents showing the modal twice
- The effect should run fresh on each component mount
- Users expect modals on first visit to each page after onboarding

## Code Changes

### File: `src/hooks/useFirstTimeModal.ts`

```text
BEFORE:
┌─────────────────────────────────────────────────────────┐
│ const checkedModals = new Set<string>();                │
│                                                         │
│ useEffect(() => {                                       │
│   if (!userId) return;                                  │
│   const cacheKey = `${tabName}_${userId}`;              │
│   if (checkedModals.has(cacheKey)) return;  ← Problem!  │
│   checkedModals.add(cacheKey);                          │
│   ...                                                   │
│ }, [userId, tabName]);                                  │
└─────────────────────────────────────────────────────────┘

AFTER:
┌─────────────────────────────────────────────────────────┐
│ // Remove module-level cache entirely                   │
│ // Use ref to prevent double-execution in same mount    │
│                                                         │
│ useEffect(() => {                                       │
│   if (!userId) return;                                  │
│   const storageKey = `tab_intro_${tabName}_${userId}`;  │
│   const hasSeenModal = safeLocalStorage.getItem(...);   │
│   if (!hasSeenModal) {                                  │
│     setShowModal(true);                                 │
│   }                                                     │
│ }, [userId, tabName]);                                  │
└─────────────────────────────────────────────────────────┘
```

**Full Implementation:**
```typescript
import { useState, useEffect, useCallback, useRef } from "react";
import { safeLocalStorage } from "@/utils/storage";
import { useAuth } from "@/hooks/useAuth";

export function useFirstTimeModal(tabName: string) {
  const { user } = useAuth();
  const userId = user?.id;
  
  const [showModal, setShowModal] = useState(false);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Reset the check flag when userId changes
    hasCheckedRef.current = false;
  }, [userId]);

  useEffect(() => {
    // Don't do anything until we have a userId
    if (!userId) return;
    
    // Prevent double-execution within same mount
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;
    
    const storageKey = `tab_intro_${tabName}_${userId}`;
    const hasSeenModal = safeLocalStorage.getItem(storageKey);
    
    if (!hasSeenModal) {
      setShowModal(true);
    }
  }, [userId, tabName]);

  const dismissModal = useCallback(() => {
    setShowModal(false);
    if (userId) {
      const storageKey = `tab_intro_${tabName}_${userId}`;
      safeLocalStorage.setItem(storageKey, 'true');
    }
  }, [userId, tabName]);

  return { showModal, dismissModal };
}
```

## Key Changes
1. **Removed module-level `checkedModals` Set** - This was causing persistence across HMR and navigation
2. **Added component-level `useRef`** - Prevents double-execution within the same mount cycle
3. **Added ref reset on userId change** - Ensures the check runs again if user changes

## Testing Steps
After implementation:
1. Clear localStorage (or use incognito)
2. Complete onboarding as a new user
3. Verify Journeys tutorial modal appears
4. Navigate to Companion tab → modal should appear
5. Navigate to Mentor tab → modal should appear
6. Navigate to Campaigns tab → modal should appear
7. Navigate to Search tab → modal should appear

## Alternative: Debug Reset Button (Optional)
For testing, add a temporary button in Profile settings to clear tutorial flags:
```typescript
const clearTutorialFlags = () => {
  Object.keys(localStorage).forEach(key => {
    if (key.startsWith('tab_intro_')) {
      localStorage.removeItem(key);
    }
  });
};
```
