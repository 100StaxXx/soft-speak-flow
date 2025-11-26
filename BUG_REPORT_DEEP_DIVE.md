# 🚨 DEEP BUG SCAN - Critical Issues Found

**Date:** November 26, 2025  
**Scan Type:** Deep security & logic analysis  
**Status:** 🔴 **6 NEW CRITICAL/HIGH BUGS FOUND**

---

## 🔴 CRITICAL BUG #8: Infinite Referral Farming via Companion Reset

**Severity:** 🔴 **CRITICAL** - Allows unlimited referral credit exploitation

### The Exploit

**Attack Vector:**
1. User A refers User B with code `REF-A`
2. User B applies code and reaches Stage 3
3. User A's `referral_count` increments: 0 → 1
4. User B's `referred_by` is cleared (as designed)
5. **User B resets companion** (via ResetCompanionButton)
6. User B creates new companion
7. **User B applies code `REF-A` AGAIN** (no validation prevents this!)
8. User B reaches Stage 3 again
9. User A's `referral_count` increments: 1 → 2
10. **Repeat steps 5-9 infinitely**

**Result:** User A unlocks ALL skins with just 1 real referral!

### Why It Happens

**In `reset-companion` edge function:**
```typescript
// Lines 44-60: Deletes companion but NOT profiles data
const { error: delXpErr } = await supabase
  .from('xp_events')
  .delete()
  .eq('companion_id', compId);

const { error: delEvoErr } = await supabase
  .from('companion_evolutions')
  .delete()
  .eq('companion_id', compId);

const { error: delCompErr } = await supabase
  .from('user_companion')
  .delete()
  .eq('id', compId);

// ❌ MISSING: Clear referred_by to prevent re-application
```

**In `applyReferralCode` mutation:**
```typescript
// Lines 69-76: Only checks if referred_by is currently set
const { data: currentProfile } = await supabase
  .from("profiles")
  .select("referred_by")
  .eq("id", user.id)
  .single();

if (currentProfile?.referred_by) {
  throw new Error("You have already used a referral code");
}
// ❌ PROBLEM: After reset, referred_by is NULL again!
```

### Impact

- **Referral fraud:** One user can generate unlimited referrals
- **Skin exploitation:** Unlock all milestone skins with 1 friend
- **Unfair advantage:** Gaming the system
- **Data integrity:** Inflated referral counts
- **Support burden:** Legitimate users reporting fraud

### Proof of Concept

```typescript
// Malicious user script
for (let i = 0; i < 100; i++) {
  await resetCompanion();
  await createNewCompanion();
  await applyReferralCode("REF-VICTIM");
  await reachStage3(); // Farm XP quickly
  // Referrer gets +1 count each time
}
// Result: 100 referral credits from 0 real referrals
```

### Fix Required

**Option 1: Track referral history permanently**
```sql
-- Add to migration
CREATE TABLE referral_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referee_id UUID NOT NULL REFERENCES profiles(id),
  referrer_id UUID NOT NULL REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referee_id, referrer_id)
);

-- Modify validation logic
-- Check referral_history instead of just referred_by
```

**Option 2: Never clear `referred_by` (simpler)**
```typescript
// In validateReferralAtStage3(), REMOVE this:
await supabase
  .from("profiles")
  .update({ referred_by: null })
  .eq("id", user.id);

// Instead, track completion in separate field:
ALTER TABLE profiles ADD COLUMN referral_completed BOOLEAN DEFAULT false;

// Check both referred_by AND !referral_completed
```

**Option 3: Use one-time token system**
```sql
-- Generate one-time use token when code is applied
-- Token is consumed on Stage 3, cannot be reused
```

---

## 🔴 CRITICAL BUG #9: Stage Bypass - Referral Validation Can Be Skipped

**Severity:** 🔴 **CRITICAL** - Referral validation can be completely bypassed

### The Issue

**In `evolveCompanion` mutation (useCompanion.ts:562-564):**
```typescript
// Check if user reached Stage 3 and validate referral
if (newStage === 3) {
  await validateReferralAtStage3();
}
```

**Problems:**

1. **Only checks `newStage === 3`** - What if user goes from Stage 2 → Stage 4+ directly?
2. **XP formula could allow stage skipping** with large XP gains
3. **No validation for Stages 0, 1, 2** reaching 3

### Scenarios Where Validation Fails

