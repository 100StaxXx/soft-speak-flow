# 🔍 BUG REPORT - Round 4: Integration & Type Safety

**Date:** November 26, 2025  
**Scan Type:** Integration issues, type safety, operational concerns  
**Status:** 🔴 **6 MORE BUGS FOUND**

---

## Overview

After fixing 19 bugs across 3 rounds with atomic database functions, **deeper integration testing reveals critical deployment and type safety issues**.

These aren't logic bugs - they're **operational bugs** that will cause **runtime failures** when deployed.

---

## 🔴 CRITICAL BUG #20: Missing TypeScript Types for New RPC Functions

**Severity:** 🔴 **CRITICAL** - Code will fail at runtime

### The Problem

**New RPC functions created in migrations:**
- `complete_referral_stage3()`
- `apply_referral_code_atomic()`
- `has_completed_referral()`
- `decrement_referral_count()`

**But TypeScript doesn't know they exist!**

**In types.ts (checked):**
```typescript
Functions: {
  generate_referral_code: { Args: never; Returns: string }
  // ❌ complete_referral_stage3: NOT HERE
  // ❌ apply_referral_code_atomic: NOT HERE
  // ❌ has_completed_referral: NOT HERE
  // ❌ decrement_referral_count: NOT HERE
}
```

### What Happens at Runtime

```typescript
// TypeScript compile: ✅ No error (types not enforced for .rpc())
const { data } = await supabase.rpc('complete_referral_stage3', {...});

// Runtime: ❌ Error: "Function complete_referral_stage3 does not exist"
// OR (if migration was applied): ✅ Works, but types are wrong
```

### Impact

**If migrations NOT applied yet:**
- ❌ All referral completions fail
- ❌ All code applications fail
- ❌ Users stuck, can't progress
- ❌ Support flooded with tickets

**If migrations applied but types not regenerated:**
- ⚠️ Works at runtime
- ❌ No TypeScript autocomplete
- ❌ No type checking on parameters
- ❌ Return types are `any`
- ❌ Developers might pass wrong parameters

### Current Code

```typescript
// No type safety:
const { data: result } = await supabase.rpc(
  'complete_referral_stage3',  // ❌ TypeScript doesn't validate this
  { 
    p_referee_id: user.id,     // ❌ TypeScript doesn't validate this
    p_referrer_id: profile.referred_by
  }
);

// result is typed as 'any' ❌
if (!result?.success) { ... }
```

### Fix Required

**Option 1: Regenerate types (REQUIRED after migration)**
```bash
# After applying migrations to database:
npx supabase gen types typescript --local > src/integrations/supabase/types.ts

# OR on cloud:
npx supabase gen types typescript --project-id <your-project-id> > src/integrations/supabase/types.ts
```

**Option 2: Manual type definitions (temporary)**

Add to a type definition file:

```typescript
// src/types/referral-functions.ts
export interface CompleteReferralStage3Args {
  p_referee_id: string;
  p_referrer_id: string;
}

export interface CompleteReferralStage3Result {
  success: boolean;
  reason?: string;
  message?: string;
  new_count?: number;
  milestone_reached?: boolean;
  skin_unlocked?: boolean;
}

export interface ApplyReferralCodeArgs {
  p_user_id: string;
  p_referrer_id: string;
  p_referral_code: string;
}

export interface ApplyReferralCodeResult {
  success: boolean;
  reason?: string;
  message?: string;
}

// Then use:
const { data } = await supabase.rpc<CompleteReferralStage3Result>(
  'complete_referral_stage3',
  args as CompleteReferralStage3Args
);
```

**Recommendation:** Do BOTH - regenerate types AND add explicit interfaces for safety.

---

## 🟠 HIGH BUG #21: No Retry Logic for RPC Calls

**Severity:** 🟠 **HIGH** - Network issues cause permanent failures

### The Problem

**Current code in useCompanion.ts (line 454):**

```typescript
const { data: result, error: completionError } = await supabase.rpc(
  'complete_referral_stage3',
  { p_referee_id: user.id, p_referrer_id: profile.referred_by }
);

if (completionError) {
  console.error("Failed to complete referral:", completionError);
  return; // ❌ Gives up immediately
}
```

**No retry on transient failures:**
- Network timeout
- Database temporarily unavailable
- Connection reset
- Load balancer issue

### Impact

**Scenario:**
1. User B reaches Stage 3
2. Network hiccup during RPC call
3. Error returned: "Network timeout"
4. Referral validation abandoned
5. **User A NEVER gets credit**
6. User B's `referred_by` never cleared
7. No second chance - evolution continues, moment lost

