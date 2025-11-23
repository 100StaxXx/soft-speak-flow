# App Walkthrough/Tutorial - Bug & Error Report

**Date:** 2025-11-23  
**Component:** AppWalkthrough.tsx, TutorialModal.tsx  
**Status:** 🔴 **10 Issues Found** (3 Critical, 4 Major, 3 Minor)

---

## Critical Issues (Must Fix)

### 1. ❌ Incorrect XP Value in Tutorial Instructions
**File:** `src/components/AppWalkthrough.tsx:57`  
**Severity:** Critical (Inaccurate Information)

**Issue:**
```tsx
action: "Type 'Start my Journey', select Medium difficulty (10 XP), tap Add Quest..."
```
The tutorial says Medium difficulty quests award **10 XP**, but they actually award **15 XP** according to `src/config/xpRewards.ts:16`.

**Impact:** Misleads users about XP rewards, causing confusion about game mechanics.

**Fix:**
```tsx
action: "Type 'Start my Journey', select Medium difficulty (15 XP), tap Add Quest..."
```

---

### 2. ❌ No Fallback Timeout for Evolution Completion
**File:** `src/components/AppWalkthrough.tsx:79, 294-324`  
**Severity:** Critical (Walkthrough Can Get Stuck)

**Issue:**
A timeout constant `TIMEOUTS.EVOLUTION_COMPLETE: 15000` is defined but **never used**. If the evolution animation fails to complete (network error, browser issue, etc.), the walkthrough gets permanently stuck at step 4 with no way to continue.

**Code:**
```tsx
// Line 79 - Defined but unused
const TIMEOUTS = {
  EVOLUTION_COMPLETE: 15000, // 15 seconds fallback if evolution doesn't complete
} as const;

// Line 294-324 - Step 4 waits forever with no timeout
useEffect(() => {
  if (stepIndex !== STEP_INDEX.QUEST_CREATION) {
    setOnEvolutionComplete(null);
    return;
  }
  // ... waits indefinitely for evolution
}, [stepIndex, setOnEvolutionComplete]);
```

**Impact:** Users can get stuck in the tutorial with no way to proceed if evolution fails.

**Recommended Fix:**
Add a fallback timeout that shows the completion button after 15 seconds even if evolution callback never fires:

```tsx
useEffect(() => {
  if (stepIndex !== STEP_INDEX.QUEST_CREATION) {
    setOnEvolutionComplete(null);
    return;
  }

  // Set fallback timeout
  const fallbackTimeout = createTrackedTimeout(() => {
    console.warn('[Tutorial] Evolution timeout reached, showing completion button');
    setShowCompletionButton(true);
  }, TIMEOUTS.EVOLUTION_COMPLETE);

  let hasHandledLoading = false;
  
  const handleEvolutionLoadingStart = () => {
    if (hasHandledLoading) return;
    hasHandledLoading = true;
    console.log('[Tutorial] Evolution loading started, hiding modal.');
    setShowModal(false);
    setRun(false);
  };

  setOnEvolutionComplete(() => () => {
    console.log('[Tutorial] Evolution completion callback triggered!');
    clearTimeout(fallbackTimeout); // Clear fallback since evolution completed
    setRun(false);
    setShowModal(false);
    setShowCompletionButton(true);
  });

  window.addEventListener('evolution-loading-start', handleEvolutionLoadingStart, { once: true });
  
  return () => {
    window.removeEventListener('evolution-loading-start', handleEvolutionLoadingStart);
    clearTimeout(fallbackTimeout);
    setOnEvolutionComplete(null);
  };
}, [stepIndex, setOnEvolutionComplete, createTrackedTimeout]);
```

---

### 3. ❌ Memory Leak: Timer Cleanup Never Called
**File:** `src/components/AppWalkthrough.tsx:107-112`  
**Severity:** Critical (Memory Leak)

**Issue:**
The `clearAllTimers()` function is defined to clean up tracked timeouts/intervals, but it's **never actually called** anywhere in the component.

