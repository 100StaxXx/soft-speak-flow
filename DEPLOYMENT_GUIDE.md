# Deployment Guide - Critical Fixes

## Quick Start (5 Minutes)

### 1. Generate VAPID Keys
```bash
npx web-push generate-vapid-keys
```

Copy the output, you'll need it next.

### 2. Set Environment Variables in Supabase Dashboard

Go to: **Supabase Dashboard → Your Project → Settings → Edge Functions → Secrets**

Add these three secrets:
- `VAPID_PUBLIC_KEY` = (paste public key from step 1)
- `VAPID_PRIVATE_KEY` = (paste private key from step 1)
- `VAPID_SUBJECT` = `mailto:your-support-email@revolution.app`

### 3. Apply Database Migrations

```bash
# Make sure you're in the project root
cd /workspace

# Push migrations to production
supabase db push

# Verify migrations applied
supabase db diff
```

### 4. Deploy Edge Functions

```bash
# Deploy updated functions (with rate limiting & push notifications)
supabase functions deploy generate-daily-missions
supabase functions deploy generate-companion-evolution
supabase functions deploy generate-complete-pep-talk
supabase functions deploy dispatch-daily-pushes
supabase functions deploy check-task-reminders

# Verify deployment
supabase functions list
```

### 5. Deploy Frontend

```bash
# Build with latest changes
npm run build

# Deploy to your host (example for Vercel)
vercel --prod

# Or Netlify
netlify deploy --prod
```

---

## Verification Tests

### Test 1: Rate Limiting Works
```typescript
// In browser console on your app
async function testRateLimit() {
  for (let i = 0; i < 6; i++) {
    const res = await fetch('/api/test-endpoint', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    console.log(`Call ${i+1}: ${res.status}`);
  }
}
testRateLimit();
// Expected: First 5 return 200, 6th returns 429
```

### Test 2: Evolution Thresholds Load from Database
```typescript
// In React component or browser console
import { useEvolutionThresholds } from '@/hooks/useEvolutionThresholds';

const Test = () => {
  const { thresholds, isLoading } = useEvolutionThresholds();
  console.log('Thresholds:', thresholds);
  // Should show array of 21 stages with xp_required from database
};
```

### Test 3: Push Notifications Deliver
```bash
# Trigger the dispatch function manually
curl -X POST \
  https://YOUR_PROJECT.supabase.co/functions/v1/dispatch-daily-pushes \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Check logs in Supabase Dashboard → Edge Functions → Logs
# Should see: "✓ Dispatched push X to Y/Z devices"
```

### Test 4: Error Boundaries Catch Errors
```typescript
// Force an error in a wrapped component
// Example: throw new Error('test') in DailyMissions
// Should show MissionErrorFallback, not crash entire app
```

---

## Monitoring After Launch

### Check Rate Limit Usage (First Week)
```sql
SELECT 
  template_key,
  COUNT(*) as total_calls,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(AVG(response_time_ms)) as avg_response_ms
FROM ai_output_validation_log
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY template_key
ORDER BY total_calls DESC;
```

### Check Push Notification Delivery Rate
```sql
SELECT 
  DATE(scheduled_at) as date,
  COUNT(*) as scheduled,
  COUNT(delivered_at) as delivered,
  ROUND(100.0 * COUNT(delivered_at) / COUNT(*), 1) as delivery_pct
FROM user_daily_pushes
WHERE scheduled_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(scheduled_at)
ORDER BY date DESC;
```

### Check for Evolution Inconsistencies
```sql
-- Should return 0 rows (all evolutions use valid thresholds)
SELECT 
  ce.id,
  ce.stage,
  ce.xp_at_evolution,
  et.xp_required
FROM companion_evolutions ce
LEFT JOIN evolution_thresholds et ON ce.stage = et.stage
WHERE ce.xp_at_evolution < et.xp_required
  AND ce.created_at > NOW() - INTERVAL '7 days';
```

### Check Error Boundary Catches
```sql
-- Look for JavaScript errors in your logging system
-- Should see errors caught and displayed in fallback UI
-- NOT crashing the entire app
```

---

## Rollback Plan (If Something Goes Wrong)

### If Rate Limiting Causes Issues
```typescript
// Temporarily disable in edge function
// Comment out these lines:
// const rateLimit = await checkRateLimit(...);
// if (!rateLimit.allowed) { return createRateLimitResponse(...); }

// Then redeploy function:
supabase functions deploy FUNCTION_NAME
```

### If Push Notifications Fail
```sql
-- Check VAPID keys are set correctly
SELECT current_setting('app.settings.vapid_public_key', true);

-- If not set, notifications won't send but app won't crash
-- Users just won't receive push notifications
```

### If Evolution Thresholds Cause Issues
```sql
-- Verify thresholds table populated
SELECT COUNT(*) FROM evolution_thresholds;
-- Should return 21

-- If empty, re-run migration:
-- Copy contents of 20251124225119_create_evolution_thresholds.sql
-- Run manually in SQL editor
```

### If Transactions Cause Issues
```typescript
// Frontend can still use old flow (direct mutations)
// Transaction function is new feature, not breaking change
// Just don't call supabase.rpc('complete_quest_with_xp')
```

---

## Performance Baseline

Before launch, capture these metrics for comparison:

```sql
-- Average XP award time
SELECT AVG(response_time_ms) 
FROM xp_events 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Average evolution time
SELECT AVG(EXTRACT(EPOCH FROM (evolved_at - created_at))) * 1000 as avg_ms
FROM companion_evolutions
WHERE evolved_at > NOW() - INTERVAL '1 hour';

-- Average mission generation time
SELECT AVG(response_time_ms)
FROM ai_output_validation_log
WHERE template_key = 'daily-missions'
  AND created_at > NOW() - INTERVAL '1 hour';
```

After launch, compare to see if performance improved/degraded.

---

## Support Checklist

✅ VAPID keys generated and set  
✅ Migrations applied (21 evolution thresholds exist)  
✅ Edge functions deployed (rate limiting active)  
✅ Frontend deployed (error boundaries active)  
✅ Push notifications tested (at least one success)  
✅ Monitoring queries ready (can check health)  
✅ Rollback plan documented (can revert if needed)  

---

**You're ready to deploy! 🚀**

Any issues? Check the logs:
- Supabase Dashboard → Edge Functions → Logs
- Browser Console → Network tab → Failed requests
- Supabase Dashboard → Database → SQL Editor → Run monitoring queries