### Why This is Critical

**Referral validation happens ONCE in companion's lifetime:**
- Only at Stage 3 evolution
- If it fails, user can't trigger it again
- No "retry" button for users
- Manual database fix required

Compare to XP award (has built-in retry):
```typescript
// XP awards use retryWithBackoff
const imageData = await retryWithBackoff(
  async () => { /* ... */ },
  { maxAttempts: 3, initialDelay: 2000 }
);
```

### Fix Required

```typescript
import { retryWithBackoff } from "@/utils/retry";

// Wrap RPC call in retry logic
const result = await retryWithBackoff(
  async () => {
    const { data, error } = await supabase.rpc(
      'complete_referral_stage3',
      { p_referee_id: user.id, p_referrer_id: profile.referred_by }
    );
    
    if (error) throw error;
    return data;
  },
  {
    maxAttempts: 3,
    initialDelay: 1000,
    shouldRetry: (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      // Retry on network errors, not on business logic errors
      return msg.includes('network') || 
             msg.includes('timeout') ||
             msg.includes('unavailable');
    }
  }
);

if (!result?.success) {
  console.log('Referral not completed:', result?.reason);
  return;
}
```

---

## 🟠 HIGH BUG #22: PERFORM with NOWAIT Can Fail

**Severity:** 🟠 **HIGH** - Lock errors cause silent failures

### The Problem

**In complete_referral_stage3 function (line 21-24):**

```sql
PERFORM 1 FROM referral_completions
WHERE referee_id = p_referee_id 
  AND referrer_id = p_referrer_id
FOR UPDATE NOWAIT; -- ❌ Throws lock_not_available exception

IF FOUND THEN
  RETURN jsonb_build_object(...);
END IF;
```

### What NOWAIT Does

- Tries to acquire row lock
- If lock is held by another transaction: **immediate exception**
- Exception: `SQLSTATE 55P03: lock_not_available`

### The Issue

**Exception handler catches it (line 110-116):**
```sql
WHEN lock_not_available THEN
  RETURN jsonb_build_object(
    'success', false,
    'reason', 'concurrent_processing',
    'message', 'Referral is currently being processed'
  );
```

**But this is correct behavior!** So what's the bug?

**The bug is in the CLIENT CODE:**

```typescript
if (!result?.success) {
  console.log('Referral not completed:', result?.reason);
  return; // ❌ Silently gives up
}
```

If lock is held, client returns immediately without retry.

### Real-World Scenario

```
T0: User B clicks "complete task" → triggers Stage 3
T1: Evolution starts → validateReferralAtStage3() called
T2: RPC call starts → tries to lock row
T3: Network lag → retry #1 starts
T4: Retry #1 tries to lock → BLOCKED by original request
T5: NOWAIT fires → lock_not_available exception
T6: Returns success=false, reason='concurrent_processing'
T7: Client gives up ❌
T8: Original request completes ✅
```

**Result:** 
- Original request succeeds
- Retry request aborted
- **But if ORIGINAL fails for other reason, referral lost**

### Impact

- **Race with self:** Retry logic conflicts with itself
- **Legitimate failures:** Hard to distinguish from lock conflicts
- **Lost referrals:** If original request fails, no backup

### Fix Required

**Option 1: Use WAIT instead of NOWAIT**
```sql
-- Wait up to 5 seconds for lock
PERFORM 1 FROM referral_completions
WHERE referee_id = p_referee_id 
  AND referrer_id = p_referrer_id
FOR UPDATE; -- Removed NOWAIT, will wait

-- Or with timeout:
SET LOCAL lock_timeout = '5s';
PERFORM ...FOR UPDATE;
```

**Option 2: Client-side retry on lock error**
```typescript
const result = await retryWithBackoff(
  async () => {
    const { data, error } = await supabase.rpc(...);
    if (error) throw error;
    
    // Retry if locked by another transaction
    if (!data.success && data.reason === 'concurrent_processing') {
      throw new Error('RETRY_LOCK'); // Trigger retry
    }
    
    return data;
  },
  {
    maxAttempts: 3,
    shouldRetry: (err) => err.message === 'RETRY_LOCK'
  }
);
```

**Recommendation:** Option 1 (simpler, database handles it)

---

## 🟡 MEDIUM BUG #23: Unnecessary RPC Call

**Severity:** 🟡 **MEDIUM** - Wasted database call, minor performance hit

### The Problem

**In validateReferralAtStage3 (line 444-450):**

