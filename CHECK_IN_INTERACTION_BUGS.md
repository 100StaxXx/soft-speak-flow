# Check-In Walkthrough Interaction Bugs

## Overview
Analysis of bugs related to preventing unwanted interactions during the check-in portion of the walkthrough, focusing on three key areas:
1. Full-Screen Overlay with Higher Z-Index
2. Scroll Locking
3. Disable Bottom Navigation

---

## 🐛 Bug #1: Backdrop Not Blocking Interactions During Check-In

**Severity:** HIGH  
**File:** `src/components/AppWalkthrough.tsx` (line 498)

### Problem
The backdrop overlay has `pointer-events-none`, which means it doesn't block clicks during the check-in step. Users can still interact with elements behind the backdrop.

### Current Code
```tsx
<div 
  className={cn(
    "fixed inset-0 backdrop-blur-sm z-[9998] transition-all duration-300 pointer-events-none",
    stepIndex === STEP_INDEX.HOME_CHECKIN 
      ? "bg-black/80" 
      : "bg-black/40"
  )}
/>
```

### Issue
- `pointer-events-none` allows all clicks to pass through the backdrop
- During check-in step, we want to block interactions with everything EXCEPT the check-in form
- The backdrop should block clicks, but the check-in form needs to be above it

### Expected Behavior
- During check-in step: backdrop should have `pointer-events: auto` to block clicks
- Check-in form should have `z-index > 9998` to be clickable above the backdrop
- Modal should remain at `z-index: 10000` (highest)

### Fix Required
1. Change backdrop `pointer-events-none` to conditional: `pointer-events-none` when NOT on check-in step, `pointer-events-auto` when on check-in step
2. Ensure check-in form has explicit z-index above backdrop (e.g., `z-[9999]`)

---

## 🐛 Bug #2: Scroll Lock Not Restored on Unmount

**Severity:** MEDIUM  
**File:** `src/components/AppWalkthrough.tsx` (lines 233-264)

### Problem
If the component unmounts while scroll is locked (during check-in step), the cleanup function might not execute properly, leaving the page permanently scroll-locked.

### Current Code
```tsx
useEffect(() => {
  if (stepIndex !== STEP_INDEX.HOME_CHECKIN || !run) {
    document.body.style.overflow = 'auto';
    // ... restore nav
    return;
  }

  document.body.style.overflow = 'hidden';
  // ... disable nav

  return () => {
    document.body.style.overflow = 'auto';
    // ... restore nav
  };
}, [stepIndex, run]);
```

### Issue
- If component unmounts unexpectedly during check-in step, cleanup might not run
- No global cleanup in the unmount effect (lines 101-115) to restore scroll
- Race condition: if `stepIndex` or `run` changes rapidly, cleanup might not execute

### Expected Behavior
- Scroll should always be restored, even if component unmounts unexpectedly
- Unmount cleanup should check and restore scroll state

### Fix Required
Add scroll restoration to the main unmount cleanup effect (around line 101-115):
```tsx
useEffect(() => {
  return () => {
    clearAllTimers();
    // Restore scroll if locked
    document.body.style.overflow = 'auto';
    // Restore bottom nav
    const bottomNav = document.querySelector('nav[role="navigation"]');
    if (bottomNav) {
      (bottomNav as HTMLElement).style.pointerEvents = 'auto';
      (bottomNav as HTMLElement).style.opacity = '1';
    }
    // ... existing cleanup
  };
}, [run, clearAllTimers]);
```

---

## 🐛 Bug #3: Bottom Nav Style Manipulation Conflicts

**Severity:** MEDIUM  
**Files:** 
- `src/components/AppWalkthrough.tsx` (lines 238-242, 250-254, 258-262)
- `src/components/BottomNav.tsx` (lines 40-66, 81, 111, 139, 157, 173)

### Problem
`AppWalkthrough` directly manipulates the bottom nav element's styles (`pointerEvents`, `opacity`), but `BottomNav` component also has its own logic for disabling nav items based on tutorial step. This creates conflicts and potential race conditions.

### Current Code
**AppWalkthrough.tsx:**
```tsx
const bottomNav = document.querySelector('nav[role="navigation"]');
if (bottomNav) {
  (bottomNav as HTMLElement).style.pointerEvents = 'none';
  (bottomNav as HTMLElement).style.opacity = '0.3';
}
```

