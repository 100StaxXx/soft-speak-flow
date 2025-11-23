# Walkthrough System Bug Report

## Date: 2025-11-23

## Critical Bugs Found

### 1. **CRITICAL: Navigation Blocking Inconsistency in BottomNav.tsx**

**Location:** Lines 81, 157, 173 in `src/components/BottomNav.tsx`

**Issue:** Some navigation items have both `pointer-events-none` AND `onClick` handler with preventDefault. This creates redundant blocking and the `pointer-events-none` prevents the onClick handler from even firing.

**Current Code:**
```tsx
className={`... ${isTutorialActive ? 'pointer-events-none opacity-50' : ''}`}
onClick={(e) => handleNavClick(e, '/')}
```

**Problem:** 
- When `pointer-events-none` is applied, the onClick handler NEVER fires
- This means the navigation is just visually disabled but the logic isn't consistent
- The handleNavClick function is designed to handle blocking, so pointer-events-none is redundant

**Fix:** Remove `pointer-events-none` from lines 81, 157, and 173 and rely solely on handleNavClick logic.

---

### 2. **MAJOR: NavLink Children Render Function Not Properly Typed**

**Location:** Lines 84-102, 116-130, 144-151, 160-167, 176-183 in `src/components/BottomNav.tsx`

**Issue:** The NavLink component uses a render function pattern for children, but the implementation doesn't ensure proper types are passed through.

**Current Pattern:**
```tsx
<NavLink>
  {({ isActive }) => (
    // content
  )}
</NavLink>
```

**Problem:**
The NavLink wrapper in `src/components/NavLink.tsx` doesn't explicitly handle the children prop when it's a function. React Router's NavLink expects `children` to be a function, but our wrapper doesn't type this properly.

**Fix:** Update NavLink.tsx to properly type the children prop:

```tsx
interface NavLinkCompatProps extends Omit<NavLinkProps, "className"> {
  className?: string | (({ isActive, isPending }: { isActive: boolean; isPending: boolean }) => string);
  activeClassName?: string;
  pendingClassName?: string;
  children?: React.ReactNode | (({ isActive, isPending }: { isActive: boolean; isPending: boolean }) => React.ReactNode);
}
```

---

### 3. **MAJOR: Race Condition Between OnboardingFlow and AppWalkthrough Event Listeners**

**Location:** 
- `src/components/OnboardingFlow.tsx` line 112-115
- `src/components/AppWalkthrough.tsx` line 226

**Issue:** The OnboardingFlow dispatches the `onboarding-complete` event with a 500ms delay, but AppWalkthrough sets up its listener AFTER the component mounts, which could be AFTER the event is dispatched.

**Scenario:**
1. OnboardingFlow completes
2. Event is dispatched after 500ms
3. User navigates to Index page
4. AppWalkthrough component mounts (takes time)
5. AppWalkthrough sets up listener AFTER event was already dispatched
6. Walkthrough never starts

**Current Code (OnboardingFlow.tsx):**
```tsx
setTimeout(() => {
  console.log('[OnboardingFlow] Dispatching onboarding-complete event');
  window.dispatchEvent(new CustomEvent('onboarding-complete'));
}, 500);
```

**Current Code (AppWalkthrough.tsx):**
```tsx
window.addEventListener('onboarding-complete', handleOnboardingComplete, { once: true });
```

**Fix:** 
- Option 1: Remove the setTimeout delay and dispatch immediately
- Option 2: Add a flag in localStorage and check it on AppWalkthrough mount
- Option 3: Use a more reliable state management solution (React Context)

**Recommended Fix:** Add a flag check in AppWalkthrough:

```tsx
useEffect(() => {
  if (!user || !session || isWalkthroughCompleted === null) return;
  if (isWalkthroughCompleted) return;

  // Check if onboarding just completed (within last 2 seconds)
  const onboardingCompletedFlag = localStorage.getItem('onboardingJustCompleted');
  if (onboardingCompletedFlag) {
    const timestamp = parseInt(onboardingCompletedFlag);
    if (Date.now() - timestamp < 2000) {
      // Start walkthrough immediately
      localStorage.removeItem('onboardingJustCompleted');
      handleOnboardingComplete();
      return;
    }
  }

  let hasStarted = false;
  const handleOnboardingComplete = () => {
    // ... existing code
  };

  window.addEventListener('onboarding-complete', handleOnboardingComplete, { once: true });
  return () => {
    // Cleanup
  };
}, [user, session, isWalkthroughCompleted]);
```