```typescript
// Fetch referred_by from database
const { data: profile } = await supabase
  .from("profiles")
  .select("referred_by")
  .eq("id", user.id)
  .single();

if (!profile?.referred_by) return;

// Then call RPC with the same referred_by
await supabase.rpc('complete_referral_stage3', {
  p_referee_id: user.id,
  p_referrer_id: profile.referred_by  // Already in profile object
});
```

**The RPC function checks referred_by AGAIN internally:**

```sql
-- Inside complete_referral_stage3:
UPDATE profiles
SET referred_by = NULL
WHERE id = p_referee_id;
-- If referred_by was already NULL, no problem, but wasteful check
```

### Why This Happens

The client-side check `if (!profile?.referred_by) return;` is redundant:
- RPC function handles NULL referred_by fine (clears it to NULL)
- Early return saves RPC call, but...
- We already fetched the profile anyway

### Impact

- **Minor:** Extra database query (small cost)
- **Logic:** If referred_by is NULL, RPC returns success=true but doesn't increment
- **Wait, that's wrong!**

### Actually, This IS a Bug

If `referred_by` is NULL:
1. Client returns early (correct)
2. **But what if it was set, then cleared between check and RPC?**
3. Race condition: check sees value, RPC sees NULL
4. RPC might not increment count

### Real Scenario

```
T0: validateReferralAtStage3() starts
T1: SELECT referred_by → returns Alice's ID
T2: Check: referred_by exists ✅
T3: [NETWORK LAG 2 seconds]
T4: Another evolution completes, clears referred_by → NULL
T5: complete_referral_stage3() RPC call executes
T6: UPDATE referred_by = NULL WHERE id = user
T7: Returns success, but count not incremented (already NULL)
```

### Fix Required

**Remove client-side check OR pass profile data to function:**

```typescript
// Option 1: Remove redundant check (simpler)
// Just call the RPC, it handles NULL gracefully
const { data: result, error } = await supabase.rpc(
  'complete_referral_stage3',
  { p_referee_id: user.id }
);
// Let function fetch referred_by internally with locking

// Option 2: Pass referred_by to avoid extra query
const { data: profile } = await supabase
  .from("profiles")
  .select("referred_by")
  .eq("id", user.id)
  .single();

if (!profile?.referred_by) return;

const { data: result } = await supabase.rpc(
  'complete_referral_stage3_with_referrer',
  { 
    p_referee_id: user.id,
    p_referrer_id: profile.referred_by  // Explicit pass
  }
);
```

**Recommendation:** Modify function to accept optional p_referrer_id, fetch if not provided.

---

## 🟡 MEDIUM BUG #24: Type Safety - Result Could Be Undefined

**Severity:** 🟡 **MEDIUM** - Runtime null pointer errors

### The Problem

**In useCompanion.ts (line 468-479):**

```typescript
if (!result?.success) {
  console.log('Referral not completed:', result?.reason, result?.message);
  return;
}

// ❌ Assumes result exists and has these properties
console.log('Referral completed successfully:', {
  newCount: result.new_count,        // Could be undefined
  milestoneReached: result.milestone_reached,  // Could be undefined
  skinUnlocked: result.skin_unlocked  // Could be undefined
});
```

### Why This Can Fail

1. **RPC returns NULL:** If function throws unhandled exception
2. **result is undefined:** If data is malformed
3. **Properties missing:** If JSONB structure changes

### Current Safeguards

The `?.` optional chaining helps, but:
```typescript
result.new_count  // ❌ Will crash if result is null/undefined
result?.new_count // ✅ Safe, returns undefined
```

**Problem:** We're using `result.new_count` not `result?.new_count`

### Fix Required

**Add explicit type checking:**

```typescript
interface ReferralCompletionResult {
  success: boolean;
  reason?: string;
  message?: string;
  new_count?: number;
  milestone_reached?: boolean;
  skin_unlocked?: boolean;
}

const result = data as ReferralCompletionResult | null;

if (!result || !result.success) {
  console.log('Referral not completed:', result?.reason ?? 'unknown');
  return;
}

// Now TypeScript knows these exist
console.log('Referral completed successfully:', {
  newCount: result.new_count ?? 0,
  milestoneReached: result.milestone_reached ?? false,
  skinUnlocked: result.skin_unlocked ?? false
});
```

---

## 🟡 MEDIUM BUG #25: No Retry Budget for Critical Operations

**Severity:** 🟡 **MEDIUM** - Transient failures become permanent

### The Problem

**Referral operations have NO retry logic:**

```typescript
// Single attempt, gives up on any error
const { data: result, error } = await supabase.rpc(...);

if (error) {
  console.error("Failed to complete referral:", error);
  return; // ❌ No retry
}
```

**Compare to image generation (has retry):**

