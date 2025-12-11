# Database Operations Analysis Report

**Generated:** 2025-01-XX  
**Purpose:** Comprehensive analysis of all database read/write operations in the application, comparing against actual schemas in Firebase Firestore and Supabase.

---

## Executive Summary

This report catalogs every database operation in the codebase, identifies the collections/tables used, fields referenced, and compares them against the actual database schemas to identify:
- Missing collections/tables
- Missing fields
- Potential query failures
- Schema inconsistencies

---

## Table of Contents

1. [Firebase Firestore Operations](#firebase-firestore-operations)
2. [Supabase Operations](#supabase-operations)
3. [Schema Comparison](#schema-comparison)
4. [Missing Collections/Tables](#missing-collectionstables)
5. [Missing Fields](#missing-fields)
6. [Potential Query Failures](#potential-query-failures)
7. [Schema Diff](#schema-diff)

---

## Firebase Firestore Operations

### Collections Found in Code

Based on analysis of `src/` and `functions/src/` directories:

#### 1. **profiles**
- **Operations:** READ, WRITE, UPDATE
- **Files:** 
  - `src/lib/firebase/profiles.ts`
  - `src/pages/Profile.tsx`
  - `src/pages/Horoscope.tsx`
  - `src/pages/Tasks.tsx`
  - `functions/src/index.ts` (multiple locations)
- **Fields Referenced:**
  - `id`, `user_id`, `email`, `onboarding_data`, `selected_mentor_id`
  - `zodiac_sign`, `astral_encounters_enabled`
  - `daily_push_enabled`, `daily_push_window`, `daily_push_time`, `timezone`
  - `referred_by`, `current_habit_streak`, `streak_freezes_available`, `streak_at_risk`
  - `faction`, `display_name`, `username`
- **Exists in Firestore Rules:** ✅ Yes (line 15-20)
- **Exists in Supabase:** ✅ Yes (table: `profiles`)

#### 2. **mentors**
- **Operations:** READ
- **Files:**
  - `src/pages/MentorSelection.tsx`
  - `src/components/TodaysPepTalk.tsx`
  - `src/components/MentorMessage.tsx`
  - `src/components/BottomNav.tsx`
  - `src/contexts/ThemeContext.tsx`
  - `functions/src/index.ts` (multiple locations)
- **Fields Referenced:**
  - `id`, `slug`, `name`, `is_active`
- **Exists in Firestore Rules:** ✅ Yes (line 23-26)
- **Exists in Supabase:** ✅ Yes (table: `mentors`)

#### 3. **user_companion**
- **Operations:** READ, WRITE, UPDATE
- **Files:**
  - `src/hooks/useCompanion.ts`
  - `src/components/GuildMembersSection.tsx`
  - `functions/src/index.ts` (multiple locations)
- **Fields Referenced:**
  - `id`, `user_id`, `current_image_url`, `spirit_animal`
  - `image_regenerations_used`, `created_at`, `initial_image_url`
  - `current_stage`, `current_xp`, `favorite_color`, `core_element`
- **Exists in Firestore Rules:** ✅ Yes (line 29-31)
- **Exists in Supabase:** ✅ Yes (table: `user_companion`)

#### 4. **companion_evolutions**
- **Operations:** READ, WRITE
- **Files:**
  - `src/hooks/useCompanion.ts`
  - `src/components/CompanionEvolutionHistory.tsx`
  - `src/components/GlobalEvolutionListener.tsx`
  - `functions/src/index.ts` (multiple locations)
- **Fields Referenced:**
  - `id`, `companion_id`, `stage`, `image_url`, `evolved_at`, `xp_at_evolution`
- **Exists in Firestore Rules:** ✅ Yes (line 34-40)
- **Exists in Supabase:** ✅ Yes (table: `companion_evolutions`)

#### 5. **companion_evolution_cards**
- **Operations:** READ, WRITE
- **Files:**
  - `src/hooks/useCompanion.ts`
  - `src/components/EvolutionCardGallery.tsx`
  - `functions/src/index.ts` (multiple locations)
- **Fields Referenced:**
  - `id`, `companion_id`, `evolution_id`, `card_id`, `creature_name`
  - `element`, `species`, `rarity`, `stats`, `image_url`
- **Exists in Firestore Rules:** ✅ Yes (line 43-49)
- **Exists in Supabase:** ✅ Yes (table: `companion_evolution_cards`)

#### 6. **companion_stories**
- **Operations:** READ, WRITE
- **Files:**
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `companion_id`, `user_id`, `stage`, `chapter_title`
  - `main_story`, `intro_line`, `bond_moment`, `life_lesson`
- **Exists in Firestore Rules:** ✅ Yes (line 52-58)
- **Exists in Supabase:** ✅ Yes (table: `companion_stories`)

#### 7. **companion_postcards**
- **Operations:** READ, WRITE
- **Files:**
  - `src/hooks/useCompanionPostcards.ts`
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `companion_id`, `user_id`, `epic_id`, `image_url`
  - `location_name`, `location_description`, `caption`, `generated_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `companion_postcards`)

#### 8. **daily_missions**
- **Operations:** READ, WRITE, UPDATE
- **Files:**
  - `functions/src/index.ts`
  - `src/components/WeeklyInsights.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `mission_date`, `mission_text`, `mission_type`
  - `completed`, `completed_at`, `xp_reward`
- **Exists in Firestore Rules:** ✅ Yes (line 61-70)
- **Exists in Supabase:** ✅ Yes (table: `daily_missions`)

#### 9. **daily_tasks**
- **Operations:** READ, WRITE, UPDATE, DELETE
- **Files:**
  - `src/pages/Tasks.tsx`
  - `src/hooks/useTaskMutations.ts`
  - `src/components/GlobalSearch.tsx`
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `user_id`, `task_date`, `task_text`, `completed`, `completed_at`
  - `scheduled_time`, `estimated_duration`, `is_main_quest`, `xp_reward`
  - `category`, `difficulty`, `is_bonus`, `is_recurring`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `daily_tasks`)

#### 10. **quotes**
- **Operations:** READ, WRITE
- **Files:**
  - `src/components/library/LibraryContent.tsx`
  - `src/components/QuoteOfTheDay.tsx`
  - `src/components/InspireSection.tsx`
  - `src/components/MentorSelection.tsx`
  - `src/utils/quoteSelector.ts`
  - `functions/src/index.ts` (multiple locations)
- **Fields Referenced:**
  - `id`, `text`, `author`, `category`, `emotional_triggers`
  - `mentor_id`, `intensity`, `tags`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `quotes`)

#### 11. **daily_quotes**
- **Operations:** READ, WRITE
- **Files:**
  - `functions/src/index.ts` (multiple locations)
- **Fields Referenced:**
  - `id`, `for_date`, `mentor_slug`, `quote_id`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `daily_quotes`)

#### 12. **daily_pep_talks**
- **Operations:** READ, WRITE, UPDATE
- **Files:**
  - `src/components/TodaysPepTalk.tsx`
  - `src/components/TodaysPush.tsx`
  - `src/components/HeroQuoteBanner.tsx`
  - `functions/src/index.ts` (multiple locations)
- **Fields Referenced:**
  - `id`, `mentor_slug`, `for_date`, `title`, `script`, `audio_url`
  - `summary`, `topic_category`, `intensity`, `emotional_triggers`, `transcript`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `daily_pep_talks`)

#### 13. **pep_talks**
- **Operations:** READ, WRITE, DELETE
- **Files:**
  - `src/components/library/LibraryContent.tsx`
  - `src/components/MentorSelection.tsx`
  - `src/pages/Admin.tsx`
- **Fields Referenced:**
  - `id`, `title`, `category`, `description`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ❌ No (table does not exist - only `daily_pep_talks` exists)

#### 14. **challenges**
- **Operations:** READ, WRITE
- **Files:**
  - `src/components/library/LibraryContent.tsx`
  - `src/pages/Challenges.tsx`
  - `src/components/GlobalSearch.tsx`
- **Fields Referenced:**
  - `id`, `title`, `description`, `category`, `duration_days`, `total_days`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `challenges`)

#### 15. **user_challenges**
- **Operations:** READ, WRITE
- **Files:**
  - `src/pages/Challenges.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `challenge_id`, `start_date`, `end_date`, `status`, `current_day`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `user_challenges`)

#### 16. **favorites**
- **Operations:** READ, WRITE, DELETE
- **Files:**
  - `src/components/library/FeaturedQuoteCard.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `content_id`, `content_type`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `favorites`)

#### 17. **activity_feed**
- **Operations:** READ, WRITE, UPDATE, DELETE
- **Files:**
  - `src/hooks/useActivityFeed.ts`
  - `src/components/ActivityTimeline.tsx`
  - `src/components/WeeklyInsights.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `activity_type`, `activity_data`, `is_read`
  - `mentor_comment`, `mentor_voice_url`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `activity_feed`)

#### 18. **user_reflections**
- **Operations:** READ, WRITE
- **Files:**
  - `src/pages/Reflection.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `reflection_text`, `created_at`, `mood`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ❌ No (table does not exist)

#### 19. **epics**
- **Operations:** READ, WRITE
- **Files:**
  - `src/pages/SharedEpics.tsx`
  - `src/pages/JoinEpic.tsx`
  - `src/components/companion/GuildStoriesSection.tsx`
  - `src/components/JoinEpicDialog.tsx`
  - `src/components/GlobalSearch.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `title`, `description`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `epics`)

#### 20. **epic_members**
- **Operations:** READ, WRITE
- **Files:**
  - `src/pages/SharedEpics.tsx`
  - `src/pages/JoinEpic.tsx`
  - `src/components/companion/GuildStoriesSection.tsx`
  - `src/components/JoinEpicDialog.tsx`
  - `src/components/GuildMembersSection.tsx`
  - `src/utils/guildBonus.ts`
- **Fields Referenced:**
  - `id`, `epic_id`, `user_id`, `joined_at`, `total_contribution`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `epic_members`)

#### 21. **epic_habits**
- **Operations:** READ
- **Files:**
  - `src/components/JoinEpicDialog.tsx`
  - `src/utils/guildBonus.ts`
- **Fields Referenced:**
  - `id`, `epic_id`, `habit_id`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `epic_habits`)

#### 22. **habits**
- **Operations:** READ
- **Files:**
  - `src/pages/SharedEpics.tsx`
  - `src/pages/JoinEpic.tsx`
  - `src/components/HabitCard.tsx`
  - `src/components/HabitCalendar.tsx`
  - `src/components/JoinEpicDialog.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `title`, `frequency`, `current_streak`, `longest_streak`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `habits`)

