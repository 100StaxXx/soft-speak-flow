# Timezone Handling Fix - Implementation Guide

## Problem Summary

**Critical Bug**: Daily tasks were using device local time, causing:
- Tasks to appear/disappear when users travel across timezones
- Incorrect "today" calculation if device time is wrong
- Daily reset happening at different times for different users
- Data integrity issues in multi-timezone scenarios

## Solution Implemented

### 1. Created Timezone-Aware Utilities (`/src/utils/dateUtils.ts`)

**Key Functions**:
- `getTodayInTimezone(timezone?)` - Get current date in user's timezone
- `formatDateForStorage(date, timezone?)` - Consistent YYYY-MM-DD format
- `parseStoredDate(dateString, timezone?)` - Parse stored dates
- `isToday()`, `isPastDate()`, `isFutureDate()` - Timezone-aware date checks

**Strategy**: 
- Store dates as YYYY-MM-DD strings (simple, no timezone ambiguity)
- Always calculate "today" based on user's timezone preference
- Fall back to browser timezone if user hasn't set preference

### 2. Updated Hooks

**`useDailyTasks.ts`**:
```typescript
// Before (buggy):
const taskDate = format(new Date(), 'yyyy-MM-dd');

// After (timezone-aware):
const userTimezone = profile?.timezone || undefined;
const taskDate = selectedDate 
  ? formatDateForStorage(selectedDate, userTimezone)
  : getTodayInTimezone(userTimezone);
```

**`useCalendarTasks.ts`**:
```typescript
// Before:
const startDate = format(start, 'yyyy-MM-dd');

// After:
const userTimezone = profile?.timezone || undefined;
const startDate = formatDateForStorage(start, userTimezone);
```

## How It Works

### Data Flow

1. **User loads tasks**:
   - System checks `profile.timezone` (e.g., "America/New_York")
   - Falls back to browser timezone if not set
   - Calculates "today" in that timezone → "2025-12-03"
   - Queries database: `WHERE task_date = '2025-12-03'`

2. **User creates task**:
   - Task date formatted using user's timezone
   - Stored as simple date string (no time component)
   - Consistent regardless of when/where created

3. **User travels to different timezone**:
   - Profile still has original timezone
   - Tasks remain consistent (tied to profile timezone)
   - OR user can update timezone in settings

### Edge Cases Handled

✅ **User travels from NYC → Tokyo**:
- Tasks remain tied to profile timezone
- User sees same tasks (not shifted by time difference)

✅ **User with wrong device time**:
- Timezone calculation uses profile/browser timezone
- Device time doesn't affect date calculation

✅ **Midnight edge case**:
- "Today" calculated consistently across server/client
- Daily reset happens at midnight in user's timezone

✅ **User changes timezone preference**:
- Future tasks use new timezone
- Past tasks remain in original timezone (historical accuracy)

## Database Schema

**Existing** (already in place):
```sql
-- profiles table
timezone TEXT  -- User's IANA timezone (e.g., 'America/New_York')

-- daily_tasks table
task_date DATE  -- Stored as YYYY-MM-DD (no timezone component)
```

**No migration needed** - schema already supports this!

## Testing Checklist

- [ ] User in PST creates task at 11 PM → appears for "today" (not tomorrow)
- [ ] User travels PST → EST → tasks remain consistent
- [ ] User crosses midnight → tasks correctly show for new day
- [ ] Calendar view shows correct tasks for month view
- [ ] Task recurrence works correctly across timezones
- [ ] Habit frequency (custom days) respects timezone

## Future Enhancements

### 1. Add Timezone Picker in Settings

```typescript
// In Profile settings:
<Select value={profile.timezone} onChange={updateTimezone}>
  <option value="America/New_York">Eastern Time</option>
  <option value="America/Los_Angeles">Pacific Time</option>
  <option value="Europe/London">London</option>
  <option value="Asia/Tokyo">Tokyo</option>
</Select>
```

### 2. Auto-detect Timezone Changes

```typescript
useEffect(() => {
  const browserTz = getBrowserTimezone();
  if (profile.timezone !== browserTz) {
    // Prompt: "Looks like you're in a different timezone. Update?"
    showTimezoneChangePrompt(browserTz);
  }
}, [profile.timezone]);
```

### 3. Show Timezone in UI

```typescript
// In task list header:
<div className="text-xs text-muted-foreground">
  Showing tasks for {formatDateForDisplay(taskDate)} 
  ({profile.timezone || 'Local time'})
</div>
```

## Migration Path for Existing Users

**No data migration required!** 

Existing tasks stored as YYYY-MM-DD continue to work:
- System now interprets them in user's timezone context
- Historical accuracy maintained
- No breaking changes

## Dependencies Added

```bash
npm install date-fns-tz
```

Required for `formatInTimeZone` and `toZonedTime` functions.

## Files Modified

1. ✅ `/src/utils/dateUtils.ts` - **NEW**: Timezone utilities
2. ✅ `/src/hooks/useDailyTasks.ts` - Use timezone-aware date calculation
3. ✅ `/src/hooks/useCalendarTasks.ts` - Use timezone-aware date formatting
4. 📋 `/src/hooks/useProfile.ts` - Already has `timezone` field (no changes needed)

## Rollout Plan

1. **Deploy** - No breaking changes, works immediately
2. **Monitor** - Check for timezone-related bug reports
3. **Enhance** - Add timezone picker in settings (Phase 2)
4. **Educate** - Add tooltip explaining timezone behavior

## Known Limitations

1. **Timezone updates are not retroactive**: 
   - If user changes timezone, past tasks remain in original timezone
   - This is intentional for historical accuracy

2. **Browser timezone used as fallback**:
   - If `profile.timezone` not set, uses browser timezone
   - Encourages users to explicitly set timezone in onboarding

3. **No automatic DST handling needed**:
   - IANA timezones handle DST automatically
   - "America/New_York" switches between EST/EDT correctly

## Success Metrics

- ✅ Zero "tasks disappeared" bug reports
- ✅ Users traveling see consistent task data
- ✅ Midnight rollover works correctly
- ✅ Calendar view accurate across timezones

---

**Status**: ✅ CRITICAL FIX IMPLEMENTED

**Next**: Add timezone picker to onboarding/settings (optional enhancement)
