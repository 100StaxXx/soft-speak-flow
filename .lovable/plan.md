

# Comprehensive App Synchronization Fix Plan

## Overview

This plan addresses all remaining synchronization gaps in the app to ensure data consistency across views and devices.

---

## Issues to Fix

| Issue | Severity | Impact |
|-------|----------|--------|
| Missing `habit-surfacing` invalidation in EditRitualSheet | High | Quests tab shows stale frequency data after editing |
| Incomplete habits query in useEpicProgress | Medium | Progress tracking missing frequency context |
| Incomplete habits query in useAIInteractionTracker | Low | AI learning missing full habit context |
| No realtime sync for habits/epics | Medium | Cross-device changes require manual refresh |
| App resume not refreshing habit data | Medium | Returning to app shows stale ritual data |

---

## Changes by File

### 1. src/components/EditRitualSheet.tsx

**Location:** Lines 230-233

**Problem:** Missing `habit-surfacing` query invalidation causes Quests tab to show stale frequency/custom_days.

**Fix:** Add the missing invalidation after save.

```typescript
// Current (lines 230-232):
queryClient.invalidateQueries({ queryKey: ['habits'] });
queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
queryClient.invalidateQueries({ queryKey: ['epics'] });

// Updated:
queryClient.invalidateQueries({ queryKey: ['habits'] });
queryClient.invalidateQueries({ queryKey: ['daily-tasks'] });
queryClient.invalidateQueries({ queryKey: ['epics'] });
queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] }); // NEW
queryClient.invalidateQueries({ queryKey: ['epic-progress'] });   // NEW
```

---

### 2. src/hooks/useEpicProgress.ts

**Location:** Lines 56-59

**Problem:** Only fetches `id` and `title` for habits, missing scheduling fields.

**Fix:** Expand the habits query to include frequency context.

```typescript
// Current:
habits(id, title)

// Updated:
habits(id, title, frequency, custom_days)
```

---

### 3. src/hooks/useAIInteractionTracker.ts

**Location:** Lines 238-239

**Problem:** Incomplete habit context for AI learning when tracking epic outcomes.

**Fix:** Expand the habits query.

```typescript
// Current:
.select('habits(difficulty, frequency)')

// Updated:
.select('habits(difficulty, frequency, category, custom_days)')
```

---

### 4. src/hooks/useAppResumeRefresh.ts

**Location:** Lines 43-47 and 72-74

**Problem:** App resume only refreshes profile and mentor data, not habits/epics.

**Fix:** Add habit and epic query invalidations for complete sync on resume.

```typescript
// After profile refetch, add:
queryClient.invalidateQueries({ queryKey: ['habits'] });
queryClient.invalidateQueries({ queryKey: ['habit-surfacing'] });
queryClient.invalidateQueries({ queryKey: ['epics'] });
queryClient.invalidateQueries({ queryKey: ['epic-progress'] });
```

---

## Summary of Changes

| File | Lines Changed | What Changes |
|------|---------------|--------------|
| `EditRitualSheet.tsx` | 230-233 | Add 2 new query invalidations |
| `useEpicProgress.ts` | 58 | Expand habits select by 2 fields |
| `useAIInteractionTracker.ts` | 239 | Expand habits select by 2 fields |
| `useAppResumeRefresh.ts` | 43-47, 72-74 | Add 4 invalidations in both handlers |

---

## Expected Results

After these fixes:

1. Editing a ritual in Campaigns view immediately updates Quests tab
2. Epic progress correctly factors in habit frequency
3. AI learning receives complete habit context for better predictions  
4. Switching apps or tabs refreshes all habit/epic data
5. Cross-device sync works when returning to the app