#### 23. **habit_completions**
- **Operations:** READ
- **Files:**
  - `src/components/HabitCalendar.tsx`
  - `src/components/EpicCheckInDrawer.tsx`
  - `src/components/WeeklyInsights.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `habit_id`, `date`, `completed_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `habit_completions`)

#### 24. **guild_stories**
- **Operations:** READ, WRITE
- **Files:**
  - `src/components/companion/GuildStoriesSection.tsx`
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `epic_id`, `chapter_title`, `main_story`, `intro_line`
  - `bond_lesson`, `climax_moment`, `trigger_type`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `guild_stories`)

#### 25. **guild_story_reads**
- **Operations:** READ, WRITE (UPSERT)
- **Files:**
  - `src/components/companion/GuildStoriesSection.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `story_id`, `read_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `guild_story_reads`)

#### 26. **guild_shouts**
- **Operations:** READ (via realtime listener)
- **Files:**
  - `src/hooks/useGuildShouts.ts`
- **Fields Referenced:**
  - `id`, `epic_id`, `sender_id`, `recipient_id`, `shout_type`, `message_key`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `guild_shouts`)

#### 27. **epic_activity_feed**
- **Operations:** READ (via realtime listener)
- **Files:**
  - `src/hooks/useGuildActivity.ts`
  - `src/components/EpicActivityFeed.tsx`
