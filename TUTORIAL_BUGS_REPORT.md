# App Walkthrough (Tutorial) - Bug Report

## Date: 2025-11-23

---

## 🔴 CRITICAL BUGS (Must Fix)

### 1. **Incorrect XP Value in Tutorial Instructions**
**File**: `src/components/AppWalkthrough.tsx` (Line 57)
**Severity**: HIGH - User-facing instruction error

**Issue**:
The tutorial instruction says:
```typescript
"Type 'Start my Journey', select Medium difficulty (10 XP), tap Add Quest..."
```

**Reality**:
According to `src/config/xpRewards.ts`:
- Medium difficulty quests award **15 XP**, not 10 XP

**Impact**:
- Users will see they received 15 XP but were told they'd get 10 XP
- Creates confusion and erodes trust in the tutorial
- First-time user experience is negatively affected

**Fix Required**:
Change line 57 to say "(15 XP)" instead of "(10 XP)"

---

### 2. **Incorrect XP Display in Mobile View**
**File**: `src/pages/Tasks.tsx` (Lines 444, 454, 464)
**Severity**: HIGH - Misleading UI information

**Issue**:
The mobile view (screen width < 640px) shows abbreviated XP values:
```tsx
<span className="sm:hidden">5</span>    // Easy - CORRECT
<span className="sm:hidden">10</span>   // Medium - WRONG (should be 15)
<span className="sm:hidden">20</span>   // Hard - WRONG (should be 25)
```

**Reality**:
According to `src/config/xpRewards.ts` (Lines 14-18):
```typescript
export const QUEST_XP_REWARDS = {
  EASY: 5,    // ✓ Matches UI
  MEDIUM: 15, // ✗ UI shows 10
  HARD: 25,   // ✗ UI shows 20
}
```

**Impact**:
- Mobile users see incorrect XP values in the difficulty selector
- The actual XP awarded is correct (uses `getQuestXP()`), but the display is misleading
- Users will be confused when they receive different XP than shown

**Fix Required**:
Update lines 454 and 464 to show correct values:
```tsx
<span className="sm:hidden">15</span>   // Medium
<span className="sm:hidden">25</span>   // Hard
```

---

## ⚠️ INCONSISTENCIES (Should Verify)

### 3. **Maximum Quest Limit Discrepancy**
**Files**: 
- `src/hooks/useDailyTasks.ts` (Line 61)
- `src/pages/Tasks.tsx` (Line 398)

**Issue**:
Two different sources claim different maximum quest limits:

**In useDailyTasks.ts (Line 61)**:
```typescript
if (existingTasks && existingTasks.length >= 4) {
  throw new Error('Maximum 4 tasks per day');
}
```

**In Tasks.tsx UI (Line 398)**:
```tsx
<p className="text-sm text-muted-foreground">Max 3 quests per day</p>
```

**Impact**:
- Users are told they can only add 3 quests
- But the backend allows 4 quests
- Unclear which is the intended behavior

**Recommendation**:
- Determine the correct maximum (likely should be 3)
- Update either the UI or the backend check to match
- Update `useDailyTasks.ts` line 172 which also checks `tasks.length < 4`

---

## 🟡 POTENTIAL ISSUES (Worth Reviewing)

### 4. **Evolution Timeout May Be Too Short**
**File**: `src/components/AppWalkthrough.tsx` (Line 79)
**Severity**: MEDIUM - Could cause tutorial to fail

**Issue**:
```typescript
const TIMEOUTS = {
  EVOLUTION_COMPLETE: 15000, // 15 seconds fallback if evolution doesn't complete
} as const;
```

However, this timeout is **defined but never actually used** in the code!

**Impact**:
- If companion evolution takes longer than expected (slow network, API delays), the tutorial could hang indefinitely
- The comment suggests a fallback should exist, but it's not implemented
- User might get stuck on the last tutorial step

**Recommendation**:
- Either remove the unused constant or implement the timeout fallback
- Add a safety mechanism to complete the tutorial if evolution takes too long

---

### 5. **LocalStorage Quota Exceeded Risk**
**File**: `src/components/TutorialModal.tsx` (Lines 74-91)
**Severity**: LOW - Non-critical feature failure

**Issue**:
The tutorial caches audio in localStorage, which has a limited quota (~5-10MB per domain):

