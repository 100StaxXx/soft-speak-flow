# Apple Payments: Documentation vs. Reality

**A Line-by-Line Comparison**

---

## Claim #1: "Service Role Has Full Access"

### Documentation Says:
**File**: `APPLE_PAYMENTS_ROUND2_FIXES.md` (Line 132-136)

> **Security Impact**:
> - Prevents receipt sharing/theft
> - One payment = one account (as intended)
> - Protects revenue
> 
> **Database Improvements**
> - RLS policies should be least-privilege (SELECT only)
> - Use service_role for edge function operations

### Reality Check:

**File**: `supabase/functions/verify-apple-receipt/index.ts` (Lines 15-23)
```typescript
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",  // ❌ ANON KEY, not service role
  {
    global: {
      headers: { Authorization: req.headers.get("Authorization")! },
    },
  }
);
```

**For Comparison** - What's Correct:

**File**: `supabase/functions/apple-webhook/index.ts` (Lines 47-50)
```typescript
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",  // ✅ SERVICE ROLE KEY
);
```

### Verdict: ❌ **DOCS WRONG** - Claims service role is used, but implementation uses anon key

---

## Claim #2: "RLS Policies Properly Secured"

### Documentation Says:
**File**: `APPLE_PAYMENTS_ROUND2_FIXES.md` (Lines 109-136)

> ### ✅ Bug #11: Secure RLS Policies (HIGH PRIORITY SECURITY)
> 
> **After**:
> ```sql
> -- Only SELECT for users
> REVOKE ALL ON subscriptions FROM authenticated;
> GRANT SELECT ON subscriptions TO authenticated;
> 
> -- Full access for edge functions (service role)
> GRANT ALL ON subscriptions TO service_role;
> ```
> 
> **Security Impact**:
> - Users can't fake premium status
> - Users can't modify payment records
> - Only edge functions can write

### Reality Check:

**File**: `supabase/migrations/20251127_fix_rls_policies.sql` (Lines 5-15)
```sql
-- Revoke overly permissive grants
REVOKE ALL ON subscriptions FROM authenticated;
REVOKE ALL ON payment_history FROM authenticated;

-- Grant only SELECT (read-only) to authenticated users
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON payment_history TO authenticated;

-- Ensure service role has full access (for edge functions)
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON payment_history TO service_role;
```

✅ **Migration is correct**

BUT...

**File**: `supabase/functions/verify-apple-receipt/index.ts` (Lines 15-23)
```typescript
// Function runs as authenticated user, not service role
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",  // Authenticated context
  {
    global: {
      headers: { Authorization: req.headers.get("Authorization")! },
    },
  }
);
```

### What Happens:
1. RLS policy: "Only service_role can write"
2. Function: "I'm running as authenticated user"
3. Function tries to write: `await supabase.from("subscriptions").upsert(...)`
4. Database: "Permission denied - you're not service_role"
5. Purchase fails

### Verdict: ⚠️ **PARTIALLY TRUE** - Policies ARE secure, but function can't work because of it

---

## Claim #3: "Receipt Hijacking Prevented"

### Documentation Says:
**File**: `APPLE_PAYMENTS_ROUND2_FIXES.md` (Lines 56-84)

> ### ✅ Bug #9: Receipt Hijacking Prevention (CRITICAL SECURITY)
> 
> **After**:
> ```typescript
> // Check if receipt already belongs to another user
> const { data: existingSubscription } = await supabase
>   .from("subscriptions")
>   .select("user_id")
>   .eq("stripe_subscription_id", originalTransactionId)
>   .maybeSingle();
> 
> if (existingSubscription && existingSubscription.user_id !== userId) {
>   throw new Error("This receipt is already registered to another account");
> }
> ```

### Reality Check:

**File**: `supabase/functions/verify-apple-receipt/index.ts` (Lines 121-130)
```typescript
// SECURITY: Check if this receipt is already registered to another user (prevent hijacking)
const { data: existingSubscription } = await supabase
  .from("subscriptions")
  .select("user_id")
  .eq("stripe_subscription_id", originalTransactionId)
  .maybeSingle();

if (existingSubscription && existingSubscription.user_id !== userId) {
  throw new Error("This receipt is already registered to another account");
}
```