- **Fields Referenced:**
  - `id`, `epic_id`, `user_id`, `activity_type`, `activity_data`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `epic_activity_feed`)

#### 28. **lessons**
- **Operations:** READ (via realtime listener), WRITE
- **Files:**
  - `src/hooks/useLessonNotifications.ts`
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `title`, `description`, `content`, `audio_url`, `mentor_id`, `category`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `lessons`)

#### 29. **daily_check_ins**
- **Operations:** READ, WRITE
- **Files:**
  - `src/components/MorningCheckIn.tsx`
  - `src/hooks/useCompanionMood.ts`
  - `src/components/WeeklyInsights.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `check_in_date`, `check_in_type`, `mood`, `intention`, `reflection`
  - `completed_at`, `mentor_response`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `daily_check_ins`)

#### 30. **xp_events**
- **Operations:** READ, DELETE
- **Files:**
  - `src/components/TodaysPepTalk.tsx`
  - `src/components/XPBreakdown.tsx`
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `user_id`, `companion_id`, `event_type`, `xp_earned`, `event_metadata`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `xp_events`)

#### 31. **adaptive_push_settings**
- **Operations:** READ, WRITE, UPDATE
- **Files:**
  - `src/pages/Profile.tsx`
- **Fields Referenced:**
  - `id`, `user_id`, `enabled`, `categories`, `emotional_triggers`, `frequency`
  - `intensity`, `time_window`, `primary_category`, `mentor_id`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `adaptive_push_settings`)

#### 32. **mentor_chats**
- **Operations:** READ, WRITE
- **Files:**
  - `src/components/AskMentorChat.tsx`
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `user_id`, `mentor_id`, `role`, `content`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `mentor_chats`)

#### 33. **referral_codes**
- **Operations:** READ, WRITE, UPDATE
- **Files:**
  - `src/components/AdminReferralTesting.tsx`
  - `src/components/AdminReferralCodes.tsx`
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `code`, `owner_type`, `owner_user_id`, `influencer_email`, `influencer_name`
  - `payout_identifier`, `payout_method`, `is_active`, `total_signups`, `total_conversions`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `referral_codes`)

#### 34. **referral_payouts**
- **Operations:** READ, WRITE, UPDATE
- **Files:**
  - `src/components/AdminReferralTesting.tsx`
  - `src/components/AdminPayouts.tsx`
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `referrer_id`, `referee_id`, `referral_code_id`, `amount`, `status`
  - `payout_type`, `paypal_transaction_id`, `apple_transaction_id`, `approved_at`, `paid_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `referral_payouts`)

