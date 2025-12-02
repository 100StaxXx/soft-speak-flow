# Negative Companion System - Quick Start Guide

## TL;DR - What This System Does

Your companion now reacts to user inactivity with gentle negative consequences:

- **Day 0**: User active → Companion happy 😊
- **Day 1**: User inactive → Stats -5, Mood neutral 😐
- **Day 2**: Still inactive → Stats -5, Mood worried 😟, Nudge sent
- **Day 3**: Critical → Stats -5, Mood sad 😢, **Sad image generated**, Badge appears
- **Day 5+**: Very inactive → Mood sick 🤒, Final plea nudges
- **Return**: Welcome back modal, +10 stats recovery, +25 XP bonus 🎉

**Safety Net**: Streak freezes (1 per week) protect your habit streak even when companion decays.

---

## 5-Minute Setup (For Developers)

### 1. Apply Database Migration
```bash
cd /workspace
supabase db push
```

This adds:
- `neglected_image_url`, `last_activity_date`, `inactive_days` to `user_companion`
- `streak_freezes_available`, `last_streak_freeze_used`, `streak_freezes_reset_at` to `profiles`

### 2. Deploy Edge Functions
```bash
supabase functions deploy process-daily-decay
supabase functions deploy generate-neglected-companion-image
supabase functions deploy generate-proactive-nudges
```

### 3. Set Up Daily Cron
Via Supabase Dashboard:
- Edge Functions → `process-daily-decay` → Add Cron
- Schedule: `0 3 * * *` (3 AM UTC daily)
- Enable

### 4. Deploy Frontend
```bash
npm run build
# Deploy to your hosting platform (Vercel/Netlify/etc)
```

### 5. Test It Works
```sql
-- Set a test user to inactive
UPDATE user_companion 
SET inactive_days = 3, current_mood = 'sad' 
WHERE user_id = '<test-user-id>';

-- Login as that user → Should see Welcome Back Modal
```

---

## Files Changed

### Backend
- `supabase/migrations/20251202000609_*.sql` - Database schema
- `supabase/functions/process-daily-decay/index.ts` - Daily decay logic ⭐
- `supabase/functions/generate-neglected-companion-image/index.ts` - Sad image generation
- `supabase/functions/generate-proactive-nudges/index.ts` - Mentor concern messages

### Frontend
- `src/hooks/useCompanionHealth.ts` - Health tracking hook ⭐
- `src/hooks/useXPRewards.ts` - Activity tracking integration
- `src/components/CompanionDisplay.tsx` - Shows mood states ⭐
- `src/components/WelcomeBackModal.tsx` - Reunion flow ⭐
- `src/components/StreakFreezeDisplay.tsx` - Freeze counter
- `src/pages/Companion.tsx` - Added StreakFreezeDisplay to Progress tab

---

## How It Works (Under the Hood)

### Daily Decay Process
**Runs**: Every day at 3 AM UTC (via cron)

**For each user with a companion**:
1. Check if user was active yesterday:
   - Query `daily_tasks`, `habit_completions`, `daily_check_ins` for yesterday's date
   - If ANY activity found → Mark active, apply recovery bonus
   - If NO activity → Increment `inactive_days`, apply stat decay

2. Update mood state:
   ```typescript
   if (inactiveDays === 0) mood = 'happy';
   if (inactiveDays === 1) mood = 'neutral';
   if (inactiveDays === 2) mood = 'worried';
   if (inactiveDays >= 3 && < 5) mood = 'sad';
   if (inactiveDays >= 5) mood = 'sick';
   ```

3. Apply consequences:
   - **Stats**: -5 Body/Mind/Soul per day (min 0)
   - **Image**: Generate sad version at day 3 (cached)
   - **Streak**: Auto-use freeze if available

4. Generate mentor nudges:
   - Day 1: Gentle reminder
   - Day 2: Concerned check-in
   - Day 3-4: Urgent message
   - Day 5-6: Emotional plea
   - Day 7+: Final message

