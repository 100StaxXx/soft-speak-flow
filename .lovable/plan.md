

# Implementation Review: Living Companion Talk Popup System

## Critical Issues Found

### 1. **React Rules of Hooks Violation** 🔴 CRITICAL

The implementation calls React hooks inside try/catch blocks in multiple files:

**Files Affected:**
- `src/hooks/useAstralEncounters.ts` (lines 36-42)
- `src/hooks/useXPRewards.ts` (lines 53-62)
- `src/components/EpicCheckInDrawer.tsx` (lines 116-122)
- `src/features/tasks/hooks/useFocusSession.ts` (lines 55-62)

**Problem:**
```typescript
// ❌ WRONG - Hooks inside try/catch
let triggerResistVictory = null;
try {
  const livingCompanion = useLivingCompanion();  // Hook inside try block!
  triggerResistVictory = livingCompanion.triggerResistVictory;
} catch {
  // Context not available
}
```

React hooks must be called unconditionally at the top level. Wrapping them in try/catch means they may not be called on every render, which breaks React's hook ordering.

**Fix:** Call hooks unconditionally and handle missing context gracefully inside the returned functions:
```typescript
// ✅ CORRECT - Hook called unconditionally, context check inside function
const { show } = useTalkPopupContext(); // Will throw if no provider
// OR create a safe version that returns null if no context
```

---

### 2. **Inconsistent Integration Patterns** 🟡 MEDIUM

The integrations use two different approaches:

**Pattern A (useAstralEncounters, useFocusSession):**
Uses `useLivingCompanion()` hook directly

**Pattern B (useXPRewards, EpicCheckInDrawer):**
Manually imports and calls `useTalkPopupContext`, `useReactionBudget`, `useReactionSelector` separately

**Problem:** This duplication creates maintenance burden and inconsistent error handling. The `useLivingCompanion` hook was designed as the central orchestration layer, but it's not being used consistently.

**Fix:** All integrations should use `useLivingCompanion()` as the single entry point.

---

### 3. **Missing "focus_proof" in Config Types** 🟡 MEDIUM

In `src/config/reactionPools.ts`, the `MomentType` union includes `focus_proof`:
```typescript
export type MomentType = 
  | 'momentum_gain'
  | 'quiet_consistency'
  | 'discipline_win'
  | 'urge_defeated'
  | 'comeback'
  | 'breakthrough'
  | 'focus_proof';  // ✅ Present
```

However, `useLivingCompanion.ts` has a `triggerPomodoroComplete` function that uses this correctly. This is fine.

---

### 4. **Duplicate Reaction Trigger in EpicCheckInDrawer** 🟡 MEDIUM

In `EpicCheckInDrawer.tsx`, the `handleToggleRitual` function calls `triggerRitualReaction()` in two places (lines 179 and 191):

```typescript
// Line 179 - when surfacing a new habit
if (!taskId) {
  surfaceHabit(habitId);
  triggerRitualReaction();  // First call
  return;
}

// Line 191 - when toggling existing task
toggleTask({ taskId, completed: true, xpReward: 25 });
triggerRitualReaction();  // Second call (also executed after surfaceHabit returns!)
```

**Problem:** The early return on line 180 prevents the duplicate, but the code structure is confusing. The reaction should only trigger once per ritual completion.

---

### 5. **No Safe Context Hook Pattern** 🟡 MEDIUM

The `useTalkPopupContext` throws an error if used outside `TalkPopupProvider`:
```typescript
export const useTalkPopupContext = () => {
  const context = useContext(TalkPopupContext);
  if (!context) {
    throw new Error('useTalkPopupContext must be used within TalkPopupProvider');
  }
  return context;
};
```

**Problem:** This is why try/catch was used (incorrectly). A better pattern is to create a safe version that returns a no-op function when context is unavailable.

**Fix:** Add a safe hook variant:
```typescript
export const useTalkPopupContextSafe = () => {
  const context = useContext(TalkPopupContext);
  if (!context) {
    return {
      show: async () => {},
      dismiss: () => {},
      isVisible: false,
    };
  }
  return context;
};
```

---

## Recommended Fixes

### Fix 1: Create Safe Hook Variants

Create `useLivingCompanionSafe()` that returns no-op functions when context is unavailable:

```typescript
export const useLivingCompanionSafe = () => {
  const talkPopup = useContext(TalkPopupContext);
  // If no context, return no-op versions
  if (!talkPopup) {
    return {
      triggerReaction: async () => false,
      triggerResistVictory: async () => false,
      triggerQuestComplete: async () => false,
      triggerRitualComplete: async () => false,
      triggerPomodoroComplete: async () => false,
      triggerComeback: async () => false,
      isLateNight: () => false,
    };
  }
  // Otherwise use the full implementation
  return useLivingCompanion();
};
```

### Fix 2: Update All Integrations

Replace try/catch hook patterns with safe hooks:

**useAstralEncounters.ts:**
```typescript
const { triggerResistVictory } = useLivingCompanionSafe();
```

**useXPRewards.ts:**
```typescript
const { triggerReaction } = useLivingCompanionSafe();
// Use triggerReaction('quest', { momentType: 'momentum_gain' })
```

**EpicCheckInDrawer.tsx:**
```typescript
const { triggerRitualComplete } = useLivingCompanionSafe();
```

**useFocusSession.ts:**
```typescript
const { triggerPomodoroComplete } = useLivingCompanionSafe();
```

### Fix 3: Simplify Integration Code

Remove the duplicate manual budget/selector logic from `useXPRewards` and `EpicCheckInDrawer`. They should use `useLivingCompanion` functions that already handle budget, selection, and recording internally.

---

## Summary Table

| Issue | Severity | Impact | Files Affected |
|-------|----------|--------|----------------|
| Hooks in try/catch | 🔴 Critical | React errors, unpredictable behavior | 4 files |
| Inconsistent patterns | 🟡 Medium | Maintenance burden | 4 files |
| Duplicate trigger | 🟡 Medium | Potential double popups | 1 file |
| Missing safe hook | 🟡 Medium | Forces bad patterns | 1 file |

---

## Implementation Order

1. **Create safe hook variants** in `TalkPopupContext.tsx` and `useLivingCompanion.ts`
2. **Update useAstralEncounters.ts** - replace try/catch with safe hook
3. **Update useFocusSession.ts** - replace try/catch with safe hook  
4. **Update useXPRewards.ts** - replace manual logic with safe hook
5. **Update EpicCheckInDrawer.tsx** - replace manual logic with safe hook
6. **Test all trigger points** - Quest, Ritual, Resist, Pomodoro