#### 35. **referral_completions**
- **Operations:** READ, WRITE
- **Files:**
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `referrer_id`, `referee_id`, `completed_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ❌ No (table does not exist - but referenced in functions)

#### 36. **companion_skins**
- **Operations:** READ
- **Files:**
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `unlock_type`, `unlock_requirement`, `name`, `image_url`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `companion_skins`)

#### 37. **user_companion_skins**
- **Operations:** READ, WRITE
- **Files:**
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `user_id`, `skin_id`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `user_companion_skins`)

#### 38. **user_roles**
- **Operations:** READ
- **Files:**
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `user_id`, `role`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ❌ No (table does not exist)

#### 39. **user_daily_pushes**
- **Operations:** READ, WRITE, UPDATE
- **Files:**
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `user_id`, `daily_pep_talk_id`, `scheduled_at`, `delivered_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `user_daily_pushes`)

#### 40. **push_subscriptions**
- **Operations:** READ, UPDATE, DELETE
- **Files:**
  - `src/utils/pushNotifications.ts`
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `user_id`, `endpoint`, `keys`, `platform`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `push_subscriptions`)

#### 41. **push_device_tokens**
- **Operations:** READ, WRITE, DELETE
- **Files:**
  - `src/utils/nativePushNotifications.ts`
- **Fields Referenced:**
  - `id`, `user_id`, `device_token`, `platform`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `push_device_tokens`)

