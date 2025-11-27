# Apple IAP Testing Guide

**Date**: November 27, 2025  
**Purpose**: Comprehensive testing procedures for Apple In-App Purchases after bug fixes

---

## Prerequisites

### Required Setup
- [ ] Physical iOS device (iPhone or iPad)
- [ ] TestFlight access to R-Evolution app
- [ ] Apple Sandbox test account created
- [ ] Xcode installed (for debugging)
- [ ] Access to Supabase dashboard

### Create Sandbox Test Account

1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. Navigate to **Users and Access** > **Sandbox Testers**
3. Click **+** to add new tester
4. Fill in:
   - First Name: Test
   - Last Name: User1
   - Email: testuser1@example.com (use a unique email)
   - Password: Create strong password
   - Country/Region: Select your country
5. Save and note credentials

### Configure Device

1. Open **Settings** app on iOS device
2. Tap your name at the top
3. Tap **Media & Purchases**
4. Tap **View Account**
5. Scroll down to **Sandbox Account**
6. Sign in with sandbox test account created above

⚠️ **Important**: Do NOT sign in with sandbox account in main App Store settings

---

## Test Suite

### Test 1: First-Time Purchase (Monthly)

**Objective**: Verify new user can purchase subscription successfully

**Steps**:
1. Install app from TestFlight on device
2. Create new account or sign in
3. Navigate to Premium page
4. Tap "Subscribe Now" ($9.99/month)
5. Complete Face ID/Touch ID authentication
6. Wait for purchase to complete

**Expected Results**:
- ✅ Native iOS payment sheet appears
- ✅ Shows $9.99/month price
- ✅ Payment completes successfully
- ✅ Shows "Success!" toast message
- ✅ Premium badge appears in profile
- ✅ Premium features unlock immediately

**Database Verification**:
```sql
-- Check subscription record
SELECT * FROM subscriptions WHERE user_id = '[USER_ID]';

-- Should show:
-- status: 'active'
-- plan: 'monthly'
-- current_period_start: [today's date]
-- current_period_end: [30 days from now]

-- Check profile
SELECT is_premium, subscription_status FROM profiles WHERE id = '[USER_ID]';

-- Should show:
-- is_premium: true
-- subscription_status: 'active'

-- Check payment history
SELECT * FROM payment_history WHERE user_id = '[USER_ID]';

-- Should show:
-- status: 'succeeded'
-- amount: 999 (cents)
```

**If Fails**:
- Check edge function logs: `supabase functions logs verify-apple-receipt`
- Verify sandbox account is signed in correctly
- Check device date/time is correct
- Ensure product ID matches: `com.revolutions.app.premium.monthly`

---

### Test 2: Purchase Cancellation

**Objective**: Verify cancelled purchases are handled gracefully

**Steps**:
1. Tap "Subscribe Now"
2. When payment sheet appears, tap **Cancel**
3. Observe app behavior

**Expected Results**:
- ✅ Returns to Premium page
- ✅ Shows "Purchase was cancelled" message (or silent dismissal)
- ✅ No error/crash
- ✅ User can try again

**Database Verification**:
```sql
-- Should NOT create subscription record
SELECT * FROM subscriptions WHERE user_id = '[USER_ID]';
-- Result: No rows
```

---

### Test 3: Failed Purchase (No Payment Method)

**Objective**: Handle failed payment gracefully

**Steps**:
1. Remove payment method from sandbox account
2. Attempt to purchase
3. Let payment fail

**Expected Results**:
- ✅ Shows "Purchase failed" error message
- ✅ App doesn't crash
- ✅ User can retry after fixing payment method

---

### Test 4: Deferred Purchase (Ask to Buy)

**Objective**: Handle family sharing "Ask to Buy" feature

**Steps**:
1. Use sandbox account with "Ask to Buy" enabled
2. Attempt purchase
3. Observe app behavior