### Activity Tracking
**Marks user as active** when they:
- Complete a quest/task
- Complete a habit
- Complete a check-in
- Complete a challenge
- Complete a weekly challenge

**Implementation**: All XP reward functions now call `markUserActive()` which:
```typescript
await supabase
  .from('user_companion')
  .update({
    last_activity_date: today,
    inactive_days: 0,
    current_mood: 'happy',
  })
  .eq('user_id', userId);
```

### Welcome Back Flow
**Triggered**: When user returns after 2+ days inactive

**Steps**:
1. Modal opens automatically on Companion page
2. Shows sad companion image and stats lost
3. User clicks "Reunite with Your Companion"
4. Animated transition (sad → happy)
5. Rewards applied:
   - +10 to each stat (recovery bonus)
   - +25 XP
   - Reset `inactive_days` to 0
6. Companion returns to normal

---

## Configuration Options

### Adjust Decay Rate
Edit `supabase/functions/process-daily-decay/index.ts` line 98-100:
```typescript
// Current: -5 per day
const newBody = Math.max(0, (companion.body ?? 100) - 5);

// More forgiving: -2 per day
const newBody = Math.max(0, (companion.body ?? 100) - 2);

// More strict: -10 per day
const newBody = Math.max(0, (companion.body ?? 100) - 10);
```

### Adjust Mood Thresholds
Edit same file, lines 103-108:
```typescript
// Current thresholds
if (newInactiveDays === 1) newMood = "neutral";
if (newInactiveDays === 2) newMood = "worried";
if (newInactiveDays >= 3 && newInactiveDays < 5) newMood = "sad";
if (newInactiveDays >= 5) newMood = "sick";

// More lenient (sad at 5 days instead of 3)
if (newInactiveDays <= 2) newMood = "neutral";
if (newInactiveDays >= 3 && newInactiveDays < 5) newMood = "worried";
if (newInactiveDays >= 5 && newInactiveDays < 7) newMood = "sad";
if (newInactiveDays >= 7) newMood = "sick";
```

### Adjust Recovery Bonus
Edit same file, lines 73-75:
```typescript
// Current: +10 each
const newBody = Math.min(100, (companion.body ?? 100) + 10);

// More generous: +20 each
const newBody = Math.min(100, (companion.body ?? 100) + 20);

// Proportional to time away (up to +30)
const recoveryBonus = Math.min(companion.inactive_days * 5, 30);
const newBody = Math.min(100, (companion.body ?? 100) + recoveryBonus);
```

### Change Streak Freeze Reset Period
Edit migration file or manually update:
```sql
-- Current: 7 days (weekly)
UPDATE profiles 
SET streak_freezes_reset_at = CURRENT_TIMESTAMP + INTERVAL '7 days';

-- Monthly instead
UPDATE profiles 
SET streak_freezes_reset_at = CURRENT_TIMESTAMP + INTERVAL '30 days';
```

---

## Common Questions

### Q: Will this make users feel bad?
**A**: No. The system is designed to be gentle and supportive:
- Emphasizes positive recovery over punishment
- Streak freezes provide safety net
- Welcome back bonus rewards return
- Mentor messages avoid guilt-tripping
- Visual changes are subtle, not dramatic

### Q: What if users complain about unfair decay?
**A**: Check their `last_activity_date`:
```sql
SELECT 
  user_id,
  last_activity_date,
  inactive_days,
  body, mind, soul
FROM user_companion 
WHERE user_id = '<complained-user-id>';
```

If incorrect:
- Verify activity tracking is working (check habit_completions, daily_tasks)
- Manually reset: `UPDATE user_companion SET inactive_days = 0 WHERE user_id = '...'`
- Give compensation: Award extra XP or stats

### Q: How do I disable this system temporarily?
**A**: Disable the cron job:
- Supabase Dashboard → Edge Functions → `process-daily-decay`
- Toggle off the cron schedule
- Users will stop decaying, but existing decay remains