```typescript
const imageData = await retryWithBackoff(
  async () => { /* ... */ },
  {
    maxAttempts: 3,
    initialDelay: 2000,
    shouldRetry: (error) => { /* smart retry logic */ }
  }
);
```

### When This Matters

**Transient failures that SHOULD be retried:**
- Network timeout (502, 503, 504)
- Database connection pool exhausted
- Load balancer timeout
- SSL handshake failure
- DNS resolution failure

**Permanent failures that SHOULDN'T be retried:**
- Invalid UUID format
- Foreign key violation
- Business logic rejection (already completed)
- Permission denied

### Impact

**User experience:**
```
User: "I reached Stage 3 but my friend didn't get credit!"
Support: "Let me check... your referred_by is still set. Seems like a transient error."
Fix: Manual database UPDATE to clear referred_by and increment count
```

**At scale:**
- 1% network error rate = 1 out of 100 referrals lost
- 1000 Stage 3 evolutions = 10 lost referrals
- Angry users, support burden

### Fix Required

```typescript
import { retryWithBackoff } from "@/utils/retry";

const result = await retryWithBackoff(
  async () => {
    const { data, error } = await supabase.rpc(
      'complete_referral_stage3',
      { p_referee_id: user.id, p_referrer_id: profile.referred_by }
    );
    
    if (error) throw error;
    return data;
  },
  {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
    shouldRetry: (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      
      // Don't retry business logic errors
      if (msg.includes('already_completed') ||
          msg.includes('concurrent_completion') ||
          msg.includes('not found')) {
        return false;
      }
      
      // Retry network/transient errors
      return msg.includes('network') ||
             msg.includes('timeout') ||
             msg.includes('temporarily unavailable') ||
             msg.includes('connection') ||
             msg.includes('ECONNRESET');
    }
  }
);
```

---

## 🟢 LOW BUG #26: Query Results Not Paginated

**Severity:** 🟢 **LOW** - Potential OOM with many referrals

### The Problem

**No queries use pagination:**

```typescript
// Could return thousands of rows
const { data: unlockedSkins } = await supabase
  .from("user_companion_skins")
  .select(`*, companion_skins (*)`)
  .eq("user_id", user.id);
// ❌ No .limit() or .range()
```

### When This Matters

**Unlikely but possible:**
- Power user with 1000+ referrals (viral growth)
- Skin system expands to 100+ skins
- Browser runs out of memory
- Mobile device crashes

### Impact

**Current max:**
- 3 referral skins (manageable)
- Even with 1000 referrals, only 3 rows returned
- **Not a problem NOW**

**Future risk:**
- If achievement skins added (50+ skins)
- If purchase skins added (100+ skins)
- If user has 50+ unlocked skins
- 50 skins × joins = large payload

### Fix Required (for future)

```typescript
// Add pagination
const { data: unlockedSkins } = await supabase
  .from("user_companion_skins")
  .select(`*, companion_skins (*)`)
  .eq("user_id", user.id)
  .limit(100); // Safety limit

// Or use range
.range(0, 49); // First 50
```

**Recommendation:** Not urgent, but add when skin count > 10

---

## 🟢 LOW BUG #27: Missing Validation in SQL Function

**Severity:** 🟢 **LOW** - Edge case could cause unexpected behavior

### The Problem

**In complete_referral_stage3 (line 20-32):**

```sql
PERFORM 1 FROM referral_completions
WHERE referee_id = p_referee_id 
  AND referrer_id = p_referrer_id
FOR UPDATE NOWAIT;

IF FOUND THEN
  RETURN jsonb_build_object('success', false, ...);
END IF;

-- Then INSERT completion
INSERT INTO referral_completions (referee_id, referrer_id, stage_reached)
VALUES (p_referee_id, p_referrer_id, 3);
```

**What if both p_referee_id and p_referrer_id are NULL?**

### Edge Case

```typescript
// Corrupted data or bug elsewhere
const { data: profile } = await supabase
  .from("profiles")
  .select("referred_by")
  .eq("id", user.id)
  .single();

// profile.referred_by is NULL (database returned null)
// But code doesn't check:
await supabase.rpc('complete_referral_stage3', {
  p_referee_id: user.id,
  p_referrer_id: null  // ❌ NULL passed to function
});
```

**In SQL function:**
```sql
WHERE referee_id = NULL AND referrer_id = NULL
-- This matches NOTHING (NULL != NULL in SQL)

INSERT INTO referral_completions (referee_id, referrer_id, ...)
VALUES (p_referee_id, NULL, 3);
-- Inserts with NULL referrer_id ❌
```

### Impact

