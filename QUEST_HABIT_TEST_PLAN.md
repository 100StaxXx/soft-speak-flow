# Quest & Habit System - Test Plan

## Critical Flow Validation Checklist

---

## 🎯 QUEST FLOWS

### Quest Creation
- [ ] **New user creates first quest**
  - Expected: Quest created, appears in UI, position 1, gets 100% XP multiplier
  - Edge: No companion loaded yet → should still work

- [ ] **User creates 4 quests in same day**
  - Expected: All 4 created successfully
  - Edge: Quest 4 gets 75% XP multiplier (diminishing returns)

- [ ] **User tries to create 5th quest**
  - Expected: Client shows error "Maximum 4 tasks per day"
  - Fallback: Database trigger blocks at 10 quests

- [ ] **Two users create quest at exact same time (race condition)**
  - Expected: Database count prevents overflow, both succeed up to limit

- [ ] **User creates quest for future date**
  - Expected: Quest created with correct task_date, doesn't show in "Today"

### Quest Completion
- [ ] **User completes a quest (first time)**
  - Expected:
    - Quest marked completed (completed=true, completed_at set)
    - XP awarded exactly once
    - XP toast shows correct amount
    - Evolution check triggered
    - UI updates immediately
    - Companion attributes update in background

- [ ] **User rapid-clicks quest completion (spam test)**
  - Expected:
    - Only ONE update succeeds (database atomic check)
    - XP awarded only once
    - UI shows "Please wait" or ignores subsequent clicks

- [ ] **User tries to complete another user's quest (security)**
  - Expected: RLS policy blocks, error returned

- [ ] **User tries to uncheck completed quest**
  - Expected: Error "Cannot uncheck completed tasks"

- [ ] **Quest completion with Guild Bonus**
  - Expected:
    - Base XP + 10% guild bonus
    - Toast shows "Task Complete! +X Guild Bonus (10%) 🎯"

### Main Quest
- [ ] **User sets quest as Main Quest**
  - Expected:
    - Previous main quest demoted to side quest
    - New quest gets gold border, star badge, 1.5x XP
    - Only one main quest exists per day

- [ ] **User sets Main Quest twice (race condition)**
  - Expected: Database ensures only one main quest per user per day

### Quest Deletion
- [ ] **User deletes incomplete quest**
  - Expected: Quest removed, no XP penalty, slot freed

- [ ] **User tries to delete completed quest**
  - Expected: Delete button hidden in UI

---

## 🔥 HABIT FLOWS

### Habit Creation
- [ ] **New user creates first habit**
  - Expected: Habit created, appears in UI, streak = 0

- [ ] **User creates second habit**
  - Expected: Both habits show, max limit reached

- [ ] **User tries to create third habit**
  - Expected: Client error "Maximum 2 habits allowed"
  - Fallback: Database trigger blocks

- [ ] **Two concurrent habit creations (race condition)**
  - Expected: Database trigger prevents user from having >2 active habits

### Habit Completion
- [ ] **User completes habit (first time today)**
  - Expected:
    - Completion record inserted (unique constraint on habit_id + date)
    - XP awarded based on difficulty (Easy=7, Medium=14, Hard=24)
    - Streak updated (if applicable)
    - Epic progress updates
    - Confetti animation
    - UI shows "Completed today"

- [ ] **User rapid-clicks habit completion (spam test)**
  - Expected:
    - Database unique constraint prevents duplicate
    - Error code 23505 caught gracefully
    - XP awarded only once
    - UI shows completion without XP toast

- [ ] **User unchecks habit completion**
  - Expected:
    - Completion record deleted
    - XP NOT removed (no XP penalty)
    - Epic progress recalculated

### Habit Archiving
- [ ] **User archives one of two habits**
  - Expected:
    - Habit marked is_active=false
    - Disappears from active list
    - Slot freed for new habit

- [ ] **User archives habit with active epic**
  - Expected:
    - Habit archived
    - Epic progress recalculated (may decrease if habit was contributing)

---

## 🏆 EPIC FLOWS

### Epic Creation
- [ ] **User creates epic with 2 habits**
  - Expected:
    - All habits created first
    - Epic created with correct end_date (start_date + target_days)
    - Habits linked to epic
    - Progress = 0%
    - Invite code generated

- [ ] **Epic creation fails after habits created**
  - Expected:
    - Rollback: created habits deleted
    - Error shown to user
    - No orphaned data

- [ ] **User creates epic with 0 habits**
  - Expected: Client validation error "Epic must have at least one habit"

- [ ] **User creates epic with target_days > 365**
  - Expected: Error "Target days must be between 1 and 365"