**Expected Results**:
- ✅ Shows "Purchase is pending approval" message
- ✅ Explains user needs family organizer approval
- ✅ App doesn't hang or crash
- ✅ Purchase completes after approval (if granted)

⚠️ **Note**: This requires special sandbox account configuration

---

### Test 5: Rapid Multiple Clicks (Race Condition)

**Objective**: Verify no duplicate processing with rapid clicks

**Steps**:
1. Tap "Subscribe Now"
2. Immediately tap it 5 more times rapidly
3. Complete payment when sheet appears
4. Check database

**Expected Results**:
- ✅ Only one payment sheet appears
- ✅ Only one subscription record created
- ✅ Only one payment history entry
- ✅ No duplicate charges

**Database Verification**:
```sql
-- Check for duplicates
SELECT COUNT(*) FROM subscriptions WHERE user_id = '[USER_ID]';
-- Should be: 1

SELECT COUNT(*) FROM payment_history WHERE user_id = '[USER_ID]';
-- Should be: 1
```

---

### Test 6: Restore Purchases

**Objective**: Verify purchase restoration works correctly

**Prerequisites**:
- User must have completed Test 1 (have active subscription)
- Uninstall and reinstall app OR use different device with same Apple ID

**Steps**:
1. Sign into app with same account
2. Go to Premium page
3. Tap "Manage Subscription" or Profile
4. Tap "Restore Purchases"
5. Wait for restore to complete

**Expected Results**:
- ✅ Shows "Restoring..." loading state
- ✅ Completes within 3-5 seconds
- ✅ Shows "Restored!" success message
- ✅ Premium badge appears
- ✅ Premium features unlock

**Database Verification**:
```sql
SELECT * FROM subscriptions WHERE user_id = '[USER_ID]';
-- Should show same subscription as before
-- updated_at should be recent
```

---

### Test 7: Restore with No Purchases

**Objective**: Handle restore when user has no purchases

**Prerequisites**:
- Brand new account that never purchased

**Steps**:
1. Sign into app with new account
2. Tap "Restore Purchases"
3. Observe result

**Expected Results**:
- ✅ Shows "No Purchases Found" message
- ✅ Explains no previous purchases exist
- ✅ Suggests purchasing instead
- ✅ No error/crash

---

### Test 8: Restore with Multiple Purchases

**Objective**: Verify correct purchase is restored when multiple exist

**Prerequisites**:
- Make 2-3 test purchases (can cancel between)
- Latest should be active subscription

**Steps**:
1. Restore purchases
2. Check which subscription is restored

**Expected Results**:
- ✅ Restores most recent purchase
- ✅ Ignores older cancelled subscriptions
- ✅ Correctly identifies subscription products (not other IAPs)

---

### Test 9: Restore with Expired Subscription

**Objective**: Handle restore of expired subscription

**Prerequisites**:
- Subscription that expired (in sandbox, expires quickly)
- OR manually expire in database for testing

**Steps**:
1. Wait for subscription to expire
2. Attempt restore
3. Check result

**Expected Results**:
- ✅ Shows "No active subscription" or similar
- ✅ Suggests purchasing again
- ✅ Premium features remain locked
- ✅ Database shows expired subscription

**Database Verification**:
```sql
SELECT 
  status,
  current_period_end,
  current_period_end < NOW() as is_expired
FROM subscriptions 
WHERE user_id = '[USER_ID]';

-- Should show:
-- is_expired: true
-- status: 'cancelled' or 'active' (but expired)
```

---

### Test 10: Yearly Subscription Purchase

**Objective**: Verify yearly plan works (if implemented)

**Steps**:
1. Navigate to Premium page
2. Select "Yearly" plan
3. Tap "Subscribe Now" ($99.99/year)
4. Complete purchase

**Expected Results**:
- ✅ Shows $99.99/year price
- ✅ Purchase completes
- ✅ Database shows plan: 'yearly'
- ✅ current_period_end is ~365 days away