```typescript
try {
  localStorage.setItem(cacheKey, audioDataUrl);
} catch (e) {
  // localStorage might be full, try to clear old tutorial audio
  console.warn('[TutorialModal] Failed to cache audio, attempting to clear old cache:', e);
  // ... cleanup logic ...
}
```

**Impact**:
- If localStorage is full, audio caching will fail
- Tutorial will still work but without audio playback
- Non-critical but degrades user experience

**Current Mitigation**:
- Code attempts to clear old cached tutorial audio and retry
- Falls back gracefully if caching fails
- Not a blocker but could be improved

**Recommendation**:
- Consider using IndexedDB instead of localStorage for audio caching
- Or implement better cache size management
- Add user notification if audio can't play due to storage issues

---

## ✅ VERIFIED WORKING CORRECTLY

### 6. **Event Integration**
**Status**: ✅ Working as designed

All custom events are properly dispatched and listened for:
- ✅ `onboarding-complete` - Dispatched by OnboardingFlow, listened by AppWalkthrough
- ✅ `checkin-complete` - Dispatched by MorningCheckIn, listened by AppWalkthrough
- ✅ `evolution-loading-start` - Dispatched by GlobalEvolutionListener, listened by AppWalkthrough
- ✅ `walkthrough-ready` - Dispatched by AppWalkthrough for other components

### 7. **Data Tour Attributes**
**Status**: ✅ All present and correct

All required `data-tour` attributes exist in their respective components:
- ✅ `data-tour="checkin-mood"` - MorningCheckIn.tsx (Line 195)
- ✅ `data-tour="checkin-intention"` - MorningCheckIn.tsx (Line 200)
- ✅ `data-tour="add-task-input"` - Tasks.tsx (Line 427)
- ✅ `data-tour="add-task-button"` - Tasks.tsx (Line 469)

### 8. **XP Rewards System**
**Status**: ✅ Backend correctly uses centralized config

The actual XP awards use the correct values from `xpRewards.ts`:
- ✅ `useDailyTasks.ts` imports and uses `getQuestXP()` correctly (Line 66)
- ✅ Check-in awards correct 5 XP (Line 98 uses `awardCheckInComplete()`)
- ✅ Backend will award correct XP regardless of UI display bugs

---

## 📋 SUMMARY

### Must Fix (2 issues):
1. ❌ Tutorial says Medium difficulty is 10 XP (should be 15 XP)
2. ❌ Mobile UI shows wrong XP values for Medium (10→15) and Hard (20→25)

### Should Verify (1 issue):
3. ⚠️ Maximum quest limit inconsistency (UI says 3, backend allows 4)

### Worth Reviewing (2 issues):
4. 🟡 Unused evolution timeout constant
5. 🟡 LocalStorage quota risk for audio caching

### Working Correctly:
- ✅ Event system integration
- ✅ Data tour attributes
- ✅ Backend XP calculation

---

## 🛠️ RECOMMENDED FIXES

### Priority 1: Fix XP Value Inaccuracies
1. Update `AppWalkthrough.tsx` line 57: Change "(10 XP)" to "(15 XP)"
2. Update `Tasks.tsx` lines 454 and 464: Change "10" to "15" and "20" to "25"

### Priority 2: Resolve Max Quest Limit
3. Decide on correct maximum (recommend 3 quests per day)
4. Update either UI text or backend validation to match
5. Ensure consistency across all references

### Priority 3: Improve Robustness
6. Implement the evolution timeout fallback or remove unused constant
7. Consider better audio caching strategy (IndexedDB or cache size limits)

---

## 🧪 TESTING RECOMMENDATIONS

After fixes are applied, test the following flow:
1. Complete onboarding with new user account
2. Follow tutorial exactly as instructed
3. Verify mood selection triggers next step
4. Verify check-in completion awards 5 XP
5. Verify companion tab navigation works
6. Verify tasks tab navigation works
7. Add quest with Medium difficulty
8. Verify UI shows 15 XP (not 10)
9. Complete quest to trigger evolution
10. Verify tutorial completes successfully
11. Test on both desktop and mobile views

---

*Report generated by automated code review*
*No linter errors detected in AppWalkthrough.tsx or TutorialModal.tsx*
