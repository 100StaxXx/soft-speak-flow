# Supabase Cleanup Safety Verification Checklist

## ⚠️ BEFORE DELETING SUPABASE FILES - VERIFY THESE:

### 1. Check Active Cron Jobs in Supabase Database
Run in Supabase SQL Editor:
```sql
-- Check for active cron jobs
SELECT * FROM cron.job WHERE active = true;

-- Check recent cron job runs
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 20;
```

**Action Required:**
- If cron jobs exist and reference Supabase functions → **DO NOT DELETE** yet
- If no cron jobs or they reference Firebase → Safe to proceed

### 2. Verify Apple Webhook Configuration
Check App Store Connect:
- Go to: App Store Connect → Your App → App Information → App Store Server Notifications
- Verify Production Server URL points to Firebase, NOT Supabase
- Expected: `https://us-central1-cosmiq-prod.cloudfunctions.net/appleWebhook`
- If it points to Supabase → **UPDATE FIRST** before deleting

### 3. Check for Active Supabase Project
Verify if Supabase project `tffrgsaawvletgiztfry` is still active:
- Check Supabase dashboard for active deployments
- Check function logs for recent activity
- Check if any external services call Supabase functions

### 4. Verify Firebase Cron Jobs Are Active
Check Firebase Cloud Scheduler:
```bash
gcloud scheduler jobs list --project=cosmiq-prod
```

Verify these Firebase cron jobs exist:
- `scheduledGenerateDailyQuotes`
- `scheduledGenerateDailyMentorPepTalks`
- `scheduledScheduleDailyMentorPushes`
- `scheduledDispatchDailyPushes`

## ✅ SAFE TO DELETE IF:

1. ✅ No active cron jobs in Supabase database
2. ✅ Apple webhook points to Firebase
3. ✅ Firebase cron jobs are active and working
4. ✅ No external services calling Supabase functions
5. ✅ All app code uses Firebase (verified by scan)

## 📋 RECOMMENDED CLEANUP STEPS:

### Phase 1: Archive (Safe - No Risk)
```bash
# Create backup/archive
mkdir -p archive/supabase-functions-$(date +%Y%m%d)
cp -r supabase/functions archive/supabase-functions-$(date +%Y%m%d)/
cp -r supabase/config.toml archive/supabase-functions-$(date +%Y%m%d)/
```

### Phase 2: Verify (Critical)
- Run verification checklist above
- Test all Firebase cron jobs
- Verify webhooks work

### Phase 3: Cleanup (After Verification)
```bash
# Only after verification passes:
rm -rf supabase/functions
# Keep supabase/migrations if database still exists
# Keep supabase/config.toml for reference
```

## 🚨 DO NOT DELETE IF:

- ❌ Active cron jobs in Supabase
- ❌ Webhooks still pointing to Supabase
- ❌ Any production systems using Supabase functions
- ❌ Supabase database still in use (migrations may be needed)