⚠️ **Skip if yearly plan not implemented**

---

### Test 11: Plan Switch (Monthly to Yearly)

**Objective**: Verify plan switching works

**Prerequisites**:
- Active monthly subscription

**Steps**:
1. Go to iOS Settings > [Name] > Subscriptions > R-Evolution
2. Select different plan (Yearly)
3. Confirm change
4. Wait for webhook notification (or manual sync)

**Expected Results**:
- ✅ Plan changes to yearly in database
- ✅ Billing date adjusts
- ✅ Pro-rated credit applied (Apple handles)

⚠️ **Note**: Requires webhook implementation to auto-update

---

### Test 12: Cancellation via iOS Settings

**Objective**: Verify cancellation flow

**Prerequisites**:
- Active subscription

**Steps**:
1. Open **Settings** app
2. Tap your name
3. Tap **Subscriptions**
4. Select **R-Evolution**
5. Tap **Cancel Subscription**
6. Confirm cancellation
7. Return to app
8. Wait for webhook (or trigger manual sync)

**Expected Results**:
- ✅ Subscription status changes to 'cancelled'
- ✅ Premium access continues until end of billing period
- ✅ No immediate loss of features
- ✅ Shows expiration date in app

**Database Verification**:
```sql
SELECT 
  status,
  cancelled_at,
  current_period_end,
  current_period_end > NOW() as still_active
FROM subscriptions 
WHERE user_id = '[USER_ID]';

-- Should show:
-- status: 'cancelled'
-- cancelled_at: [recent timestamp]
-- still_active: true (until period ends)
```

---

### Test 13: Subscription Expiration

**Objective**: Verify expired subscription removes premium access

**Prerequisites**:
- Cancelled subscription near end of period
- OR wait for sandbox subscription to expire (happens quickly)

**Steps**:
1. Wait for subscription to reach expiration date
2. Open app after expiration
3. Check premium features

**Expected Results**:
- ✅ Premium badge removed
- ✅ Premium features locked
- ✅ Shown "Upgrade to Premium" prompt
- ✅ Profile shows subscription_status: 'cancelled'

**Database Verification**:
```sql
SELECT 
  is_premium,
  subscription_status,
  subscription_expires_at,
  subscription_expires_at < NOW() as is_expired
FROM profiles 
WHERE id = '[USER_ID]';

-- Should show:
-- is_premium: false
-- is_expired: true
```

---

### Test 14: Auto-Renewal (Sandbox)

**Objective**: Verify subscription auto-renews

**Prerequisites**:
- Active subscription in sandbox
- Sandbox auto-renews every 5 minutes

**Steps**:
1. Purchase subscription
2. Wait 5-10 minutes
3. Check database for renewal
4. Verify premium still active

**Expected Results**:
- ✅ current_period_end updates to new date
- ✅ Premium access continues uninterrupted
- ✅ Payment history shows new transaction

⚠️ **Note**: Requires webhook to auto-detect renewals

**Database Verification**:
```sql
SELECT 
  current_period_start,
  current_period_end,
  updated_at
FROM subscriptions 
WHERE user_id = '[USER_ID]'
ORDER BY updated_at DESC;

-- current_period_end should be newer than initial purchase
```

---

### Test 15: Receipt Validation Error Handling

**Objective**: Verify error handling when Apple API is down

**Steps**:
1. Temporarily break APPLE_SHARED_SECRET env var
2. Attempt purchase
3. Observe error handling

**Expected Results**:
- ✅ Shows user-friendly error message
- ✅ Doesn't reveal technical details
- ✅ Suggests trying again later
- ✅ Transaction can be retried after fix

**Cleanup**: Restore correct APPLE_SHARED_SECRET

---

## Performance Tests

### Test 16: Purchase Flow Speed

**Objective**: Measure end-to-end purchase time

