# Migration Status: Supabase to Firebase

## ✅ Completed Migrations

### Cron Jobs / Scheduled Functions
- ✅ `generate-daily-mentor-pep-talks` → `scheduledGenerateDailyMentorPepTalks` (Daily 00:01 UTC)
- ✅ `schedule-daily-mentor-pushes` → `scheduledScheduleDailyMentorPushes` (Daily 00:05 UTC)
- ✅ `dispatch-daily-pushes` → `scheduledDispatchDailyPushes` (Every 5 minutes)
- ✅ `generate-daily-quotes` → `scheduledGenerateDailyQuotes` (Daily 00:00 UTC)

### AI Functions (All migrated to Firebase Cloud Functions with Gemini API)
- ✅ All 40+ AI-related functions migrated from Supabase Edge Functions to Firebase Cloud Functions
- ✅ All functions now use direct Google Gemini API (no Lovable proxy)

### Push Notifications
- ✅ VAPID keys configured for web push notifications
- ✅ iOS push notification support added to scheduled dispatch function
- ✅ APNS Cloud Function created (`sendApnsNotification`)

### Data Migration
- ✅ Mentors migrated to Firestore
- ✅ Profiles migrated to Firestore
- ✅ Daily missions client-side generation implemented

## ⏳ Pending Setup

### APNS (Apple Push Notification Service)
- ⏳ Need to set Firebase Secrets:
  - `APNS_KEY_ID` = `99379WF4MQ` (provided)
  - `APNS_TEAM_ID` = `B6VW78ABTR` (found in project)
  - `APNS_BUNDLE_ID` = `com.darrylgraham.revolution` (found in project)
  - `APNS_AUTH_KEY` = Need .p8 file content from Apple Developer
  - `APNS_ENVIRONMENT` = `production` (from entitlements)

**To complete:**
1. Download .p8 file from Apple Developer Portal (Key ID: 99379WF4MQ)
2. Set Firebase secrets using the commands in `docs/APNS_SETUP.md`
3. Redeploy `sendApnsNotification` function

### Frontend Environment Variables
- ⏳ `VITE_WEB_PUSH_KEY` needs to be set in frontend environment
  - Value: `BOQz9DrqwYdOPwda_zhei3g-VZo2KFE0Itl19I6fTVTI-BlizrAx4IK3y13uNV9rZFEfQ9Y88dxviC1sP8wXD2g`
  - Add to `.env` or hosting platform environment variables

## 📋 Optional Migrations (Not Critical)

### Additional Scheduled Functions (if needed)
These Supabase Edge Functions exist but may not be scheduled:
- `schedule-daily-quote-pushes` - Schedules quote push notifications
- `dispatch-daily-quote-pushes` - Dispatches quote push notifications
- `check-task-reminders` - Checks for tasks needing reminders
- `process-daily-decay` - Processes daily companion decay

**Note:** These can be migrated if they're actively used. Check Supabase cron jobs to see if they're scheduled.

## 🔍 Verification Steps

1. **Test Scheduled Functions:**
   ```bash
   # Check function logs
   firebase functions:log --only scheduledGenerateDailyQuotes
   firebase functions:log --only scheduledGenerateDailyMentorPepTalks
   firebase functions:log --only scheduledScheduleDailyMentorPushes
   firebase functions:log --only scheduledDispatchDailyPushes
   ```

2. **Verify Secrets:**
   ```bash
   # List all secrets
   firebase functions:secrets:access VAPID_PUBLIC_KEY
   firebase functions:secrets:access VAPID_PRIVATE_KEY
   firebase functions:secrets:access VAPID_SUBJECT
   ```

3. **Test Push Notifications:**
   - Subscribe to push notifications in the app
   - Verify web push works
   - Verify iOS push works (after APNS setup)

## 📚 Documentation

- `docs/APNS_SETUP.md` - APNS configuration guide
- `docs/VAPID_SETUP.md` - VAPID keys setup guide
- `docs/GEMINI_API_MIGRATION.md` - Gemini API migration guide

## 🎯 Next Steps

1. **Complete APNS Setup:**
   - Download .p8 file from Apple Developer
   - Set Firebase secrets
   - Redeploy functions

2. **Set Frontend Environment Variable:**
   - Add `VITE_WEB_PUSH_KEY` to frontend environment
   - Rebuild/redeploy frontend

3. **Disable Old Supabase Cron Jobs:**
   - Once verified working, disable old Supabase cron jobs
   - Remove Supabase Edge Functions that have been migrated

4. **Monitor and Test:**
   - Monitor Firebase function logs
   - Test push notifications
   - Verify scheduled functions are running correctly

