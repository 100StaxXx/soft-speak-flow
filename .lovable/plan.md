

# Implementation Tightening: 5 Final Nits

This plan addresses the 5 implementation details you identified before shipping the 6-stat Engagement Gate system.

---

## Nit 1: Verify `profiles.created_at` Exists

**Status**: ✅ Already exists

The `profiles` table already has `created_at: string | null` (confirmed in types.ts line 5061).

**Minor adjustment needed**: Handle null gracefully in `isNewUser()`:

```typescript
async function isNewUser(supabase: any, userId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .single();
    
  // If no profile or no created_at, treat as new user (safe default)
  if (!profile?.created_at) return true;
  
  const accountAge = Math.floor(
    (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  return accountAge < 7;
}
```

---

## Nit 2: Rotate `last_7_days_activity` Before Sunday Logic

**Status**: ⚠️ Needs explicit sequencing

**Current behavior**: 
- `handleActiveDay` rotates array correctly
- `handleInactiveDay` rotates array correctly
- But Sunday reset could overwrite before counting

**Correct sequence for Sunday**:

```text
STEP 1: Rotate array first (add today's activity)
        → activeDays count is now accurate

STEP 2: Run Sunday maintenance check
        → Uses accurate activeDays

STEP 3: Reset array for new week
        → last_7_days_activity = [false, false, false, false, false, false, false]
```

**Code adjustment** (in edge function Sunday path):

```typescript
// STEP 1: Rotate array first (before Sunday check)
const last7Days = companion.last_7_days_activity ?? [];
const todayActivity = wasActive; // true or false
const updated7Days = [todayActivity, ...last7Days.slice(0, 6)];

// STEP 2: Count active days from the ROTATED array
const activeDays = updated7Days.filter(Boolean).length;

// STEP 3: Run Sunday maintenance using activeDays
if (isSunday) {
  // ... engagement gate + maintenance logic using activeDays ...
  
  // STEP 4: Reset for new week (only after maintenance processed)
  await supabase
    .from("user_companion")
    .update({
      last_7_days_activity: [false, false, false, false, false, false, false],
      last_weekly_maintenance_date: todayISO,
      // ... other updates
    })
    .eq("id", companion.id);
}
```

---

## Nit 3: User-Local Sunday (MVP Acceptable)

**Status**: ⚠️ MVP acceptable, document for future

**Current behavior**: Edge function uses UTC via `new Date().toISOString()`

**Why UTC is acceptable for MVP**:
- Most users won't notice Sunday boundary edge cases
- Maintenance is weekly, not daily, so slight timezone misalignment is minor
- `profiles.timezone` already exists for future use

**Future improvement** (post-MVP):

```typescript
function isUserLocalSunday(timezone: string | null): boolean {
  const tz = timezone || 'UTC';
  const formatter = new Intl.DateTimeFormat('en-US', { 
    weekday: 'short', 
    timeZone: tz 
  });
  const dayName = formatter.format(new Date());
  return dayName === 'Sun';
}

// Usage
const { data: profile } = await supabase
  .from('profiles')
  .select('timezone')
  .eq('id', companion.user_id)
  .single();

const isSunday = isUserLocalSunday(profile?.timezone);
```

**For now**: Add a comment in the code noting this is a known limitation.

---

## Nit 4: Skip Logs/Messages When `stats_enabled=false`

**Status**: ✅ Plan handles it, verify no side effects

**Current plan** (correct):

```typescript
if (!engagement.statsEnabled) {
  // Skip all stat logic entirely - no logging, no messages
  return;
}
```

**Verification checklist**:
- No `console.log()` before the early return
- No toast/notification triggered
- No database writes for maintenance tracking
- Function exits cleanly

**Code pattern**:

```typescript
async function handleSundayMaintenance(supabase: any, companion: UserCompanion) {
  const engagement = await getEngagementStatus(supabase, companion.user_id);
  
  // Silent exit for stats-disabled users
  if (!engagement.statsEnabled) {
    return; // No logs, no messages, no DB updates
  }
  
  // ... rest of logic ...
}
```

---

## Nit 5: Rename Function File (Optional)

**Status**: ⚠️ Recommended but not blocking

**Current**: `supabase/functions/process-daily-decay/index.ts`
**Recommended**: `supabase/functions/process-weekly-maintenance/index.ts`

**Why rename**:
- "Decay" implies daily punishment (old mental model)
- "Maintenance" aligns with new "Maintenance Check" language
- Reduces confusion for future development

**Migration steps** (if doing this):
1. Create new folder `supabase/functions/process-weekly-maintenance/`
2. Copy/refactor index.ts
3. Update any cron jobs or function invocations
4. Delete old function folder
5. Redeploy

**Recommendation**: Do this as a separate follow-up PR, not part of the main 6-stat migration. The function name doesn't affect functionality.

---

## Summary of Changes

| Nit | Status | Action |
|-----|--------|--------|
| 1. `profiles.created_at` | ✅ Already exists | Handle null gracefully |
| 2. Rotate array before Sunday | ⚠️ Needs fix | Explicit 4-step sequence |
| 3. User-local Sunday | ⚠️ MVP acceptable | Add TODO comment |
| 4. `stats_enabled=false` silent | ✅ Plan correct | Verify no side effects |
| 5. Rename function | ⚠️ Optional | Follow-up PR |

---

## Updated Edge Function Pseudocode (Final)

```typescript
serve(async (req) => {
  // ... setup ...

  for (const companion of companions) {
    const wasActive = checkIfActiveYesterday(companion);
    
    // ALWAYS rotate array first (before any Sunday logic)
    const last7Days = companion.last_7_days_activity ?? [];
    const updated7Days = [wasActive, ...last7Days.slice(0, 6)];
    const activeDays = updated7Days.filter(Boolean).length;
    
    const isSunday = new Date().getDay() === 0; // UTC for MVP
    
    if (isSunday) {
      // Check if already processed today
      if (companion.last_weekly_maintenance_date === todayISO) {
        continue;
      }
      
      // Get engagement status
      const engagement = await getEngagementStatus(supabase, companion.user_id);
      
      // Silent exit for stats-disabled users
      if (!engagement.statsEnabled) {
        continue; // No logs, no messages
      }
      
      // Grace period for new users
      if (await isNewUser(supabase, companion.user_id)) {
        console.log(`[Maintenance] User ${companion.user_id} in grace period`);
        await updateMaintenanceRecord(supabase, companion.id, todayISO);
        continue;
      }
      
      // Check engagement gate
      if (!engagement.isEngaged) {
        console.log(`[Maintenance] User ${companion.user_id} not engaged. Stats held steady.`);
        await updateMaintenanceRecord(supabase, companion.id, todayISO);
        continue;
      }
      
      // Apply maintenance based on activeDays
      await applyWeeklyMaintenance(supabase, companion, activeDays, engagement, todayISO);
    } else {
      // Not Sunday - just update daily tracking
      await supabase
        .from("user_companion")
        .update({ last_7_days_activity: updated7Days })
        .eq("id", companion.id);
    }
    
    // ... rest of daily companion processing ...
  }
});
```

---

## Implementation Order

1. **First**: Apply database migrations (add creativity, stat_mode, etc.)
2. **Second**: Update edge function with Nits 1-4 integrated
3. **Third**: Update frontend (6 stats, 2x3 grid)
4. **Later**: Rename function file (Nit 5) in follow-up PR

