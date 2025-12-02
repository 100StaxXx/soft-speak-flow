# Negative Companion System - Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Code Review
- [x] Database migration created and reviewed
- [x] Edge functions implemented and tested locally
- [x] Frontend components created
- [x] Activity tracking integrated across all XP events
- [x] No linting errors
- [x] Documentation complete

### 2. Dependencies Verified
- [x] Supabase client library version compatible
- [x] React Query properly configured
- [x] Lovable AI API key available
- [x] Edge function dependencies up to date

### 3. Testing Complete
- [ ] Database migration tested on staging
- [ ] Edge functions tested manually
- [ ] Frontend components tested in dev
- [ ] Integration tests pass
- [ ] Performance tests acceptable

---

## 🚀 Deployment Steps

### Step 1: Database Migration

#### 1.1: Push Migration to Production
```bash
# Navigate to project root
cd /workspace

# Login to Supabase (if not already)
supabase login

# Link to your production project
supabase link --project-ref <your-project-ref>

# Push database changes
supabase db push

# Verify migration applied
supabase db inspect user_companion
supabase db inspect profiles
```

#### 1.2: Verify Schema Changes
Run this SQL in Supabase SQL Editor:

```sql
-- Check user_companion columns
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_companion' 
  AND column_name IN ('neglected_image_url', 'last_activity_date', 'inactive_days');

-- Check profiles columns
SELECT 
  column_name, 
  data_type, 
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
  AND column_name IN ('streak_freezes_available', 'last_streak_freeze_used', 'streak_freezes_reset_at');

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('user_companion', 'profiles')
  AND indexname IN ('idx_user_companion_inactive_days', 'idx_profiles_streak_freezes_reset');
```

**Expected**:
- 6 columns found (3 per table)
- 2 indexes created
- Default values correct

#### 1.3: Backfill Existing Data (Optional)
If you want to give existing users streak freezes:

```sql
-- Give all existing users their first streak freeze
UPDATE profiles 
SET 
  streak_freezes_available = 1,
  streak_freezes_reset_at = CURRENT_TIMESTAMP + INTERVAL '7 days'
WHERE streak_freezes_available IS NULL;

-- Set all existing companions to active state
UPDATE user_companion 
SET 
  inactive_days = 0,
  last_activity_date = CURRENT_DATE,
  current_mood = 'happy'
WHERE inactive_days IS NULL;
```

---

### Step 2: Deploy Edge Functions

#### 2.1: Deploy Functions
```bash
# Deploy process-daily-decay
supabase functions deploy process-daily-decay

# Deploy generate-neglected-companion-image
supabase functions deploy generate-neglected-companion-image

# Deploy updated generate-proactive-nudges
supabase functions deploy generate-proactive-nudges
```

#### 2.2: Verify Deployment
```bash
# List deployed functions
supabase functions list

# Test process-daily-decay manually
supabase functions invoke process-daily-decay --no-verify-jwt

# Check logs
supabase functions logs process-daily-decay --limit 50
```

#### 2.3: Configure Environment Variables
Verify these secrets are set (via Supabase Dashboard → Edge Functions → Secrets):

```bash
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
LOVABLE_API_KEY=<your-lovable-api-key>
```

**Security Note**: Never commit these values to git!

#### 2.4: Set Up Cron Job
Via Supabase Dashboard → Edge Functions → `process-daily-decay`:

1. Click "Add Cron"
2. Set schedule: `0 3 * * *` (3 AM UTC daily)
3. Enable the cron job
4. Test with "Run now" button

**Why 3 AM UTC?**
- Most users are asleep (minimal impact)
- Before typical "start of day" (6-9 AM)
- After late-night users finish (usually by 2 AM)

**Alternative**: If your user base is concentrated in a specific timezone, adjust accordingly:
- US East Coast users: `0 7 * * *` (2 AM EST)
- Europe users: `0 5 * * *` (6 AM CET)
- Asia users: `0 22 * * *` (6 AM JST next day)

---

### Step 3: Deploy Frontend

#### 3.1: Build Production Bundle
```bash
# Navigate to project root
cd /workspace

# Install dependencies (if needed)
npm install

# Build for production
npm run build

# Test build locally (optional)
npm run preview
```

