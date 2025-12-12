# Supabase to Firebase Migration Status

## ✅ Completed

### Frontend Code
- ✅ All Supabase client usage removed from frontend
- ✅ All function calls use Firebase Cloud Functions (`@/lib/firebase/functions`)
- ✅ **FIXED:** `LibraryContent.tsx` - Converted broken Supabase query to Firestore
- ✅ **FIXED:** `HabitCard.tsx` - Converted broken Supabase update to Firestore
- ✅ Authentication uses Firebase Auth only
- ✅ All data operations use Firestore

### Remaining Supabase References
These are just comments/documentation:
- `src/components/AskMentorChat.tsx` - Comment about Firebase replacing Supabase
- `src/lib/firebase/functions.ts` - Comment about replacing Supabase Edge Functions
- `src/hooks/useAuth.ts` - Comment about Supabase Session compatibility
- `src/lib/firebase/pushSubscriptions.ts` - Comment about replacing Supabase table

## 🔄 In Progress / TODO

### Phase 1: Migrate Supabase Edge Functions to Firebase Cloud Functions

**Status:** 78 Edge Functions need migration

**Location:** `supabase/functions/`

These need to be converted to Firebase Cloud Functions in `functions/src/`:

#### Authentication & User Management (2)
- [ ] `delete-user-account` → Firebase Cloud Function
- [ ] `delete-user` → Firebase Cloud Function

#### AI Generation Functions (30+)
- [ ] `generate-activity-comment`
- [ ] `generate-adaptive-push`
- [ ] `generate-check-in-response`
- [ ] `generate-companion-evolution`
- [ ] `generate-companion-image`
- [ ] `generate-companion-story`
- [ ] `generate-complete-pep-talk`
- [ ] `generate-cosmic-deep-dive`
- [ ] `generate-cosmic-postcard`
- [ ] `generate-daily-horoscope`
- [ ] `generate-daily-mentor-pep-talks`
- [ ] `generate-daily-missions`
- [ ] `generate-daily-quotes`
- [ ] `generate-evolution-card`
- [ ] `generate-evolution-voice`
- [ ] `generate-full-mentor-audio`
- [ ] `generate-guild-story`
- [ ] `generate-inspire-quote`
- [ ] `generate-lesson`
- [ ] `generate-mentor-audio`
- [ ] `generate-mentor-content`
- [ ] `generate-mentor-script`
- [ ] `generate-mood-push`
- [ ] `generate-neglected-companion-image`
- [ ] `generate-proactive-nudges`
- [ ] `generate-quote-image`
- [ ] `generate-quotes`
- [ ] `generate-reflection-reply`
- [ ] `generate-smart-notifications`
- [ ] `generate-tutorial-tts`
- [ ] `generate-weekly-challenges`
- [ ] `generate-weekly-insights`
- [ ] `generate-zodiac-images`

#### Notification Functions (10+)
- [ ] `deliver-adaptive-pushes` → Firebase Cloud Function + Scheduler
- [ ] `deliver-scheduled-notifications` → Firebase Cloud Function + Scheduler
- [ ] `dispatch-daily-pushes` → Firebase Cloud Function + Scheduler
- [ ] `dispatch-daily-pushes-native` → Firebase Cloud Function + Scheduler
- [ ] `dispatch-daily-quote-pushes` → Firebase Cloud Function + Scheduler
- [ ] `send-apns-notification`
- [ ] `send-shout-notification`
- [ ] `schedule-adaptive-pushes` → Firebase Cloud Scheduler
- [ ] `schedule-daily-mentor-pushes` → Firebase Cloud Scheduler
- [ ] `schedule-daily-quote-pushes` → Firebase Cloud Scheduler

#### Subscription & Payment Functions (6)
- [ ] `record-subscription`
- [ ] `process-paypal-payout`
- [ ] `verify-apple-receipt`
- [ ] `check-apple-subscription`
- [ ] `apple-webhook`
- [ ] `request-referral-payout`