✅ **Code matches docs exactly**

BUT...

### Problem:
With anon key + RLS, the SELECT query will fail if:
1. User isn't authenticated (401 error before this code runs)
2. User is authenticated but different from existingSubscription.user_id (RLS filters it out)

Actually this might work for SELECT since RLS allows authenticated users to SELECT. However, the subsequent UPSERT will fail.

### Verdict: ⚠️ **CODE CORRECT, BUT NON-FUNCTIONAL** - Logic is right, but can't execute due to Issue #1

---

## Claim #4: "Payment Amounts Correct"

### Documentation Says:
**File**: `APPLE_PAYMENTS_ROUND2_FIXES.md` (Lines 87-106)

> ### ✅ Bug #10: Correct Payment Amounts (HIGH PRIORITY)
> 
> **Before**:
> ```typescript
> amount: 999, // Always $9.99
> ```
> 
> **After**:
> ```typescript
> // Determine correct payment amount based on plan
> let amount = 999; // Default $9.99 monthly
> if (plan === "yearly") {
>   amount = 9999; // $99.99 yearly
> }
> ```

### Reality Check:

**File**: `supabase/functions/verify-apple-receipt/index.ts` (Lines 138-143)
```typescript
// Determine correct payment amount based on plan
let amount = 999; // Default $9.99 monthly in cents
if (plan === "yearly") {
  amount = 9999; // $99.99 yearly in cents
}
```

### Verdict: ✅ **CORRECT** - Code matches docs, logic is sound

---

## Claim #5: "All 15 Bugs Fixed"

### Documentation Says:
**File**: `START_HERE_APPLE_PAYMENTS.md` (Lines 21-22)

> **Total**: 15 bugs found and fixed

### Bug List from Docs:

**Round 1** (7 bugs):
1. ✅ Missing current_period_start
2. ✅ Wrong receipt field  
3. ✅ No transaction states
4. ✅ Race conditions
5. ✅ Broken restore flow
6. ✅ No restore validation
7. ✅ No payment history

**Round 2** (8 bugs):
8. ✅ Trialing status ignored
9. ✅ Receipt hijacking
10. ✅ Wrong payment amounts
11. ✅ Overly permissive RLS
12. ✅ Payment not linked
13. ✅ Wrong HTTP codes
14. ✅ TypeScript types
15. ✅ Error handling

### Reality Check - Code Review:

| Bug | Claimed Fixed | Actually Fixed | Notes |
|-----|---------------|----------------|-------|
| #1 | ✅ | ✅ | current_period_start added line 158 |
| #2 | ✅ | ✅ | transactionReceipt \|\| receipt fallback |
| #3 | ✅ | ✅ | All states handled in appleIAP.ts |
| #4 | ✅ | ✅ | Duplicate check on line 145-149 |
| #5 | ✅ | ✅ | Sorting by date on line 68-72 |
| #6 | ✅ | ✅ | State filtering on line 74-77 |
| #7 | ✅ | ✅ | Payment history insert line 174-184 |
| #8 | ✅ | ✅ | Trialing support line 56-57 |
| #9 | ✅ | ⚠️ | Code correct, can't execute |
| #10 | ✅ | ✅ | Amount logic line 138-143 |
| #11 | ✅ | ❌ | RLS correct, function wrong |
| #12 | ✅ | ✅ | subscription_id linked line 177 |
| #13 | ✅ | ✅ | Status codes line 89-96 |
| #14 | ✅ | ✅ | Full types in useSubscription.ts |
| #15 | ✅ | ✅ | .maybeSingle() used correctly |

### New Bugs Found:
| Bug | Severity | Description |
|-----|----------|-------------|
| #16 | 🔴 Critical | Wrong Supabase key (Issue #1) |
| #17 | 🔴 Critical | Duplicate migrations (Issue #2) |
| #18 | 🟠 High | Misleading field names (Issue #3) |
| #19 | 🟡 Medium | Trigger logic error (Issue #4) |

### Verdict: ⚠️ **PARTIALLY TRUE** - 13/15 bugs actually fixed, but 4 new bugs introduced

---