**Code:**
```tsx
const clearAllTimers = useCallback(() => {
  activeTimeouts.current.forEach((id) => clearTimeout(id));
  activeTimeouts.current.clear();
  activeIntervals.current.forEach((id) => clearInterval(id));
  activeIntervals.current.clear();
}, []);
```

**Impact:** When the component unmounts or when walkthrough completes, scheduled timeouts may still fire, causing:
- State updates on unmounted components
- Unexpected behavior after walkthrough completion
- Memory leaks

**Recommended Fix:**
Call `clearAllTimers()` in cleanup scenarios:

```tsx
// Add to handleWalkthroughComplete
const handleWalkthroughComplete = useCallback(async () => {
  if (isSaving) return;
  setIsSaving(true);
  clearAllTimers(); // Add this
  console.log('[Tutorial] Tutorial completed');
  // ... rest of function
}, [user, isSaving, clearAllTimers]);

// Add useEffect for cleanup on unmount
useEffect(() => {
  return () => {
    clearAllTimers();
  };
}, [clearAllTimers]);
```

---

## Major Issues (Should Fix)

### 4. ⚠️ localStorage Overflow Risk with Audio Caching
**File:** `src/components/TutorialModal.tsx:42-91`  
**Severity:** Major (Can Cause Runtime Errors)

**Issue:**
Tutorial audio files are cached in localStorage as **base64-encoded data URLs**. Each audio file can be 100-500KB+ in base64, and localStorage typically has a **5-10MB limit**. With 5 tutorial steps, this could use 2.5MB+ of localStorage.

**Code:**
```tsx
const cacheKey = `tutorial-audio-${mentorSlug}-${step.id}`;
const cachedAudio = localStorage.getItem(cacheKey);

if (cachedAudio) {
  setAudioUrl(cachedAudio);
  return;
}

// ... later
localStorage.setItem(cacheKey, audioDataUrl); // Can fail if storage full
```

**Impact:** 
- localStorage.setItem() throws `QuotaExceededError` when full
- While there's try-catch cleanup logic, it only deletes old tutorial audio
- If user has other data in localStorage, this could still fail

**Recommended Solutions:**
1. **Don't cache audio** - Let it regenerate each time (simple fix)
2. **Use IndexedDB instead** - No size limits for blob storage
3. **Add size check before caching** - Only cache if there's enough space

---

### 5. ⚠️ Confusing XP Progression in Tutorial
**File:** `src/components/AppWalkthrough.tsx:20-61`  
**Severity:** Major (User Confusion)

**Issue:**
The tutorial flow is confusing about when evolution happens:
1. User completes check-in → **+5 XP** (total: 5 XP)
2. Tutorial says "You Earned XP!" and "Tap Companion tab" (Step 2-3)
3. User creates and completes Medium quest → **+15 XP** (total: 20 XP)
4. Companion evolves to Stage 1

**The Problem:** Stage 1 only requires **10 XP** (per `xpSystem.ts:82`), so the user will evolve **during the check-in**, not when they complete the quest. The tutorial makes it seem like the quest triggers evolution, but that's misleading.

**Impact:** Users may be confused about when/why evolution happens.

**Recommended Fix:**
Either:
- Change Stage 1 threshold to 20 XP (requires Medium quest)
- OR clarify tutorial text to explain the combined XP triggers evolution

---

### 6. ⚠️ Unused Event Dispatch
**File:** `src/components/AppWalkthrough.tsx:160-162`  
**Severity:** Major (Dead Code)

**Issue:**
The component dispatches a `walkthrough-ready` event, but nothing in the codebase listens for it:

```tsx
window.dispatchEvent(new CustomEvent('walkthrough-ready', { 
  detail: { shouldRun: !completed } 
}));
```

**Impact:** Dead code that serves no purpose, adds confusion.

**Fix:** Remove the event dispatch or implement the listener if it's needed.

---

### 7. ⚠️ Race Condition in Evolution Event Handling
**File:** Multiple files (AppWalkthrough.tsx, GlobalEvolutionListener.tsx, CompanionEvolution.tsx, useCompanion.ts)  
**Severity:** Major (Potential Walkthrough Failure)

