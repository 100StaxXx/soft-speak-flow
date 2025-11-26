# 🚨 BUG REPORT - Round 3: Critical Logic Flaws

**Date:** November 26, 2025  
**Scan Type:** Deep logic & transaction analysis  
**Status:** 🔴 **6 MORE BUGS FOUND**

---

## ⚠️ IMPORTANT DISCOVERY

After fixing 13 bugs across 2 rounds, **deeper analysis reveals critical logic flaws** in the fixes themselves. These are **TOCTOU (Time-of-Check-Time-of-Use)** vulnerabilities and **transaction atomicity issues**.

---

## 🔴 CRITICAL BUG #14: New Race Condition in Completion Check

**Severity:** 🔴 **CRITICAL** - The fix for Bug #8 introduced a NEW race condition

### The Problem

**In validateReferralAtStage3 (useCompanion.ts:454-494):**

```typescript
// Line 454-460: CHECK if already completed
const { data: alreadyCompleted } = await supabase.rpc(
  'has_completed_referral',
  { p_referee_id: user.id, p_referrer_id: profile.referred_by }
);

if (alreadyCompleted) {
  return; // Skip
}

// Line 474-477: INCREMENT count
await supabase.rpc('increment_referral_count', ...);

// Line 488-494: INSERT completion record
await supabase
  .from("referral_completions")
  .insert({ referee_id: user.id, referrer_id: profile.referred_by });
```

### The Race Condition

**Scenario: Two Stage 3 evolutions at EXACT same moment:**

```
Time    User B (Thread 1)              User B (Thread 2)
----    -----------------              -----------------
T0      CHECK completed? → NO          
T1                                     CHECK completed? → NO
T2      INCREMENT count (0 → 1)        
T3                                     INCREMENT count (1 → 2) ❌
T4      INSERT completion              
T5                                     INSERT completion ❌ (duplicate!)
```

**Result:**
- Count incremented TWICE (should be once)
- Second INSERT fails with duplicate key error
- Referrer gets double credit

### Why This Happens