## Claim #6: "Ready for Testing"

### Documentation Says:
**File**: `APPLE_PAYMENTS_ROUND2_FIXES.md` (Line 501)

> **Status**: ✅ **COMPLETE - Ready for Testing**

**File**: `START_HERE_APPLE_PAYMENTS.md` (Line 353)

> **Status**: ✅ **READY FOR TESTING**

### Reality Check:

**What Happens on Test #1** (First-Time Purchase):
```
Step 1: User taps "Subscribe Now" → ✅ Works
Step 2: iOS payment sheet appears → ✅ Works  
Step 3: User completes Face ID → ✅ Works
Step 4: Apple processes payment → ✅ Works
Step 5: App gets receipt from Apple → ✅ Works
Step 6: App calls verify-apple-receipt function → ✅ Works
Step 7: Function verifies with Apple → ✅ Works
Step 8: Function tries to write to subscriptions table → ❌ FAILS

Error: "new row violates row-level security policy for table 'subscriptions'"

Result: User charged, but premium not activated
```

### Test Failure Rate Estimate:

Tests that will fail immediately:
- Test 1: First-Time Purchase ❌
- Test 5: Rapid Multiple Clicks ❌
- Test 6: Restore Purchases ❌
- Test 10: Yearly Subscription ❌
- Test 23: Free Trial User Access ❌
- Test 24: Receipt Hijacking Prevention ❌
- Test 25: Yearly Subscription Amount ❌
- Test 26: RLS Policy Enforcement ❌

**Failure Rate**: 8/26 = **31% of tests will fail**

### Verdict: ❌ **NOT READY** - System will fail on first purchase attempt

---

## Claim #7: "Database Migration Applied"

### Documentation Says:
**File**: `START_HERE_APPLE_PAYMENTS.md` (Lines 84-88)

> ### 1. Deploy Database Migration (NEW - Required!)
> ```bash
> # Apply RLS policy fixes
> supabase db push
> ```

### Reality Check:

**Problem**: Two competing migrations exist:

**File 1**: `20250121_add_subscription_tables.sql` (older)
```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  ...
  user_id UUID NOT NULL REFERENCES auth.users(id),  -- No UNIQUE
```

**File 2**: `20251127012757_3997f8f9-3dc4-4ec9-ac2b-43401348821c.sql` (newer)
```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  ...
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),  -- UNIQUE added
```

**Issue**: `IF NOT EXISTS` means only the first one to run will create the table. If File 1 ran first, the UNIQUE constraint is missing.

### To Check Current State:
```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'subscriptions' AND constraint_type = 'UNIQUE';
```

**Expected**: 2 UNIQUE constraints (user_id + stripe_subscription_id)  
**If Bug Exists**: Only 1 UNIQUE constraint (stripe_subscription_id)

### Verdict: ⚠️ **UNKNOWN** - Depends on which migration ran first in production

---

## Side-by-Side: apple-webhook vs verify-apple-receipt

### Correct Implementation (apple-webhook)

```typescript
// apple-webhook/index.ts - Line 47-50
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",  // ✅ Correct
);

// Lines 196-208 - Can write to database
await supabase.from("subscriptions").upsert({
  user_id: userId,
  stripe_subscription_id: transactionId,
  plan,
  status: "active",
  ...
});  // ✅ Works - has service role permissions
```

### Broken Implementation (verify-apple-receipt)

```typescript
// verify-apple-receipt/index.ts - Line 15-23
const supabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",  // ❌ Wrong
  {
    global: {
      headers: { Authorization: req.headers.get("Authorization")! },
    },
  }
);

// Lines 152-163 - Tries to write to database
const { data: updatedSubscription } = await supabase.from("subscriptions").upsert({
  user_id: userId,
  stripe_subscription_id: originalTransactionId,
  plan,
  status: isActive ? "active" : "cancelled",
  ...
});  // ❌ Fails - doesn't have write permissions
```

### Why The Difference?

**apple-webhook**: Receives server-to-server notifications from Apple, no user context needed
**verify-apple-receipt**: Called by authenticated user, so someone thought it needed auth headers

**Mistake**: verify-apple-receipt needs to write to database on behalf of user, so it ALSO needs service role, just like the webhook.

