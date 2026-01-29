
# High Priority Fixes: Unsafe Queries & Sound Fix Audit

## Overview

This plan addresses the two highest-impact issues identified in the audit:

1. **Unsafe `.single()` queries** → Convert to `.maybeSingle()` where data may not exist
2. **Missing `ensureAudioContext()` in remaining sound methods** → Audit and fix

---

## Issue 1: Unsafe `.single()` Queries

### The Problem
`.single()` throws a **runtime error** if 0 or 2+ rows are returned. This causes crashes when:
- User has no data yet (new users)
- Data was deleted
- Query conditions match nothing

### Analysis of 280+ Occurrences

After reviewing the codebase, the `.single()` calls fall into two categories:

| Category | Action | Count |
|----------|--------|-------|
| **Safe** - After `.insert()` or `.update()` (guaranteed 1 row) | Keep as-is | ~180 |
| **Unsafe** - SELECT queries where data may not exist | Convert to `.maybeSingle()` | ~15 files |

### Files Requiring Changes

| File | Line(s) | Context | Fix |
|------|---------|---------|-----|
| `src/features/epics/hooks/useWelcomeImage.ts` | 19 | Checks if user has cached image | `.maybeSingle()` |
| `src/hooks/useCompanionDialogue.ts` | 49 | Fetches voice template by species | `.maybeSingle()` |
| `src/hooks/useGuildShouts.ts` | 121 | Fetches sender's profile | `.maybeSingle()` |
| `src/hooks/useAstralEncounters.ts` | 214, 325, 426 | Fetches encounter/habit data | `.maybeSingle()` |
| `src/hooks/useCompanionMemories.ts` | 113, 165 | Fetches bond level/memory count | `.maybeSingle()` |
| `src/hooks/useEpicProgress.ts` | 164 | Fetches epic by ID | `.maybeSingle()` + null check |
| `src/hooks/useLegacyTraits.ts` | 84 | Fetches existing traits | `.maybeSingle()` |
| `src/hooks/useMilestoneSurfacing.ts` | 108 | Checks for existing task | `.maybeSingle()` |
| `src/hooks/useAIInteractionTracker.ts` | 232 | Fetches epic details | `.maybeSingle()` |
| `src/components/journey/SmartRescheduleAdvisor.tsx` | 61, 108 | Fetches epic/log data | `.maybeSingle()` |

### Implementation Pattern

**Before (unsafe):**
```typescript
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', someId)
  .single();

if (error) throw error;
doSomething(data.field); // CRASH if no row exists
```

**After (safe):**
```typescript
const { data, error } = await supabase
  .from('table')
  .select('*')
  .eq('id', someId)
  .maybeSingle();

if (error) throw error;
if (!data) return; // Graceful early return or handle null case
doSomething(data.field);
```

---

## Issue 2: Sound Effects Audio Context

### The Problem
The `playStrikethrough()` fix was applied, but other sound methods may also need the `ensureAudioContext()` call for iOS compatibility.

### Audit Required
Review `src/utils/soundEffects.ts` to ensure ALL public sound methods that use oscillators call `ensureAudioContext()`.

### Expected Pattern
```typescript
async playXyz() {
  if (this.shouldMute()) return;
  await this.ensureAudioContext();
  if (!this.audioContext) return;
  // ... create oscillators
}
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/features/epics/hooks/useWelcomeImage.ts` | `.single()` → `.maybeSingle()` |
| `src/hooks/useCompanionDialogue.ts` | `.single()` → `.maybeSingle()` + null handling |
| `src/hooks/useGuildShouts.ts` | `.single()` → `.maybeSingle()` + null handling |
| `src/hooks/useAstralEncounters.ts` | 3 occurrences → `.maybeSingle()` |
| `src/hooks/useCompanionMemories.ts` | 2 occurrences → `.maybeSingle()` |
| `src/hooks/useEpicProgress.ts` | `.single()` → `.maybeSingle()` + null guard |
| `src/hooks/useLegacyTraits.ts` | `.single()` → `.maybeSingle()` |
| `src/hooks/useMilestoneSurfacing.ts` | `.single()` → `.maybeSingle()` |
| `src/hooks/useAIInteractionTracker.ts` | `.single()` → `.maybeSingle()` |
| `src/components/journey/SmartRescheduleAdvisor.tsx` | 2 occurrences → `.maybeSingle()` |
| `src/utils/soundEffects.ts` | Audit all methods for `ensureAudioContext()` |

---

## Technical Notes

### Why Keep `.single()` After INSERT/UPDATE?
When you call `.insert().select().single()` or `.update().select().single()`, you're guaranteed exactly 1 row is affected, so `.single()` is appropriate.

### Why `.maybeSingle()` for SELECT?
SELECT queries with `.eq()` filters may return 0 rows. Using `.single()` throws an error; `.maybeSingle()` returns `null` gracefully.

---

## Estimated Impact

- **Prevents ~15 potential runtime crashes** for edge cases (new users, missing data)
- **Improves iOS sound reliability** for all audio feedback
- **No breaking changes** - only safer error handling