And in OnboardingFlow:
```tsx
const handleComplete = async () => {
  // ... existing code
  
  // Set flag for immediate detection
  localStorage.setItem('onboardingJustCompleted', Date.now().toString());
  
  // Dispatch event after short delay
  setTimeout(() => {
    console.log('[OnboardingFlow] Dispatching onboarding-complete event');
    window.dispatchEvent(new CustomEvent('onboarding-complete'));
  }, 500);
};
```

---

### 4. **MINOR: Potential Memory Leak - Event Listeners Not Cleaned Up Properly**

**Location:** `src/components/TodaysPepTalk.tsx` line 64

**Issue:** The tutorial-step-change event listener is added but the cleanup in return doesn't use the same handler reference.

**Current Code:**
```tsx
const handleTutorialChange = () => checkWalkthrough();
window.addEventListener('tutorial-step-change', handleTutorialChange);

return () => {
  window.removeEventListener('tutorial-step-change', handleTutorialChange);
};
```

**Status:** Actually this is CORRECT - the handler is properly referenced. Not a bug.

---

### 5. **MINOR: Inconsistent Check for appWalkthroughActive**

**Location:** Multiple files check `localStorage.getItem('appWalkthroughActive')`

**Issue:** Different components check this flag in different ways:
- `AppWalkthrough.tsx` line 106: `localStorage.getItem('appWalkthroughActive')`
- `TodaysPepTalk.tsx` line 57: `Boolean(localStorage.getItem('appWalkthroughActive'))`
- `DailyContentWidget.tsx` line 129: `Boolean(localStorage.getItem('appWalkthroughActive'))`

**Problem:** Inconsistent checking could lead to bugs if the value is anything other than null/undefined vs truthy string.

**Fix:** Standardize to always use Boolean conversion:
```tsx
const isWalkthroughActive = Boolean(localStorage.getItem('appWalkthroughActive'));
```

---

### 6. **MINOR: Evolution Callback Might Not Be Set in Time**

**Location:** 
- `src/components/AppWalkthrough.tsx` line 356
- `src/components/GlobalEvolutionListener.tsx` line 108

**Issue:** The `setOnEvolutionComplete` callback is set in a useEffect, but the evolution might complete before the callback is registered.

**Scenario:**
1. User completes quest (triggers evolution)
2. Evolution animation starts
3. AppWalkthrough hasn't reached step 3 yet
4. Callback isn't set
5. Evolution completes
6. No callback to trigger walkthrough completion

**Current Code:**
```tsx
useEffect(() => {
  if (stepIndex !== STEP_INDEX.QUEST_CREATION) {
    setOnEvolutionComplete(null);
    return;
  }

  // ... callback setup
  setOnEvolutionComplete(() => () => {
    // ...
  });
}, [stepIndex, setOnEvolutionComplete, createTrackedTimeout]);
```

**Problem:** If evolution happens before stepIndex becomes QUEST_CREATION, the callback won't be set.

**Fix:** This is actually working as intended since:
1. The walkthrough explicitly shows step 3 first (telling user to create quest)
2. THEN user creates quest
3. THEN evolution triggers
4. The callback is set when step 3 shows

**Status:** NOT A BUG - Working as designed

---

### 7. **CRITICAL: Duplicate Navigation Prevention Still Uses pointer-events-none**

**Location:** `src/components/BottomNav.tsx` lines 81, 157, 173

**Already covered in Bug #1**

---

## Summary of Fixes Needed

### High Priority:
1. ✅ Remove `pointer-events-none` from navigation items in BottomNav.tsx (already fixed by user)
2. 🔴 Fix race condition between OnboardingFlow and AppWalkthrough
3. 🟡 Standardize localStorage checks for appWalkthroughActive

### Medium Priority:
4. 🟡 Improve TypeScript types for NavLink children prop

### Low Priority:
5. ✅ Memory leak check - False alarm, code is correct

---

## Recommended Immediate Actions

1. **Fix the race condition** - This is the most critical issue that could cause walkthrough to not start
2. **Standardize localStorage checks** - Prevent potential inconsistencies
3. **Add error boundaries** - Ensure walkthrough failures don't crash the app

---

## Testing Checklist

After fixes are applied, test:
- [ ] Complete onboarding and verify walkthrough starts immediately
- [ ] Try refreshing page during walkthrough
- [ ] Test navigation blocking works correctly
- [ ] Verify modal doesn't block navigation clicks inappropriately
- [ ] Test on slow network connections
- [ ] Test with browser back/forward buttons during walkthrough
- [ ] Verify cleanup on unmount works correctly