---

## Documentation Quality Assessment

### What's Good:
- ✅ Comprehensive (2000+ lines across 6 docs)
- ✅ Well-organized with clear structure  
- ✅ Detailed bug descriptions
- ✅ Good test plan (26 test cases)
- ✅ Clear deployment instructions
- ✅ Helpful troubleshooting sections

### What's Problematic:
- ❌ Claims don't match implementation
- ❌ No evidence of actual device testing
- ❌ Over-optimistic "ready" status
- ❌ Doesn't acknowledge critical issues
- ❌ Multiple conflicting migrations not addressed
- ❌ Field naming issues dismissed as "nice to have"

### How This Happened:

**Likely Sequence**:
1. Bugs identified through code review ✅
2. Fixes planned and documented ✅
3. Some fixes implemented ✅
4. Code review of fixes done ✅
5. Documentation marked "complete" ✅
6. **Testing on device never happened** ❌
7. Critical Issue #1 never discovered ❌

---

## Recommendations for Documentation

### Immediate Updates Needed:

1. **Change Status**:
   ```markdown
   - Status: ✅ READY FOR TESTING
   + Status: ⚠️ CRITICAL BUGS FOUND - NOT READY
   ```

2. **Add Known Issues Section**:
   ```markdown
   ## Known Issues (Blocking)
   
   ### Issue #1: Wrong Database Key
   - File: verify-apple-receipt/index.ts
   - Impact: 100% purchase failure
   - Fix: Change ANON_KEY to SERVICE_ROLE_KEY
   - Status: Not fixed
   
   ### Issue #2: Duplicate Migrations
   - Files: Two subscription table migrations
   - Impact: Non-deterministic schema
   - Fix: Remove old migration
   - Status: Not fixed
   ```

3. **Update Testing Checklist**:
   ```markdown
   ### Before Testing (NEW)
   - [ ] Verify Issue #1 is fixed (check for SERVICE_ROLE_KEY)
   - [ ] Verify Issue #2 is fixed (only one migration)
   - [ ] Deploy updated function
   - [ ] Check edge function logs for RLS errors
   ```

### Long-Term Documentation Improvements:

1. **Add "Implementation Status" field** to each bug:
   - Fixed in code: Yes/No
   - Tested on device: Yes/No
   - Works in production: Yes/No

2. **Include Code Snippets** showing before/after for verification

3. **Add "How to Verify" section** for each fix with specific tests

4. **Create "Known Limitations"** section separate from bugs

5. **Add "Production Readiness Checklist"** with objective criteria

---

## Summary Table

| Claim | Documentation | Reality | Verdict |
|-------|---------------|---------|---------|
| Service role used | ✅ Yes | ❌ No (anon key) | ❌ FALSE |
| RLS secured | ✅ Yes | ⚠️ Yes, but blocks function | ⚠️ INCOMPLETE |
| Receipt hijacking prevented | ✅ Yes | ⚠️ Code right, can't run | ⚠️ NON-FUNCTIONAL |
| Payment amounts correct | ✅ Yes | ✅ Yes | ✅ TRUE |
| 15 bugs fixed | ✅ Yes | ⚠️ 13/15, 4 new found | ⚠️ MOSTLY TRUE |
| Ready for testing | ✅ Yes | ❌ No (will fail immediately) | ❌ FALSE |
| Migration applied | ✅ Yes | ⚠️ Unknown (conflicts exist) | ⚠️ UNCLEAR |

---

## Conclusion

The documentation is **well-written and comprehensive**, but contains **critical inaccuracies** because:

1. **Code review happened**, but **device testing did not**
2. **Fixes were planned** better than they were **implemented**
3. **Status markers** are optimistic rather than realistic
4. **"Ready" declaration** was premature

**Not a documentation problem** - it's a **testing gap problem** that manifested as documentation inaccuracies.

---

**Recommendation**: Update all docs to reflect "IN PROGRESS - BLOCKING ISSUES FOUND" status after fixing Issues #1 and #2.

---

**Analysis by**: Claude 4.5 Sonnet  
**Date**: November 27, 2025  
**Method**: Line-by-line code vs. docs comparison
