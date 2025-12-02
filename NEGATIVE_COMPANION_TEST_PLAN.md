# Negative Companion System - Testing Plan

## Manual Testing Checklist

### Prerequisites
1. Have a test account with an active companion
2. Access to Supabase dashboard for direct database manipulation
3. Access to edge function logs

---

## Test Suite 1: Database & Schema

### Test 1.1: Verify Migration
```sql
-- Check user_companion columns
SELECT 
  column_name, 
  data_type, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'user_companion' 
  AND column_name IN ('neglected_image_url', 'last_activity_date', 'inactive_days');

-- Expected: 3 rows returned with correct types

-- Check profiles columns
SELECT 
  column_name, 
  data_type, 
  column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('streak_freezes_available', 'last_streak_freeze_used', 'streak_freezes_reset_at');

-- Expected: 3 rows returned with correct types
```

**Expected Results**:
- ✅ `neglected_image_url`: TEXT, NULL
- ✅ `last_activity_date`: DATE, CURRENT_DATE
- ✅ `inactive_days`: INTEGER, 0
- ✅ `streak_freezes_available`: INTEGER, 1
- ✅ `last_streak_freeze_used`: TIMESTAMP, NULL
- ✅ `streak_freezes_reset_at`: TIMESTAMP, CURRENT_TIMESTAMP + 7 days

### Test 1.2: Verify Indexes
```sql
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('user_companion', 'profiles')
  AND indexname IN ('idx_user_companion_inactive_days', 'idx_profiles_streak_freezes_reset');
```

**Expected Results**:
- ✅ Both indexes exist
- ✅ Index on `user_companion(inactive_days)`
- ✅ Index on `profiles(streak_freezes_reset_at)`

### Test 1.3: Check Default Values
```sql
-- Create a test companion (or check existing)
SELECT 
  inactive_days, 
  last_activity_date,
  neglected_image_url 
FROM user_companion 
WHERE user_id = '<test_user_id>';

-- Create a test profile (or check existing)
SELECT 
  streak_freezes_available,
  streak_freezes_reset_at
FROM profiles 
WHERE id = '<test_user_id>';
```

**Expected Results**:
- ✅ New companions: `inactive_days = 0`, `last_activity_date = today`
- ✅ New profiles: `streak_freezes_available = 1`, `streak_freezes_reset_at ~= 7 days from now`

---

## Test Suite 2: Edge Function - Daily Decay

### Test 2.1: Manual Invoke (Inactive User)
**Setup**:
```sql
-- Set test user to inactive (2 days ago)
UPDATE user_companion 
SET 
  last_activity_date = CURRENT_DATE - INTERVAL '2 days',
  inactive_days = 2,
  current_mood = 'worried',
  body = 90,
  mind = 80,
  soul = 75
WHERE user_id = '<test_user_id>';
```

**Action**: Invoke `process-daily-decay` via Supabase dashboard

**Verification**:
```sql
SELECT 
  inactive_days,    -- Should be 3
  current_mood,     -- Should be 'sad'
  body,            -- Should be 85 (90 - 5)
  mind,            -- Should be 75 (80 - 5)
  soul,            -- Should be 70 (75 - 5)
  neglected_image_url  -- Should have URL OR null (if image gen failed)
FROM user_companion 
WHERE user_id = '<test_user_id>';
```

**Expected Results**:
- ✅ `inactive_days` incremented by 1
- ✅ Stats decreased by 5 each
- ✅ Mood changed to 'sad'
- ✅ Image generation triggered (check logs)

### Test 2.2: Recovery on Activity
**Setup**:
```sql
-- Set user to inactive
UPDATE user_companion 
SET 
  inactive_days = 3,
  current_mood = 'sad',
  body = 70,
  mind = 60,
  soul = 50
WHERE user_id = '<test_user_id>';

-- Simulate activity (complete a habit)
INSERT INTO habit_completions (user_id, habit_id, date, completed)
VALUES ('<test_user_id>', '<habit_id>', CURRENT_DATE - INTERVAL '1 day', true);
```

