# Next Steps Checklist - Post Cleanup

## ✅ Completed
- [x] Archive Supabase functions
- [x] Remove Supabase functions directory
- [x] Create cleanup documentation
- [x] Verify no Supabase imports in app code

## 🔍 Verification Steps

### 1. Run Verification Script
```powershell
.\scripts\verify-cleanup.ps1
```

This will check:
- ✅ Supabase functions directory removed
- ✅ Archive exists
- ✅ No Supabase imports in src/
- ✅ No Supabase function calls
- ✅ Firebase functions exist
- ✅ Firebase cron jobs defined

### 2. Disable Supabase Cron Jobs

**IMPORTANT:** Run this in Supabase SQL Editor to disable any active cron jobs:

```sql
-- See scripts/disable-supabase-cron-jobs.sql
```

Or run directly:
```sql
SELECT cron.unschedule('generate-daily-mentor-pep-talks');
SELECT cron.unschedule('schedule-daily-mentor-pushes');
SELECT cron.unschedule('dispatch-daily-pushes');
SELECT cron.unschedule('dispatch-daily-pushes-native');
SELECT cron.unschedule('dispatch-daily-quote-pushes');
SELECT cron.unschedule('process-daily-decay');
```

**Verify they're disabled:**
```sql
SELECT * FROM cron.job WHERE active = true;
-- Should return 0 rows
```

### 3. Verify Firebase Cloud Scheduler Jobs

**Via gcloud CLI:**
```bash
# List all scheduler jobs
gcloud scheduler jobs list --project=cosmiq-prod

# Verify specific jobs exist:
gcloud scheduler jobs describe scheduledGenerateDailyQuotes --project=cosmiq-prod
gcloud scheduler jobs describe scheduledGenerateDailyMentorPepTalks --project=cosmiq-prod
gcloud scheduler jobs describe scheduledScheduleDailyMentorPushes --project=cosmiq-prod
gcloud scheduler jobs describe scheduledDispatchDailyPushes --project=cosmiq-prod
```

**Expected Jobs:**
- `scheduledGenerateDailyQuotes` - Daily at 00:00 UTC
- `scheduledGenerateDailyMentorPepTalks` - Daily at 00:01 UTC
- `scheduledScheduleDailyMentorPushes` - Daily at 00:05 UTC
- `scheduledDispatchDailyPushes` - Every 5 minutes

**Via Firebase Console:**
1. Go to Firebase Console → Functions → Cloud Scheduler
2. Verify all 4 jobs are listed and enabled

### 4. Verify Apple Webhook Configuration

**Check App Store Connect:**
1. Go to App Store Connect → Your App → App Information
2. Navigate to App Store Server Notifications
3. Verify Production Server URL is:
   ```
   https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook
   ```
4. **NOT** pointing to:
   ```
   https://*.supabase.co/functions/v1/apple-webhook
   ```

If it's pointing to Supabase, update it to Firebase.

### 5. Test Functionality

Test these critical features to ensure everything works with Firebase:

- [ ] User authentication (signup/login)
- [ ] Mentor chat
- [ ] Daily missions generation
- [ ] Push notifications
- [ ] Subscription handling (Apple)
- [ ] AI generation features:
  - [ ] Companion image generation
  - [ ] Pep talk generation
  - [ ] Quote generation
  - [ ] Mentor audio generation
- [ ] Cron job functionality:
  - [ ] Daily quotes generated
  - [ ] Daily pep talks generated
  - [ ] Push notifications scheduled
  - [ ] Push notifications dispatched

### 6. Environment Variables

**Check for any remaining Supabase environment variables:**
```powershell
# Check .env files
Get-Content .env* | Select-String -Pattern "SUPABASE"
```

**Remove if found:**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- Any other `SUPABASE_*` variables

**Keep Firebase variables:**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- etc.

### 7. Documentation Updates

Update these files if needed:
- [ ] `README.md` - Remove Supabase setup instructions
- [ ] `docs/MIGRATION_COMPLETE.md` - Mark as fully complete
- [ ] Any deployment documentation

## 🎯 Final Verification

After completing all steps, run:
```powershell
.\scripts\verify-cleanup.ps1
```

All checks should pass ✅

## 📋 Summary

Once all verification steps are complete:
1. ✅ Supabase cron jobs disabled
2. ✅ Firebase cron jobs active
3. ✅ Apple webhook points to Firebase
4. ✅ All functionality tested
5. ✅ No Supabase references in code

**Then you can safely:**
- Delete the archive (optional, after 30 days)
- Remove Supabase project (if no longer needed)
- Update documentation

## ⚠️ Important Notes

- **Don't delete the archive immediately** - Keep it for at least 30 days
- **Test thoroughly** before considering cleanup complete
- **Monitor Firebase logs** for any errors after cleanup
- **Keep Supabase migrations** if database still exists