#### 3.2: Deploy to Hosting Platform

**Option A: Vercel**
```bash
vercel --prod
```

**Option B: Netlify**
```bash
netlify deploy --prod
```

**Option C: Supabase Storage (Static)**
```bash
supabase storage upload --bucket website --recursive --dir dist
```

#### 3.3: Verify Frontend Changes
After deployment, visit your production site and check:

1. **Companion Page Loads**
   - Navigate to `/companion`
   - Verify no console errors
   - Check companion displays correctly

2. **Progress Tab Shows Streak Freeze**
   - Click "Progress" tab
   - Verify StreakFreezeDisplay component visible
   - Check countdown shows correctly

3. **Welcome Back Modal Works**
   - Test with inactive account (set `inactive_days = 3` in database)
   - Verify modal appears on login
   - Test reunion flow

---

### Step 4: Post-Deployment Verification

#### 4.1: Immediate Checks (Within 1 Hour)

**Database**:
```sql
-- Check if any errors in migrations
SELECT * FROM _realtime.schema_migrations 
ORDER BY version DESC 
LIMIT 5;

-- Verify new columns are NOT NULL where expected
SELECT COUNT(*) FROM user_companion WHERE inactive_days IS NULL;
SELECT COUNT(*) FROM profiles WHERE streak_freezes_available IS NULL;
-- Both should return 0
```

**Edge Functions**:
```bash
# Check function health
curl https://<project-ref>.supabase.co/functions/v1/process-daily-decay

# View recent logs
supabase functions logs process-daily-decay --limit 100
```

**Frontend**:
- Visit homepage as guest → No errors
- Login as test user → Companion page loads
- Complete a habit → Check `inactive_days` resets

#### 4.2: Day 1 Checks (Next Morning)

**Verify Cron Ran**:
```bash
# Check logs for cron execution
supabase functions logs process-daily-decay --limit 200 | grep "Daily Decay"
```

Expected log output:
```
[Daily Decay] Processing for date: 2025-12-03
[Daily Decay] Found 42 companions to process
[Decay] User abc123 inactive for 1 days
[Recovery] User def456 was active, resetting decay
[Daily Decay] Complete: 42 processed, 15 decayed, 8 recovered, 2 neglected images triggered
```

**Check Database State**:
```sql
-- See distribution of inactive days
SELECT 
  inactive_days,
  COUNT(*) as user_count,
  AVG(body) as avg_body,
  AVG(mind) as avg_mind,
  AVG(soul) as avg_soul
FROM user_companion
GROUP BY inactive_days
ORDER BY inactive_days;

-- Check mood distribution
SELECT 
  current_mood,
  COUNT(*) as count
FROM user_companion
GROUP BY current_mood;

-- Check neglected images generated
SELECT COUNT(*) 
FROM user_companion 
WHERE neglected_image_url IS NOT NULL;
```

**User Feedback**:
- Check support inbox for complaints
- Monitor app reviews (if applicable)
- Check Discord/Slack for user reactions

#### 4.3: Week 1 Monitoring

**Metrics to Track**:

1. **Daily Decay Execution**:
   ```sql
   -- Check processing volume
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as companions_processed
   FROM user_companion
   WHERE last_activity_date IS NOT NULL
   GROUP BY DATE(created_at)
   ORDER BY date DESC
   LIMIT 7;
   ```

2. **Neglected Image Generation Rate**:
   ```sql
   -- How many images generated
   SELECT 
     DATE(created_at) as date,
     COUNT(*) as images_generated
   FROM user_companion
   WHERE neglected_image_url IS NOT NULL
     AND created_at >= CURRENT_DATE - INTERVAL '7 days'
   GROUP BY DATE(created_at);
   ```

3. **Streak Freeze Usage**:
   ```sql
   -- How many freezes used
   SELECT 
     DATE(last_streak_freeze_used) as date,
     COUNT(*) as freezes_used
   FROM profiles
   WHERE last_streak_freeze_used IS NOT NULL
     AND last_streak_freeze_used >= CURRENT_DATE - INTERVAL '7 days'
   GROUP BY DATE(last_streak_freeze_used);
   ```