#### 42. **subscriptions**
- **Operations:** READ, WRITE, UPDATE
- **Files:**
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `user_id`, `plan`, `status`, `stripe_customer_id`, `stripe_subscription_id`
  - `current_period_start`, `current_period_end`, `trial_ends_at`, `cancelled_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `subscriptions`)

#### 43. **payment_history**
- **Operations:** READ, WRITE
- **Files:**
  - `functions/src/index.ts`
- **Fields Referenced:**
  - `id`, `user_id`, `subscription_id`, `amount`, `currency`, `status`
  - `stripe_payment_intent_id`, `stripe_invoice_id`, `failure_reason`, `created_at`
- **Exists in Firestore Rules:** ❌ No (not in rules)
- **Exists in Supabase:** ✅ Yes (table: `payment_history`)

---

## Supabase Operations

### Tables Found in Code

All Supabase operations use `.from()` method. The following tables are accessed:

1. **achievements** - ✅ Exists
2. **activity_feed** - ✅ Exists
3. **adaptive_push_queue** - ✅ Exists
4. **adaptive_push_settings** - ✅ Exists
5. **daily_check_ins** - ✅ Exists
6. **daily_missions** - ✅ Exists
7. **daily_pep_talks** - ✅ Exists
8. **daily_quotes** - ✅ Exists
9. **daily_tasks** - ✅ Exists
10. **epic_activity_feed** - ✅ Exists
11. **epic_habits** - ✅ Exists
12. **epic_members** - ✅ Exists
13. **epics** - ✅ Exists
14. **guild_shouts** - ✅ Exists
15. **guild_stories** - ✅ Exists
16. **guild_story_reads** - ✅ Exists
17. **habit_completions** - ✅ Exists
18. **habits** - ✅ Exists
19. **mentor_chats** - ✅ Exists
20. **mentor_nudges** - ✅ Exists
21. **mentors** - ✅ Exists
22. **profiles** - ✅ Exists
23. **push_device_tokens** - ✅ Exists
24. **push_subscriptions** - ✅ Exists
25. **quotes** - ✅ Exists
26. **referral_codes** - ✅ Exists
27. **referral_payouts** - ✅ Exists
28. **user_companion** - ✅ Exists
29. **xp_events** - ✅ Exists
30. **companion_evolutions** - ✅ Exists
31. **companion_evolution_cards** - ✅ Exists

---

## Schema Comparison

### Critical Issues Found

#### 1. **Firestore Collections NOT in Rules**

The following collections are used in code but **NOT** defined in `firestore.rules`:

- ❌ `companion_postcards`
- ❌ `daily_tasks`
- ❌ `quotes`
- ❌ `daily_quotes`
- ❌ `daily_pep_talks`
- ❌ `pep_talks` (also doesn't exist in Supabase)
- ❌ `challenges`
- ❌ `user_challenges`
- ❌ `favorites`
- ❌ `activity_feed`
- ❌ `user_reflections` (also doesn't exist in Supabase)
- ❌ `epics`
- ❌ `epic_members`
- ❌ `epic_habits`
- ❌ `habits`
- ❌ `habit_completions`
- ❌ `guild_stories`
- ❌ `guild_story_reads`
- ❌ `guild_shouts`
- ❌ `epic_activity_feed`
- ❌ `lessons`
- ❌ `daily_check_ins`
- ❌ `xp_events`
- ❌ `adaptive_push_settings`
- ❌ `mentor_chats`
- ❌ `referral_codes`
- ❌ `referral_payouts`
- ❌ `referral_completions` (also doesn't exist in Supabase)
- ❌ `companion_skins`
- ❌ `user_companion_skins`
- ❌ `user_roles` (also doesn't exist in Supabase)
- ❌ `user_daily_pushes`
- ❌ `push_subscriptions`
- ❌ `push_device_tokens`
- ❌ `subscriptions`
- ❌ `payment_history`

**Impact:** All operations on these collections will **FAIL** due to Firestore security rules default deny (line 73-75).

#### 2. **Collections/Tables That Don't Exist**

- ❌ `pep_talks` - Referenced in code but only `daily_pep_talks` exists in Supabase
- ❌ `user_reflections` - Referenced in Firestore code but doesn't exist in either database
- ❌ `referral_completions` - Referenced in functions but doesn't exist in Supabase
- ❌ `user_roles` - Referenced in functions but doesn't exist in Supabase

#### 3. **Field Mismatches**

Detailed field analysis would require comparing each operation's field usage against the actual schema. Key observations:

- Most Supabase operations use correct field names
- Firestore operations may reference fields that don't exist in the schema
- Some operations use generic field access (`...doc.data()`) which makes field validation impossible

---

## Missing Collections/Tables

### Firestore Collections Missing from Rules

**Total: 35 collections** are used in code but not protected by Firestore rules.

### Supabase Tables Missing

**Total: 4 tables** referenced in code but don't exist:
1. `pep_talks` (should use `daily_pep_talks` instead)
2. `user_reflections`
3. `referral_completions`
4. `user_roles`

---

## Missing Fields

### Analysis Needed

To identify missing fields, we need to:
1. Extract all field references from each operation
2. Compare against Supabase type definitions
3. Check Firestore document structures

**Note:** Firestore is schemaless, so field validation must be done at the application level.

---

## Potential Query Failures

### High Risk Operations

1. **All Firestore operations on collections not in rules** - Will fail with permission denied
2. **Operations on non-existent tables:**
   - `pep_talks` queries will fail
   - `user_reflections` writes will fail
   - `referral_completions` operations will fail
   - `user_roles` queries will fail

### Medium Risk Operations

1. **Field access on nullable fields** - May cause runtime errors if not handled
2. **Queries with filters on non-indexed fields** - May be slow or fail
3. **Array operations on non-array fields** - Will cause type errors

---

## Schema Diff

### Firestore Rules - Required Additions

```javascript
// Add to firestore.rules

