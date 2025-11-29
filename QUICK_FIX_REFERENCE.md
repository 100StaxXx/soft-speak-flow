# Quest & Habit System - Quick Fix Reference

## 🚨 What Was Broken

### Critical (P0)
1. **Habit XP Duplication** - Spam clicking gave infinite XP
2. **Epic Progress Never Updated** - Database trigger had wrong field name
3. **Epic Double Completion** - Could claim XP twice
4. **Quest Race Conditions** - Concurrent completions could duplicate XP

### Major (P1)
5. **Quest Limit Bypass** - Could create >4 quests via race condition
6. **Habit Limit Bypass** - Could create >2 habits via race condition
7. **Epic Creation Not Atomic** - Orphaned habits if epic creation failed
8. **Tutorial Quest Spam** - "Join R-Evolution" created multiple times
9. **Main Quest Not Atomic** - Two quests could be main simultaneously

### Moderate (P2)
10. **Missing Error Handling** - Many mutations had no try/catch
11. **No Input Validation** - Missing null checks, ID validation
12. **Timezone Edge Cases** - Documented but not fixed (design choice)

---

## ✅ What Was Fixed

### Code Changes
- **src/pages/Tasks.tsx**: Habit completion now atomic (unique constraint check)
- **src/hooks/useDailyTasks.ts**: Better error handling, null checks, atomic operations
- **src/hooks/useEpics.ts**: Transactional epic creation, double-completion prevention
- **src/components/HabitCard.tsx**: Added ID validation

### Database Migrations
1. **20251129040000_fix_epic_progress_trigger.sql**
   - Fixed broken trigger that never fired
   - Removed invalid `completed` field check

2. **20251129040100_enforce_quest_limits.sql**
   - Database-level 10 quest limit per day
   - Prevents race conditions

3. **20251129040200_enforce_habit_limits.sql**
   - Database-level 2 active habit limit
   - Prevents concurrent creation bypass

---

## 🎯 Critical Fixes Explained

### 1. Habit XP Duplication Fix
**Location**: `src/pages/Tasks.tsx` (toggleHabitMutation)

```typescript
// ❌ BEFORE: Race condition
const { data: existing } = await check()
if (!existing) {
  await insert()
  awardXP() // Could run multiple times!
}

// ✅ AFTER: Atomic with unique constraint
const { data, error } = await insert().select()
if (error?.code === '23505') {
  // Already completed, skip XP
  return { isFirstCompletion: false }
}
if (data?.length > 0) {
  awardXP() // Only runs once!
}
```

**Why This Works**:
- Database unique constraint on `(habit_id, date)` is atomic
- Insert either succeeds (first completion) or fails with error 23505 (duplicate)
- XP only awarded if insert returned data

---

### 2. Epic Progress Trigger Fix
**Location**: `supabase/migrations/20251129040000_fix_epic_progress_trigger.sql`

```sql
-- ❌ BEFORE: Never executed
IF NEW.completed = true AND (OLD IS NULL OR OLD.completed = false) THEN
  -- habit_completions table has NO 'completed' field!

-- ✅ AFTER: Executes on every insert
-- Trigger on INSERT only, no field check needed
FOR epic_record IN SELECT ... LOOP
  -- Update epic progress
END LOOP;
```

**Why This Works**:
- `habit_completions` is insert-only (no updates)
- Just fire on INSERT, no conditional needed
- Progress calculation uses COUNT of completions

---

### 3. Epic Double Completion Fix
**Location**: `src/hooks/useEpics.ts` (updateEpicStatus)

```typescript
// ❌ BEFORE: No check
const { data: epic } = await fetch()
await update({ status: 'completed' })
awardXP() // Always runs!

// ✅ AFTER: Check current status
const { data: epic } = await fetch()
if (epic.current_status === 'completed') {
  throw new Error('Epic is already completed')
}
await update({ status: 'completed' })
if (!wasAlreadyCompleted) awardXP()
```

**Why This Works**:
- Fetch current status before updating
- Block if already completed
- Only award XP on first completion

---

### 4. Quest Limit Enforcement
**Location**: `supabase/migrations/20251129040100_enforce_quest_limits.sql`

```sql
-- Database trigger enforces hard limit
CREATE TRIGGER enforce_daily_quest_limit
  BEFORE INSERT ON daily_tasks
  FOR EACH ROW
  EXECUTE FUNCTION check_daily_quest_limit();
```

**Why This Works**:
- Runs BEFORE insert, checks count
- Atomic at database level (no race conditions)
- Set to 10 quests as safety limit (UX shows 4)

---

## 🧪 How to Test

### Quick Smoke Test
```bash
# 1. Complete a quest (check XP awarded once)
# 2. Rapid-click quest completion (should prevent duplicate)
# 3. Create 4 quests (all succeed)
# 4. Try creating 5th quest (should fail)
# 5. Complete a habit (check epic progress updates)
```

### Full Test Suite
See `QUEST_HABIT_TEST_PLAN.md` for comprehensive checklist.

---

## 🚀 Deployment Steps

1. **Run migrations**:
   ```sql
   -- In Supabase dashboard or via CLI
   psql $DATABASE_URL -f supabase/migrations/20251129040000_fix_epic_progress_trigger.sql
   psql $DATABASE_URL -f supabase/migrations/20251129040100_enforce_quest_limits.sql
   psql $DATABASE_URL -f supabase/migrations/20251129040200_enforce_habit_limits.sql
   ```

2. **Deploy code changes**:
   - All changes are backward compatible
   - No breaking changes to API
   - Safe to deploy without downtime

3. **Monitor for 24 hours**:
   - Watch error logs for unexpected failures
   - Check XP audit logs for anomalies
   - Verify epic progress updates correctly

---

## 📞 If Something Breaks

### Quest completion fails
- Check: `toggleInProgress` ref is being reset
- Check: Database has `completed` field
- Check: User has permission (RLS)

### Habit completion fails
- Check: Unique constraint on habit_completions
- Check: Epic trigger is enabled
- Check: habit_id is valid UUID

### Epic progress not updating
- Check: Trigger `update_epic_progress_on_habit_completion` exists
- Check: Function `update_epic_progress()` has no errors
- Check: epic_habits links are correct

### Users report XP duplication
- Check: Code is using the fixed version
- Check: Database trigger is enabled
- Check: No custom mutations bypassing our logic

---

## 📊 Success Metrics

After deployment, expect:
- ✅ Zero XP duplication reports
- ✅ Zero "more than 10 quests" reports
- ✅ Epic progress updates in real-time
- ✅ Error rate <0.1% on quest/habit operations

---

## 🎓 Lessons Learned

1. **Always use database constraints for limits** - Client-side checks are UX, not security
2. **Race conditions are real** - Atomic operations at database level prevent them
3. **Unique constraints are your friend** - They provide free atomicity
4. **Validate inputs early** - Null checks save crashes
5. **Database triggers must match schema** - Test trigger code carefully
6. **Rollback logic is critical** - Multi-step operations need cleanup on failure

---

## 🔗 Related Files

- `BUG_FIXES_SUMMARY.md` - Detailed bug descriptions
- `QUEST_HABIT_TEST_PLAN.md` - Comprehensive test checklist
- `supabase/migrations/20251129*` - Database fixes
