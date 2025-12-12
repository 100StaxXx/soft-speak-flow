# Firestore vs Supabase Usage Analysis

## Summary
**Most of the app is using Firestore**, not Supabase! Only a few things use Supabase.

## What Uses Supabase (Database)
1. **`profiles` table** - User profiles (via `useProfile` hook and `authRedirect.ts`)
2. **`mentors` table** - Mentor data (some places)
3. **Edge Functions** - Various Supabase edge functions for backend operations

## What Uses Firestore (Most Everything Else)

### Core User Data
- `user_companion` - Companion data
- `profiles` - **ALSO in Firestore** (some places use Firestore, some use Supabase - INCONSISTENT!)
- `adaptive_push_settings` - Push notification settings

### Tasks & Quests
- `daily_tasks` - Daily tasks/quests
- `daily_missions` - Daily missions
- `challenges` - Challenges
- `user_challenges` - User challenge progress
- `challenge_progress` - Challenge progress tracking

### Companion System
- `user_companion` - Main companion data
- `companion_evolutions` - Evolution history
- `companion_stories` - Companion story chapters
- `companion_evolution_cards` - Evolution cards
- `companion_skins` - Companion skins
- `user_companion_skins` - User's unlocked skins
- `companion_postcards` - Postcards

### Social/Epic System
- `epics` - Epic quests
- `epic_members` - Epic memberships
- `epic_habits` - Epic habits
- `epic_progress` - Epic progress
- `guild_stories` - Guild stories
- `guild_shouts` - Guild shouts
- `guild_rivalries` - Guild rivalries
- `muted_guild_users` - Muted users

### Content
- `pep_talks` - Pep talks
- `quotes` - Quotes
- `habits` - Habits
- `evolution_thresholds` - Evolution thresholds
- `cosmic_deep_dives` - Cosmic deep dives
- `astral_encounters` - Astral encounters
- `adversary_essences` - Adversary essences
- `cosmic_codex_entries` - Codex entries

### User Activity
- `user_reflections` - User reflections
- `activity_feed` - Activity feed
- `push_notification_queue` - Push notification queue
- `achievements` - Achievements
- `user_achievements` - User achievement progress

### Other
- `mentors` - **ALSO in Firestore** (inconsistent!)
- `epic_templates` - Epic templates
- `referral_codes` - Referral codes (some places)

## Key Issues Found

### 1. **INCONSISTENT DATA SOURCES**
- `profiles` is accessed via **BOTH** Supabase (in `useProfile.ts`) and Firestore (in `Profile.tsx`, `Index.tsx`, etc.)
- `mentors` is accessed via **BOTH** Supabase (in `Admin.tsx`) and Firestore (in `MentorChat.tsx`, `Index.tsx`, etc.)

### 2. **The Error is Likely From:**
The "Missing or insufficient permissions" error is probably coming from:
- A Supabase query that's failing (likely `profiles` table)
- OR a Firestore security rules issue

### 3. **Architecture Confusion**
The app is using:
- **Firebase Auth** ✅ (correct)
- **Firestore** for most data ✅ (working)
- **Supabase** for profiles and some other data ⚠️ (causing issues)

## Recommendation

Since most of the app uses Firestore, and only `profiles` uses Supabase (and inconsistently), you have two options:

### Option A: Keep Supabase for Profiles Only
- Fix the RLS policies (what we're trying to do)
- Migrate all `profiles` access to use Supabase consistently
- Keep everything else in Firestore

### Option B: Migrate Profiles to Firestore
- Move `profiles` table to Firestore
- Update `useProfile.ts` to use Firestore instead of Supabase
- This would make everything consistent

## Files That Need Attention

### Using Supabase:
- `src/hooks/useProfile.ts` - Uses Supabase for profiles
- `src/utils/authRedirect.ts` - Uses Supabase for profiles
- `src/pages/Admin.tsx` - Uses Supabase for mentors
- `src/components/AskMentorChat.tsx` - Uses Supabase

### Using Firestore (but should check for profiles/mentors):
- `src/pages/Profile.tsx` - Uses Firestore for `profiles` and `adaptive_push_settings`
- `src/pages/Index.tsx` - Uses Firestore for `profiles` and `mentors`
- `src/pages/MentorChat.tsx` - Uses Firestore for `mentors`
- Many other files use Firestore for various collections