**Scenario 1: Large XP Award**
```typescript
// User at Stage 2 with 180 XP (Stage 3 threshold: 200 XP)
// User completes high-value task: +500 XP
// newXP = 680 (exceeds Stage 4 threshold: 450 XP)
// Evolution goes: Stage 2 → Stage 4 directly
// validateReferralAtStage3() is NEVER called!
```

**Scenario 2: Manual Stage Manipulation** (if possible)
```sql
-- If any admin/debug tool allows:
UPDATE user_companion 
SET current_stage = 5 
WHERE user_id = 'malicious_user';
-- Referral never validated
```

**Scenario 3: Starting at Stage > 0**
- If companion creation ever starts at Stage 1+ (bug or feature)
- Reaching Stage 3 from Stage 1 works
- But what if starting at Stage 3 or 4?

### Impact

- **Referral bypass:** Users skip Stage 3 validation entirely
- **No rewards for referrer:** Legitimate referrers lose credits
- **Data inconsistency:** `referred_by` never cleared
- **Audit trail broken:** No record in audit log

### Fix Required

```typescript
// In evolveCompanion, check if PASSING THROUGH Stage 3
const oldStage = companion.current_stage;
const newStage = evolutionData.new_stage;

// Check if we crossed Stage 3 (not just landed on it)
if (oldStage < 3 && newStage >= 3) {
  await validateReferralAtStage3();
}
```

Or better, check the companion's history:
```sql
-- Add to profiles
ALTER TABLE profiles ADD COLUMN stage_3_validated BOOLEAN DEFAULT false;

-- In validation, check this flag instead
```

---

## 🟠 HIGH BUG #10: RLS Allows Users to Modify Own Referral Fields

**Severity:** 🟠 **HIGH** - Users can self-award referral credits

### The Vulnerability

**Current RLS Policy (migration 20251114163453):**
```sql
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
```

**This allows users to UPDATE ANY column in their profile, including:**
- `referral_count` ← Can set to 99
- `referral_code` ← Can change to steal others' codes
- `referred_by` ← Can set to any user

### Exploitation

```typescript
// Malicious user in browser console
await supabase
  .from('profiles')
  .update({ referral_count: 999 })
  .eq('id', currentUser.id);

// Result: All skins unlocked instantly!
```

### Proof of Concept

```typescript
// In browser DevTools console:
const { data, error } = await supabase
  .from('profiles')
  .update({ 
    referral_count: 5,  // Unlock all skins
    referral_code: 'REF-HACKER', // Steal someone's code
    referred_by: 'victim-uuid'   // Frame someone
  })
  .eq('id', localStorage.getItem('userId'));

console.log(data); // ✅ Success! RLS allows it
```

### Impact

- **Self-service fraud:** Instant skin unlocks
- **Code theft:** Steal referral credits from others
- **Framing:** Make it look like someone referred you
- **Data corruption:** Arbitrary profile modifications

### Fix Required

**Use column-level restrictions:**

```sql
-- Drop existing policy
DROP POLICY "Users can update own profile" ON public.profiles;

-- Create restricted policy
CREATE POLICY "Users can update own profile limited"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND referral_count = OLD.referral_count  -- Cannot modify
    AND referral_code = OLD.referral_code    -- Cannot modify
    AND (referred_by = OLD.referred_by OR    -- Can only set once
         (OLD.referred_by IS NULL AND referred_by IS NOT NULL))
  );
```

Or separate into multiple policies:
```sql
-- Allow updating safe fields
CREATE POLICY "Users can update profile settings"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
  -- Then use GENERATED ALWAYS columns for referral fields
  
ALTER TABLE profiles 
  ALTER COLUMN referral_count SET DEFAULT 0;
  -- Make it so only triggers can modify referral fields
```

---

## 🟠 HIGH BUG #11: increment_referral_count() No Validation

**Severity:** 🟠 **HIGH** - Function can fail silently or crash

### The Issue

**Current function (20251126_fix_referral_bugs.sql:2-13):**
```sql
CREATE OR REPLACE FUNCTION increment_referral_count(referrer_id UUID)
RETURNS TABLE(referral_count INTEGER) AS $$
BEGIN
  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = referrer_id
  RETURNING profiles.referral_count INTO referral_count;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;
```

**Problems:**

1. **No check if `referrer_id` exists**
   - UPDATE runs but affects 0 rows
   - Returns NULL instead of error
   - Caller thinks it succeeded

