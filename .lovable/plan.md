

# Fix: Sync Ritual Frequency/Recurrence Across All Views

## Problem Summary

When you update a ritual's frequency or recurrence days, the changes save correctly to the database but don't display in the Campaigns view because the query is missing key fields.

## Data Flow Analysis

| Source | Query Location | Has Required Fields? |
|--------|---------------|---------------------|
| Quests Tab (rituals list) | `useHabitSurfacing.ts` → queries `habits` directly | ✅ Yes - has `frequency`, `custom_days`, `preferred_time`, `category` |
| Campaigns View (JourneyCard) | `useEpics.ts` → queries through `epic_habits` join | ❌ No - missing `custom_days`, `preferred_time`, `category` |

Both views will be properly connected after the fix because:
1. `EditRitualSheet` updates the `habits` table (source of truth)
2. It invalidates both `['epics']` and `['habit-surfacing']` query caches
3. The fix ensures `useEpics` fetches the same fields as `useHabitSurfacing`

## Solution

### File: `src/hooks/useEpics.ts`

Update the habits select statement in the epics query (around line 94):

**Current query:**
```
habits(id, title, difficulty, description, frequency, estimated_minutes)
```

**Updated query:**
```
habits(id, title, difficulty, description, frequency, estimated_minutes, custom_days, preferred_time, category)
```

## Technical Details

This is a one-line change that adds three missing fields to the Supabase select:

| Field | Purpose |
|-------|---------|
| `custom_days` | Array of day indices for custom scheduling (0=Mon through 6=Sun) |
| `preferred_time` | Time string for when the ritual should be scheduled |
| `category` | Mind/Body/Soul categorization for attribute boosts |

## Result

After this fix:
- Both Campaigns view and Quests tab will display identical ritual data
- Frequency changes (Daily → Weekdays → Custom) will immediately reflect everywhere
- Custom day chips (M T W T F S S) will show correctly in both locations
- Preferred time will sync across all views

