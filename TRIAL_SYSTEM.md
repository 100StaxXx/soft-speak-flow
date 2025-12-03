# Trial & Subscription System Documentation

## Overview

The app uses a 7-day free trial system that requires no credit card. After the trial expires, users must subscribe to continue accessing premium features.

## User States

The system has three possible user states:

### 1. Trial (Free Trial Active)
- **Duration**: 7 days from account creation
- **Access**: Full premium access
- **How Started**: Automatically when user creates an account
- **Field**: `profiles.trial_ends_at` > NOW()
- **Display**: Shows "X days left" badge

### 2. Subscribed (Paid Subscriber)
- **Duration**: Monthly or yearly billing cycle
- **Access**: Full premium access
- **How Started**: User purchases via Apple IAP
- **Field**: Active record in `subscriptions` table
- **Priority**: Subscription overrides trial

### 3. Free (Trial Expired, Not Subscribed)
- **Access**: Limited features, hard paywall shown
- **How Reached**: Trial expires AND user hasn't subscribed
- **Field**: `profiles.trial_ends_at` < NOW() AND no active subscription
- **Display**: TrialExpiredPaywall component blocks app

## Architecture

### Source of Truth

**Use `useAccessStatus()` hook** - This is the ONLY source of truth for determining user access.

```typescript
const { status, hasPremiumAccess, isInTrial, isSubscribed, needsPaywall } = useAccessStatus();
```

### Database Schema

#### Profiles Table (`profiles`)
- `trial_ends_at` - TIMESTAMPTZ when trial expires
- `is_premium` - Boolean flag (updated by subscription trigger)
- `subscription_status` - Text status synced from subscriptions table
- `subscription_expires_at` - Date subscription ends
- `created_at` - Account creation date

#### Subscriptions Table (`subscriptions`)
- `user_id` - FK to auth.users
- `status` - 'active', 'cancelled', 'past_due', 'trialing', 'incomplete'
- `plan` - 'monthly' or 'yearly'
- `current_period_end` - Subscription expiry date
- `stripe_subscription_id` - Apple transaction ID (reused field name)

### Trial Start Mechanism

Trial is started in **TWO** places to ensure reliability:

1. **Database Trigger** (`set_trial_end_date()`)
   - Fires on profile INSERT
   - Sets `trial_ends_at = NOW() + INTERVAL '7 days'`
   - Location: `supabase/migrations/20251202160450_*.sql`

2. **Frontend Code** (Defensive)
   - `useProfile.ts` - Sets trial_ends_at when creating profile via upsert
   - `authRedirect.ts` - Sets trial_ends_at in ensureProfile()
   - Ensures trial is set even if trigger doesn't fire

### Access Control Flow

```
User Login
    ↓
Check subscription status (backend)
    ↓
    ├─ Has active subscription? → Premium Access
    ↓
    └─ No subscription
        ↓
    Check trial_ends_at (client-side)
        ↓
        ├─ Trial active? (trial_ends_at > NOW) → Premium Access
        ├─ Trial expired? → Show Paywall (Limited Access)
        └─ No trial date? → Assume trial active (benefit of doubt)
```

### Key Components

#### Hooks
- `useAccessStatus()` - **PRIMARY** - Single source of truth for access status
- `useTrialStatus()` - Legacy wrapper around useAccessStatus (deprecated)
- `useSubscription()` - Checks subscription table via edge function
- `useProfile()` - Fetches user profile including trial_ends_at

#### Components
- `ProtectedRoute` - Wraps routes, shows paywall if trial expired
- `TrialExpiredPaywall` - Hard paywall blocking app when trial expires
- `SubscriptionGate` - Soft upsell modal shown at companion stage 1
- `TrialBadge` - Shows "X days left" during trial

#### Backend Functions
- `check-apple-subscription` - Returns subscription status (NOT trial status)
- `verify-apple-receipt` - Validates Apple IAP purchase, creates subscription

## Trial → Subscription Transition

When a user subscribes during their trial:

1. User purchases via Apple IAP
2. `verify-apple-receipt` function creates subscription record
3. Database trigger updates `profiles.is_premium = true`
4. Frontend detects subscription (via `useSubscription`)
5. `useAccessStatus` returns `status: "subscribed"` (subscription takes priority)
6. Trial becomes irrelevant - user now has paid access

**No special migration needed** - The priority system automatically handles this.

## Edge Cases & Abuse Prevention

### Current Implementation

✅ **Handled:**
- Profile creation sets trial automatically
- Trial calculation has fallback to created_at + 7 days
- Subscription overrides trial (no conflict)
- Trial days calculated with timezone awareness
- Multiple devices share same trial (profile-based)

⚠️ **Not Handled (Known Limitations):**
- Users can create multiple accounts for multiple trials
- Email-based trial tracking not implemented
- Device fingerprinting not implemented
- No IP-based rate limiting

### Why Not Prevent Multi-Account Trials?

**Design Decision:** The current system prioritizes **user experience** over abuse prevention:
- No friction onboarding (no email verification, no CC required)
- Most users won't exploit the system
- 7-day window limits potential abuse impact
- Implementing prevention would require:
  - Email verification (adds friction)
  - Device fingerprinting (privacy concerns)
  - Payment method collection (defeats "no CC" promise)

**Future Options** (if abuse becomes significant):
1. Email-based trial tracking (1 trial per email)
2. Phone number verification
3. Require Apple Sign-In (Apple provides fraud protection)
4. IP-based rate limiting (can have false positives)