4. **Welcome Back Engagement**:
   ```sql
   -- Track users returning after inactivity
   SELECT 
     DATE(last_activity_date) as return_date,
     AVG(inactive_days) as avg_days_away,
     COUNT(*) as users_returned
   FROM user_companion
   WHERE last_activity_date >= CURRENT_DATE - INTERVAL '7 days'
     AND inactive_days = 0  -- Recently reset
   GROUP BY DATE(last_activity_date);
   ```

5. **Error Rate**:
   ```bash
   # Check edge function errors
   supabase functions logs process-daily-decay | grep -i error | wc -l
   supabase functions logs generate-neglected-companion-image | grep -i error | wc -l
   ```

**Performance Monitoring**:
- Edge function execution time (should be <5 seconds for <1000 users)
- Database query performance (check slow query log)
- Image generation API rate limits (monitor Lovable dashboard)

---

## 🛠️ Rollback Plan

If critical issues arise, follow this rollback procedure:

### Emergency Rollback (Critical Bug)

#### 1. Disable Cron Job
- Supabase Dashboard → Edge Functions → `process-daily-decay`
- Toggle off the cron job
- This prevents further damage

#### 2. Revert Frontend (if needed)
```bash
# Vercel
vercel rollback

# Netlify
netlify rollback
```

#### 3. Assess Damage
```sql
-- Check how many users affected
SELECT COUNT(*) FROM user_companion WHERE inactive_days > 0;

-- Check if stats were incorrectly modified
SELECT 
  user_id,
  body,
  mind,
  soul,
  inactive_days,
  last_activity_date
FROM user_companion
WHERE body < 50 OR mind < 50 OR soul < 50;
```

#### 4. Restore User Data (if needed)
If decay was applied incorrectly:

```sql
-- Reset all companions to healthy state
UPDATE user_companion 
SET 
  inactive_days = 0,
  current_mood = 'happy',
  body = GREATEST(body + 20, 100),  -- Restore some stats
  mind = GREATEST(mind + 20, 100),
  soul = GREATEST(soul + 20, 100),
  last_activity_date = CURRENT_DATE;

-- Give everyone extra streak freezes as compensation
UPDATE profiles 
SET streak_freezes_available = GREATEST(streak_freezes_available + 1, 2);
```

#### 5. Database Rollback (extreme cases only)
```bash
# List recent migrations
supabase db list-migrations

# Rollback to before neglect system
supabase db rollback 20251202000609_46c70f51-3647-4934-8038-d66d088ebc54
```

**Warning**: This will remove all neglect-related columns and data!

### Partial Rollback (Non-Critical)

If only one component has issues:

**Option A: Disable Welcome Back Modal**
```typescript
// In CompanionDisplay.tsx, comment out:
// const [showWelcomeBack, setShowWelcomeBack] = useState(false);

// useEffect(() => {
//   if (needsWelcomeBack && !welcomeBackDismissed && companion) {
//     setShowWelcomeBack(true);
//   }
// }, [needsWelcomeBack, welcomeBackDismissed, companion]);

// Redeploy frontend only
```

**Option B: Disable Neglected Image Generation**
```sql
-- In process-daily-decay, comment out image generation:
-- Line 123-138 in the edge function

-- Redeploy edge function
supabase functions deploy process-daily-decay
```

**Option C: Adjust Decay Rate**
```typescript
// In process-daily-decay, change decay amount:
// Line 98-100
const newBody = Math.max(0, (companion.body ?? 100) - 2);  // Changed from -5 to -2
const newMind = Math.max(0, (companion.mind ?? 0) - 2);
const newSoul = Math.max(0, (companion.soul ?? 0) - 2);

// Redeploy edge function
```

---

## 📊 Success Criteria

### Day 1 Success
- ✅ Cron job executed successfully
- ✅ At least 50% of inactive users processed
- ✅ No database errors in logs
- ✅ No user complaints about data loss
- ✅ Frontend loads without errors

