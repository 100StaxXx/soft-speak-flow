-- Disable Supabase Cron Jobs
-- Run this in Supabase SQL Editor to disable any active cron jobs
-- that reference Supabase Edge Functions

-- Check for active cron jobs first
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
WHERE active = true
ORDER BY jobname;

-- Disable cron jobs that reference Supabase functions
-- (These should now be handled by Firebase Cloud Scheduler)

-- Disable generate-daily-mentor-pep-talks
SELECT cron.unschedule('generate-daily-mentor-pep-talks');

-- Disable schedule-daily-mentor-pushes
SELECT cron.unschedule('schedule-daily-mentor-pushes');

-- Disable dispatch-daily-pushes
SELECT cron.unschedule('dispatch-daily-pushes');

-- Disable dispatch-daily-pushes-native
SELECT cron.unschedule('dispatch-daily-pushes-native');

-- Disable dispatch-daily-quote-pushes
SELECT cron.unschedule('dispatch-daily-quote-pushes');

-- Disable process-daily-decay
SELECT cron.unschedule('process-daily-decay');

-- Verify all jobs are disabled
SELECT 
    jobid,
    jobname,
    schedule,
    active,
    command
FROM cron.job
WHERE active = true
ORDER BY jobname;

-- If the above query returns no rows, all cron jobs are disabled ✅

