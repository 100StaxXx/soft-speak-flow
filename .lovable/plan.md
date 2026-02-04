

# Change Daily Missions Reset to 2 AM User Timezone

## Overview

Shift the daily missions reset from midnight to 2 AM in the user's local timezone, providing a more predictable experience for users who may be awake past midnight.

## Current Behavior

| Component | Time Source | Reset Point |
|-----------|-------------|-------------|
| Frontend query key | Device local time | Midnight local |
| Edge function | Server UTC | Midnight UTC |

This creates inconsistencies where missions might reset at unexpected times for users in different timezones.

## New Behavior

Missions reset at **2 AM in the user's timezone**. This means:
- A user in New York (EST) gets new missions at 2 AM EST
- A user in Tokyo (JST) gets new missions at 2 AM JST
- Users who stay up past midnight still see the same missions until 2 AM

## Technical Implementation

### 1. Create a Timezone Utility (`src/utils/timezone.ts`)

New helper function to calculate the "effective date" for missions:

```typescript
export function getEffectiveMissionDate(userTimezone?: string): string {
  // Get current time in user's timezone
  const now = new Date();
  const tz = userTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  
  // Get local hour in user's timezone
  const localHour = parseInt(
    new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      hour12: false, 
      timeZone: tz 
    }).format(now)
  );
  
  // If before 2 AM, use previous day's date
  if (localHour < 2) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toLocaleDateString('en-CA');
  }
  
  return now.toLocaleDateString('en-CA');
}
```

### 2. Update Frontend Hook (`src/hooks/useDailyMissions.ts`)

Replace the simple date calculation:

```typescript
// Before
const today = new Date().toLocaleDateString('en-CA');

// After
import { getEffectiveMissionDate } from '@/utils/timezone';
const today = getEffectiveMissionDate();
```

### 3. Store User Timezone in Profile

Add a `timezone` column to the `profiles` table to persist user timezone:

```sql
ALTER TABLE profiles ADD COLUMN timezone TEXT;
```

Capture timezone on login/app load:

```typescript
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
await supabase.from('profiles').update({ timezone }).eq('id', user.id);
```

### 4. Update Edge Function (`supabase/functions/generate-daily-missions/index.ts`)

Modify the date calculation to respect user timezone:

```typescript
// Get user's timezone from profile
const { data: profile } = await supabase
  .from('profiles')
  .select('current_habit_streak, timezone')
  .eq('id', userId)
  .maybeSingle();

const userTimezone = profile?.timezone || 'UTC';
const today = getEffectiveMissionDate(userTimezone);
const dayOfWeek = getEffectiveDayOfWeek(userTimezone);
```

### 5. Update Habit Surfacing Hook (`src/hooks/useHabitSurfacing.ts`)

Apply the same 2 AM reset logic for consistency:

```typescript
import { getEffectiveMissionDate } from '@/utils/timezone';
const taskDate = getEffectiveMissionDate();
```

## Files to Modify

| File | Change |
|------|--------|
| `src/utils/timezone.ts` | **Create** - New timezone utility with `getEffectiveMissionDate()` |
| `src/hooks/useDailyMissions.ts` | Use `getEffectiveMissionDate()` instead of raw date |
| `src/hooks/useHabitSurfacing.ts` | Use `getEffectiveMissionDate()` for consistency |
| `src/hooks/useAuth.ts` or similar | Capture and save user timezone to profile |
| `supabase/functions/generate-daily-missions/index.ts` | Read user timezone and calculate effective date |
| Database migration | Add `timezone` column to `profiles` table |

## Edge Cases Handled

1. **User travels across timezones**: Timezone is updated on each app load, missions adjust accordingly
2. **No timezone stored**: Falls back to UTC on server, device timezone on client
3. **User awake at 1:59 AM**: Still sees yesterday's missions until 2:00 AM
4. **Day-of-week themes**: Theme is also calculated using the effective date, so "Momentum Monday" shows correctly after 2 AM

## Result

Users will experience a consistent 2 AM reset for daily missions in their local timezone, regardless of where the server is located.