### Q: Can I test this without waiting 3 days?
**A**: Yes, manually set inactive_days:
```sql
-- Make companion sad immediately
UPDATE user_companion 
SET 
  inactive_days = 3,
  current_mood = 'sad',
  body = 70,
  mind = 60,
  soul = 50
WHERE user_id = '<test-user-id>';

-- Trigger image generation manually
-- Via Supabase Functions → generate-neglected-companion-image → Invoke with:
{
  "companionId": "<companion-id>",
  "userId": "<test-user-id>"
}
```

### Q: What happens after 30+ days inactive?
**A**: System continues working normally:
- Stats bottom out at 0 (don't go negative)
- Mood stays at "sick"
- Welcome back flow works the same
- Recovery bonus still applies
- User can resume as if nothing happened

### Q: Does this affect habit streaks?
**A**: No, streaks are protected by freeze system:
- Companion decay happens regardless
- Streak freeze saves your habit streak count
- Both systems run independently

---

## Monitoring

### Daily Health Check
Run this SQL every morning:
```sql
-- Overview of companion states
SELECT 
  current_mood,
  COUNT(*) as count,
  AVG(inactive_days) as avg_inactive,
  AVG(body) as avg_body
FROM user_companion
GROUP BY current_mood
ORDER BY 
  CASE current_mood 
    WHEN 'happy' THEN 1
    WHEN 'neutral' THEN 2
    WHEN 'worried' THEN 3
    WHEN 'sad' THEN 4
    WHEN 'sick' THEN 5
    ELSE 6
  END;
```

Expected healthy distribution:
- 70%+ happy
- 10-15% neutral
- 5-10% worried
- 3-5% sad
- <2% sick

If sick > 5%, investigate retention issues.

### Edge Function Logs
```bash
# Check today's execution
supabase functions logs process-daily-decay --limit 500 | grep "$(date +%Y-%m-%d)"

# Count errors
supabase functions logs process-daily-decay | grep -i error | wc -l
```

Should see 0-1 errors per 100 users.

### User Feedback
Monitor for these keywords in support:
- "companion sad"
- "lost stats"
- "unfair decay"
- "didn't log in"

If >5 complaints per 1000 users, adjust decay rate.

---

## Rollback Instructions

### Quick Disable (Reversible)
```bash
# 1. Disable cron via Supabase dashboard
# 2. Reset all companions to happy state
```
```sql
UPDATE user_companion 
SET 
  inactive_days = 0,
  current_mood = 'happy',
  last_activity_date = CURRENT_DATE;
```

### Full Rollback (Nuclear Option)
```bash
# Rollback database
supabase db rollback 20251202000609_46c70f51-3647-4934-8038-d66d088ebc54

# Revert frontend
git revert <commit-hash>
npm run build && npm run deploy
```

---

## Next Steps

1. **Deploy to staging first** - Test with real users for 2-3 days
2. **Monitor metrics** - Track retention, complaints, engagement
3. **Adjust parameters** - Fine-tune decay rate based on feedback
4. **Iterate on messaging** - Improve mentor nudges if needed
5. **Add analytics** - Track welcome back modal completion rate

---

## Support

**Documentation**:
- [NEGATIVE_COMPANION_SYSTEM_REPORT.md](./NEGATIVE_COMPANION_SYSTEM_REPORT.md) - Full technical spec
- [NEGATIVE_COMPANION_TEST_PLAN.md](./NEGATIVE_COMPANION_TEST_PLAN.md) - Testing procedures
- [NEGATIVE_COMPANION_DEPLOYMENT.md](./NEGATIVE_COMPANION_DEPLOYMENT.md) - Deployment guide

**Need Help?**
- Check Supabase logs for edge function errors
- Review React DevTools for frontend issues
- Test with manual database updates
- Contact team for assistance

---

**Status**: ✅ Complete and ready to deploy  
**Last Updated**: December 2, 2025  
**Version**: 1.0.0