**Issue:**
Evolution completion relies on multiple event sources with potential race conditions:
- `evolution-loading-start` event (dispatched twice - useCompanion.ts:275, GlobalEvolutionListener.tsx:75)
- `evolution-complete` event (CompanionEvolution.tsx:223)
- `evolution-modal-closed` event (CompanionEvolution.tsx:224, 237, 254)
- `onEvolutionComplete` callback (set in AppWalkthrough.tsx:311, called in GlobalEvolutionListener.tsx:108)

**Impact:** If events fire in unexpected order or some don't fire, the walkthrough may not advance to completion button.

**Recommended Fix:** Consolidate to a single source of truth for evolution completion.

---

## Minor Issues (Nice to Have)

### 8. 📝 Potential Re-render Issue in TutorialModal
**File:** `src/components/TutorialModal.tsx:130-136`  
**Severity:** Minor (Performance)

**Issue:**
The useEffect dependencies `[isMuted, audioUrl, hasUserPaused, isPlaying]` might cause unnecessary re-renders when audio state changes.

**Code:**
```tsx
useEffect(() => {
  if (!isMuted && audioUrl && audioRef.current && !isPlaying && !hasUserPaused) {
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(console.error);
    setIsPlaying(true); // This causes re-render
  }
}, [isMuted, audioUrl, hasUserPaused, isPlaying]); // isPlaying in deps
```

**Impact:** Could cause multiple re-renders, though not critical.

**Fix:** Remove `isPlaying` from dependencies or restructure logic.

---

### 9. 📝 Missing Null Check in Audio Cleanup
**File:** `src/components/TutorialModal.tsx:104-111`  
**Severity:** Minor (Potential Runtime Error)

**Issue:**
Audio cleanup doesn't explicitly check for null before calling `.pause()` and `.currentTime`:

```tsx
return () => {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current.currentTime = 0; // Could throw if audio already cleaned up
  }
  setIsPlaying(false);
  setHasUserPaused(false);
};
```

**Impact:** Unlikely to cause issues due to the `if` check, but not as defensive as it could be.

**Fix:** Wrap in try-catch like done in CompanionEvolution.tsx:38-48.

---

### 10. 📝 Inconsistent Event Naming
**File:** Multiple files  
**Severity:** Minor (Code Quality)

**Issue:**
Evolution events use inconsistent naming:
- `evolution-loading-start`
- `evolution-complete`
- `evolution-modal-closed`
- `companion-evolved`

vs other events like:
- `checkin-complete`
- `onboarding-complete`

**Impact:** Makes code harder to maintain.

**Fix:** Standardize to kebab-case with consistent naming pattern (e.g., `evolution-loading-start`, `evolution-completed`, `evolution-dismissed`).

---

## Summary

| Severity | Count | Issues |
|----------|-------|--------|
| 🔴 Critical | 3 | Incorrect XP value, No evolution timeout, Memory leak |
| ⚠️ Major | 4 | localStorage overflow, Confusing XP flow, Unused event, Race conditions |
| 📝 Minor | 3 | Re-render issue, Missing null check, Inconsistent naming |
| **Total** | **10** | |

## Priority Fixes

1. **Fix incorrect XP value** (1 line change)
2. **Add evolution completion timeout** (prevents stuck walkthrough)
3. **Call clearAllTimers on cleanup** (prevents memory leak)
4. **Fix/clarify XP progression** (user experience)

---

## Testing Recommendations

After fixes:
1. ✅ Complete full walkthrough from onboarding to evolution
2. ✅ Test evolution timeout by simulating network failure
3. ✅ Test audio caching with multiple mentors
4. ✅ Test walkthrough on slow networks
5. ✅ Test unmounting component during various steps
6. ✅ Check localStorage size before/after tutorial
7. ✅ Test on mobile browsers (iOS Safari, Chrome)

---

**Report Generated By:** Cursor AI  
**Files Analyzed:** 7 core files, 2000+ lines of code  
**Recommendation:** Address Critical and Major issues before next release