### Epic Progress
- [ ] **User completes 1 habit on day 1 of 7-day epic**
  - Expected:
    - Epic progress = 14% (1 day / 7 days)
    - Progress log entry created
    - Epic UI updates

- [ ] **User completes all epic habits on day 1**
  - Expected:
    - Still counts as 1 day (progress = 14%)
    - Progress calculation: days with ≥1 habit done, not total habit count

- [ ] **User completes habit NOT linked to any epic**
  - Expected:
    - Habit completes normally
    - No epic progress updated
    - No errors

- [ ] **Epic reaches 100% progress**
  - Expected:
    - Progress bar shows 100%
    - "Complete Epic" button appears
    - Epic still in "active" state until user claims

### Epic Completion
- [ ] **User completes epic at 100% progress**
  - Expected:
    - Epic status → "completed"
    - XP awarded (target_days × 10)
    - Toast: "Epic Completed! 🏆"
    - completed_at timestamp set

- [ ] **User tries to complete epic twice**
  - Expected:
    - Error "Epic is already completed"
    - No duplicate XP

- [ ] **User abandons epic at 50% progress**
  - Expected:
    - Epic status → "abandoned"
    - No XP awarded
    - Habits remain active

---

## 🌐 EDGE CASES & STRESS TESTS

### Timezone & Date Handling
- [ ] **User in different timezone creates quest**
  - Expected: Uses device local time (documented limitation)
  - Note: May see "wrong" date if device time is incorrect

- [ ] **Midnight rollover (11:59 PM → 12:01 AM)**
  - Expected:
    - Old quests remain with yesterday's date
    - New quests get today's date
    - No automatic reset (user must create new quests)

### Network & Error Handling
- [ ] **Quest completion with network error**
  - Expected:
    - Error caught and logged
    - User sees error toast
    - toggleInProgress flag reset
    - Retry on next attempt

- [ ] **Habit completion while offline**
  - Expected:
    - Request queued (if React Query configured)
    - OR error shown immediately
    - No phantom completions

### Concurrent Operations
- [ ] **User completes quest while another user completes their quest**
  - Expected: Both succeed independently (no cross-user interference)

- [ ] **User creates quest while background job creates quest**
  - Expected: Database limit enforced, whoever exceeds limit gets error

### Data Integrity
- [ ] **User deletes habit that's linked to active epic**
  - Expected:
    - Habit deleted (CASCADE)
    - epic_habits link deleted (CASCADE)
    - Epic progress recalculated
    - Epic remains active

- [ ] **Epic with 0 habits (database state)**
  - Expected:
    - Progress calculation handles division by zero
    - No crashes
    - Epic shows 0% progress

---

## ✅ VALIDATION CHECKLIST

Run through these scenarios before marking complete:

**Quest System:**
- [x] Fixed: Quest completion XP duplication
- [x] Fixed: Quest limit bypass (race condition)
- [x] Fixed: Main quest atomic update
- [x] Fixed: Missing error handling

**Habit System:**
- [x] Fixed: Habit completion XP duplication
- [x] Fixed: Habit limit bypass (race condition)
- [x] Fixed: Epic progress trigger (never fired)
- [x] Fixed: Missing null checks

**Epic System:**
- [x] Fixed: Epic creation not transactional
- [x] Fixed: Epic double-completion XP
- [x] Fixed: Habit linking without duplicate check
- [x] Fixed: Epic progress calculation edge cases

**General:**
- [x] All mutations have error handling
- [x] All database calls have null checks
- [x] All user inputs validated
- [x] Database triggers enforce limits
- [x] RLS policies verified

---

## 🚀 PRODUCTION DEPLOYMENT CHECKLIST

Before deploying:
1. [ ] Run database migrations in order:
   - `20251129040000_fix_epic_progress_trigger.sql`
   - `20251129040100_enforce_quest_limits.sql`
   - `20251129040200_enforce_habit_limits.sql`

2. [ ] Test on staging with real user data

3. [ ] Monitor error logs for:
   - Quest completion failures
   - Habit completion failures
   - Epic progress update failures

4. [ ] Verify existing data:
   - Users with >10 quests/day (grandfathered)
   - Users with >2 active habits (should be blocked from adding more)
   - Epics with incomplete progress logs

---

## 📊 MONITORING POST-DEPLOY

Watch for these patterns:
- `MAX_TASKS_REACHED` errors (expected, good)
- `Maximum active habit limit reached` (expected, good)
- `Task was already completed` (race condition caught, good)
- `Epic is already completed` (double-completion prevented, good)
- Unique constraint violations on habit_completions (expected, good)

Any unexpected errors or crashes → rollback and investigate.