**Steps**:
1. Time from "Subscribe Now" click to "Success" message
2. Measure database update latency
3. Check edge function execution time

**Expected Performance**:
- ✅ Payment sheet appears: <1 second
- ✅ Receipt verification: 2-5 seconds
- ✅ Database update: <1 second
- ✅ Total time: 3-7 seconds

**Monitoring**:
```bash
# Check edge function logs for execution time
supabase functions logs verify-apple-receipt
```

---

### Test 17: Restore Flow Speed

**Objective**: Measure restore performance

**Steps**:
1. Time from "Restore" tap to success message

**Expected Performance**:
- ✅ Restore completes: 2-5 seconds
- ✅ No hanging or timeout errors

---

## Edge Cases & Error Scenarios

### Test 18: Network Interruption

**Objective**: Handle network loss during purchase

**Steps**:
1. Start purchase flow
2. Enable Airplane Mode during receipt verification
3. Disable Airplane Mode
4. Retry or restore

**Expected Results**:
- ✅ Shows network error message
- ✅ Doesn't lose transaction
- ✅ Can restore after network restored
- ✅ No duplicate charges

---

### Test 19: App Force Quit During Purchase

**Objective**: Handle app termination mid-purchase

**Steps**:
1. Start purchase
2. During payment sheet, force quit app
3. Reopen app
4. Complete or restore purchase

**Expected Results**:
- ✅ Purchase still pending or completed
- ✅ Can restore if completed
- ✅ No stuck transactions
- ✅ Database consistency maintained

---

### Test 20: Invalid Receipt Data

**Objective**: Handle corrupted or invalid receipts

**Steps**:
1. (Developer) Mock invalid receipt response
2. Attempt verification
3. Check error handling

**Expected Results**:
- ✅ Graceful error handling
- ✅ User-friendly error message
- ✅ No crashes
- ✅ Can retry with valid receipt

---

## Production Testing (Post-Launch)

### Test 21: Production Purchase (Real Money)

⚠️ **WARNING**: This charges real money. Test with personal account.

**Steps**:
1. Build production app (not sandbox)
2. Install on device
3. Purchase with real Apple ID
4. Verify all features work
5. **Cancel immediately after testing**

**Expected Results**:
- Same as Test 1, but with real payment
- Verify refund process if needed

---

### Test 22: Family Sharing

**Objective**: Verify subscription sharing works (if enabled)

**Prerequisites**:
- Family sharing configured in Apple ID
- Subscription with family sharing enabled

**Steps**:
1. Purchase subscription on primary account
2. Install app on family member's device
3. Check if premium features accessible

**Expected Results**:
- Depends on family sharing configuration
- Document behavior for users

---

## Automated Testing

### Unit Tests (Future Implementation)

```typescript
// Example test cases
describe('Apple IAP', () => {
  test('purchaseProduct handles deferred state', async () => {
    // Mock deferred purchase
    // Verify error thrown
  });

  test('restorePurchases sorts by date', async () => {
    // Mock multiple purchases
    // Verify newest selected
  });

  test('verify-apple-receipt prevents duplicates', async () => {
    // Call twice with same transaction ID
    // Verify only one payment record
  });
});
```

---

## Bug Tracking Template

When you find a bug during testing, document using this template:

```markdown
### Bug: [Brief Description]

**Test**: Test #X - [Test Name]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**:
- 

**Actual Result**:
- 

**Database State**:
```sql
-- Query showing issue
```

**Screenshots/Logs**:
- 

**Environment**:
- iOS Version: 
- App Version: 
- Device Model: 
- Sandbox/Production: 

**Fix Required**:
- 
```

---

## Testing Completion Checklist

Before deploying to production, ensure all tests pass:

### Critical Tests (Must Pass)
- [ ] Test 1: First-Time Purchase
- [ ] Test 2: Purchase Cancellation
- [ ] Test 5: Rapid Multiple Clicks
- [ ] Test 6: Restore Purchases
- [ ] Test 13: Subscription Expiration