#### Data Processing Functions (10+)
- [ ] `process-daily-decay` → Firebase Cloud Function + Scheduler
- [ ] `process-referral`
- [ ] `trigger-adaptive-event`
- [ ] `resolve-streak-freeze`
- [ ] `check-task-reminders` → Firebase Cloud Function + Scheduler
- [ ] `calculate-cosmic-profile`
- [ ] `transcribe-audio`
- [ ] `sync-daily-pep-talk-transcript`

#### Admin/Utility Functions (10+)
- [ ] `create-influencer-code`
- [ ] `reset-companion`
- [ ] `seed-real-quotes`
- [ ] `seed-real-quotes-by-selection`
- [ ] `batch-generate-lessons`
- [ ] `daily-lesson-scheduler` → Firebase Cloud Scheduler
- [ ] `get-single-quote`
- [ ] `generate-sample-card`
- [ ] `generate-cosmic-postcard-test`
- [ ] `mentor-chat`

### Phase 2: Migrate Supabase Database Tables to Firestore

**Status:** Need to verify which tables have data that needs migration

**Tables in Supabase:**
- `profiles` → Already in Firestore
- `user_companion` → Already in Firestore
- `daily_tasks` → May need migration
- `habits` → May need migration
- `epics` → Already in Firestore
- `epic_members` → Already in Firestore
- `epic_habits` → Already in Firestore
- `activity_feed` → Already in Firestore
- `daily_check_ins` → Already in Firestore
- `mentor_nudges` → May need migration
- `quotes` → Need to verify if in Supabase
- `daily_pep_talks` → May need migration
- All other tables → Check for data migration

**Action Items:**
1. Export all Supabase table data
2. Create migration scripts to import to Firestore
3. Verify data integrity
4. Update all Edge Functions to use Firestore

### Phase 3: Remove Supabase Infrastructure

**Status:** Pending completion of Phases 1 & 2

**Tasks:**
- [ ] Delete `supabase/` directory
- [ ] Remove Supabase from `package.json` (if present)
- [ ] Remove Supabase environment variables
- [ ] Remove Supabase from deployment configs
- [ ] Remove Supabase from CI/CD pipelines
- [ ] Archive Supabase migrations as reference

## Migration Strategy

### For Each Edge Function:

1. **Create Firebase Cloud Function:**
   - Copy function logic to `functions/src/[function-name].ts`
   - Replace Supabase client with Firestore admin SDK
   - Replace Supabase database queries with Firestore queries
   - Update environment variable references

2. **Update Function Logic:**
   - Replace `createClient()` with `admin.firestore()`
   - Convert Supabase queries to Firestore queries
   - Update response formats if needed

3. **Deploy:**
   - Deploy to Firebase
   - Update function URL in frontend if needed (already using Firebase functions)

4. **Test:**
   - Test the new function
   - Verify it works correctly
   - Monitor for errors

5. **Remove:**
   - Delete old Supabase Edge Function
   - Clean up unused code

### For Scheduled Functions:

Use Firebase Cloud Scheduler instead of Supabase cron jobs:
- Create Cloud Scheduler job
- Point to Firebase Cloud Function
- Set schedule (same as Supabase cron)
- Deploy

## Next Steps

1. **Start with critical functions:**
   - Notification delivery functions (users rely on these)
   - Subscription/payment functions (revenue critical)
   - Daily processing functions (data integrity)

2. **Then migrate utility functions:**
   - AI generation functions
   - Admin functions
   - Testing functions

3. **Finally clean up:**
   - Remove Supabase infrastructure
   - Clean up code
   - Update documentation

## Notes

- Frontend is already fully migrated ✅
- All function calls go through Firebase Cloud Functions ✅
- Main work is migrating the backend Edge Functions
- Consider keeping Supabase read-only until all functions are migrated
- Test thoroughly before removing Supabase infrastructure

