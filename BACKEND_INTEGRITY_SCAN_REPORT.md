# Backend Feature Integrity Scan Report

Generated: 2025-12-11T22:14:19.819Z

## Firebase Cloud Functions

| Function Name | File Path | Trigger | Referenced | Compiles | Dependencies |
|--------------|-----------|---------|------------|----------|-------------|
| generateCompanionName | functions/src/index.ts | Callable | ✅ | ✅ | ✅ |
| mentorChat | functions/src/index.ts | Callable | ✅ | ✅ | ✅ |
| sendApnsNotification | functions/src/index.ts | Callable | ❌ | ✅ | ✅ |
| verifyAppleReceipt | functions/src/index.ts | Callable | ✅ | ✅ | ✅ |
| checkAppleSubscription | functions/src/index.ts | Callable | ✅ | ✅ | ✅ |
| appleWebhook | functions/src/index.ts | HTTP | ❌ | ✅ | ✅ |
| scheduledGenerateDailyQuotes | functions/src/index.ts | Cron | ❌ | ✅ | ✅ |
| scheduledGenerateDailyMentorPepTalks | functions/src/index.ts | Cron | ❌ | ✅ | ✅ |
| scheduledScheduleDailyMentorPushes | functions/src/index.ts | Cron | ❌ | ✅ | ✅ |
| scheduledDispatchDailyPushes | functions/src/index.ts | Cron | ❌ | ✅ | ✅ |
| deleteUserAccount | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateEvolutionCard | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateCompanionStory | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateDailyMissions | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateQuotes | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateWeeklyInsights | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateWeeklyChallenges | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateSmartNotifications | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateProactiveNudges | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateReflectionReply | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateGuildStory | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateCosmicPostcard | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateCosmicDeepDive | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateDailyHoroscope | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateMentorScript | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateMentorContent | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateLesson | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateCompanionImage | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateCompletePepTalk | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateCheckInResponse | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateAdaptivePush | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| calculateCosmicProfile | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateActivityComment | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateMoodPush | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateInspireQuote | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateQuoteImage | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateSampleCard | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateNeglectedCompanionImage | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateZodiacImages | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| getSingleQuote | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| batchGenerateLessons | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateCompanionEvolution | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateDailyQuotes | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateDailyMentorPepTalks | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateMentorAudio | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateFullMentorAudio | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| testApiKeys | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| generateEvolutionVoice | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| transcribeAudio | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| syncDailyPepTalkTranscript | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| seedRealQuotes | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| resetCompanion | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| createInfluencerCode | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| processPaypalPayout | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| completeReferralStage3 | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |
| resolveStreakFreeze | functions/src/index.ts | Callable (v1) | ✅ | ✅ | ✅ |

## Supabase Edge Functions

**STATUS: ARCHIVED** ✅

All 69 Supabase Edge Functions have been archived to `archive/supabase-functions-20251211-142222/` and removed from the codebase.

**Archive Date:** December 11, 2025

See `SUPABASE_CLEANUP_COMPLETE.md` for details.

## Database Collections/Tables

| Collection Name | Referenced In |
|----------------|---------------|
| quotes | src\components\GlobalSearch.tsx, src\components\HeroQuoteBanner.tsx, src\components\InspireSection.tsx, src\components\library\LibraryContent.tsx, src... |
| pep_talks | src\components\GlobalSearch.tsx, src\components\library\LibraryContent.tsx, src\pages\Admin.tsx, src\pages\Library.tsx |
| challenges | src\components\GlobalSearch.tsx, src\components\library\LibraryContent.tsx, src\pages\Challenges.tsx |
| epics | src\components\GlobalSearch.tsx, src\pages\JoinEpic.tsx, src\pages\SharedEpics.tsx |
| epic_members | src\components\GlobalSearch.tsx, src\components\GuildMembersSection.tsx, src\utils\guildBonus.ts |
| profiles | src\components\GuildMembersSection.tsx, src\pages\Admin.tsx, functions\src\index.ts |
| user_companion | src\components\GuildMembersSection.tsx, src\hooks\useCompanion.ts, functions\src\index.ts |
| habits | src\components\HabitCard.tsx, src\hooks\useEpics.ts, src\pages\JoinEpic.tsx, src\pages\SharedEpics.tsx |
| daily_pep_talks | src\components\HeroQuoteBanner.tsx, src\components\TodaysPepTalk.tsx, functions\src\index.ts |
| mentors | src\components\HeroQuoteBanner.tsx, src\components\TodaysPepTalk.tsx, src\contexts\ThemeContext.tsx, src\pages\Admin.tsx, src\pages\MentorChat.tsx, sr... |
| daily_check_ins | src\components\MorningCheckIn.tsx, src\hooks\useCompanionMood.ts |
| xp_events | src\components\TodaysPepTalk.tsx, functions\src\index.ts |
| adaptive_push_settings | src\hooks\useAdaptiveNotifications.ts, src\pages\Profile.tsx |
| epic_activity_feed | src\hooks\useGuildActivity.ts |
| guild_shouts | src\hooks\useGuildShouts.ts |
| lessons | src\hooks\useLessonNotifications.ts, functions\src\index.ts |
| companion_skins | src\hooks\useReferrals.ts, functions\src\index.ts |
| push_subscriptions | src\lib\firebase\pushSubscriptions.ts, functions\src\index.ts |
| epic_habits | src\utils\guildBonus.ts |
| companion_evolutions | functions\src\index.ts |
| companion_evolution_cards | functions\src\index.ts |
| mentor_chats | functions\src\index.ts |
| companion_stories | functions\src\index.ts |
| daily_missions | functions\src\index.ts |
| daily_tasks | functions\src\index.ts |
| guild_stories | functions\src\index.ts |
| companion_postcards | functions\src\index.ts |
| daily_quotes | functions\src\index.ts |
| referral_codes | functions\src\index.ts |
| user_roles | functions\src\index.ts |
| referral_payouts | functions\src\index.ts |
| user_daily_pushes | functions\src\index.ts |
| referral_completions | functions\src\index.ts |
| user_companion_skins | functions\src\index.ts |
| payment_history | functions\src\index.ts |
| subscriptions | functions\src\index.ts |

## Summary

- **Firebase Functions**: 56 total, 50 referenced
- **Supabase Edge Functions**: 69 total, **ARCHIVED** ✅
- **Database Collections**: 43 unique collections referenced
- **Files with Deleted Imports**: 0

## ⚠️ Unreferenced Functions

### Firebase Functions (Expected - Cron/Webhooks)
- sendApnsNotification (functions/src/index.ts) - Internal use
- appleWebhook (functions/src/index.ts) - Webhook endpoint
- scheduledGenerateDailyQuotes (functions/src/index.ts) - Cron job
- scheduledGenerateDailyMentorPepTalks (functions/src/index.ts) - Cron job
- scheduledScheduleDailyMentorPushes (functions/src/index.ts) - Cron job
- scheduledDispatchDailyPushes (functions/src/index.ts) - Cron job

### Supabase Edge Functions
**All archived** - See `SUPABASE_CLEANUP_COMPLETE.md` for details.

## Cleanup Status

✅ **Supabase Functions Cleanup Complete**
- All 69 functions archived
- Functions directory removed
- Archive location: `archive/supabase-functions-20251211-142222/`
- See `SUPABASE_CLEANUP_COMPLETE.md` for full details
