
# Fix: Remove Body Dependency and Reset Incorrectly Scaled Vitality

## Problem Analysis

The `vitality` stat is maxed at 1000 because of a cascading migration issue:

```text
Current State:
┌──────────────────────────────────────────────────────────────────┐
│ Column    │ Current Value │ Expected Value │ Status              │
├───────────┼───────────────┼────────────────┼─────────────────────┤
│ vitality  │ 1000          │ 300            │ BROKEN              │
│ body      │ 100           │ (legacy)       │ Should be removed   │
│ wisdom    │ 150           │ 300            │ Low                 │
│ discipline│ 150           │ 300            │ Low                 │
│ alignment │ 150           │ 300            │ Low                 │
│ resolve   │ 300           │ 300            │ OK                  │
│ creativity│ 220           │ 300            │ Low                 │
└──────────────────────────────────────────────────────────────────┘
```

**Root Cause**: The stat scaling migration (`20260205232716`) ran after your companion was created and **unconditionally** multiplied all stats by 10. Since `body` defaulted to 100, vitality was set to 100 (from body), then scaled to 1000.

## Solution

### Part 1: Fix existing companions with incorrect stat scaling

Create a one-time data fix migration that:
1. Resets all 6 stats to proper starting values for companions that haven't progressed
2. Only affects companions at stage 0 with minimal XP (fresh companions)

```sql
-- Reset stats for fresh companions that were incorrectly scaled
UPDATE public.user_companion SET
  vitality   = 300,
  wisdom     = 300,
  discipline = 300,
  resolve    = 300,
  creativity = 300,
  alignment  = 300
WHERE current_stage = 0 
  AND current_xp < 50
  AND (vitality = 1000 OR wisdom < 200 OR discipline < 200);
```

### Part 2: Remove legacy `body`, `mind`, `soul` columns

The old attribute system (body/mind/soul) is no longer used and causes confusion. However, this needs careful handling because:
- Some code still references these columns for card generation
- The `create_companion_if_not_exists` function returns these columns

**Files to update:**
1. `supabase/functions/_shared/cardMath.ts` - Update to use new 6-stat system
2. `src/hooks/useCompanion.ts` - Remove body/mind/soul references in edge function calls
3. Edge functions that use `userAttributes: { body, mind, soul }` - Update to new stats

### Part 3: Database cleanup (optional, can be done later)

After code is updated:
1. Drop `body`, `mind`, `soul` columns from `user_companion`
2. Update `create_companion_if_not_exists` function to not return these columns

## Implementation Order

1. **Migration**: Reset stats for fresh companions (immediate fix)
2. **Code update**: Remove body/mind/soul references from card generation
3. **Testing**: Verify your companion shows vitality = 300
4. **Later**: Drop legacy columns once confirmed working

## Files to Change

| File | Change |
|------|--------|
| `supabase/migrations/[new]_fix_companion_stats.sql` | Reset incorrectly scaled stats |
| `src/hooks/useCompanion.ts` | Remove body/mind/soul from edge function calls |
| `supabase/functions/_shared/cardMath.ts` | Update to use 6-stat system (vitality, wisdom, etc.) |

## Expected Result

After the fix:
- Your companion's vitality will show **300** (proper starting value)
- All 6 stats will start at 300 for fresh companions
- The `body` column will no longer impact new companions
- Card generation will use the new stat system