### Week 1 Success
- ✅ Cron job runs daily without manual intervention
- ✅ Neglected images generating successfully (1-5 per day)
- ✅ Welcome back modals appearing correctly
- ✅ Streak freezes being consumed and reset
- ✅ User retention improved (measure baseline first)

### Month 1 Success
- ✅ 15%+ increase in user return rate (within 7 days)
- ✅ Average inactive days decreased by 20%
- ✅ 70%+ users engage with welcome back modal
- ✅ Less than 1% of users request stat restoration
- ✅ No performance degradation

---

## 🆘 Troubleshooting

### Issue: Cron Job Not Running

**Symptoms**: No logs in `process-daily-decay`, inactive_days not updating

**Solutions**:
1. Check cron configuration in Supabase dashboard
2. Verify cron schedule syntax: `0 3 * * *`
3. Manually invoke function to test
4. Check edge function secrets are set
5. Review Supabase status page for outages

### Issue: Neglected Images Not Generating

**Symptoms**: `neglected_image_url` stays NULL even after 3+ days

**Solutions**:
1. Check `generate-neglected-companion-image` logs for errors
2. Verify Lovable API key is valid and has credits
3. Check rate limits on AI API
4. Manually invoke function for a test user
5. Fallback: Users still see CSS-filtered sad version

### Issue: Welcome Back Modal Not Appearing

**Symptoms**: Users with `inactive_days >= 2` don't see modal

**Solutions**:
1. Check browser console for React errors
2. Verify `needsWelcomeBack` is true (React DevTools)
3. Check if modal was already dismissed in session
4. Clear browser cache and refresh
5. Verify `useCompanionHealth` hook is loading data

### Issue: Streak Freeze Not Auto-Applying

**Symptoms**: User loses streak despite having freezes

**Solutions**:
1. Check if user actually had active streak (>0 days)
2. Verify `streak_freezes_available > 0` before missed day
3. Check `process-daily-decay` logs for freeze application
4. Manual fix: Restore streak and notify user

### Issue: Stats Decaying Too Fast

**Symptoms**: Users complain companion stats dropped too much

**Solutions**:
1. Verify activity tracking is working (check `last_activity_date`)
2. Check if user's actions are being recorded in `daily_tasks`, `habit_completions`, etc.
3. Review edge function logic for decay calculation
4. Consider adjusting decay rate (currently -5 per day)
5. Manual fix: Restore stats and investigate root cause

### Issue: Performance Degradation

**Symptoms**: Companion page loading slowly, timeouts

**Solutions**:
1. Check database query performance (use EXPLAIN ANALYZE)
2. Verify indexes are being used
3. Check edge function execution times
4. Consider adding more caching (increase staleTime in React Query)
5. Optimize `process-daily-decay` batch size if needed

---

## 📞 Support Resources

### Internal Documentation
- [NEGATIVE_COMPANION_SYSTEM_REPORT.md](./NEGATIVE_COMPANION_SYSTEM_REPORT.md) - Full implementation details
- [NEGATIVE_COMPANION_TEST_PLAN.md](./NEGATIVE_COMPANION_TEST_PLAN.md) - Testing procedures

### External Resources
- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [Supabase Cron Jobs](https://supabase.com/docs/guides/functions/schedule-functions)
- [React Query Docs](https://tanstack.com/query/latest/docs/react/overview)

### Support Contacts
- **Engineering**: [Your team Slack channel]
- **Product**: [Product manager contact]
- **DevOps**: [Infrastructure team contact]
- **Supabase Support**: support@supabase.com

---

## ✅ Deployment Sign-Off

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Reviewed By**: _______________  

### Checklist
- [ ] Database migration deployed successfully
- [ ] Edge functions deployed and tested
- [ ] Cron job configured and enabled
- [ ] Frontend deployed without errors
- [ ] Post-deployment checks passed
- [ ] Monitoring dashboard set up
- [ ] Team notified of deployment
- [ ] Documentation updated
- [ ] Rollback plan understood by team

**Status**: 🟢 Ready for Production | 🟡 Proceed with Caution | 🔴 Do Not Deploy

**Notes**:
_______________________________________________________
_______________________________________________________
_______________________________________________________
