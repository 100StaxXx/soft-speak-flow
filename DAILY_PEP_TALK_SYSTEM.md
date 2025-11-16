# Daily Mentor Pep Talk System

## Overview

A Lil Push now features a fully automated daily pep talk generation and delivery system. Each mentor generates ONE new pep talk every day at 12:01 AM UTC using AI + ElevenLabs, tailored to their unique personality and themes.

## System Architecture

### 1. Database Tables

#### `daily_pep_talks`
Stores daily-generated pep talks for each mentor.
- One pep talk per mentor per day
- Indexed by `(for_date, mentor_slug)` for efficient lookups
- Contains: title, summary, script, audio_url, category, triggers, intensity

#### `pep_talks` (Main Library)
Extended with new columns:
- `mentor_slug`: Identifies the mentor
- `source`: 'manual' or 'daily_auto'
- `for_date`: Date for daily-generated content
- `intensity`: 'soft', 'medium', or 'strong'
- Daily pep talks automatically inserted with `source = 'daily_auto'`

#### `user_daily_pushes`
Tracks scheduled and delivered push notifications.
- Links users to their daily pep talks
- Contains scheduling and delivery timestamps
- Used by dispatch system

#### `profiles` (Extended)
New columns for daily push settings:
- `daily_push_enabled`: Toggle daily pushes on/off
- `daily_push_window`: 'morning', 'afternoon', 'evening', 'custom'
- `daily_push_time`: Preferred time (for custom window)
- `timezone`: User's timezone

### 2. Mentor Daily Themes

Each mentor has 2-3 pre-configured themes that rotate daily based on day of year. Themes include:
- **Topic Category**: discipline, confidence, physique, focus, mindset, business
- **Emotional Triggers**: From the 12 core triggers (e.g., 'Self-Doubt', 'Anxious & Overthinking')
- **Intensity Level**: soft, medium, or strong

Configuration file: `src/config/mentorDailyThemes.ts`

Example for Atlas:
```typescript
{
  topic_category: 'focus',
  intensity: 'medium',
  triggers: ['Anxious & Overthinking', 'Feeling Stuck']
}
```

### 3. Edge Functions

#### `generate-daily-mentor-pep-talks` (Runs at 00:01 UTC)
1. Checks each mentor for existing daily pep talk
2. Selects theme based on day of year (consistent rotation)
3. Calls `generate-full-mentor-audio` with theme parameters
4. Stores result in both `daily_pep_talks` AND `pep_talks` (automatic, no approval)
5. Generates title and summary automatically

#### `schedule-daily-mentor-pushes` (Runs at 00:05 UTC)
1. Finds users with `daily_push_enabled = true`
2. Gets their selected mentor's daily pep talk
3. Calculates scheduled time based on user preferences
4. Creates `user_daily_pushes` entries

#### `dispatch-daily-pushes` (Runs every 5 minutes)
1. Finds pending pushes where `scheduled_at <= now()`
2. Sends notifications (placeholder for push notification integration)
3. Marks as delivered with `delivered_at` timestamp

### 4. Scheduling (Cron Jobs)

Three cron jobs configured via `pg_cron`:
- **00:01 UTC**: Generate daily pep talks for all mentors
- **00:05 UTC**: Schedule pushes for users
- **Every 5 min**: Dispatch pending push notifications

## User Experience

### For Users
1. **Daily Delivery**: Users receive one pep talk per day from their selected mentor at their preferred time
2. **Library Access**: All daily pep talks appear in the Library/Pushes immediately (marked with "Daily" badge)
3. **No Waiting**: No admin approval required - content is instantly available
4. **Personalized**: Matches their mentor's personality and themes

### For Admins
1. **Zero Manual Work**: Entire system is fully automated
2. **Content Library**: Daily pep talks automatically populate the main library
3. **Source Tracking**: Can filter by `source = 'daily_auto'` vs 'manual'
4. **Quality Control**: AI ensures on-brand content matching mentor persona

## How Themes Are Selected

Each day, the system:
1. Calculates `dayOfYear` (1-365/366)
2. Uses `dayOfYear % themes.length` to select theme index
3. This ensures consistent rotation and variety

Example: Atlas has 3 themes
- Day 1: Theme 0 (focus)
- Day 2: Theme 1 (mindset)
- Day 3: Theme 2 (business)
- Day 4: Theme 0 (focus) - cycle repeats

## Key Features

✅ **Fully Automated**: No manual intervention required
✅ **Mentor-Specific**: Each pep talk matches mentor's voice and personality
✅ **Instant Library**: Auto-added to main library, no approval needed
✅ **User Preferences**: Respects time windows and timezone settings
✅ **Duplicate Prevention**: Checks prevent re-generation for same date
✅ **Error Handling**: Robust logging and error tracking per mentor
✅ **Scalable**: Handles all 9 mentors efficiently

## Testing the System

### Manual Trigger (Testing Only)
You can manually trigger generation:
```bash
curl -X POST https://tffrgsaawvletgiztfry.supabase.co/functions/v1/generate-daily-mentor-pep-talks \
  -H "Authorization: Bearer [ANON_KEY]"
```

### Check Cron Jobs
```sql
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

### Verify Daily Pep Talks
```sql
SELECT mentor_slug, for_date, title, created_at 
FROM daily_pep_talks 
ORDER BY for_date DESC, mentor_slug;
```

## Maintenance

### Updating Mentor Themes
Edit `src/config/mentorDailyThemes.ts` to:
- Add new themes
- Adjust categories/triggers
- Change intensity levels

Changes apply to next day's generation automatically.

### Disabling for Specific Mentor
Remove mentor from `MENTOR_SLUGS` array in edge function or set condition to skip.

### Viewing Logs
Check Supabase Edge Function logs for:
- Generation results
- Scheduling confirmations
- Dispatch status
- Any errors

## Future Enhancements

- [ ] Push notification integration (currently placeholder)
- [ ] User feedback on daily pep talks
- [ ] A/B testing different themes
- [ ] Analytics on engagement by mentor/category
- [ ] Custom theme requests from users

## Security Notes

⚠️ After migration, address the security warning about leaked password protection by enabling it in your authentication settings.

All edge functions are public (`verify_jwt = false`) to allow cron scheduling. User data is protected by RLS policies on tables.