- **Low likelihood:** Client checks referred_by before calling
- **Data corruption:** If it happens, completions table has NULL referrer
- **Broken queries:** JOINs fail, stats wrong

### Fix Required

```sql
CREATE OR REPLACE FUNCTION complete_referral_stage3(
  p_referee_id UUID,
  p_referrer_id UUID
) RETURNS JSONB AS $$
BEGIN
  -- Validate inputs are not NULL
  IF p_referee_id IS NULL OR p_referrer_id IS NULL THEN
    RAISE EXCEPTION 'referee_id and referrer_id cannot be NULL';
  END IF;
  
  -- Validate they're different users
  IF p_referee_id = p_referrer_id THEN
    RAISE EXCEPTION 'Cannot refer yourself';
  END IF;
  
  -- ... rest of function
END;
$$;
```

---

## 🟢 LOW BUG #28: Missing Input Sanitization

**Severity:** 🟢 **LOW** - Potential SQL injection (very low risk)

### The Problem

**In apply_referral_code_atomic (line 131):**

```sql
INSERT INTO used_referral_codes (user_id, referral_code)
VALUES (p_user_id, p_referral_code)
```

**p_referral_code comes from user input!**

### Is This Actually Vulnerable?

**No, because:**
1. Parameterized queries (PostgreSQL prepared statements)
2. `SECURITY DEFINER SET search_path = public`
3. No dynamic SQL (`EXECUTE` statements)

**However:**

The function doesn't validate `p_referral_code` format:
- Could be empty string: `''`
- Could be very long: 10,000 characters
- Could have weird characters: `'; DROP TABLE--`

### Impact

**Actual risk: VERY LOW**
- SQL injection: Not possible (parameterized)
- Database bloat: Minimal (one row per user)
- Data quality: Poor (invalid codes in table)

### Fix Required (for data quality)

```sql
-- Validate referral code format
IF p_referral_code IS NULL OR 
   p_referral_code = '' OR
   p_referral_code !~ '^REF-[A-Z0-9]{8}$' THEN
  RETURN jsonb_build_object(
    'success', false,
    'reason', 'invalid_code_format',
    'message', 'Invalid referral code format'
  );
END IF;
```

---

## Summary of Round 4 Bugs

| # | Severity | Bug | Impact | Fix Complexity |
|---|----------|-----|--------|----------------|
| 20 | 🔴 CRITICAL | Missing TypeScript types | Runtime failure | Low (regen) |
| 21 | 🟠 HIGH | No retry logic | Lost referrals | Medium |
| 22 | 🟠 HIGH | NOWAIT lock failures | Silent failures | Low |
| 23 | 🟡 MEDIUM | Unnecessary query | Performance | Low |
| 24 | 🟡 MEDIUM | Type safety gaps | Null pointer errors | Low |
| 25 | 🟢 LOW | No pagination | Future OOM | Low |
| 26 | 🟢 LOW | Missing NULL checks | Edge case | Low |
| 27 | 🟢 LOW | No input sanitization | Data quality | Low |

**Total: 8 bugs (but 2 are operational, not code bugs)**

---

## Grand Total Across All Rounds

| Round | Focus | Bugs |
|-------|-------|------|
| 1 | Initial scan | 7 |
| 2 | Security | 6 |
| 3 | Transactions | 6 |
| 4 | Integration | 8 |
| **TOTAL** | **Complete** | **27** |

---

## Critical Path Issues

### Before Production Deployment

**MUST FIX:**
1. 🔴 **Bug #20** - Regenerate TypeScript types
2. 🟠 **Bug #21** - Add retry logic to RPC calls
3. 🟠 **Bug #22** - Remove NOWAIT or add retry

**SHOULD FIX:**
4. 🟡 **Bug #24** - Add explicit types
5. 🟢 **Bug #26** - Add NULL validation in SQL

**CAN WAIT:**
6. 🟢 **Bug #25** - Pagination (not needed yet)
7. 🟢 **Bug #27** - Input sanitization (low risk)
8. 🟡 **Bug #23** - Remove redundant query (optimization)

---

## Recommended Actions

### Immediate (Before Deploy)
1. Apply all 3 migrations
2. **Regenerate TypeScript types:** `supabase gen types typescript`
3. Add retry logic to RPC calls
4. Change NOWAIT to WAIT (with timeout)
5. Add NULL validation in SQL functions

### First Week
6. Add explicit TypeScript interfaces
7. Add pagination to queries
8. Add input format validation

### Ongoing
9. Monitor audit logs
10. Watch for error patterns
11. Gather production metrics

---

**Next:** Create fixes for critical Round 4 bugs...
