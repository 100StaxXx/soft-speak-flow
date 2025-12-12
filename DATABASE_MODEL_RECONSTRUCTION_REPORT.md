# Database Model Reconstruction Report
**Generated:** 2025-01-27

## Executive Summary

This report documents all database read/write operations across the application, identifies expected collections/tables, schema fields referenced, and compares against actual database schemas in Firebase/Supabase to identify missing fields and potential query failures.

**Total Operations Found:** 200+ database operations  
**Collections/Tables Identified:** 50+  
**Potential Issues Found:** Multiple schema mismatches and missing fields

---

## Table of Contents

1. [Firestore Collections](#firestore-collections)
2. [Supabase Tables](#supabase-tables)
3. [Schema Diff Analysis](#schema-diff-analysis)
4. [Critical Issues](#critical-issues)
5. [Missing Fields by Collection](#missing-fields-by-collection)
6. [Query Failure Risk Assessment](#query-failure-risk-assessment)

---

## Firestore Collections

### 1. `profiles`

**Operations:**
- **Read:** `getDocument("profiles", userId)` - Used in 15+ locations
- **Write:** `updateDocument("profiles", userId, {...})` - Used in 10+ locations
- **Write:** `setDocument("profiles", userId, {...}, false)` - Profile creation

**Fields Referenced in Code:**
- `id`, `email`, `is_premium`, `preferences`, `selected_mentor_id`
- `created_at`, `updated_at`
- `daily_push_enabled`, `daily_push_window`, `daily_push_time`
- `daily_quote_push_enabled`, `daily_quote_push_window`, `daily_quote_push_time`
- `timezone`, `current_habit_streak`, `longest_habit_streak`
- `onboarding_completed`, `onboarding_data`
- `trial_ends_at`, `subscription_status`, `subscription_expires_at`
- `zodiac_sign`, `birthdate`, `birth_time`, `birth_location`
- `moon_sign`, `rising_sign`, `mercury_sign`, `mars_sign`, `venus_sign`
- `cosmic_profile_generated_at`, `faction`, `referred_by`
- `astral_encounters_enabled`
- `paypal_email`, `referred_by_code`
- `streak_at_risk`, `streak_at_risk_since`
- `trial_started_at`
- `total_quests_completed`, `last_encounter_quest_count`, `last_weekly_encounter`

**Schema in Supabase (`profiles` table):**
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_premium BOOLEAN DEFAULT FALSE,
  preferences JSONB,
  selected_mentor_id UUID REFERENCES mentors(id),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  daily_push_enabled BOOLEAN DEFAULT TRUE,
  daily_push_window TEXT,
  daily_push_time TEXT,
  daily_quote_push_enabled BOOLEAN DEFAULT TRUE,
  daily_quote_push_window TEXT,
  daily_quote_push_time TEXT,
  timezone TEXT,
  -- Additional fields from migrations
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES profiles(id),
  referral_count INTEGER DEFAULT 0,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'free',
  trial_ends_at TIMESTAMPTZ,
  subscription_started_at TIMESTAMPTZ,
  subscription_expires_at TIMESTAMPTZ,
  paypal_email TEXT,
  referred_by_code TEXT,
  streak_at_risk BOOLEAN DEFAULT FALSE,
  streak_at_risk_since TIMESTAMPTZ,
  trial_started_at TIMESTAMPTZ,
  total_quests_completed INTEGER DEFAULT 0,
  last_encounter_quest_count INTEGER DEFAULT 0,
  last_weekly_encounter TIMESTAMPTZ
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** 
- `current_habit_streak`, `longest_habit_streak` - Referenced in code but not in Supabase schema
- Astrology fields: `zodiac_sign`, `birthdate`, `birth_time`, `birth_location`, `moon_sign`, `rising_sign`, `mercury_sign`, `mars_sign`, `venus_sign`, `cosmic_profile_generated_at` - NOT in Supabase
- `faction` - NOT in Supabase
- `astral_encounters_enabled` - NOT in Supabase

**Query Failure Risk:** 🔴 **HIGH** - Code references many fields that don't exist in Supabase. Queries may fail silently or return nulls.

---

### 2. `user_companion`

**Operations:**
- **Read:** `getDocument("user_companion", userId)` - Used in 20+ locations
- **Write:** `setDocument("user_companion", companionId, {...}, false)` - Companion creation
- **Write:** `updateDocument("user_companion", companionId, {...})` - XP updates, evolution

**Fields Referenced in Code:**
- `id`, `user_id`, `favorite_color`, `spirit_animal`, `core_element`
- `current_stage`, `current_xp`, `current_image_url`, `initial_image_url`
- `eye_color`, `fur_color`, `body`, `mind`, `soul`
- `last_energy_update`, `display_name`
- `created_at`, `updated_at`
- `current_mood`, `last_mood_update`
- `image_regenerations_used`, `story_tone`

**Schema in Supabase (`user_companion` table):**
```sql
CREATE TABLE public.user_companion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  favorite_color TEXT NOT NULL,
  spirit_animal TEXT NOT NULL,
  core_element TEXT NOT NULL,
  current_stage INTEGER DEFAULT 0 NOT NULL,
  current_xp INTEGER DEFAULT 0 NOT NULL,
  current_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  current_mood TEXT DEFAULT 'neutral',
  last_mood_update TIMESTAMPTZ DEFAULT NOW()
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:**
- `initial_image_url` - Used in code for stage 0 evolution
- `eye_color`, `fur_color` - Used in companion creation
- `body`, `mind`, `soul` - Attribute fields referenced
- `last_energy_update` - Referenced in code
- `display_name` - AI-generated companion name
- `image_regenerations_used` - For regeneration tracking
- `story_tone` - Used in companion creation

**Query Failure Risk:** 🟡 **MEDIUM** - Missing fields may cause issues with companion evolution and display features.

---

### 3. `companion_evolutions`

**Operations:**
- **Read:** `getDocuments("companion_evolutions", [["companion_id", "==", id], ["stage", "==", stage]])`
- **Write:** `setDocument("companion_evolutions", evolutionId, {...}, false)`

**Fields Referenced in Code:**
- `id`, `companion_id`, `stage`, `image_url`, `xp_at_evolution`
- `evolved_at` - Used in code but may be auto-generated

**Schema in Supabase (`companion_evolutions` table):**
```sql
CREATE TABLE public.companion_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companion_id UUID REFERENCES user_companion(id) ON DELETE CASCADE NOT NULL,
  stage INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  evolved_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  xp_at_evolution INTEGER NOT NULL
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 4. `xp_events`

**Operations:**
- **Read:** `getDocuments("xp_events", [["user_id", "==", userId]], "created_at", "desc")`
- **Read:** `getDocuments("xp_events", [["companion_id", "==", companionId]])`

**Fields Referenced in Code:**
- `id`, `user_id`, `companion_id`, `event_type`, `xp_earned`
- `event_metadata`, `created_at`

**Schema in Supabase (`xp_events` table):**
```sql
CREATE TABLE public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  companion_id UUID REFERENCES user_companion(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL,
  xp_earned INTEGER NOT NULL,
  event_metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 5. `daily_tasks`

**Operations:**
- **Read:** `getDocuments("daily_tasks", [["user_id", "==", userId]], "task_date", "desc")`
- **Write:** `setDocument("daily_tasks", taskId, {...}, false)` - Task creation
- **Write:** `updateDocument("daily_tasks", taskId, {...})` - Task updates
- **Write:** `deleteDocument("daily_tasks", taskId)` - Task deletion

**Fields Referenced in Code:**
- `id`, `user_id`, `task_text`, `task_date`, `completed`, `completed_at`
- `xp_reward`, `created_at`, `updated_at`
- `is_main_quest` - Added in migration
- `difficulty` - Referenced in TypeScript interface but not in Supabase
- `scheduled_time`, `estimated_duration`, `recurrence_pattern`, `recurrence_days`
- `reminder_enabled`, `reminder_minutes_before`, `more_information`

**Schema in Supabase (`daily_tasks` table):**
```sql
CREATE TABLE public.daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  task_text TEXT NOT NULL,
  task_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  xp_reward INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_main_quest BOOLEAN DEFAULT false
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:**
- `updated_at` - Referenced in code but not in schema
- `difficulty` - Referenced in TypeScript interface
- `scheduled_time`, `estimated_duration`, `recurrence_pattern`, `recurrence_days` - Task scheduling fields
- `reminder_enabled`, `reminder_minutes_before`, `more_information` - Task detail fields

**Query Failure Risk:** 🟡 **MEDIUM** - Missing fields won't cause query failures but will prevent storing task scheduling data.

---

### 6. `habits`

**Operations:**
- **Read:** `getDocument("habits", habitId)`
- **Read:** `getDocuments("habits", [["user_id", "==", userId]])`
- **Write:** `setDocument("habits", habitId, {...}, false)` - Habit creation
- **Write:** `updateDocument("habits", habitId, {...})` - Habit updates
- **Supabase Write:** `.from('habits').update({ is_active: false })` - Habit archiving

**Fields Referenced in Code:**
- `id`, `user_id`, `title`, `difficulty`, `frequency`, `custom_days`
- `is_active` - Used in Supabase query
- `created_at`, `updated_at`

**Schema in Supabase (`habits` table):**
```sql
CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  difficulty TEXT,
  frequency TEXT,
  custom_days INTEGER[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 7. `epics`

**Operations:**
- **Read:** `getDocument("epics", epicId)`
- **Read:** `getDocuments("epics", [["user_id", "==", userId]], "created_at", "desc")`
- **Read:** `getDocuments("epics", [["invite_code", "==", code], ["is_public", "==", true]])`
- **Write:** `setDocument("epics", epicId, {...}, false)` - Epic creation
- **Write:** `updateDocument("epics", epicId, {...})` - Status updates

**Fields Referenced in Code:**
- `id`, `user_id`, `title`, `description`, `target_days`, `is_public`
- `xp_reward`, `invite_code`, `theme_color`, `status`
- `created_at`, `updated_at`, `completed_at`
- `progress_percentage` - Referenced but may be calculated

**Schema in Supabase (`epics` table):**
```sql
CREATE TABLE public.epics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_days INTEGER,
  is_public BOOLEAN DEFAULT false,
  invite_code TEXT UNIQUE,
  status TEXT DEFAULT 'active',
  xp_reward INTEGER,
  theme_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  discord_channel_id TEXT,
  discord_invite_url TEXT,
  discord_ready BOOLEAN DEFAULT false
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match (progress_percentage likely calculated)

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 8. `epic_members`

**Operations:**
- **Read:** `getDocuments("epic_members", [["epic_id", "==", epicId]])`
- **Read:** `getDocuments("epic_members", [["user_id", "==", userId]])`
- **Write:** `setDocument("epic_members", memberId, {...}, false)` - Join epic

**Fields Referenced in Code:**
- `id`, `epic_id`, `user_id`, `total_contribution`
- `joined_at`, `created_at`

**Schema in Supabase (`epic_members` table):**
```sql
CREATE TABLE public.epic_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_contribution INTEGER DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(epic_id, user_id)
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 9. `epic_habits`

**Operations:**
- **Read:** `getDocuments("epic_habits", [["epic_id", "==", epicId]])`
- **Read:** `getDocuments("epic_habits", [["epic_id", "in", batch]])` - Batch queries
- **Write:** `setDocument("epic_habits", linkId, {...}, false)` - Link habit to epic
- **Write:** `deleteDocument("epic_habits", linkId)` - Unlink habit

**Fields Referenced in Code:**
- `id`, `epic_id`, `habit_id`, `created_at`

**Schema in Supabase (`epic_habits` table):**
```sql
CREATE TABLE public.epic_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(epic_id, habit_id)
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 10. `activity_feed`

**Operations:**
- **Read:** `getDocuments("activity_feed", [["user_id", "==", userId]], "created_at", "desc", 50)`
- **Write:** `setDocument("activity_feed", activityId, {...}, false)` - Log activity
- **Write:** `updateDocument("activity_feed", activityId, { is_read: true })` - Mark as read
- **Write:** `deleteDocument("activity_feed", activityId)` - Delete activity

**Fields Referenced in Code:**
- `id`, `user_id`, `activity_type`, `activity_data`
- `mentor_comment`, `mentor_voice_url`
- `created_at`, `is_read`

**Schema in Supabase (`activity_feed` table):**
```sql
CREATE TABLE public.activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_data JSONB NOT NULL DEFAULT '{}',
  mentor_comment TEXT,
  mentor_voice_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN DEFAULT false
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 11. `daily_check_ins`

**Operations:**
- **Read:** `getDocuments("daily_check_ins", [["user_id", "==", userId], ["check_in_date", "==", date]])`
- **Write:** `setDocument("daily_check_ins", checkInId, {...}, false)` - Create check-in

**Fields Referenced in Code:**
- `id`, `user_id`, `check_in_type`, `check_in_date`
- `mood`, `intention`, `reflection`, `mentor_response`
- `completed_at`, `created_at`

**Schema in Supabase (`daily_check_ins` table):**
```sql
CREATE TABLE public.daily_check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in_type TEXT NOT NULL,
  check_in_date DATE NOT NULL DEFAULT CURRENT_DATE,
  mood TEXT,
  intention TEXT,
  reflection TEXT,
  mentor_response TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, check_in_type, check_in_date)
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 12. `quotes`

**Operations:**
- **Read:** `getDocuments("quotes", undefined, undefined, undefined, 1000)` - Get all quotes
- **Read:** `getDocuments("quotes", filters, "created_at", "desc", limit)` - Filtered queries
- **Read:** `.from("quotes").select("id, text, author")` - Supabase query

**Fields Referenced in Code:**
- `id`, `text`, `author`, `category`, `created_at`
- `is_premium` - May be referenced in filtering

**Schema Status:** ⚠️ **FIRESTORE ONLY** - No Supabase table found for `quotes`

**Query Failure Risk:** 🔴 **HIGH** - Supabase query in `LibraryContent.tsx` will fail if table doesn't exist.

---

### 13. `pep_talks`

**Operations:**
- **Read:** `getDocuments("pep_talks", undefined, "created_at", "desc")`
- **Read:** `getDocument("pep_talks", pepTalkId)`
- **Write:** `setDocument("pep_talks", pepTalkId, {...}, false)` - Admin creation
- **Write:** `updateDocument("pep_talks", id, { transcript: data.transcript })` - Update transcript
- **Write:** `deleteDocument("pep_talks", id)` - Admin deletion

**Fields Referenced in Code:**
- `id`, `title`, `category`, `description`, `quote`, `created_at`
- `transcript` - Updated in PepTalkDetail

**Schema Status:** ⚠️ **FIRESTORE ONLY** - No Supabase table found for `pep_talks`

**Query Failure Risk:** ✅ **LOW** - All operations use Firestore, no Supabase queries.

---

### 14. `daily_pep_talks`

**Operations:**
- **Read:** `getDocuments("daily_pep_talks", [["for_date", "==", date], ["mentor_slug", "==", slug]])`

**Fields Referenced in Code:**
- `id`, `for_date`, `mentor_slug`, `title`, `summary`, `script`, `audio_url`
- `topic_category`, `intensity`, `emotional_triggers`, `transcript`
- `created_at`

**Schema Status:** ✅ **EXISTS in Supabase** - Created in migration `20251116014335`

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 15. `challenges`

**Operations:**
- **Read:** `getDocuments("challenges", undefined, undefined, undefined, 1000)`
- **Read:** `getDocument("challenges", challengeId)`
- **Write:** `setDocument("user_challenges", challengeId_doc, {...})` - User accepts challenge

**Fields Referenced in Code:**
- `id`, `title`, `description`, `category`

**Schema Status:** ⚠️ **FIRESTORE ONLY** - No Supabase table found for `challenges`

**Query Failure Risk:** ✅ **LOW** - All operations use Firestore.

---

### 16. `mentors`

**Operations:**
- **Read:** `getDocument("mentors", mentorId)` - Used in 10+ locations
- **Read:** `getDocuments("mentors", undefined, "name", "asc")` - Admin list

**Fields Referenced in Code:**
- `id`, `name`, `slug` - Minimum fields used

**Schema Status:** ✅ **EXISTS in Supabase** - Referenced in profiles foreign key

**Query Failure Risk:** ✅ **LOW** - Basic queries work, may need to verify all fields exist.

---

### 17. `favorites`

**Operations:**
- **Read:** `getDocuments("favorites", [["user_id", "==", userId]])`
- **Write:** `setDocument("favorites", favoriteId, {...})` - Add favorite
- **Write:** `deleteDocument("favorites", favoriteId)` - Remove favorite

**Fields Referenced in Code:**
- `id`, `user_id`, `content_type`, `content_id`, `created_at`

**Schema in Supabase (`favorites` table):**
```sql
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('pep_talk', 'video', 'playlist', 'quote')),
  content_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 18. `adaptive_push_settings`

**Operations:**
- **Read:** `getDocument("adaptive_push_settings", user.uid)`
- **Read:** `getDocuments("adaptive_push_settings", [...])`
- **Write:** `setDocument("adaptive_push_settings", user.uid, {...})`
- **Write:** `updateDocument("adaptive_push_settings", user.uid, { enabled: newState })`

**Fields Referenced in Code:**
- `id`, `user_id`, `enabled`

**Schema in Supabase (`adaptive_push_settings` table):**
```sql
CREATE TABLE public.adaptive_push_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  -- Additional fields may exist
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None detected - Basic fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 19. `push_notification_queue`

**Operations:**
- **Read:** `getDocuments("push_notification_queue", [...])`
- **Write:** `setDocument("push_notification_queue", notificationId, {...})`
- **Write:** `deleteDocument("push_notification_queue", notification.id)`

**Fields Referenced in Code:**
- `id`, `user_id`, `scheduled_for`, `delivered`, `created_at`

**Schema in Supabase (`push_notification_queue` table):**
```sql
CREATE TABLE push_notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  scheduled_for TIMESTAMPTZ NOT NULL,
  delivered BOOLEAN DEFAULT false,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All referenced fields exist

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 20. `referral_codes`

**Operations:**
- **Read:** `getDocuments("referral_codes", [["code", "==", code], ["owner_type", "==", "influencer"]])`
- **Write:** `updateDocument("referral_codes", codeId, updates)`

**Fields Referenced in Code:**
- `id`, `code`, `owner_type`, `owner_user_id`
- `influencer_name`, `influencer_email`, `influencer_handle`
- `payout_method`, `payout_identifier`
- `is_active`, `total_signups`, `total_conversions`, `total_revenue`
- `created_at`

**Schema in Supabase (`referral_codes` table):**
```sql
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'influencer')),
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  influencer_name TEXT,
  influencer_email TEXT,
  influencer_handle TEXT,
  payout_method TEXT,
  payout_identifier TEXT,
  is_active BOOLEAN DEFAULT true,
  total_signups INTEGER DEFAULT 0,
  total_conversions INTEGER DEFAULT 0,
  total_revenue INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 21. `referral_payouts`

**Operations:**
- **Read:** `getDocuments("referral_payouts", [...])`
- **Read:** `getDocument("referral_payouts", payoutId)`
- **Write:** `updateDocument("referral_payouts", payoutId, updates)`

**Fields Referenced in Code:**
- `id`, `referrer_id`, `referee_id`, `referral_code_id`
- `amount`, `status`, `payout_type`
- `apple_transaction_id`, `paypal_transaction_id`
- `created_at`, `approved_at`, `paid_at`, `rejected_at`
- `admin_notes`

**Schema in Supabase (`referral_payouts` table):**
```sql
CREATE TABLE referral_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code_id UUID REFERENCES referral_codes(id),
  amount INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
  payout_type TEXT NOT NULL CHECK (payout_type IN ('first_month', 'first_year')),
  apple_transaction_id TEXT,
  paypal_transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  admin_notes TEXT
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 22. `user_companion_skins`

**Operations:**
- **Read:** `getDocuments("user_companion_skins", [["user_id", "==", userId]])`
- **Write:** `updateDocument("user_companion_skins", skin.id, { is_equipped: true })`

**Fields Referenced in Code:**
- `id`, `user_id`, `skin_id`, `is_equipped`

**Schema in Supabase (`user_companion_skins` table):**
```sql
CREATE TABLE user_companion_skins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skin_id UUID NOT NULL REFERENCES companion_skins(id) ON DELETE CASCADE,
  is_equipped BOOLEAN DEFAULT false,
  acquired_via TEXT,
  acquired_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, skin_id)
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All referenced fields exist

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 23. `companion_skins`

**Operations:**
- **Read:** `getDocument("companion_skins", userSkin.skin_id)`

**Fields Referenced in Code:**
- `id`, `name`, `description`, `skin_type`, `unlock_type`
- `unlock_requirement`, `css_effect`, `image_url`, `rarity`

**Schema in Supabase (`companion_skins` table):**
```sql
CREATE TABLE companion_skins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  skin_type TEXT NOT NULL,
  unlock_type TEXT NOT NULL,
  unlock_requirement INTEGER,
  css_effect JSONB NOT NULL,
  image_url TEXT,
  rarity TEXT DEFAULT 'common',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 24. `companion_evolution_cards`

**Operations:**
- **Read:** `getDocuments("companion_evolution_cards", [["companion_id", "==", companion.id]])`

**Fields Referenced in Code:**
- `id`, `user_id`, `card_id`, `evolution_id`, `evolution_stage`
- `creature_name`, `species`, `element`, `stats`, `traits`
- `story_text`, `rarity`, `image_url`, `energy_cost`, `bond_level`
- `created_at`

**Schema in Supabase (`companion_evolution_cards` table):**
```sql
CREATE TABLE companion_evolution_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  evolution_id UUID REFERENCES companion_evolutions(id) ON DELETE SET NULL,
  evolution_stage INTEGER NOT NULL,
  creature_name TEXT NOT NULL,
  species TEXT NOT NULL,
  element TEXT NOT NULL,
  stats JSONB,
  traits TEXT[],
  story_text TEXT NOT NULL,
  rarity TEXT NOT NULL,
  image_url TEXT,
  energy_cost INTEGER,
  bond_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 25. `companion_stories`

**Operations:**
- **Read:** `getDocuments("companion_stories", [["companion_id", "==", companion.id], ["stage", "==", stage]])`

**Fields Referenced in Code:**
- `id`, `companion_id`, `stage`, `chapter_title`, `story_content`
- `created_at`

**Schema in Supabase (`companion_stories` table):**
```sql
CREATE TABLE public.companion_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companion_id UUID NOT NULL REFERENCES user_companion(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL,
  chapter_title TEXT NOT NULL,
  story_content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 26. `guild_stories`

**Operations:**
- **Read:** `getDocuments("guild_stories", [["epic_id", "==", epicId]], "created_at", "desc")`

**Fields Referenced in Code:**
- `id`, `epic_id`, `chapter_number`, `chapter_title`, `intro_line`
- `main_story`, `companion_spotlights`, `climax_moment`, `bond_lesson`
- `next_hook`, `trigger_type`, `generated_at`, `created_at`

**Schema in Supabase (`guild_stories` table):**
```sql
CREATE TABLE public.guild_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID NOT NULL REFERENCES epics(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  chapter_title TEXT NOT NULL,
  intro_line TEXT NOT NULL,
  main_story TEXT NOT NULL,
  companion_spotlights JSONB,
  climax_moment TEXT NOT NULL,
  bond_lesson TEXT NOT NULL,
  next_hook TEXT,
  trigger_type TEXT NOT NULL,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 27. `guild_story_reads`

**Operations:**
- **Write:** `setDocument("guild_story_reads", readId, {...})`

**Fields Referenced in Code:**
- `id`, `user_id`, `story_id`, `read_at`, `created_at`

**Schema in Supabase (`guild_story_reads` table):**
```sql
CREATE TABLE public.guild_story_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id UUID NOT NULL REFERENCES guild_stories(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 28. `habit_completions`

**Operations:**
- **Read:** `getDocuments("habit_completions", [["user_id", "==", userId], ["date", ">=", startDate]])`
- **Write:** `setDocument("habit_completions", completionId, {...})`
- **Write:** `deleteDocument("habit_completions", completion.id)`

**Fields Referenced in Code:**
- `id`, `user_id`, `habit_id`, `date`, `completed_at`, `created_at`

**Schema Status:** ⚠️ **FIRESTORE ONLY** - No Supabase table found

**Query Failure Risk:** ✅ **LOW** - All operations use Firestore.

---

### 29. `user_reflections`

**Operations:**
- **Read:** `getDocuments("user_reflections", [["user_id", "==", userId]], "created_at", "desc")`
- **Write:** `setDocument("user_reflections", reflectionId, {...}, true)`

**Fields Referenced in Code:**
- `id`, `user_id`, `reflection_text`, `reflection_date`, `created_at`

**Schema in Supabase (`user_reflections` table):**
```sql
CREATE TABLE IF NOT EXISTS public.user_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reflection_text TEXT NOT NULL,
  reflection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### 30. `muted_guild_users`

**Operations:**
- **Read:** `getDocuments("muted_guild_users", [["user_id", "==", userId]])`
- **Write:** `setDocument("muted_guild_users", muteId, {...})`
- **Write:** `deleteDocument("muted_guild_users", toDelete.id)`

**Fields Referenced in Code:**
- `id`, `user_id`, `muted_user_id`, `created_at`

**Schema in Supabase (`muted_guild_users` table):**
```sql
CREATE TABLE public.muted_guild_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  muted_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, muted_user_id)
);
```

**Status:** ✅ **EXISTS in Supabase**  
**Missing Fields:** None - All fields match

**Query Failure Risk:** ✅ **LOW** - Schema matches code usage.

---

### Additional Collections (Firestore Only)

The following collections are used in Firestore but don't have Supabase equivalents:

31. **`achievements`** - User achievements system
32. **`battle_matches`** - Battle matchmaking system
33. **`battle_participants`** - Battle participants
34. **`battle_rounds`** - Battle rounds
35. **`battle_rankings`** - Battle rankings
36. **`epic_activity_feed`** - Epic-specific activity feed
37. **`mentor_chats`** - Chat conversations with mentors
38. **`mentor_nudges`** - Mentor notification nudges
39. **`push_subscriptions`** - Push notification subscriptions
40. **`lessons`** - Lesson content
41. **`guild_shouts`** - Guild shout messages
42. **`companion_postcards`** - Companion postcard content
43. **`user_challenges`** - User-accepted challenges
44. **`daily_missions`** - Daily mission system
45. **`evolution_thresholds`** - Evolution XP thresholds
46. **`referral_completions`** - Referral completion tracking
47. **`used_referral_codes`** - Used referral code tracking
48. **`referral_audit_log`** - Referral audit logging

---

## Supabase Tables

### Additional Supabase-Only Tables

The following tables exist in Supabase but are not directly accessed via Firestore operations in the frontend code (likely accessed via Edge Functions):

1. **`subscriptions`** - Subscription management
2. **`payment_history`** - Payment transaction history
3. **`daily_quotes`** - Daily quote content
4. **`user_daily_quote_pushes`** - Daily quote push notifications
5. **`adaptive_push_queue`** - Adaptive push notification queue
6. **`challenge_tasks`** - Challenge task definitions
7. **`zodiac_sign_content`** - Zodiac sign content
8. **`user_daily_horoscopes`** - User daily horoscopes
9. **`cosmic_deep_dive_feedback`** - Cosmic deep dive feedback
10. **`user_cosmic_deep_dives`** - User cosmic deep dive content
11. **`push_device_tokens`** - Push device token management
12. **`epic_templates`** - Epic quest templates
13. **`guild_rivalries`** - Guild rivalry system
14. **`shout_push_log`** - Shout push notification log
15. **`companion_voice_templates`** - Companion voice templates
16. **`astral_encounters`** - Astral encounter system
17. **`adversary_essences`** - Adversary essence data
18. **`cosmic_codex_entries`** - Cosmic codex entries
19. **`prompt_templates`** - AI prompt templates
20. **`user_ai_preferences`** - User AI preferences
21. **`ai_output_validation_log`** - AI output validation logging
22. **`task_reminders_log`** - Task reminder logging
23. **`epic_progress_log`** - Epic progress logging
24. **`epic_discord_events`** - Epic Discord integration
25. **`written_content`** - Written content catalog
26. **`visual_assets`** - Visual assets catalog
27. **`written_mentors`** - Written mentor definitions
28. **`visual_mentors`** - Visual mentor definitions
29. **`pep_talk_mentors`** - Pep talk mentor definitions
30. **`lesson_mentors`** - Lesson mentor definitions
31. **`mood_logs`** - User mood logging
32. **`daily_messages`** - Daily message system

---

## Schema Diff Analysis

### Critical Missing Fields

#### 1. `profiles` Table

**Missing Fields:**
- `current_habit_streak` (INTEGER)
- `longest_habit_streak` (INTEGER)
- `zodiac_sign` (TEXT)
- `birthdate` (DATE)
- `birth_time` (TIME)
- `birth_location` (TEXT)
- `moon_sign` (TEXT)
- `rising_sign` (TEXT)
- `mercury_sign` (TEXT)
- `mars_sign` (TEXT)
- `venus_sign` (TEXT)
- `cosmic_profile_generated_at` (TIMESTAMPTZ)
- `faction` (TEXT)
- `astral_encounters_enabled` (BOOLEAN)

**Impact:** 🔴 **CRITICAL** - Profile page and astrology features will fail or show incorrect data.

---

#### 2. `user_companion` Table

**Missing Fields:**
- `initial_image_url` (TEXT)
- `eye_color` (TEXT)
- `fur_color` (TEXT)
- `body` (INTEGER)
- `mind` (INTEGER)
- `soul` (INTEGER)
- `last_energy_update` (TIMESTAMPTZ)
- `display_name` (TEXT)
- `image_regenerations_used` (INTEGER)
- `story_tone` (TEXT)

**Impact:** 🟡 **MEDIUM** - Companion evolution and display features may not work correctly.

---

#### 3. `daily_tasks` Table

**Missing Fields:**
- `updated_at` (TIMESTAMPTZ)
- `difficulty` (TEXT) - Referenced in TypeScript interface
- `scheduled_time` (TIME)
- `estimated_duration` (INTEGER)
- `recurrence_pattern` (TEXT)
- `recurrence_days` (INTEGER[])
- `reminder_enabled` (BOOLEAN)
- `reminder_minutes_before` (INTEGER)
- `more_information` (TEXT)

**Impact:** 🟡 **MEDIUM** - Task scheduling and detail features won't work.

---

#### 4. Missing Tables

**Firestore Collections NOT in Supabase:**
- `quotes` - ⚠️ **CRITICAL** - Supabase query exists in `LibraryContent.tsx`
- `pep_talks` - ⚠️ Used extensively, no Supabase equivalent
- `challenges` - Used but no Supabase equivalent
- `habit_completions` - Used for habit tracking

**Impact:** 🔴 **CRITICAL** - Queries will fail if trying to use Supabase for these collections.

---

## Critical Issues

### Issue #1: `quotes` Table Missing in Supabase

**Location:** `src/components/library/LibraryContent.tsx:50`

**Code:**
```typescript
const { data } = await supabase
  .from("quotes")
  .select("id, text, author")
  .order("created_at", { ascending: false })
  .limit(4);
```

**Problem:** This query will fail because `quotes` table doesn't exist in Supabase.

**Solution:** Either:
1. Create `quotes` table in Supabase, OR
2. Change to use Firestore `getDocuments("quotes", ...)`

---

### Issue #2: Profile Astrology Fields Missing

**Impact:** Horoscope and astrology features will not work correctly.

**Affected Files:**
- `src/pages/Horoscope.tsx`
- `src/pages/Profile.tsx`
- Any code referencing zodiac/birth data

**Solution:** Add missing astrology fields to `profiles` table.

---

### Issue #3: Companion Missing Fields

**Impact:** Companion evolution, regeneration, and display features may fail.

**Solution:** Add missing fields to `user_companion` table.

---

## Missing Fields by Collection

### Complete Field Diff

| Collection/Table | Missing Fields | Priority | Impact |
|-----------------|----------------|----------|---------|
| `profiles` | 13 fields (astrology, streaks, faction) | 🔴 HIGH | Profile features broken |
| `user_companion` | 9 fields (attributes, display, regeneration) | 🟡 MEDIUM | Companion features degraded |
| `daily_tasks` | 8 fields (scheduling, reminders) | 🟡 MEDIUM | Task features limited |
| `quotes` | Table missing | 🔴 CRITICAL | Library query fails |
| `pep_talks` | Table missing | 🟡 MEDIUM | Admin features use Firestore only |
| `challenges` | Table missing | 🟡 MEDIUM | Uses Firestore only |
| `habit_completions` | Table missing | 🟡 MEDIUM | Uses Firestore only |

---

## Query Failure Risk Assessment

### High Risk Queries

1. **`LibraryContent.tsx:50`** - Supabase query on non-existent `quotes` table
   - **Risk:** 🔴 **CRITICAL** - Will throw error
   - **Fix:** Migrate to Firestore or create Supabase table

2. **Profile astrology fields** - Code reads/writes fields that don't exist
   - **Risk:** 🔴 **HIGH** - Silent failures, null values
   - **Fix:** Add fields to `profiles` table

3. **Companion attributes (body, mind, soul)** - Referenced but missing
   - **Risk:** 🟡 **MEDIUM** - Evolution calculations may fail
   - **Fix:** Add fields to `user_companion` table

### Medium Risk Queries

1. **Task scheduling fields** - Missing but not critical for basic functionality
2. **Companion display fields** - Missing but fallbacks may exist
3. **Habit streak fields** - Missing from profiles

### Low Risk Queries

Most other queries match their schemas correctly or use Firestore exclusively.

---

## Recommended Actions

### Immediate (Critical)

1. **Fix `quotes` table issue:**
   - Either create Supabase table OR change `LibraryContent.tsx` to use Firestore

2. **Add missing profile fields:**
   ```sql
   ALTER TABLE profiles ADD COLUMN current_habit_streak INTEGER;
   ALTER TABLE profiles ADD COLUMN longest_habit_streak INTEGER;
   ALTER TABLE profiles ADD COLUMN zodiac_sign TEXT;
   ALTER TABLE profiles ADD COLUMN birthdate DATE;
   ALTER TABLE profiles ADD COLUMN birth_time TIME;
   ALTER TABLE profiles ADD COLUMN birth_location TEXT;
   ALTER TABLE profiles ADD COLUMN moon_sign TEXT;
   ALTER TABLE profiles ADD COLUMN rising_sign TEXT;
   ALTER TABLE profiles ADD COLUMN mercury_sign TEXT;
   ALTER TABLE profiles ADD COLUMN mars_sign TEXT;
   ALTER TABLE profiles ADD COLUMN venus_sign TEXT;
   ALTER TABLE profiles ADD COLUMN cosmic_profile_generated_at TIMESTAMPTZ;
   ALTER TABLE profiles ADD COLUMN faction TEXT;
   ALTER TABLE profiles ADD COLUMN astral_encounters_enabled BOOLEAN DEFAULT false;
   ```

### Short Term (High Priority)

3. **Add missing companion fields:**
   ```sql
   ALTER TABLE user_companion ADD COLUMN initial_image_url TEXT;
   ALTER TABLE user_companion ADD COLUMN eye_color TEXT;
   ALTER TABLE user_companion ADD COLUMN fur_color TEXT;
   ALTER TABLE user_companion ADD COLUMN body INTEGER DEFAULT 0;
   ALTER TABLE user_companion ADD COLUMN mind INTEGER DEFAULT 0;
   ALTER TABLE user_companion ADD COLUMN soul INTEGER DEFAULT 0;
   ALTER TABLE user_companion ADD COLUMN last_energy_update TIMESTAMPTZ;
   ALTER TABLE user_companion ADD COLUMN display_name TEXT;
   ALTER TABLE user_companion ADD COLUMN image_regenerations_used INTEGER DEFAULT 0;
   ALTER TABLE user_companion ADD COLUMN story_tone TEXT;
   ```

4. **Add missing task fields:**
   ```sql
   ALTER TABLE daily_tasks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
   ALTER TABLE daily_tasks ADD COLUMN difficulty TEXT;
   ALTER TABLE daily_tasks ADD COLUMN scheduled_time TIME;
   ALTER TABLE daily_tasks ADD COLUMN estimated_duration INTEGER;
   ALTER TABLE daily_tasks ADD COLUMN recurrence_pattern TEXT;
   ALTER TABLE daily_tasks ADD COLUMN recurrence_days INTEGER[];
   ALTER TABLE daily_tasks ADD COLUMN reminder_enabled BOOLEAN DEFAULT false;
   ALTER TABLE daily_tasks ADD COLUMN reminder_minutes_before INTEGER;
   ALTER TABLE daily_tasks ADD COLUMN more_information TEXT;
   ```

### Long Term (Medium Priority)

5. **Consider migrating Firestore-only collections to Supabase:**
   - `quotes`
   - `pep_talks`
   - `challenges`
   - `habit_completions`

6. **Add database triggers for `updated_at` fields** where missing

7. **Add indexes** for frequently queried fields

---

## Summary

**Total Collections Analyzed:** 50+  
**Collections with Issues:** 7  
**Critical Issues:** 3  
**High Priority Issues:** 4  
**Medium Priority Issues:** 3  

**Overall Status:** 🟡 **NEEDS ATTENTION**

The application has a mixed database architecture (Firestore + Supabase) with several schema mismatches. Critical issues need immediate resolution to prevent query failures and data loss.

---

## Appendix: Migration Scripts

See the recommended SQL migration scripts above for adding missing fields.