**BottomNav.tsx:**
```tsx
const isTutorialActive = tutorialStep !== null;
const canClickCompanion = tutorialStep === 1;
const canClickQuests = tutorialStep === 2 || tutorialStep === 3;

className={`... ${isTutorialActive ? 'pointer-events-none opacity-50' : ''}`}
```

### Issue
- Direct DOM manipulation in `AppWalkthrough` conflicts with React state/props in `BottomNav`
- `BottomNav` uses CSS classes (`pointer-events-none opacity-50`) while `AppWalkthrough` uses inline styles
- Inline styles override CSS classes, causing inconsistent behavior
- During check-in step (step 0), `BottomNav` logic might not match `AppWalkthrough` expectations

### Expected Behavior
- Single source of truth for nav disabling
- Use React props/state instead of direct DOM manipulation
- Consistent styling approach (either CSS classes or inline styles, not both)

### Fix Required
1. Remove direct DOM manipulation from `AppWalkthrough`
2. Pass walkthrough state to `BottomNav` via props or context
3. Let `BottomNav` handle its own disabling logic based on walkthrough state
4. Or: Use a data attribute/class that `BottomNav` can react to

---

## 🐛 Bug #4: Check-In Form Z-Index Not Explicitly Set

**Severity:** LOW  
**File:** `src/components/MorningCheckIn.tsx`

### Problem
The check-in form doesn't have an explicit z-index, so it might render below the backdrop (z-index 9998) or modal (z-index 10000), making it unclickable or visually obscured.

### Current Code
The `MorningCheckIn` component renders a `Card` without explicit z-index styling.

### Issue
- Z-index stacking context is unclear
- If backdrop has `pointer-events: auto` (after fixing Bug #1), check-in form needs higher z-index
- Form might be visually behind the backdrop

### Expected Behavior
- Check-in form should have `z-index: 9999` (above backdrop 9998, below modal 10000)
- Form should be clearly visible and clickable during walkthrough

### Fix Required
Add explicit z-index to the check-in form Card during walkthrough:
```tsx
<Card 
  data-tour="morning-checkin" 
  className="p-5 md:p-6 ... relative z-[9999]"
  // ... or conditionally add z-index when walkthrough is active
>
```

---

## 🐛 Bug #5: Backdrop Visible During All Steps, Not Just Check-In

**Severity:** LOW  
**File:** `src/components/AppWalkthrough.tsx` (lines 494-504)

### Problem
The backdrop is visible during all walkthrough steps (`{run && ...}`), but it should only block interactions during the check-in step. Currently it's just dimmed differently.

### Current Code
```tsx
{run && (
  <div 
    className={cn(
      "fixed inset-0 backdrop-blur-sm z-[9998] transition-all duration-300 pointer-events-none",
      stepIndex === STEP_INDEX.HOME_CHECKIN 
        ? "bg-black/80" 
        : "bg-black/40"
    )}
  />
)}
```

### Issue
- Backdrop is always visible when `run` is true
- Should only block interactions during check-in step
- Other steps might not need the backdrop at all, or need different behavior

### Expected Behavior
- Backdrop should only block interactions during check-in step
- Other steps might not need backdrop, or need lighter backdrop that doesn't block

### Fix Required
Consider making backdrop conditional or adjusting its behavior per step:
- Check-in step: Full blocking backdrop (`pointer-events: auto`, `bg-black/80`)
- Other steps: Lighter backdrop or no backdrop (`pointer-events-none`, lighter opacity)

---

## Summary of Required Fixes

1. **HIGH:** Fix backdrop `pointer-events` to block clicks during check-in step
2. **MEDIUM:** Add scroll restoration to unmount cleanup
3. **MEDIUM:** Resolve bottom nav style manipulation conflicts
4. **LOW:** Add explicit z-index to check-in form
5. **LOW:** Review backdrop visibility/behavior for all steps

---

## Testing Checklist

After fixes, verify:
- [ ] Cannot click elements behind backdrop during check-in step
- [ ] Check-in form is clickable and visible above backdrop
- [ ] Scroll is restored if walkthrough unmounts unexpectedly
- [ ] Bottom nav is properly disabled during check-in step
- [ ] Bottom nav styles are consistent (no conflicts)
- [ ] Scroll lock works correctly during check-in step
- [ ] Scroll is restored when advancing from check-in step
- [ ] All cleanup functions execute properly
