# Apple Payments Bug Report - Round 2 (Deep Audit)

**Date**: November 27, 2025  
**Type**: Deep Security & Logic Audit  
**Focus**: Additional bugs found after initial fixes

---

## Executive Summary

Found **8 additional bugs** in deeper audit:
- 3 Critical security/logic issues
- 3 High priority data integrity issues  
- 2 Medium priority type safety issues

These bugs wouldn't necessarily prevent purchases, but could cause:
- Security vulnerabilities (receipt hijacking)
- Data integrity issues (wrong amounts, broken trials)
- Type safety errors
- Overly permissive database access

---

## Bug #8: Trialing Status Not Supported in API (CRITICAL)

**Files**: 
- `/supabase/functions/check-apple-subscription/index.ts:51`
- `/src/hooks/useSubscription.ts:36`

**Problem**: 
Database supports "trialing" status and sets `is_premium = true` for trialing users, but the API check only considers "active" status:

```typescript
// check-apple-subscription/index.ts:51
const isActive = expiresAt > new Date() && subscription.status === "active";
// ❌ Ignores "trialing" status

// But database trigger (line 76 in migration):
is_premium = (NEW.status IN ('active', 'trialing'))
// ✅ Supports trialing
```

**Impact**:
- Users in trial period will show as NOT subscribed in the app
- SubscriptionGate might block trial users
- Trial functionality completely broken
- Free trial feature won't work

**Who Gets Hit**:
- Any user using Apple's free trial offer
- Expected: 30-50% of new subscribers

**Fix Required**:
```typescript
// check-apple-subscription/index.ts
const isActive = expiresAt > new Date() && 
  (subscription.status === "active" || subscription.status === "trialing");
```

**Also Fix TypeScript Types**:
```typescript
// useSubscription.ts:36
const subscription = subscriptionData ? {
  status: subscriptionData.status as "active" | "cancelled" | "trialing" | "past_due",
  // ❌ Currently only casts to "active" | "cancelled"
  plan: subscriptionData.plan as "monthly" | "yearly",
  current_period_end: subscriptionData.subscription_end,
} : null;
```

---

## Bug #9: Receipt Can Be Hijacked (CRITICAL SECURITY)

**File**: `/supabase/functions/verify-apple-receipt/index.ts`

**Problem**:
No validation that the Apple receipt actually belongs to the authenticated user. A malicious user could:
1. Copy someone else's valid receipt
2. Submit it to their own account
3. Get premium access without paying

**Attack Scenario**:
```
1. User A purchases subscription (gets receipt R1)
2. User A posts receipt R1 online (screenshot, forum, etc.)
3. User B copies receipt R1
4. User B calls verify-apple-receipt with receipt R1
5. User B gets premium access using User A's payment
```

**Current Code**:
```typescript
// No check that receipt belongs to this user!
await supabase.functions.invoke('verify-apple-receipt', {
  body: { receipt: purchase.transactionReceipt },
});
```

**Impact**:
- Revenue loss from receipt sharing
- One payment = unlimited accounts
- Violates Apple's terms of service

**Fix Required**:
```typescript
// In verify-apple-receipt/index.ts
async function updateSubscription(supabase: any, userId: string, receiptData: any) {
  const latestReceipt = receiptData.latest_receipt_info?.[0];
  
  // ✅ Check if this transaction is already assigned to another user
  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", latestReceipt.original_transaction_id)
    .maybeSingle();
  
  if (existingSubscription && existingSubscription.user_id !== userId) {
    throw new Error("This receipt is already registered to another account");
  }
  
  // Rest of function...
}
```

---

## Bug #10: Wrong Payment Amount in History (HIGH PRIORITY)

**File**: `/supabase/functions/verify-apple-receipt/index.ts:151`

**Problem**:
Payment amount is hardcoded to $9.99 (999 cents) but should vary based on plan:

```typescript
await supabase.from("payment_history").insert({
  user_id: userId,
  stripe_payment_intent_id: originalTransactionId,
  stripe_invoice_id: latestReceipt.transaction_id,
  amount: 999, // ❌ Always $9.99, even for yearly plan ($99.99)
  currency: "usd",
  status: "succeeded",
  created_at: purchaseDate.toISOString(),
});
```

**Impact**:
- Payment history shows wrong amounts for yearly subscriptions
- Financial reporting inaccurate
- Revenue tracking broken
- Could cause accounting issues

**Fix Required**:
```typescript
// Determine correct amount based on plan
let amount: number;
if (plan === "yearly") {
  amount = 9999; // $99.99 in cents
} else {
  amount = 999; // $9.99 in cents
}

await supabase.from("payment_history").insert({
  user_id: userId,
  stripe_payment_intent_id: originalTransactionId,
  stripe_invoice_id: latestReceipt.transaction_id,
  amount: amount,
  currency: "usd",
  status: "succeeded",
  created_at: purchaseDate.toISOString(),
});
```