// Companion postcards
match /companion_postcards/{postcardId} {
  allow read: if isAuthenticated() && 
    (resource.data.user_id == request.auth.uid || 
     request.resource.data.user_id == request.auth.uid);
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update, delete: if false;
}

// Daily tasks
match /daily_tasks/{taskId} {
  allow read: if isAuthenticated() && 
    (resource.data.user_id == request.auth.uid || 
     request.resource.data.user_id == request.auth.uid);
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow delete: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
}

// Quotes (read-only for users)
match /quotes/{quoteId} {
  allow read: if isAuthenticated();
  allow write: if false; // Only via Admin SDK
}

// Daily quotes (read-only)
match /daily_quotes/{quoteId} {
  allow read: if isAuthenticated();
  allow write: if false; // Only via Cloud Functions
}

// Daily pep talks (read-only)
match /daily_pep_talks/{talkId} {
  allow read: if isAuthenticated();
  allow write: if false; // Only via Cloud Functions
}

// Activity feed
match /activity_feed/{activityId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow delete: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
}

// Epics
match /epics/{epicId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && 
    (resource.data.user_id == request.auth.uid || 
     request.resource.data.user_id == request.auth.uid);
  allow delete: if false;
}

// Epic members
match /epic_members/{memberId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow delete: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
}

// Epic habits
match /epic_habits/{habitId} {
  allow read: if isAuthenticated();
  allow write: if false; // Only via Admin SDK
}

// Habits
match /habits/{habitId} {
  allow read: if isAuthenticated() && 
    (resource.data.user_id == request.auth.uid || 
     request.resource.data.user_id == request.auth.uid);
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow delete: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
}

// Habit completions
match /habit_completions/{completionId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update, delete: if false;
}

// Guild stories
match /guild_stories/{storyId} {
  allow read: if isAuthenticated();
  allow write: if false; // Only via Cloud Functions
}

// Guild story reads
match /guild_story_reads/{readId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update, delete: if false;
}

// Guild shouts
match /guild_shouts/{shoutId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && 
    (request.resource.data.sender_id == request.auth.uid ||
     request.resource.data.recipient_id == request.auth.uid);
  allow update: if isAuthenticated() && 
    resource.data.recipient_id == request.auth.uid;
  allow delete: if false;
}