**Gap between CHECK and INSERT:**
- Thread 1 checks → not completed
- Thread 2 checks → not completed (Thread 1 hasn't inserted yet)
- Both proceed to increment
- Both try to insert (second fails)
- **Count is wrong: 2 instead of 1**

### The UNIQUE Constraint Doesn't Help

```sql
UNIQUE(referee_id, referrer_id)
```

This prevents duplicate ROWS, but:
- ✅ Second INSERT fails (good)
- ❌ Count already incremented TWICE (bad!)

The increment happened BEFORE the insert, so the damage is done.

### Impact

- **Double counting:** Referrers get 2x credits per friend
- **Incorrect milestones:** Skins unlock at wrong counts
- **Data corruption:** referral_count doesn't match completions table
- **Unfair advantage:** Some users get lucky with timing

### Real-World Likelihood

**HIGH** - This can happen when:
- User completes multiple tasks simultaneously
- Network lag causes retry
- Server processes requests in parallel
- High user load (production conditions)

### Proof of Concept

```typescript
// Simulate race condition
async function exploit() {
  const promises = [];
  
  // Launch 10 Stage 3 evolutions simultaneously
  for (let i = 0; i < 10; i++) {
    promises.push(evolveToStage3());
  }
  
  await Promise.all(promises);
  
  // Expected: referral_count = 1
  // Actual: referral_count = 2-10 (race dependent)
}
```

### Fix Required

**Use database transaction with row-level locking:**

```sql
CREATE OR REPLACE FUNCTION process_referral_completion(
  p_referee_id UUID,
  p_referrer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_new_count INTEGER;
  v_already_exists BOOLEAN;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Lock the completion check with SELECT FOR UPDATE
  SELECT EXISTS(
    SELECT 1 FROM referral_completions
    WHERE referee_id = p_referee_id 
      AND referrer_id = p_referrer_id
    FOR UPDATE
  ) INTO v_already_exists;
  
  IF v_already_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'already_completed'
    );
  END IF;
  
  -- Insert completion record FIRST (acts as lock)
  INSERT INTO referral_completions (referee_id, referrer_id, stage_reached)
  VALUES (p_referee_id, p_referrer_id, 3);
  
  -- Then increment count (now safe)
  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = p_referrer_id
  RETURNING referral_count INTO v_new_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'new_count', v_new_count
  );
  
  -- Transaction commits automatically
EXCEPTION WHEN unique_violation THEN
  -- Another thread won the race, that's OK
  RETURN jsonb_build_object(
    'success', false,
    'reason', 'concurrent_completion'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Then in TypeScript:**
```typescript
const { data: result } = await supabase.rpc(
  'process_referral_completion',
  { p_referee_id: user.id, p_referrer_id: profile.referred_by }
);

if (!result.success) {
  console.log('Already completed or race lost');
  return;
}

const newCount = result.new_count;
// Now check for milestone unlocks...
```

**Key Improvements:**
1. ✅ Single atomic function call (no race window)
2. ✅ INSERT happens BEFORE increment
3. ✅ Duplicate key error is caught and handled
4. ✅ Returns clear success/failure status

---

## 🟠 HIGH BUG #15: TOCTOU in applyReferralCode

**Severity:** 🟠 **HIGH** - Time-of-Check-Time-of-Use vulnerability

### The Problem

**In applyReferralCode (useReferrals.ts:69-102):**

```typescript
// Line 69-73: CHECK if referred_by exists
const { data: currentProfile } = await supabase
  .from("profiles")
  .select("referred_by")
  .eq("id", user.id)
  .single();

if (currentProfile?.referred_by) {
  throw new Error("You have already used a referral code");
}

// ... other checks ...

// Line 96-100: UPDATE referred_by
const { error: updateError } = await supabase
  .from("profiles")
  .update({ referred_by: referrer.id })
  .eq("id", user.id)
  .is("referred_by", null);
```

### The Race Condition

**Scenario: User applies two codes simultaneously:**

```
Time    Code A Request              Code B Request
----    --------------              --------------
T0      SELECT referred_by → NULL   
T1                                  SELECT referred_by → NULL
T2      UPDATE referred_by = A      
T3                                  UPDATE referred_by = B ❌
```

**Result:** Last write wins, first referrer loses credit!

### Why `.is("referred_by", null)` Doesn't Help Enough

The `.is()` filter prevents the update if `referred_by` is NOT null, BUT:
- Both threads see NULL at check time
- Both pass the check
- Both try to UPDATE
- One succeeds, other returns 0 rows
- **No error is thrown for 0 rows updated!**

### Current Behavior

```typescript
const { error: updateError } = await supabase
  .from("profiles")
  .update({ referred_by: referrer.id })
  .eq("id", user.id)
  .is("referred_by", null);

// If 0 rows updated: error = undefined
// Function proceeds as if it succeeded!
```

### Impact

- **Silent failures:** User thinks code applied, but it didn't
- **Lost referrals:** First referrer loses credit to second
- **Data inconsistency:** Unpredictable behavior
- **Bad UX:** Success toast shows, but nothing happened

### Fix Required

**Check affected row count:**

```typescript
const { data: updatedRows, error: updateError } = await supabase
  .from("profiles")
  .update({ referred_by: referrer.id })
  .eq("id", user.id)
  .is("referred_by", null)
  .select(); // Important: returns affected rows

if (updateError) throw updateError;

// Check if update actually happened
if (!updatedRows || updatedRows.length === 0) {
  throw new Error("Referral code already applied (possible concurrent request)");
}

return referrer;
```

Or better, use a database function:

```sql
CREATE OR REPLACE FUNCTION apply_referral_code(
  p_user_id UUID,
  p_referrer_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_referred_by UUID;
BEGIN
  -- Lock the row for update
  SELECT referred_by INTO v_current_referred_by
  FROM profiles
  WHERE id = p_user_id
  FOR UPDATE;
  
  -- Check if already set
  IF v_current_referred_by IS NOT NULL THEN
    RAISE EXCEPTION 'Referral code already applied';
  END IF;
  
  -- Atomically update
  UPDATE profiles
  SET referred_by = p_referrer_id
  WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

## 🟠 HIGH BUG #16: Partial State in validateReferralAtStage3

**Severity:** 🟠 **HIGH** - No rollback on failure leaves inconsistent state

### The Problem

**validateReferralAtStage3 has 4 database operations in sequence:**

```typescript
// Operation 1: Increment count
await supabase.rpc('increment_referral_count', ...);

// Operation 2: Insert completion
await supabase.from("referral_completions").insert(...);

// Operation 3: Maybe unlock skin
await supabase.from("user_companion_skins").upsert(...);

// Operation 4: Clear referred_by
await supabase.from("profiles").update({ referred_by: null });
```

### What If Something Fails?

**Scenario 1: Operation 2 fails (network error)**
```
✅ Count incremented (1 → 2)
❌ Completion NOT recorded
❌ Skin NOT unlocked
❌ referred_by NOT cleared

Result: Count is wrong, user can try again and increment AGAIN!
```

**Scenario 2: Operation 3 fails (database error)**
```
✅ Count incremented (2 → 3)
✅ Completion recorded
❌ Skin NOT unlocked (milestone 3!)
✅ referred_by cleared

Result: User should have "Golden Frame" but doesn't!
```

**Scenario 3: Operation 4 fails (RLS policy)**
```
✅ Count incremented
✅ Completion recorded
✅ Skin unlocked
❌ referred_by NOT cleared

Result: User might be able to trigger validation again (though completion check should catch it)
```

### Impact

- **Inconsistent state:** Partial updates
- **Lost skins:** Count increased but skin not unlocked
- **Retry chaos:** User retries, makes it worse
- **Support nightmare:** Hard to diagnose and fix

### Current "Protection"

```typescript
try {
  // ... all operations ...
} catch (error) {
  console.error("Failed to validate referral:", error);
  // Don't throw - this shouldn't block evolution
}
```

**This makes it WORSE:**
- Errors are silently swallowed
- Evolution proceeds as if nothing happened
- User has no idea something went wrong
- Data is corrupted

### Fix Required

**Option 1: Database transaction (preferred)**

Move all logic to a single database function:

```sql
CREATE OR REPLACE FUNCTION complete_referral_stage3(
  p_referee_id UUID,
  p_referrer_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_new_count INTEGER;
  v_skin_id UUID;
BEGIN
  -- All operations in single transaction
  
  -- 1. Check completion
  IF EXISTS(
    SELECT 1 FROM referral_completions
    WHERE referee_id = p_referee_id AND referrer_id = p_referrer_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_completed');
  END IF;
  
  -- 2. Insert completion (locks this relationship)
  INSERT INTO referral_completions (referee_id, referrer_id, stage_reached)
  VALUES (p_referee_id, p_referrer_id, 3);
  
  -- 3. Increment count
  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = p_referrer_id
  RETURNING referral_count INTO v_new_count;
  
  -- 4. Check milestone and unlock skin
  IF v_new_count IN (1, 3, 5) THEN
    SELECT id INTO v_skin_id
    FROM companion_skins
    WHERE unlock_type = 'referral'
      AND unlock_requirement = v_new_count;
    
    IF v_skin_id IS NOT NULL THEN
      INSERT INTO user_companion_skins (user_id, skin_id, acquired_via)
      VALUES (p_referrer_id, v_skin_id, 'referral_milestone_' || v_new_count)
      ON CONFLICT (user_id, skin_id) DO NOTHING;
    END IF;
  END IF;
  
  -- 5. Clear referred_by
  UPDATE profiles
  SET referred_by = NULL
  WHERE id = p_referee_id;
  
  -- All succeed or all rollback
  RETURN jsonb_build_object(
    'success', true,
    'new_count', v_new_count,
    'milestone_reached', v_new_count IN (1, 3, 5)
  );
  
EXCEPTION WHEN OTHERS THEN
  -- Rollback happens automatically
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Option 2: Compensating transactions**

If any operation fails, undo previous ones:

```typescript
let countIncremented = false;
let completionRecorded = false;

try {
  // 1. Increment
  await supabase.rpc('increment_referral_count', ...);
  countIncremented = true;
  
  // 2. Record completion
  await supabase.from("referral_completions").insert(...);
  completionRecorded = true;
  
  // 3. Unlock skin
  await supabase.from("user_companion_skins").upsert(...);
  
  // 4. Clear referred_by
  await supabase.from("profiles").update(...);
  
} catch (error) {
  // Rollback what we did
  if (countIncremented) {
    await supabase.rpc('decrement_referral_count', { referrer_id });
  }
  if (completionRecorded) {
    await supabase.from("referral_completions").delete().eq(...);
  }
  throw error; // Re-throw to prevent evolution
}
```

**Option 1 is MUCH better** - atomic, no rollback logic needed.

---

## 🟡 MEDIUM BUG #17: Silent Failure on Completion Insert

**Severity:** 🟡 **MEDIUM** - Error not checked after critical operation

### The Problem

**Line 488-494 in useCompanion.ts:**

```typescript
// Record completion to prevent re-use after reset
await supabase
  .from("referral_completions")
  .insert({
    referee_id: user.id,
    referrer_id: profile.referred_by,
    stage_reached: 3
  });
// ❌ No error checking!

// Continues to unlock skins...
```

### What If Insert Fails?

**Possible failures:**
- Network timeout
- Database unavailable
- Duplicate key (race condition from Bug #14)
- RLS policy denial
- Foreign key violation

**Current behavior:** Silently proceeds as if everything is fine!

### Impact

- **Count incremented** but **completion NOT recorded**
- User can reach Stage 3 again (new companion) and trigger again
- Referrer gets double credit
- Defeats the entire anti-farming protection

### Fix Required

```typescript
const { error: completionError } = await supabase
  .from("referral_completions")
  .insert({
    referee_id: user.id,
    referrer_id: profile.referred_by,
    stage_reached: 3
  });

if (completionError) {
  // This is CRITICAL - if completion isn't recorded, we have a problem
  console.error("CRITICAL: Failed to record referral completion:", completionError);
  
  // Option 1: Throw error to rollback everything
  throw new Error("Failed to record referral completion");
  
  // Option 2: Try to decrement count to compensate
  await supabase.rpc('decrement_referral_count', { referrer_id: profile.referred_by });
  throw new Error("Referral validation failed");
}
```

---

## 🟡 MEDIUM BUG #18: Update with .is() Returns No Error

**Severity:** 🟡 **MEDIUM** - Silent failure when 0 rows affected

### The Problem

**In applyReferralCode (line 96-102):**

```typescript
const { error: updateError } = await supabase
  .from("profiles")
  .update({ referred_by: referrer.id })
  .eq("id", user.id)
  .is("referred_by", null); // Filter: only if NULL

if (updateError) throw updateError;
// ✅ Thrown if database error

// ❌ NOT thrown if 0 rows matched the filter!
```

### Supabase Behavior

```javascript
// If filter matches 0 rows:
{ data: [], error: null }

// If filter matches 1 row:
{ data: [{ id: '...', referred_by: '...' }], error: null }
```

Both return `error: null`! You must check `data.length`.

### Impact

- **Silent failure:** User thinks code applied
- **Success toast shows:** "Referral code applied!"
- **But nothing happened:** `referred_by` is still null
- **User confusion:** Why isn't my friend getting credit?

### Real Scenario

```
1. User applies code A → Success
2. User (maliciously or by accident) tries to apply code B
3. Check passes: referred_by = A (not null)
4. Throws: "You have already used a referral code" ✅ Correct
5. User waits for network lag, tries code B again
6. Meanwhile, Stage 3 evolution cleared referred_by = null
7. Check passes: referred_by = null
8. UPDATE with .is(referred_by, null) matches 0 rows (race timing)
9. No error thrown ❌
10. Success toast shows ❌
11. But referred_by is still null ❌
```

### Fix Required

**Always check affected rows:**

```typescript
const { data: updatedRows, error: updateError } = await supabase
  .from("profiles")
  .update({ referred_by: referrer.id })
  .eq("id", user.id)
  .is("referred_by", null)
  .select(); // IMPORTANT: Returns affected rows

if (updateError) throw updateError;

if (!updatedRows || updatedRows.length === 0) {
  // Update didn't happen - could be race condition
  // Check current state to give accurate error
  const { data: currentState } = await supabase
    .from("profiles")
    .select("referred_by")
    .eq("id", user.id)
    .single();
  
  if (currentState?.referred_by) {
    throw new Error("You have already used a referral code");
  } else {
    throw new Error("Failed to apply referral code. Please try again.");
  }
}

return referrer;
```

---

## 🟢 LOW BUG #19: Query Invalidation Race

**Severity:** 🟢 **LOW** - UI might show stale data briefly

### The Problem

**In applyReferralCode (line 106-108):**

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["referral-stats"] });
  toast.success("Referral code applied! Your friend will earn rewards when you reach Stage 3.");
},
```

**Race condition:**
1. UPDATE database (referred_by set)
2. onSuccess callback fires
3. Invalidate queries (triggers refetch)
4. Toast shows immediately
5. **Refetch hasn't completed yet**
6. UI still shows old data while toast says "applied"

### Impact

- **Confusing UX:** Success message but UI doesn't update
- **Brief flicker:** Old data → new data after delay
- **Not critical:** Just UX polish issue

### Fix Required

**Wait for refetch before showing toast:**

```typescript
onSuccess: async () => {
  // Invalidate and wait for refetch
  await queryClient.invalidateQueries({ queryKey: ["referral-stats"] });
  
  // Only show toast after UI updates
  toast.success("Referral code applied! Your friend will earn rewards when you reach Stage 3.");
},
```

Or use optimistic updates:

```typescript
onMutate: async (code) => {
  // Cancel outgoing refetches
  await queryClient.cancelQueries({ queryKey: ["referral-stats"] });
  
  // Snapshot previous value
  const previousStats = queryClient.getQueryData(["referral-stats"]);
  
  // Optimistically update
  queryClient.setQueryData(["referral-stats"], (old) => ({
    ...old,
    referred_by: '<referrer-id-from-code>'
  }));
  
  return { previousStats };
},
onError: (err, variables, context) => {
  // Rollback on error
  queryClient.setQueryData(["referral-stats"], context.previousStats);
},
```

---

## Summary of Round 3 Bugs

| # | Severity | Issue | Root Cause |
|---|----------|-------|------------|
| 14 | 🔴 CRITICAL | Race in completion check | TOCTOU between check and insert |
| 15 | 🟠 HIGH | TOCTOU in apply code | Gap between check and update |
| 16 | 🟠 HIGH | Partial state on failure | No transaction/rollback |
| 17 | 🟡 MEDIUM | Silent completion insert fail | No error checking |
| 18 | 🟡 MEDIUM | Silent update failure | 0 rows not detected |
| 19 | 🟢 LOW | Query invalidation race | Async timing issue |

---

## Grand Total: 19 Bugs

### Round 1: 7 bugs
### Round 2: 6 bugs  
### Round 3: 6 bugs
### **Total: 19 bugs found across 3 rounds**

---

## Critical Pattern

**All Round 3 bugs share a common theme:**
> **Multiple database operations that should be atomic, but aren't**

This is the **hardest class of bugs to find** because:
- ✅ Each operation works correctly in isolation
- ✅ Sequential execution appears to work
- ❌ Race conditions only appear under load
- ❌ Failures leave inconsistent state

---

## Recommended Solution

**Move ALL referral logic to database functions:**

1. `apply_referral_code()` - Atomic check + update
2. `complete_referral_stage3()` - Single transaction for all operations
3. Add row-level locking where needed
4. Return detailed status objects

**Benefits:**
- ✅ True atomicity (transaction guarantees)
- ✅ No race conditions
- ✅ Consistent state always
- ✅ Better error handling
- ✅ Easier to test
- ✅ Better performance (fewer round trips)

---

## Next Steps

1. Create comprehensive transaction-based database functions
2. Update TypeScript to call single functions instead of multiple operations
3. Add retry logic with exponential backoff
4. Implement thorough error handling
5. Add integration tests that simulate concurrent requests

---

**Status:** 🔴 **6 MORE CRITICAL BUGS FOUND**

These are **logic/transaction bugs** - harder to find but critical to fix before production.