**Action**: Invoke `process-daily-decay`

**Verification**:
```sql
SELECT 
  inactive_days,    -- Should be 0 (reset)
  current_mood,     -- Should be 'happy'
  body,            -- Should be 80 (70 + 10 recovery bonus, capped)
  mind,            -- Should be 70 (60 + 10)
  soul             -- Should be 60 (50 + 10)
FROM user_companion 
WHERE user_id = '<test_user_id>';
```

**Expected Results**:
- ✅ `inactive_days` reset to 0
- ✅ Stats increased by +10 (recovery bonus)
- ✅ Mood changed to 'happy'

### Test 2.3: Streak Freeze Consumption
**Setup**:
```sql
-- Set user with active streak and available freeze
UPDATE profiles 
SET 
  current_habit_streak = 15,
  streak_freezes_available = 1
WHERE id = '<test_user_id>';

UPDATE user_companion 
SET 
  inactive_days = 0,
  last_activity_date = CURRENT_DATE - INTERVAL '1 day'
WHERE user_id = '<test_user_id>';

-- NO habit completion yesterday (should trigger freeze)
DELETE FROM habit_completions 
WHERE user_id = '<test_user_id>' 
  AND date = CURRENT_DATE - INTERVAL '1 day';
```

**Action**: Invoke `process-daily-decay`

**Verification**:
```sql
SELECT 
  current_habit_streak,          -- Should still be 15 (protected)
  streak_freezes_available,      -- Should be 0 (consumed)
  last_streak_freeze_used       -- Should be today's timestamp
FROM profiles 
WHERE id = '<test_user_id>';

SELECT 
  inactive_days,    -- Should be 1 (user was inactive)
  current_mood      -- Should be 'neutral'
FROM user_companion 
WHERE user_id = '<test_user_id>';
```

**Expected Results**:
- ✅ Streak preserved (not broken)
- ✅ Freeze consumed (1 → 0)
- ✅ Companion still decays normally

### Test 2.4: Streak Freeze Reset (Weekly)
**Setup**:
```sql
-- Set freeze reset date to past
UPDATE profiles 
SET 
  streak_freezes_available = 0,
  streak_freezes_reset_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
WHERE id = '<test_user_id>';
```

**Action**: Invoke `process-daily-decay`

**Verification**:
```sql
SELECT 
  streak_freezes_available,     -- Should be 1 (reset)
  streak_freezes_reset_at      -- Should be ~7 days from now
FROM profiles 
WHERE id = '<test_user_id>';
```

**Expected Results**:
- ✅ Freeze count reset to 1
- ✅ Next reset date set to 7 days in future

---

## Test Suite 3: Edge Function - Neglected Image Generation

### Test 3.1: First Generation
**Setup**:
```sql
-- Ensure no cached image
UPDATE user_companion 
SET 
  neglected_image_url = NULL,
  inactive_days = 3,
  current_image_url = '<valid_image_url>'
WHERE user_id = '<test_user_id>';
```

**Action**: 
```bash
# Invoke directly via Supabase functions
curl -X POST https://<project-ref>.supabase.co/functions/v1/generate-neglected-companion-image \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "companionId": "<companion_id>",
    "userId": "<test_user_id>"
  }'
```

**Verification**:
```sql
SELECT 
  neglected_image_url    -- Should have new URL
FROM user_companion 
WHERE user_id = '<test_user_id>';
```

**Expected Results**:
- ✅ HTTP 200 response
- ✅ `neglected_image_url` populated
- ✅ Image URL is valid and accessible
- ✅ Image shows sad version of companion

### Test 3.2: Cached Image (Skip Generation)
**Setup**: Same companion from Test 3.1 (already has neglected_image_url)

**Action**: Invoke function again

**Expected Results**:
- ✅ HTTP 200 response
- ✅ Response includes `"cached": true`
- ✅ No new image generated (check logs)
- ✅ Same URL returned

### Test 3.3: Rate Limit Handling
**Setup**: Exhaust AI API rate limits (or simulate with mock)