2. **No return value validation**
   - What if UPDATE affects 0 rows?
   - RETURNING clause returns nothing
   - referral_count variable stays NULL

3. **No error on failure**
   - Silent failure = hardest bugs to debug
   - Referrer never gets credit
   - User thinks system is broken

### Scenarios

**Scenario 1: Deleted User**
```sql
-- User A refers User B
-- User A deletes account (or admin deletes)
-- User B reaches Stage 3
-- increment_referral_count('deleted-user-id')
-- Returns NULL, no error
-- Caller assumes success!
```

**Scenario 2: Invalid UUID**
```sql
-- Corruption in database
-- referred_by = 'invalid-uuid-format'
-- Function called with garbage input
-- Silent failure
```

### Fix Required

```sql
CREATE OR REPLACE FUNCTION increment_referral_count(referrer_id UUID)
RETURNS TABLE(referral_count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Validate referrer exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = referrer_id) THEN
    RAISE EXCEPTION 'Referrer profile not found: %', referrer_id;
  END IF;

  -- Atomic increment with validation
  UPDATE profiles
  SET referral_count = COALESCE(referral_count, 0) + 1
  WHERE id = referrer_id
  RETURNING profiles.referral_count INTO v_count;
  
  -- Ensure update succeeded
  IF v_count IS NULL THEN
    RAISE EXCEPTION 'Failed to increment referral count for: %', referrer_id;
  END IF;
  
  referral_count := v_count;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

---

## 🟡 MEDIUM BUG #12: Foreign Key Missing on referred_by

**Severity:** 🟡 **MEDIUM** - Data integrity issue

### The Issue

**In migration 20251126072322 (line 4):**
```sql
ALTER TABLE profiles
ADD COLUMN referred_by UUID REFERENCES profiles(id),
```

**This IS a foreign key**, BUT:
- No `ON DELETE SET NULL` clause
- If referrer deletes account, what happens?

**PostgreSQL default:** `ON DELETE NO ACTION`
- **Prevents deletion** of referrer if they have referees!
- User can't delete account if someone used their code

### Scenario

```typescript
// User A refers User B
// User B applies code (referred_by = User A's ID)
// User A tries to delete account
// ERROR: foreign key constraint violation
// User A is stuck - can't delete account!
```

### Impact

- **Account deletion blocked**
- **GDPR compliance issue** (right to be forgotten)
- **Support burden** (manual intervention needed)

### Fix Required

```sql
-- Update migration
ALTER TABLE profiles
ADD COLUMN referred_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
```

This way:
- If referrer deletes account, `referred_by` becomes NULL
- Validation won't run (NULL check catches it)
- No orphaned references

---

## 🟡 MEDIUM BUG #13: Equip Skin Without Ownership Check

**Severity:** 🟡 **MEDIUM** - Users can equip skins they don't own

### The Issue

**In `equipSkin` mutation (useReferrals.ts:116-132):**
```typescript
// Unequip all other skins first
await supabase
  .from("user_companion_skins")
  .update({ is_equipped: false })
  .eq("user_id", user.id);

// Equip the selected skin
const { error } = await supabase
  .from("user_companion_skins")
  .update({ is_equipped: true })
  .eq("user_id", user.id)
  .eq("skin_id", skinId);  // ❌ Assumes row exists!