### High Priority Tests (Should Pass)
- [ ] Test 3: Failed Purchase
- [ ] Test 7: Restore with No Purchases
- [ ] Test 9: Restore with Expired Subscription
- [ ] Test 12: Cancellation via iOS Settings
- [ ] Test 18: Network Interruption

### Nice to Have (Can Have Known Issues)
- [ ] Test 4: Deferred Purchase (Ask to Buy)
- [ ] Test 10: Yearly Subscription
- [ ] Test 11: Plan Switch
- [ ] Test 14: Auto-Renewal
- [ ] Test 22: Family Sharing

### Performance Tests
- [ ] Test 16: Purchase Flow Speed (<7 seconds)
- [ ] Test 17: Restore Flow Speed (<5 seconds)

---

## Monitoring After Launch

### Key Metrics to Track

1. **Purchase Success Rate**
   - Target: >95%
   - Alert if: <90%

2. **Restore Success Rate**
   - Target: >98%
   - Alert if: <95%

3. **Database Constraint Errors**
   - Target: 0
   - Alert if: any

4. **Receipt Verification Failures**
   - Target: <2%
   - Alert if: >5%

5. **User Support Tickets**
   - Target: <5% of purchasers
   - Common issues to watch for

### Supabase Monitoring

```bash
# Watch edge function logs
supabase functions logs verify-apple-receipt --tail

# Check error rates
supabase functions logs verify-apple-receipt | grep -i error

# Monitor database
psql "postgresql://..." -c "
SELECT 
  status,
  COUNT(*) as count,
  MAX(updated_at) as last_updated
FROM subscriptions 
GROUP BY status;
"
```

### Apple App Store Connect Monitoring

1. **Sales and Trends**
   - Check daily sales
   - Monitor conversion rate
   - Track cancellations

2. **App Analytics**
   - Premium page views
   - Purchase button clicks
   - Conversion funnel

3. **Customer Reviews**
   - Watch for payment-related issues
   - Respond to concerns quickly

---

## Troubleshooting Guide

### Issue: "In-App Purchase plugin not available"

**Solution**:
```bash
npm install @capacitor-community/in-app-purchases
npx cap sync ios
```

### Issue: Receipt verification fails with 21007

**Cause**: Sandbox receipt sent to production URL

**Solution**: Already handled - auto-retries sandbox URL

### Issue: Purchase succeeds but premium not unlocked

**Check**:
1. Edge function logs for errors
2. Database subscription record created
3. Profile is_premium updated
4. App querying correct user

### Issue: Restore finds no purchases

**Check**:
1. Using same Apple ID as original purchase
2. Purchase actually completed (check App Store)
3. Subscription not expired
4. Product ID matches

### Issue: Duplicate payment records

**Cause**: Race condition or retry logic

**Solution**: Already fixed - checks existing payment before inserting

---

## Success Criteria

All tests are considered successful when:

✅ **Purchases**:
- 95%+ success rate
- Complete within 7 seconds
- Database updates correctly

✅ **Restores**:
- 98%+ success rate
- Complete within 5 seconds
- Finds correct subscription

✅ **Error Handling**:
- All error scenarios handled gracefully
- No crashes or hangs
- Clear user-facing messages

✅ **Database Integrity**:
- No constraint violations
- No duplicate records
- Consistent state across tables

✅ **User Experience**:
- Intuitive flow
- Clear messaging
- Fast performance
- Reliable functionality

---

**Next Steps**: After completing all tests, document results and deploy to production.

**Questions?** Refer to:
- `/workspace/APPLE_IAP_SETUP.md` - Setup guide
- `/workspace/APPLE_PAYMENTS_BUG_REPORT.md` - Bug details
- `/workspace/APPLE_PAYMENTS_FIXES_APPLIED.md` - Fix summary