// Epic activity feed
match /epic_activity_feed/{activityId} {
  allow read: if isAuthenticated();
  allow write: if false; // Only via Cloud Functions
}

// Lessons
match /lessons/{lessonId} {
  allow read: if isAuthenticated();
  allow write: if false; // Only via Admin SDK
}

// Daily check-ins
match /daily_check_ins/{checkInId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow delete: if false;
}

// XP events
match /xp_events/{eventId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow write: if false; // Only via Cloud Functions
}

// Adaptive push settings
match /adaptive_push_settings/{settingsId} {
  allow read: if isAuthenticated() && 
    (resource.data.user_id == request.auth.uid || 
     request.resource.data.user_id == request.auth.uid);
  allow create, update: if isAuthenticated() && 
    (request.resource.data.user_id == request.auth.uid || 
     resource.data.user_id == request.auth.uid);
  allow delete: if false;
}

// Mentor chats
match /mentor_chats/{chatId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update, delete: if false;
}

// Referral codes
match /referral_codes/{codeId} {
  allow read: if isAuthenticated();
  allow write: if false; // Only via Admin SDK
}

// Referral payouts
match /referral_payouts/{payoutId} {
  allow read: if isAuthenticated() && 
    (resource.data.referrer_id == request.auth.uid ||
     resource.data.referee_id == request.auth.uid);
  allow write: if false; // Only via Cloud Functions
}

// Companion skins
match /companion_skins/{skinId} {
  allow read: if isAuthenticated();
  allow write: if false; // Only via Admin SDK
}

// User companion skins
match /user_companion_skins/{userSkinId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update, delete: if false;
}

// User daily pushes
match /user_daily_pushes/{pushId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow write: if false; // Only via Cloud Functions
}

// Push subscriptions
match /push_subscriptions/{subId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow delete: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
}

// Push device tokens
match /push_device_tokens/{tokenId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && 
    request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow delete: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
}

// Subscriptions
match /subscriptions/{subscriptionId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow write: if false; // Only via Cloud Functions
}

// Payment history
match /payment_history/{paymentId} {
  allow read: if isAuthenticated() && 
    resource.data.user_id == request.auth.uid;
  allow write: if false; // Only via Cloud Functions
}
```

### Supabase - Required Table Creations

```sql
-- Create missing tables

-- 1. user_reflections (if needed)
CREATE TABLE IF NOT EXISTS public.user_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reflection_text TEXT NOT NULL,
  mood TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. referral_completions (if needed)
CREATE TABLE IF NOT EXISTS public.referral_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  referee_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(referrer_id, referee_id)
);

-- 3. user_roles (if needed)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, role)
);

-- Enable RLS on all new tables
ALTER TABLE public.user_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Add RLS policies (example for user_reflections)
CREATE POLICY "Users can view own reflections"
  ON public.user_reflections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reflections"
  ON public.user_reflections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reflections"
  ON public.user_reflections FOR UPDATE
  USING (auth.uid() = user_id);
```

---

## Recommendations

### Immediate Actions Required

1. **Update Firestore Rules** - Add rules for all 35 missing collections
2. **Create Missing Supabase Tables** - Create the 4 missing tables or update code to use existing ones
3. **Fix Code References** - Replace `pep_talks` with `daily_pep_talks` in code
4. **Add Field Validation** - Implement runtime validation for field access
5. **Add Error Handling** - Handle permission denied errors gracefully

### Long-term Improvements

1. **Schema Documentation** - Maintain up-to-date schema documentation
2. **Automated Testing** - Add tests that verify all database operations work
3. **Type Safety** - Use TypeScript types generated from schemas
4. **Migration Scripts** - Create scripts to sync schemas between environments
5. **Monitoring** - Add logging for failed database operations

---

## Conclusion

This analysis reveals significant gaps between the codebase and database schemas:

- **35 Firestore collections** are unprotected by security rules
- **4 Supabase tables** are missing
- **Multiple code references** to non-existent resources

**Priority:** HIGH - Many operations will fail in production without these fixes.

---

**Report End**

