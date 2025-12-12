# Testing Check-In Permissions Fix

## Overview
This document describes how to test that the Firestore security rules for `daily_check_ins` are working correctly after the fix.

## Verification Steps

### 1. Rules File Verification ✅
The rules file has been verified and all checks passed:
- ✅ Rules version present
- ✅ Service declaration present
- ✅ `daily_check_ins` rules present
- ✅ `daily_tasks` rules present
- ✅ Content collection rules present
- ✅ Authentication checks present
- ✅ User ownership checks present

### 2. Deployment Status ✅
The rules have been deployed to Firebase project `cosmiq-prod`.

### 3. Manual Testing in the App

#### Test 1: Create a Check-In
1. Open the app and log in
2. Navigate to the home page (where the check-in component is displayed)
3. Fill out the check-in form:
   - Select a mood (e.g., "FOCUSED")
   - Enter a focus/intention (e.g., "Complete my tasks")
4. Click "LET'S START MY DAY"
5. **Expected Result**: 
   - ✅ Check-in is saved successfully
   - ✅ No "Missing or insufficient permissions" error
   - ✅ XP is awarded
   - ✅ Check-in appears as completed

#### Test 2: View Existing Check-In
1. After creating a check-in, refresh the page
2. **Expected Result**:
   - ✅ Previously created check-in is displayed
   - ✅ No permission errors
   - ✅ Mentor response appears (if generated)

#### Test 3: Check Browser Console
1. Open browser DevTools (F12)
2. Go to the Console tab
3. Create a check-in
4. **Expected Result**:
   - ✅ No Firestore permission errors
   - ✅ No "Missing or insufficient permissions" messages
   - ✅ Only normal application logs

#### Test 4: Verify Data Isolation
1. Create a check-in as User A
2. Log out and log in as User B
3. Try to view check-ins
4. **Expected Result**:
   - ✅ User B only sees their own check-ins
   - ✅ User B cannot see User A's check-ins
   - ✅ No permission errors

## Automated Testing

### Run Rules Verification
```bash
npx tsx scripts/verify-firestore-rules.ts
```

### Run Full Integration Test (requires Firebase Admin SDK)
```bash
npx tsx scripts/test-checkin-permissions.ts
```

## Troubleshooting

### If you still see permission errors:

1. **Clear browser cache and refresh**
   - Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)

2. **Check Firebase Console**
   - Go to Firebase Console → Firestore Database → Rules
   - Verify the rules are deployed and match `firestore.rules`

3. **Verify Authentication**
   - Ensure you're logged in
   - Check that `user.uid` is present in the app

4. **Check Network Tab**
   - Open DevTools → Network tab
   - Filter by "firestore"
   - Look for failed requests and check error messages

5. **Redeploy Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

## Success Criteria

✅ All tests pass without permission errors
✅ Check-ins can be created, read, and updated
✅ Users can only access their own check-ins
✅ No "Missing or insufficient permissions" errors in console
✅ Check-in feature works as expected in the UI

## Related Files

- `firestore.rules` - Firestore security rules
- `src/lib/firebase/dailyCheckIns.ts` - Check-in data access functions
- `src/components/MorningCheckIn.tsx` - Check-in UI component
