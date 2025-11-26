# 🐛 Bug Report - Referral Skin System

**Date:** November 26, 2025  
**Severity Levels:** 🔴 CRITICAL | 🟠 HIGH | 🟡 MEDIUM | 🟢 LOW

---

## 🔴 CRITICAL BUG #1: Race Condition in Referral Count Increment

**Location:** `src/hooks/useCompanion.ts:452-466`

### Issue
The `validateReferralAtStage3()` function has a classic **read-modify-write race condition**:

```typescript
// Line 453-461: Read referral_count
const { data: referrer } = await supabase
  .from("profiles")
  .select("referral_count")
  .eq("id", profile.referred_by)
  .single();

const newCount = (referrer.referral_count || 0) + 1;

// Line 463-466: Write new count
await supabase
  .from("profiles")
  .update({ referral_count: newCount })
  .eq("id", profile.referred_by);
```

### Problem Scenario
1. User A refers Users B and C
2. User B reaches Stage 3 at 12:00:00.000
3. User C reaches Stage 3 at 12:00:00.050 (50ms later)
4. Both reads happen simultaneously, both see `referral_count = 0`
5. Both calculate `newCount = 1`
6. Both write `referral_count = 1`
7. **Result: User A only has count of 1 instead of 2**

### Impact
- **Lost referral credits** for users
- **Skins won't unlock** at correct milestones
- **User frustration** and support tickets
- Gets worse as app scales

### Fix Required
Use atomic increment in PostgreSQL:

```typescript
// CORRECT: Atomic increment
await supabase
  .from("profiles")
  .update({ referral_count: supabase.raw('referral_count + 1') })
  .eq("id", profile.referred_by)
  .select()
  .single();

// Then fetch the new count
const { data: updatedProfile } = await supabase
  .from("profiles")
  .select("referral_count")
  .eq("id", profile.referred_by)
  .single();

const newCount = updatedProfile.referral_count;
```

Or use a database function with proper locking.

---

## 🟠 HIGH BUG #2: Unhandled Duplicate Skin Insert Error

**Location:** `src/hooks/useCompanion.ts:480-488`

### Issue
The code tries to insert a skin but doesn't handle the UNIQUE constraint violation:

```typescript
// Line 480-488
await supabase
  .from("user_companion_skins")
  .insert({
    user_id: profile.referred_by,
    skin_id: skin.id,
    acquired_via: `referral_milestone_${newCount}`,
  })
  .select()
  .single();  // ❌ Will throw error if duplicate
```

Comment says "ignore if already exists" but doesn't actually ignore it!

### Problem Scenario
1. User A's referral count goes from 0 → 1 (Cosmic Aura unlocks)
2. Due to Bug #1, count gets reset or recalculated
3. System tries to unlock Cosmic Aura again
4. **UNIQUE(user_id, skin_id) constraint violation**
5. **Entire validateReferralAtStage3() fails**
6. Other operations might not complete