**Better Solution** (use Apple's actual amount):
```typescript
// Apple provides the actual price in the receipt
const amount = latestReceipt.price_amount_micros 
  ? Math.round(latestReceipt.price_amount_micros / 10000) // Convert micros to cents
  : (plan === "yearly" ? 9999 : 999); // Fallback
```

---

## Bug #11: Overly Permissive RLS Policies (HIGH PRIORITY SECURITY)

**File**: `/supabase/migrations/20250121_add_subscription_tables.sql:117-118`

**Problem**:
RLS policies grant ALL permissions to authenticated users:

```sql
-- Lines 117-118
GRANT ALL ON subscriptions TO authenticated;
GRANT ALL ON payment_history TO authenticated;
```

This allows users to:
- INSERT new subscriptions (fake premium)
- UPDATE anyone's subscription
- DELETE payment history
- Modify subscription_status

**Impact**:
- Users can give themselves premium without paying
- Malicious users can modify/delete data
- Major security vulnerability

**Fix Required**:
```sql
-- Remove overly permissive grants
REVOKE ALL ON subscriptions FROM authenticated;
REVOKE ALL ON payment_history FROM authenticated;

-- Grant only SELECT (read-only)
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON payment_history TO authenticated;

-- Edge functions use service role, so they can still write
-- RLS policies already restrict to user's own data
```

**Additional RLS Policies Needed**:
```sql
-- Allow service role to insert/update (for edge functions)
CREATE POLICY "Service role can insert subscriptions"
  ON subscriptions FOR INSERT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.role() = 'service_role');

-- Same for payment_history
CREATE POLICY "Service role can insert payment history"
  ON payment_history FOR INSERT
  USING (auth.role() = 'service_role');
```

---

## Bug #12: Payment History Not Linked to Subscription (HIGH PRIORITY)

**File**: `/supabase/functions/verify-apple-receipt/index.ts:147-156`

**Problem**:
Payment history has a `subscription_id` field but it's never populated:

```typescript
await supabase.from("payment_history").insert({
  user_id: userId,
  // subscription_id: ???, // ❌ Missing!
  stripe_payment_intent_id: originalTransactionId,
  // ...
});
```

**Impact**:
- Can't link payments to specific subscriptions
- Historical tracking broken
- Reporting queries more complex
- Can't see payment history per subscription

**Fix Required**:
```typescript
// First, get the subscription ID
const { data: subscription } = await supabase
  .from("subscriptions")
  .select("id")
  .eq("user_id", userId)
  .single();

// Then insert payment with link
if (!existingPayment) {
  await supabase.from("payment_history").insert({
    user_id: userId,
    subscription_id: subscription?.id, // ✅ Link to subscription
    stripe_payment_intent_id: originalTransactionId,
    stripe_invoice_id: latestReceipt.transaction_id,
    amount: amount,
    currency: "usd",
    status: "succeeded",
    created_at: purchaseDate.toISOString(),
  });
}
```

---

## Bug #13: Error Status Code Inconsistency (MEDIUM PRIORITY)

**File**: `/supabase/functions/check-apple-subscription/index.ts:71`

**Problem**:
All errors return 400 (Bad Request), even authorization errors:

```typescript
} catch (error: any) {
  console.error("Error checking subscription:", error);
  return new Response(
    JSON.stringify({ error: error?.message || "Unknown error" }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400, // ❌ Always 400, even for auth errors
    }
  );
}
```

**Impact**:
- Unauthorized users get 400 instead of 401
- Makes debugging harder
- Non-standard HTTP status codes
- Frontend can't distinguish error types

**Fix Required**:
```typescript
} catch (error: any) {
  console.error("Error checking subscription:", error);
  
  // Determine appropriate status code
  let statusCode = 500; // Default to server error
  if (error.message === "Unauthorized") {
    statusCode = 401;
  } else if (error.message?.includes("not found") || !subscription) {
    statusCode = 404;
  } else if (error.message?.includes("invalid")) {
    statusCode = 400;
  }
  
  return new Response(
    JSON.stringify({ error: error?.message || "Unknown error" }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: statusCode,
    }
  );
}
```

---

## Bug #14: TypeScript Type Narrowing Issue (MEDIUM PRIORITY)

**File**: `/src/hooks/useSubscription.ts:36-39`

**Problem**:
Status is cast to incomplete union type:

```typescript
const subscription = subscriptionData ? {
  status: subscriptionData.status as "active" | "cancelled",
  // ❌ Missing "trialing" | "past_due" | "incomplete"
  plan: subscriptionData.plan as "monthly" | "yearly",
  current_period_end: subscriptionData.subscription_end,
} : null;
```

**Impact**:
- TypeScript won't catch status bugs
- "trialing" status treated as "cancelled" 
- Type safety broken
- Runtime errors possible

**Fix Required**:
```typescript
// Match database schema
export interface Subscription {
  status: "active" | "cancelled" | "past_due" | "trialing" | "incomplete";
  plan: "monthly" | "yearly";
  trial_ends_at?: string | null;
  current_period_end?: string | null;
}

const subscription = subscriptionData ? {
  status: subscriptionData.status as Subscription["status"],
  plan: subscriptionData.plan as Subscription["plan"],
  current_period_end: subscriptionData.subscription_end,
} : null;
```

---

## Bug #15: Single() Error Not Handled (MEDIUM PRIORITY)

**File**: `/supabase/functions/check-apple-subscription/index.ts:34-38`

**Problem**:
Using `.single()` when subscription might not exist:

```typescript
const { data: subscription } = await supabaseClient
  .from("subscriptions")
  .select("*")
  .eq("user_id", user.id)
  .single(); // ❌ Throws error if no rows

if (!subscription) {
  return new Response(
    JSON.stringify({ subscribed: false }),
    // ...
  );
}
```

**Issue**:
`.single()` throws an error if 0 rows found. The code expects to check `if (!subscription)` but the error is thrown before that check.

**Impact**:
- New users without subscriptions might get errors
- Should use `.maybeSingle()` instead
- Error logs filled with false positives

**Fix Required**:
```typescript
const { data: subscription, error: subError } = await supabaseClient
  .from("subscriptions")
  .select("*")
  .eq("user_id", user.id)
  .maybeSingle(); // ✅ Returns null if not found

if (subError) {
  throw subError;
}

if (!subscription) {
  return new Response(
    JSON.stringify({ subscribed: false }),
    {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    }
  );
}
```

---

## Summary of Round 2 Bugs

| # | Bug | Severity | Impact | Users Affected |
|---|-----|----------|--------|----------------|
| 8 | Trialing status ignored | 🔴 Critical | Trial users blocked | 30-50% new users |
| 9 | Receipt hijacking possible | 🔴 Critical | Security breach | Malicious users |
| 10 | Wrong payment amounts | 🟠 High | Wrong financial data | Yearly subscribers |
| 11 | Overly permissive RLS | 🟠 High | Security vulnerability | All users |
| 12 | Payment history not linked | 🟠 High | Data integrity | All payments |
| 13 | Wrong HTTP status codes | 🟡 Medium | Poor error handling | All errors |
| 14 | TypeScript type issues | 🟡 Medium | Type safety broken | Developers |
| 15 | .single() error handling | 🟡 Medium | False error logs | New users |

---

## Priority Fixes

### Must Fix Before Launch (Blocking)
1. ✅ Bug #8 - Trialing status support
2. ✅ Bug #9 - Receipt hijacking protection
3. ✅ Bug #11 - RLS policy restrictions

### Should Fix Before Launch (High Priority)
4. ✅ Bug #10 - Correct payment amounts
5. ✅ Bug #12 - Link payment history
6. ✅ Bug #13 - HTTP status codes

### Can Fix Post-Launch (Nice to Have)
7. 🔶 Bug #14 - TypeScript types
8. 🔶 Bug #15 - maybeSingle() usage

---

## Testing Additions Required

### Test Cases to Add:

**Test 23: Free Trial User Access**
- Start free trial
- Verify is_premium = true
- Verify all premium features accessible
- Check subscription_status = "trialing"

**Test 24: Receipt Hijacking Prevention**
- User A purchases subscription
- User B tries to use same receipt
- Verify User B gets error
- Verify only User A has premium

**Test 25: Yearly Subscription Payment Amount**
- Purchase yearly plan
- Check payment_history
- Verify amount = 9999 (not 999)

**Test 26: RLS Policy Enforcement**
- Try to INSERT subscription via client
- Try to UPDATE subscription via client
- Verify both are blocked
- Verify SELECT still works

---

## Estimated Impact If Not Fixed

| Bug | Launch Risk | Revenue Risk | Security Risk |
|-----|-------------|--------------|---------------|
| #8 - Trialing | 🔴 High | Medium | Low |
| #9 - Receipt hijacking | 🔴 High | 🔴 High | 🔴 Critical |
| #10 - Wrong amounts | Medium | Medium | Low |
| #11 - RLS policies | 🔴 High | 🔴 High | 🔴 Critical |
| #12 - Payment links | Low | Low | Low |
| #13 - Status codes | Low | Low | Low |
| #14 - TypeScript | Low | Low | Low |
| #15 - Error handling | Low | Low | Low |

**Overall**: 2 critical security bugs, 1 critical trial bug must be fixed before launch.

---

## Next Steps

1. ✅ Fix Bug #8 (trialing support)
2. ✅ Fix Bug #9 (receipt hijacking)
3. ✅ Fix Bug #11 (RLS policies)
4. ✅ Fix Bug #10 (payment amounts)
5. ✅ Fix Bug #12 (payment links)
6. ✅ Fix Bug #13 (status codes)
7. 📝 Update test plan with new tests
8. 🔄 Re-run security audit

---

## Related Documents

- `APPLE_PAYMENTS_BUG_REPORT.md` - Round 1 bugs (7 bugs, all fixed)
- `APPLE_PAYMENTS_FIXES_APPLIED.md` - Round 1 fixes summary
- `APPLE_IAP_TESTING_GUIDE.md` - Testing procedures (needs updates)

---

**Report Generated**: November 27, 2025  
**Audit Round**: 2 (Deep Security & Logic)  
**Status**: ⚠️ CRITICAL BUGS FOUND - Immediate action required