### Multi-Device Behavior

✅ **Works Correctly:**
- Trial is tied to user account, not device
- User can log in on multiple devices
- All devices see same trial countdown
- If user subscribes on Device A, Device B immediately sees subscription (on next app load)

### Account Deletion & Re-registration

⚠️ **Current Behavior:**
- If user deletes account and re-registers with same email:
  - New profile is created
  - New 7-day trial is granted
- This is a known limitation (see abuse prevention above)

## Testing

### Manual Test Plan

#### New User Flow
1. Create new account
2. Complete onboarding
3. Check profile.trial_ends_at is set (should be 7 days from now)
4. Verify app shows "7 days left" badge
5. Navigate app - all premium features should work

#### Trial Expiry Flow
1. Manually set trial_ends_at to yesterday in database
2. Reload app
3. Should see TrialExpiredPaywall blocking access
4. Paywall should show subscription options
5. "Restore Purchases" button should work

#### Subscription Flow
1. User in trial period
2. Navigate to /premium
3. Purchase subscription (iOS IAP)
4. Verify subscription active immediately
5. Trial badge should disappear
6. Premium features remain accessible

#### Multi-Device Flow
1. Login on Device A (fresh account)
2. Verify trial starts
3. Login on Device B (same account)
4. Verify both devices show same trial countdown
5. Subscribe on Device A
6. Refresh Device B - should show subscribed status

### Automated Tests (TODO)

```typescript
describe('Trial System', () => {
  test('sets trial on new user creation', async () => {
    // Create user, verify trial_ends_at is set
  });
  
  test('shows paywall when trial expires', async () => {
    // Set trial_ends_at to past, verify paywall shown
  });
  
  test('subscription overrides trial', async () => {
    // User in trial + active subscription = subscribed status
  });
  
  test('trial days calculated correctly', async () => {
    // Verify day calculation logic
  });
});
```

## Common Issues & Troubleshooting

### Issue: User sees paywall immediately after signup
**Cause:** trial_ends_at not set on profile creation
**Fix:** Check database trigger is working, check useProfile logic
**Debug:** Query `SELECT trial_ends_at FROM profiles WHERE id = '<user_id>'`

### Issue: Trial days show incorrect number
**Cause:** Timezone mismatch or calculation error
**Fix:** Verify trial_ends_at is in UTC, check calculation in useAccessStatus
**Debug:** Log trial_ends_at and current time in same timezone

### Issue: Subscription doesn't unlock app
**Cause:** Subscription table not updated or check-apple-subscription failing
**Fix:** Verify receipt verification succeeded, check subscriptions table
**Debug:** Query `SELECT * FROM subscriptions WHERE user_id = '<user_id>'`

### Issue: User sees "Start Free Trial" but already in trial
**Cause:** SubscriptionGate showing wrong message
**Fix:** Already fixed in this update (SubscriptionGate now checks trial status)
**Debug:** Check isInTrial value in SubscriptionGate component

## Code References

### Key Files
- `src/hooks/useAccessStatus.ts` - **PRIMARY** access control logic
- `src/hooks/useTrialStatus.ts` - Legacy hook (wraps useAccessStatus)
- `src/hooks/useSubscription.ts` - Subscription checking
- `src/hooks/useProfile.ts` - Profile fetching & trial creation
- `src/utils/authRedirect.ts` - Profile creation on auth
- `src/components/ProtectedRoute.tsx` - Route protection & paywall
- `src/components/TrialExpiredPaywall.tsx` - Hard paywall UI
- `src/components/SubscriptionGate.tsx` - Soft upsell modal
- `supabase/functions/check-apple-subscription/index.ts` - Subscription check
- `supabase/functions/verify-apple-receipt/index.ts` - IAP verification
- `supabase/migrations/20251202160450_*.sql` - Trial trigger
- `supabase/migrations/20251203180000_*.sql` - Trial improvements

## Future Improvements

1. **Email-Based Trial Tracking**
   - Track trials by email, not just user_id
   - Prevent same email from getting multiple trials
   - Requires email verification flow

2. **Trial Expiry Reminders**
   - Send push notification 1 day before trial expires
   - Edge function to scan profiles where trial_ends_at = NOW() + INTERVAL '1 day'

3. **Analytics**
   - Track trial → subscription conversion rate
   - Identify when users typically upgrade (day 1, 3, 5, 7?)
   - A/B test different trial lengths

4. **Grace Period**
   - Optional: Give 1-2 day grace period after trial expires
   - Soft paywall instead of hard block

5. **Referral Trial Extension**
   - Reward users who refer friends with +3 days trial
   - Incentivize organic growth

## Migration Notes

### For Existing Users

The trial system has been improved but remains backwards compatible:

- Users with `trial_ends_at = NULL` will have fallback to `created_at + 7 days`
- Migration `20251203180000` adds indexes and documentation
- No data migration needed - existing users unaffected

### Breaking Changes

None. All changes are backwards compatible.

### Rollback Plan

If issues occur, revert these commits:
1. Revert migration `20251203180000_improve_trial_system.sql`
2. Revert changes to useAccessStatus.ts (delete file)
3. Revert useTrialStatus.ts to original implementation
4. Revert useProfile.ts and authRedirect.ts trial_ends_at setting

Database trigger will still function, system will work as before.
