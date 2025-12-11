# Edge Functions Migration Status

## Overview
This document tracks the migration of Supabase Edge Functions to Firebase Cloud Functions.

## Migration Status

### ✅ Already Using Firebase Cloud Functions

The following functions are already being called via Firebase Cloud Functions:

1. **mentorChat** - AI-powered mentor conversation
2. **generateCompletePepTalk** - Complete pep talk generation
3. **generateMentorAudio** - Text-to-speech using ElevenLabs
4. **transcribeAudio** - Audio transcription using OpenAI Whisper
5. **generateGuildStory** - Guild story generation
6. **generateCosmicPostcard** - Cosmic postcard generation
7. **generateDailyHoroscope** - Daily horoscope generation
8. **generateCompanionStory** - Companion story generation
9. **generateEvolutionCard** - Evolution card generation
10. **generateCompanionImage** - Companion image generation
11. **generateCompanionEvolution** - Companion evolution generation
12. **generateDailyMissions** - Daily mission generation
13. **generateQuotes** - Quote generation
14. **generateWeeklyInsights** - Weekly insights generation
15. **generateWeeklyChallenges** - Weekly challenges generation
16. **createInfluencerCode** - Influencer referral code creation
17. **processPaypalPayout** - PayPal payout processing
18. **completeReferralStage3** - Referral completion processing
19. **resetCompanion** - Companion reset
20. **verifyAppleReceipt** - Apple receipt verification
21. **checkAppleSubscription** - Apple subscription check
22. **resolveStreakFreeze** - Streak freeze resolution

### 🔄 Functions That Need Migration

These Supabase Edge Functions exist but may need to be migrated or verified:

#### Scheduled Functions (Cron Jobs)
- `schedule-daily-mentor-pushes` - Daily mentor push notifications
- `schedule-daily-quote-pushes` - Daily quote push notifications
- `schedule-adaptive-pushes` - Adaptive push notifications
- `daily-lesson-scheduler` - Daily lesson scheduling
- `process-daily-decay` - Daily decay processing

#### Dispatch Functions
- `dispatch-daily-pushes` - Dispatch daily pushes
- `dispatch-daily-pushes-native` - Dispatch native daily pushes
- `dispatch-daily-quote-pushes` - Dispatch daily quote pushes
- `deliver-scheduled-notifications` - Deliver scheduled notifications
- `deliver-adaptive-pushes` - Deliver adaptive pushes

#### Generation Functions
- `generate-mentor-script` - Mentor script generation
- `generate-mentor-content` - Mentor content generation
- `generate-lesson` - Lesson generation
- `generate-inspire-quote` - Inspire quote generation
- `generate-quote-image` - Quote image generation
- `generate-sample-card` - Sample card generation
- `generate-neglected-companion-image` - Neglected companion image
- `generate-zodiac-images` - Zodiac image generation
- `generate-full-mentor-audio` - Full mentor audio generation
- `generate-evolution-voice` - Evolution voice generation
- `generate-tutorial-tts` - Tutorial TTS generation
- `generate-smart-notifications` - Smart notification generation
- `generate-proactive-nudges` - Proactive nudge generation
- `generate-reflection-reply` - Reflection reply generation
- `generate-mood-push` - Mood push generation
- `generate-activity-comment` - Activity comment generation
- `generate-check-in-response` - Check-in response generation
- `generate-adaptive-push` - Adaptive push generation
- `generate-cosmic-deep-dive` - Cosmic deep dive generation
- `generate-daily-quotes` - Daily quote generation
- `generate-daily-mentor-pep-talks` - Daily mentor pep talks
- `batch-generate-lessons` - Batch lesson generation

#### Utility Functions
- `get-single-quote` - Get single quote
- `sync-daily-pep-talk-transcript` - Sync pep talk transcript
- `seed-real-quotes` - Seed real quotes
- `seed-real-quotes-by-selection` - Seed quotes by selection
- `check-task-reminders` - Check task reminders
- `check-apple-subscription` - Check Apple subscription
- `calculate-cosmic-profile` - Calculate cosmic profile
- `trigger-adaptive-event` - Trigger adaptive event

#### Webhook Functions
- `apple-webhook` - Apple webhook handler
- `process-referral` - Process referral
- `record-subscription` - Record subscription
- `request-referral-payout` - Request referral payout

#### Notification Functions
- `send-apns-notification` - Send APNS notification
- `send-shout-notification` - Send shout notification

#### Auth Functions
- `apple-native-auth` - Apple native authentication
- `google-native-auth` - Google native authentication

#### User Management
- `delete-user` - Delete user
- `delete-user-account` - Delete user account

## Migration Strategy

### 1. Functions Already Migrated ✅
These functions are already available in `src/lib/firebase/functions.ts` and are being used by components.

### 2. Functions to Migrate 🔄

#### Priority 1: Critical User-Facing Functions
- Scheduled push notifications
- Dispatch functions
- Webhook handlers

#### Priority 2: Generation Functions
- All AI generation functions
- Image generation functions
- Audio generation functions

#### Priority 3: Utility Functions
- Data seeding functions
- Profile calculation functions
- Reminder functions

### 3. Migration Steps

For each function:

1. **Create Firebase Cloud Function**
   - Deploy to Firebase Functions
   - Update function URL/name

2. **Update Client Code**
   - Add function wrapper in `src/lib/firebase/functions.ts`
   - Update component calls

3. **Test**
   - Test function locally
   - Test in staging
   - Deploy to production

4. **Remove Supabase Function**
   - Delete from `supabase/functions/`
   - Update documentation

## Firebase Cloud Functions Setup

All functions are called via:
```typescript
import { callFirebaseFunction } from '@/lib/firebase/functions';
```

Or using specific wrappers:
```typescript
import { mentorChat, generateCompletePepTalk } from '@/lib/firebase/functions';
```

## Notes

- Many functions are already migrated and working
- Scheduled functions may need Firebase Cloud Scheduler setup
- Webhook functions need to be updated to accept Firebase requests
- Auth functions may need special handling for native auth

## Next Steps

1. ✅ Verify all client-side function calls use Firebase
2. 🔄 Migrate scheduled functions to Cloud Scheduler
3. 🔄 Migrate webhook handlers
4. 🔄 Migrate remaining generation functions
5. 🔄 Clean up Supabase function directory