```

**Problem:** 
- If `skinId` doesn't exist for this user, UPDATE affects 0 rows
- No error is thrown
- User thinks skin is equipped, but it's not
- Client might show equipped state incorrectly

### Exploitation (Low Risk)

```typescript
// Try to equip someone else's skin
// Won't work due to user_id filter, but no error shown
equipSkin.mutate('some-random-skin-id');
// Silent failure
```

### Fix Required

```typescript
// Equip a skin
const equipSkin = useMutation({
  mutationFn: async (skinId: string) => {
    if (!user) throw new Error("User not authenticated");

    // FIX: Verify user owns this skin first
    const { data: ownedSkin, error: checkError } = await supabase
      .from("user_companion_skins")
      .select("id")
      .eq("user_id", user.id)
      .eq("skin_id", skinId)
      .maybeSingle();

    if (checkError) throw checkError;
    if (!ownedSkin) {
      throw new Error("You don't own this skin");
    }

    // Unequip all other skins first
    await supabase
      .from("user_companion_skins")
      .update({ is_equipped: false })
      .eq("user_id", user.id);

    // Equip the selected skin
    const { error } = await supabase
      .from("user_companion_skins")
      .update({ is_equipped: true })
      .eq("user_id", user.id)
      .eq("skin_id", skinId);

    if (error) throw error;
  },
  // ... rest
});
```

---

## Summary Table

| # | Severity | Bug | Exploitable? | Fix Complexity |
|---|----------|-----|--------------|----------------|
| 8 | 🔴 CRITICAL | Infinite referral farming via reset | ✅ YES - Easy | Medium |
| 9 | 🔴 CRITICAL | Stage bypass validation | ⚠️ Maybe | Low |
| 10 | 🟠 HIGH | RLS allows self-modification | ✅ YES - Trivial | Medium |
| 11 | 🟠 HIGH | Function no validation | ⚠️ Edge case | Low |
| 12 | 🟡 MEDIUM | FK missing ON DELETE | ⚠️ Edge case | Low |
| 13 | 🟡 MEDIUM | Equip without ownership | ⚠️ Low risk | Low |

---

## Priority Fix Order

### IMMEDIATE (Before Production)
1. 🔴 **Bug #8** - Infinite referral farming (HIGHEST PRIORITY)
2. 🔴 **Bug #9** - Stage bypass validation
3. 🟠 **Bug #10** - RLS policy too permissive

### HIGH PRIORITY (First Week)
4. 🟠 **Bug #11** - Function validation
5. 🟡 **Bug #12** - Foreign key ON DELETE

### MEDIUM PRIORITY (First Month)
6. 🟡 **Bug #13** - Equip ownership check

---

## Attack Scenarios

### Scenario 1: The Referral Farmer
```
1. User creates 2 accounts (A and B)
2. A refers B with REF-A
3. B reaches Stage 3 → A gets +1 count
4. B resets companion
5. B applies REF-A again
6. B reaches Stage 3 → A gets +1 count
7. Repeat 5x → A unlocks all skins
8. Total time: ~2 hours
9. Cost: $0
10. Detection difficulty: HIGH (looks like normal usage)
```

### Scenario 2: The RLS Hacker
```
1. User opens browser DevTools
2. Executes: 
   supabase.from('profiles')
           .update({ referral_count: 5 })
           .eq('id', userId)
3. All skins instantly unlocked
4. Total time: 30 seconds
5. Detection difficulty: MEDIUM (audit logs show suspicious update)
```

---

## Testing for Exploits

### Test Bug #8
```typescript
// Automated test
test('Cannot farm referrals via reset', async () => {
  const userA = await createUser();
  const userB = await createUser();
  
  // B applies A's code
  await applyCode(userB, userA.referralCode);
  await reachStage3(userB);
  
  let countAfterFirst = await getReferralCount(userA);
  expect(countAfterFirst).toBe(1);
  
  // B resets and tries again
  await resetCompanion(userB);
  await createCompanion(userB);
  
  // Should fail or not increment count
  await expect(applyCode(userB, userA.referralCode))
    .rejects.toThrow();
  
  // Or if it doesn't fail, count shouldn't increase
  await reachStage3(userB);
  let countAfterSecond = await getReferralCount(userA);
  expect(countAfterSecond).toBe(1); // Still 1, not 2
});
```

### Test Bug #10
```sql
-- Manual SQL test
BEGIN;
SET ROLE authenticated;
SET request.jwt.claims.sub = '<test_user_uuid>';

UPDATE profiles
SET referral_count = 999
WHERE id = '<test_user_uuid>';

-- Should fail with permission denied
-- Currently: SUCCEEDS (bug!)
ROLLBACK;
```

---

## Recommendations

1. **Deploy Bug #8 and #10 fixes ASAP** - Critical security issues
2. **Add comprehensive audit logging** for all referral operations
3. **Monitor for suspicious patterns:**
   - Same user reaching Stage 3 multiple times
   - Rapid referral_count increases
   - Profile updates to referral fields from client
4. **Consider rate limiting:**
   - Companion resets (max 1 per week?)
   - Referral code applications (max 1 ever?)
5. **Add admin dashboard** to review flagged referral activity

---

**Next Steps:**
1. Review and prioritize fixes
2. Create fix branches for critical bugs
3. Write comprehensive tests
4. Deploy to staging
5. Monitor for exploitation attempts