**Expected Results**:
- ✅ HTTP 500 response
- ✅ Error message: "RATE_LIMITED: AI service is currently busy"
- ✅ Companion still displays (falls back to CSS filter)

---

## Test Suite 4: Edge Function - Proactive Nudges

### Test 4.1: Day 1 Nudge (Gentle)
**Setup**:
```sql
UPDATE user_companion 
SET inactive_days = 1 
WHERE user_id = '<test_user_id>';

DELETE FROM mentor_nudges 
WHERE user_id = '<test_user_id>' 
  AND created_at >= CURRENT_DATE;
```

**Action**: Invoke `generate-proactive-nudges`

**Verification**:
```sql
SELECT 
  nudge_type,    -- Should be 'companion_concern'
  message,       -- Should be gentle, curious tone
  context        -- Should show inactive_days: 1, concern_level: 'gentle'
FROM mentor_nudges 
WHERE user_id = '<test_user_id>' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Results**:
- ✅ Nudge created
- ✅ Gentle, casual tone
- ✅ Mentions companion by spirit animal
- ✅ No repeat nudge on same day

### Test 4.2: Day 3 Nudge (Urgent)
**Setup**:
```sql
UPDATE user_companion 
SET inactive_days = 3 
WHERE user_id = '<test_user_id>';

DELETE FROM mentor_nudges 
WHERE user_id = '<test_user_id>' 
  AND nudge_type = 'companion_concern';
```

**Action**: Invoke `generate-proactive-nudges`

**Verification**:
```sql
SELECT message, context 
FROM mentor_nudges 
WHERE user_id = '<test_user_id>' 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected Results**:
- ✅ Nudge created with `concern_level: 'urgent'`
- ✅ Genuinely concerned tone
- ✅ Mentions companion struggling/missing user
- ✅ Not guilt-trippy

### Test 4.3: Day 7+ Nudge (Final)
**Setup**:
```sql
UPDATE user_companion 
SET inactive_days = 8 
WHERE user_id = '<test_user_id>';
```

**Action**: Invoke `generate-proactive-nudges`

**Expected Results**:
- ✅ Nudge with `concern_level: 'final'`
- ✅ Sad but hopeful tone
- ✅ "Door is always open" sentiment
- ✅ No manipulation or drama

---

## Test Suite 5: Frontend - useCompanionHealth Hook

### Test 5.1: Hook Data Loading
**Test Steps**:
1. Log in as test user
2. Navigate to Companion page
3. Open React DevTools → Components → find `CompanionDisplay`
4. Inspect `useCompanionHealth` hook state

**Expected Results**:
- ✅ `health.healthPercentage` = average of Body/Mind/Soul
- ✅ `health.moodState` matches inactive days:
  - 0 days: 'happy'
  - 1 day: 'neutral'
  - 2 days: 'worried'
  - 3-4 days: 'sad'
  - 5+ days: 'sick'
- ✅ `health.isNeglected` = true if inactive_days >= 3
- ✅ `health.imageUrl` switches to neglected image when sad/sick
- ✅ `streakFreeze` data loads correctly

### Test 5.2: Mark User Active
**Test Steps**:
1. Set user to inactive (3 days) in database
2. Complete a habit in the app
3. Check database immediately after

**Expected Results**:
- ✅ `inactive_days` reset to 0
- ✅ `current_mood` = 'happy'
- ✅ `last_activity_date` = today
- ✅ UI updates automatically (companion image, mood badge)

### Test 5.3: CSS Filter Styles
**Test Steps**:
1. Set various mood states in database
2. Reload companion page
3. Inspect image element styles

**Expected Results**:
- ✅ Happy: No filter
- ✅ Neutral: Slight desaturation
- ✅ Worried: More desaturation
- ✅ Sad: Heavy desaturation + darker
- ✅ Sick: Sepia tint added

---

## Test Suite 6: Frontend - WelcomeBackModal

### Test 6.1: Automatic Display
**Setup**:
```sql
UPDATE user_companion 
SET 
  inactive_days = 3,
  current_mood = 'sad',
  body = 70,
  mind = 60,
  soul = 50
WHERE user_id = '<test_user_id>';
```