### Impact
- Evolution process could fail silently
- User sees evolution but skin doesn't unlock
- referred_by might not get cleared (Bug #1 gets worse)

### Fix Required
Use `ON CONFLICT DO NOTHING`:

```typescript
const { error: insertError } = await supabase
  .from("user_companion_skins")
  .insert({
    user_id: profile.referred_by,
    skin_id: skin.id,
    acquired_via: `referral_milestone_${newCount}`,
  });

// Ignore duplicate key error (code 23505)
if (insertError && insertError.code !== '23505') {
  console.error("Failed to unlock skin:", insertError);
}
```

Or use `.upsert()` with proper options.

---

## 🟡 MEDIUM BUG #3: Multiple Referral Codes Can Be Applied

**Location:** `src/hooks/useReferrals.ts:64-101`

### Issue
The `applyReferralCode()` function doesn't check if user already has a `referred_by` value:

```typescript
// Line 84-88: No check for existing referred_by
const { error: updateError } = await supabase
  .from("profiles")
  .update({ referred_by: referrer.id })
  .eq("id", user.id);
```

### Problem Scenario
1. New user applies Code A from User X
2. Before reaching Stage 3, user applies Code B from User Y
3. `referred_by` is overwritten: X → Y
4. User X loses the referral credit
5. User Y gets the credit instead

### Impact
- Referral theft possible (intentional or accidental)
- First referrer loses credit
- Gaming the system (users could trade codes)

### Fix Required
Add validation:

```typescript
// First check if already referred
const { data: currentProfile } = await supabase
  .from("profiles")
  .select("referred_by")
  .eq("id", user.id)
  .single();

if (currentProfile?.referred_by) {
  throw new Error("You have already used a referral code");
}

// Then update
const { error: updateError } = await supabase
  .from("profiles")
  .update({ referred_by: referrer.id })
  .eq("id", user.id)
  .eq("referred_by", null); // Extra safety
```

---

## 🟡 MEDIUM BUG #4: Clipboard API Availability Not Checked

**Location:** `src/components/ReferralDashboard.tsx:48-53`

### Issue
Code assumes `navigator.clipboard` exists:

```typescript
const copyToClipboard = () => {
  if (!referralStats?.referral_code) return;
  
  navigator.clipboard.writeText(referralStats.referral_code);  // ❌ Might not exist
  toast.success("Referral code copied to clipboard!");
};
```

### Problem Scenario
- Older browsers don't support Clipboard API
- Non-HTTPS contexts (localhost exceptions aside)
- iOS Safari in certain modes
- Browser extensions blocking clipboard access

### Impact
- Uncaught error in console
- Toast shows "copied" but nothing was copied
- User confusion

### Fix Required
Add proper error handling:

```typescript
const copyToClipboard = async () => {
  if (!referralStats?.referral_code) return;
  
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(referralStats.referral_code);
      toast.success("Referral code copied to clipboard!");
    } else {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = referralStats.referral_code;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success("Referral code copied to clipboard!");
    }
  } catch (error) {
    console.error("Copy failed:", error);
    toast.error("Failed to copy code. Please copy manually: " + referralStats.referral_code);
  }
};
```

---

## 🟢 LOW BUG #5: Non-null Assertion on unlock_requirement

**Location:** `src/components/CompanionSkins.tsx:92`

### Issue
Uses non-null assertion operator (!):

```typescript
Refer {skin.unlock_requirement} friend{skin.unlock_requirement! > 1 ? 's' : ''}
```

### Problem
- If `unlock_requirement` is null, runtime error
- Database allows NULL values for this field
- Seeded data has values, but future skins might not

### Impact
- Low likelihood (seeded data is correct)
- Could cause crashes if data is corrupted

### Fix Required
Use optional chaining:

```typescript
Refer {skin.unlock_requirement ?? 0} friend{(skin.unlock_requirement ?? 0) > 1 ? 's' : ''}
```

---

## 🟢 LOW BUG #6: Missing Loading/Disabled States on Share Button

**Location:** `src/components/ReferralDashboard.tsx:86-93`

### Issue
Share button doesn't show loading state:

```typescript
<Button
  className="w-full"
  onClick={handleShare}
  disabled={!referralStats?.referral_code}
>
  <Share className="mr-2 h-4 w-4" />
  Share Your Code
</Button>
```

### Problem
- Share action is async but button doesn't show loading
- User might click multiple times during share
- On iOS, Share Sheet takes time to open

### Impact
- Minor UX issue
- Potential duplicate share attempts

### Fix Required
Add loading state:

```typescript
const [isSharing, setIsSharing] = useState(false);

const handleShare = async () => {
  setIsSharing(true);
  try {
    // ... share logic
  } finally {
    setIsSharing(false);
  }
};

<Button
  className="w-full"
  onClick={handleShare}
  disabled={!referralStats?.referral_code || isSharing}
>
  <Share className="mr-2 h-4 w-4" />
  {isSharing ? "Sharing..." : "Share Your Code"}
</Button>
```

---

## 🟢 LOW BUG #7: Skin Effect Parsing Could Fail Silently

**Location:** `src/components/CompanionDisplay.tsx:84-103`

### Issue
CSS effect parsing doesn't handle malformed JSONB:

```typescript
const skinStyles = useMemo(() => {
  if (!equippedSkin?.css_effect) return {};
  
  const effects = equippedSkin.css_effect as any;  // ❌ No validation

  // Apply different effects based on skin type
  if (equippedSkin.skin_type === 'aura' && effects.glowColor) {
    return {
      boxShadow: `0 0 30px ${effects.glowColor}, 0 0 60px ${effects.glowColor}`,
      filter: `drop-shadow(0 0 20px ${effects.glowColor})`
    };
  }
  // ...
}, [equippedSkin]);
```

### Problem
- If JSONB structure changes, no fallback
- Malformed data could inject invalid CSS
- No validation of color values

### Impact
- Skins might not render
- Silent failures (user sees no effect)
- Potential CSS injection (low risk with CSP)

### Fix Required
Add validation:

```typescript
const skinStyles = useMemo(() => {
  if (!equippedSkin?.css_effect) return {};
  
  try {
    const effects = equippedSkin.css_effect as Record<string, any>;
    
    if (equippedSkin.skin_type === 'aura' && 
        effects.glowColor && 
        typeof effects.glowColor === 'string') {
      return {
        boxShadow: `0 0 30px ${effects.glowColor}, 0 0 60px ${effects.glowColor}`,
        filter: `drop-shadow(0 0 20px ${effects.glowColor})`
      };
    }
    // ... more validation
  } catch (error) {
    console.error("Failed to parse skin effects:", error);
    return {};
  }
  
  return {};
}, [equippedSkin]);
```

---

## Additional Edge Cases to Consider

### 1. User Deletes Account Before Referee Reaches Stage 3
**Scenario:** User A refers User B, then User A deletes their account. User B reaches Stage 3.

**Current Behavior:** 
- `validateReferralAtStage3()` tries to update non-existent profile
- Query returns null/error
- Function returns early (line 459)

**Impact:** Silently fails, which is okay (no one to reward)

**Status:** ✅ Already handled correctly

---

### 2. Skin Gets Deleted While User Has It Equipped
**Scenario:** Admin deletes a skin from `companion_skins` table.

**Current Behavior:**
- Foreign key with `ON DELETE CASCADE` removes from `user_companion_skins`
- User's equipped skin disappears

**Impact:** User loses skin without notification

**Recommendation:** Add database trigger to notify users or prevent deletion if in use

**Status:** ⚠️ Minor issue, unlikely scenario

---

### 3. User Reaches Stage 3 Multiple Times (Reset Companion)
**Scenario:** User reaches Stage 3, resets companion, reaches Stage 3 again.

**Current Behavior:**
- `referred_by` was already cleared first time
- Second evolution doesn't trigger referral validation

**Impact:** No double-counting (correct behavior)

**Status:** ✅ Working as intended

---

### 4. Referrer's Skin Unlocks But They're Offline
**Scenario:** User A refers User B. User B reaches Stage 3 while User A is offline.

**Current Behavior:**
- Skin unlocks in database
- User A sees it next time they open app
- No push notification

**Impact:** User might not know they unlocked a skin

**Recommendation:** Add push notification when skin unlocks

**Status:** ⚠️ Missing feature (not a bug, but UX improvement)

---

## Priority Fix Order

### Immediate (Before Production)
1. 🔴 **Bug #1** - Race condition (data corruption risk)
2. 🟠 **Bug #2** - Duplicate insert error (evolution failures)
3. 🟡 **Bug #3** - Multiple codes (fairness issue)

### High Priority (First Week)
4. 🟡 **Bug #4** - Clipboard fallback (user experience)

### Medium Priority (First Month)
5. 🟢 **Bug #5** - Non-null assertion (edge case)
6. 🟢 **Bug #6** - Share button loading state (polish)
7. 🟢 **Bug #7** - CSS parsing validation (robustness)

---

## Testing Recommendations

### Unit Tests Needed
```typescript
// useCompanion.ts
describe('validateReferralAtStage3', () => {
  it('should handle concurrent Stage 3 evolutions', async () => {
    // Test race condition fix
  });
  
  it('should not unlock same skin twice', async () => {
    // Test duplicate handling
  });
  
  it('should clear referred_by after processing', async () => {
    // Test cleanup
  });
});

// useReferrals.ts
describe('applyReferralCode', () => {
  it('should prevent applying multiple codes', async () => {
    // Test Bug #3 fix
  });
  
  it('should reject self-referral', async () => {
    // Test existing validation
  });
});
```

### Integration Tests
1. **Concurrent Evolution Test:**
   - Create 5 users all referred by User A
   - Have all 5 reach Stage 3 simultaneously
   - Verify User A's count = 5 (not 1, 2, or 4)

2. **Duplicate Code Prevention:**
   - User applies Code A
   - User tries to apply Code B
   - Verify error is thrown

3. **Clipboard Fallback:**
   - Mock `navigator.clipboard` as undefined
   - Click copy button
   - Verify fallback method works

---

## Database Migration Recommendations

### Add Check Constraint
```sql
-- Prevent negative referral counts
ALTER TABLE profiles
ADD CONSTRAINT referral_count_non_negative
CHECK (referral_count >= 0);
```

### Add Index for Performance
```sql
-- Speed up referred_by lookups
CREATE INDEX idx_profiles_referred_by 
ON profiles(referred_by) 
WHERE referred_by IS NOT NULL;
```

### Add Audit Log
```sql
-- Track referral events for debugging
CREATE TABLE referral_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES profiles(id),
  referee_id UUID REFERENCES profiles(id),
  event_type TEXT, -- 'code_applied', 'stage_3_reached', 'skin_unlocked'
  old_count INTEGER,
  new_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Summary

**Total Bugs Found:** 7
- 🔴 Critical: 1
- 🟠 High: 1
- 🟡 Medium: 2
- 🟢 Low: 3

**Most Critical Issues:**
1. Race condition causing lost referral counts
2. Unhandled duplicate key errors
3. Multiple referral codes allowed

**Recommendation:** Fix bugs #1, #2, #3 before production deployment.

**Estimated Fix Time:** 2-4 hours for critical bugs

---

**Next Steps:**
1. Create fixes for bugs #1, #2, #3
2. Write unit tests
3. Test with concurrent users
4. Deploy fixes to staging
5. Retest full referral flow
