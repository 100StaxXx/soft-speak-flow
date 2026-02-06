
# Fix: Tutorial Modals Not Showing for New Users

## Problem Summary
Tutorial modals are not appearing for new users after completing onboarding, despite being properly wired up in the code.

## Current Tab Structure (Bottom Navigation)
| Tab | Route | Tutorial Modal | Tab Key Used |
|-----|-------|----------------|--------------|
| **Mentor** | `/mentor` | `MentorTutorialModal` | `'mentor'` |
| **Companion** | `/companion` | `CompanionTutorialModal` | `'companion'` |
| **Quests** | `/journeys` | `QuestHubTutorial` | `'journeys'` |
| **Campaigns** | `/campaigns` | `EpicsTutorialModal` | `'epics'` |
| **Command** | `/profile` | None (not needed) | N/A |

## Root Cause
The `useFirstTimeModal` hook at `src/hooks/useFirstTimeModal.ts` has a **module-level cache** that breaks the modal display logic:

```typescript
// This Set persists across navigation and HMR
const checkedModals = new Set<string>();
```

**Why this breaks modals:**
1. On first render, `userId` might be `null` (auth still loading), so the effect returns early
2. The tab key gets added to `checkedModals` anyway when userId arrives
3. On subsequent navigations, the Set already has the key, so it skips the localStorage check
4. The modal never shows because the effect returns early due to the cached key

## Solution
Remove the module-level cache and use a component-level ref instead:

### File: `src/hooks/useFirstTimeModal.ts`

**Changes:**
1. Remove the module-level `checkedModals` Set
2. Add a `useRef` to prevent double-execution within the same mount cycle
3. Reset the ref when userId changes (for user switching scenarios)

**Updated Implementation:**
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

## Files Changed
- `src/hooks/useFirstTimeModal.ts` - Remove module-level cache, add component-level ref

## Testing Steps
After implementation:
1. Clear localStorage (or use incognito window)
2. Create a new account or log in as a user who hasn't seen the modals
3. Complete onboarding
4. Navigate to **Companion** tab - `CompanionTutorialModal` should appear
5. Navigate to **Mentor** tab - `MentorTutorialModal` should appear  
6. Navigate to **Quests** tab - `QuestHubTutorial` should appear
7. Navigate to **Campaigns** tab - `EpicsTutorialModal` should appear
8. After dismissing each modal, refreshing the page should NOT show the modal again
