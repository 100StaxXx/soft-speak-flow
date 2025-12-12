-- Verification Script: Check Firebase Cloud Scheduler Jobs
-- Run this in Firebase Console or via gcloud CLI

-- To check via gcloud CLI:
-- gcloud scheduler jobs list --project=cosmiq-prod

-- Expected Firebase Cloud Scheduler Jobs:
-- 1. scheduledGenerateDailyQuotes (runs daily at 00:00 UTC)
-- 2. scheduledGenerateDailyMentorPepTalks (runs daily at 00:01 UTC)
-- 3. scheduledScheduleDailyMentorPushes (runs daily at 00:05 UTC)
-- 4. scheduledDispatchDailyPushes (runs every 5 minutes)

-- To verify a specific job:
-- gcloud scheduler jobs describe scheduledGenerateDailyQuotes --project=cosmiq-prod

-- To check job execution history:
-- gcloud scheduler jobs describe scheduledGenerateDailyQuotes --project=cosmiq-prod --format="value(state)"