**Test Steps**:
1. Log out completely
2. Log back in
3. Navigate to Companion page

**Expected Results**:
- ✅ Modal opens automatically
- ✅ Shows sad companion image (neglected or filtered)
- ✅ Displays stats lost: -15 Body, -20 Mind, -25 Soul
- ✅ Shows recovery bonus: +10 all stats, +25 XP
- ✅ "Reunite with Your Companion" button visible

### Test 6.2: Reunion Flow
**Test Steps**:
1. Click "Reunite with Your Companion" button
2. Watch animation

**Expected Results**:
- ✅ Image transitions from sad to happy
- ✅ Spring animation (scale + rotation)
- ✅ Heart emoji appears and pulses
- ✅ Sparkles effect
- ✅ Success message: "Your companion is overjoyed!"
- ✅ Stats updated in database immediately

### Test 6.3: XP Award
**Test Steps**:
1. Complete reunion flow
2. Check XP toast notification
3. Verify in database

**Expected Results**:
- ✅ Toast: "+25 XP - Welcome back bonus! 🎉"
- ✅ XP added to companion (check `current_xp`)
- ✅ Award only happens once per session

### Test 6.4: Dismissal
**Test Steps**:
1. Trigger welcome back modal
2. Click outside modal or X button
3. Navigate away and back

**Expected Results**:
- ✅ Modal closes without applying changes
- ✅ Stats remain decayed
- ✅ Modal doesn't reappear in same session
- ✅ Modal reappears on next login if still inactive

---

## Test Suite 7: Frontend - StreakFreezeDisplay

### Test 7.1: Full Display Mode
**Test Steps**:
1. Navigate to Companion → Progress tab
2. Locate StreakFreezeDisplay component

**Expected Results**:
- ✅ Card with gradient background visible
- ✅ Snowflake icon
- ✅ "X/1 Available" text (X = current count)
- ✅ Countdown: "Resets in X days"
- ✅ Educational text about auto-protection

### Test 7.2: Compact Mode
**Test Steps**:
1. Find compact implementation (if exists)
2. Hover for tooltip

**Expected Results**:
- ✅ Small badge with count
- ✅ Tooltip shows full info on hover

### Test 7.3: Zero Freezes
**Setup**:
```sql
UPDATE profiles 
SET streak_freezes_available = 0 
WHERE id = '<test_user_id>';
```

**Expected Results**:
- ✅ Displays "0/1 Available"
- ✅ Red or warning color (if styled)
- ✅ Countdown still visible

### Test 7.4: Reset Countdown
**Setup**:
```sql
UPDATE profiles 
SET streak_freezes_reset_at = CURRENT_TIMESTAMP + INTERVAL '2 days' 
WHERE id = '<test_user_id>';
```

**Expected Results**:
- ✅ "Resets in 2 days"
- ✅ Updates daily (check tomorrow)

---

## Test Suite 8: Frontend - CompanionDisplay

### Test 8.1: Mood Badge Display
**Test Cases**:

| inactive_days | Expected Badge |
|---------------|----------------|
| 0-1 | No badge |
| 2 | 😟 Worried |
| 3-4 | 😢 Missing you |
| 5+ | 💔 Needs attention |

**Test Steps**: Set each inactive_days value, reload page

**Expected Results**:
- ✅ Correct badge for each state
- ✅ Badge positioned bottom-right of image
- ✅ Badge has background + border
- ✅ Readable text

### Test 8.2: Image Switching
**Setup**:
```sql
-- Ensure neglected image exists
UPDATE user_companion 
SET 
  neglected_image_url = '<sad_image_url>',
  inactive_days = 3
WHERE user_id = '<test_user_id>';
```

**Expected Results**:
- ✅ Displays sad image when inactive_days >= 3
- ✅ Reverts to normal image when inactive_days < 3
- ✅ No broken images
- ✅ Smooth transition

### Test 8.3: Ring Color Change
**Test Cases**:
- Happy state: Blue/purple ring
- Neglected state: Red ring

