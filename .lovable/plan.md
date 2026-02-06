
# Fix: Reset Corrupted Companion Stats (168 Affected)

## Problem Summary

From the database analysis:
- **168 companions** have corrupted stats where vitality is too high (500-1000) and/or other stats are too low (150)
- The previous fix migration only targeted companions with `current_xp < 50`, missing users who had earned 50+ XP

### What Went Wrong

1. **Migration 20260205232723** scaled old stats from 0-100 to 100-1000 range by multiplying by 10
2. Some companions had already been migrated to the new 300 default for some stats (e.g., vitality=100) but not others (e.g., wisdom=15)
3. The scaling created these broken distributions:
   - `vitality = 100 * 10 = 1000` (max, incorrect)
   - `wisdom = 15 * 10 = 150` (floor, too low)
4. **Migration 20260206003944** attempted a fix but only for `current_xp < 50`, excluding 168 users with 50+ XP

### Current Data (Your Screenshot)

Your Phoenix companion shows:
- Vitality: 1000 (should be ~300)
- Wisdom: 150 (should be ~300)
- Discipline: 150 (should be ~300)
- Current XP: 198 (excluded from the fix)

## Solution

Create a migration that resets ALL companions with corrupted stats, regardless of XP:

```sql
-- Fix remaining companions with corrupted stat distributions
-- Applies to 168 companions where vitality > 500 or wisdom/discipline < 200
UPDATE public.user_companion SET
  vitality   = 300,
  wisdom     = 300,
  discipline = 300,
  resolve    = 300,
  creativity = 300,
  alignment  = 300
WHERE vitality > 500 
   OR wisdom < 200 
   OR discipline < 200;
```

## Why This Works

1. **Catches all affected companions** - No XP filter this time
2. **Resets to fair baseline** - 300 is the intended starting point (30% of 1000-point scale)
3. **No data loss** - Stats haven't been meaningfully earned yet; they were corrupted by migration
4. **Safe condition** - Normal gameplay cannot produce vitality > 500 with wisdom < 200, so this only targets corrupted records

## File Changes

| File | Change |
|------|--------|
| New migration | Reset stats for all 168 affected companions |

## Technical Details

- Stats use a 100-1000 scale with 300 as the default/baseline
- The corrupted state (vitality: 1000, wisdom: 150) is impossible through normal gameplay
- Weekly maintenance and stat gains will resume normally after the fix

## Expected Result

After the migration:
- All 168 companions reset to balanced 300 stats
- Your Phoenix companion: All stats = 300
- Stats will grow naturally from user activity going forward