**Expected Results**:
- ✅ Ring color matches mood
- ✅ Color transitions smoothly

### Test 8.4: Filter Effects
**Visual Test**: Manually verify each mood state looks appropriate

**Expected**:
- ✅ Happy: Vibrant, full color
- ✅ Neutral: Barely noticeable desaturation
- ✅ Worried: Noticeably less vibrant
- ✅ Sad: Clearly desaturated, darker
- ✅ Sick: Sepia tone, very dark

---

## Test Suite 9: Integration Tests

### Test 9.1: End-to-End Neglect Cycle
**Day 0**: User completes habit
- ✅ `inactive_days = 0`
- ✅ Companion looks happy

**Day 1**: User misses day (simulate by not completing anything)
- Run `process-daily-decay`
- ✅ `inactive_days = 1`
- ✅ Stats: -5 each
- ✅ Mood: neutral
- ✅ Nudge sent

**Day 2**: User still inactive
- Run `process-daily-decay`
- ✅ `inactive_days = 2`
- ✅ Stats: -5 each (cumulative -10)
- ✅ Mood: worried
- ✅ Badge appears: 😟

**Day 3**: Critical threshold
- Run `process-daily-decay`
- ✅ `inactive_days = 3`
- ✅ Stats: -5 each (cumulative -15)
- ✅ Mood: sad
- ✅ Neglected image generated
- ✅ Image switches on frontend
- ✅ Badge: 😢

**Day 4**: User returns
- Complete a habit
- ✅ Welcome Back Modal appears
- ✅ Click "Reunite"
- ✅ Stats recover: +10 each
- ✅ XP awarded: +25
- ✅ Companion returns to normal
- ✅ `inactive_days = 0`

### Test 9.2: Streak Freeze Integration
**Setup**: User has 7-day streak, 1 freeze available

**Day 1**: User misses habit
- Run `process-daily-decay`
- ✅ Freeze consumed
- ✅ Streak preserved (still 7)
- ✅ Companion still decays (inactive_days = 1)

**Day 2**: User returns, completes habit
- ✅ Streak increments (now 8)
- ✅ Companion recovers
- ✅ Freeze count still 0

**Day 8**: Weekly reset
- Run `process-daily-decay`
- ✅ Freeze count reset to 1
- ✅ Next reset date = 7 days from now

### Test 9.3: Multiple Activity Types
**Test**: Verify all activities reset decay

1. Complete a quest → Check `inactive_days` reset
2. Complete a habit → Check `inactive_days` reset
3. Complete check-in → Check `inactive_days` reset

**Expected**: All three types mark user as active

---

## Test Suite 10: Performance & Scale

### Test 10.1: Large User Base
**Setup**: Create 100+ test users with companions

**Action**: Run `process-daily-decay`

**Expected Results**:
- ✅ Completes in <10 seconds
- ✅ No timeouts
- ✅ All users processed (check logs)
- ✅ No database locks

### Test 10.2: Query Performance
**Action**: Run EXPLAIN ANALYZE on key queries

```sql
-- Check index usage
EXPLAIN ANALYZE
SELECT * FROM user_companion 
WHERE inactive_days >= 3;

-- Should use idx_user_companion_inactive_days
```

**Expected**: Index scan, not sequential scan

### Test 10.3: Frontend Performance
**Test**: Measure React Query cache efficiency

**Steps**:
1. Load Companion page
2. Navigate away
3. Navigate back within 1 minute
4. Check network tab

**Expected**:
- ✅ Second load uses cached data (no network request)
- ✅ No loading spinner
- ✅ Instant display

---

## Test Suite 11: Edge Cases

### Test 11.1: User Without Companion
**Setup**: Create user without companion record

**Action**: Run `process-daily-decay`

**Expected**:
- ✅ No errors
- ✅ User skipped gracefully
- ✅ Logged: "No companion found"

### Test 11.2: Companion Without Image
**Setup**:
```sql
UPDATE user_companion 
SET current_image_url = NULL 
WHERE user_id = '<test_user_id>';
```

**Action**: Trigger neglected image generation

**Expected**:
- ✅ Error handled: "No current image to edit"
- ✅ Frontend shows fallback (no image)
- ✅ App doesn't crash

### Test 11.3: Negative Inactive Days
**Setup**:
```sql
UPDATE user_companion 
SET inactive_days = -1 
WHERE user_id = '<test_user_id>';
```

**Action**: Run `process-daily-decay`

**Expected**:
- ✅ Treated as 0
- ✅ No errors

### Test 11.4: Stats Already at 0
**Setup**:
```sql
UPDATE user_companion 
SET 
  body = 0,
  mind = 0,
  soul = 0,
  inactive_days = 5
WHERE user_id = '<test_user_id>';
```

**Action**: Run `process-daily-decay`

**Expected**:
- ✅ Stats stay at 0 (don't go negative)
- ✅ Decay continues tracking
- ✅ Mood still updates

### Test 11.5: Very Long Absence (30+ Days)
**Setup**:
```sql
UPDATE user_companion 
SET inactive_days = 35 
WHERE user_id = '<test_user_id>';
```

**Expected**:
- ✅ System still works
- ✅ Stats at minimum (0 or close)
- ✅ Mood = 'sick'
- ✅ Welcome back works normally

---

## Automated Testing Script

```typescript
// /workspace/test-negative-companion.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runTests() {
  console.log('🧪 Starting Negative Companion System Tests\n');

  // Test 1: Database Schema
  console.log('Test 1: Verifying database schema...');
  const { data: companionCols } = await supabase.rpc('get_columns', {
    table_name: 'user_companion'
  });
  const hasNeglectCols = companionCols?.some((c: any) => 
    ['neglected_image_url', 'inactive_days', 'last_activity_date'].includes(c.column_name)
  );
  console.log(hasNeglectCols ? '✅ Schema OK' : '❌ Schema missing columns');

  // Test 2: Edge Function Invocation
  console.log('\nTest 2: Testing edge function...');
  const { data, error } = await supabase.functions.invoke('process-daily-decay');
  console.log(error ? `❌ Error: ${error.message}` : `✅ Function executed: ${JSON.stringify(data)}`);

  // Test 3: Frontend Data Fetch
  console.log('\nTest 3: Testing data fetch...');
  const { data: healthData } = await supabase
    .from('user_companion')
    .select('inactive_days, current_mood, neglected_image_url')
    .limit(5);
  console.log(`✅ Fetched ${healthData?.length || 0} companion records`);

  console.log('\n✨ Tests complete!');
}

runTests().catch(console.error);
```

---

## Bug Reporting Template

If you find issues during testing, please report using this template:

```markdown
## Bug Report: [Brief Description]

**Severity**: Critical | High | Medium | Low
**Component**: Database | Edge Function | Frontend

### Steps to Reproduce
1. 
2. 
3. 

### Expected Behavior


### Actual Behavior


### Environment
- Browser: 
- Device: 
- User ID: 
- Companion ID: 

### Database State
```sql
SELECT * FROM user_companion WHERE user_id = '<user_id>';
SELECT * FROM profiles WHERE id = '<user_id>';
```

### Screenshots / Logs


### Suggested Fix (optional)


```

---

## Test Sign-Off

Once all tests pass, complete this checklist:

### Pre-Production
- [ ] All database tests pass
- [ ] All edge function tests pass
- [ ] All frontend tests pass
- [ ] Integration tests pass
- [ ] Edge cases handled
- [ ] Performance acceptable
- [ ] No console errors
- [ ] Documentation complete

### Production Readiness
- [ ] Migration deployed to staging
- [ ] Edge functions deployed to staging
- [ ] Frontend deployed to staging
- [ ] Staging tests pass
- [ ] Team review complete
- [ ] Product owner approval

### Post-Deployment
- [ ] Monitor edge function logs (first 24 hours)
- [ ] Check error rate
- [ ] Verify user complaints (none expected)
- [ ] Confirm daily decay running on schedule

**Tested By**: _______________  
**Date**: _______________  
**Sign-Off**: ✅ Ready for Production
