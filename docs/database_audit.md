# Database Model Reconstruction

This audit inventories every database touchpoint in the repository, split between Supabase (Postgres + storage) and Firebase (Firestore + Functions). For each dataset we list how it is used, the schema fields referenced in code, whether the dataset is defined in the checked-in Supabase migrations, and any risks for missing fields or failing queries.

## Supabase tables and storage buckets

The following Supabase tables are referenced via `supabase.from(...)` across the edge functions and web app. Presence was checked against the `supabase/migrations` directory.

- **mentor_chats** – Reads daily message counts and inserts user/assistant chat rows (`user_id`, `mentor_id`, `role`, `content`, `created_at`). Used in the mentor chat client and rate-limited in the edge function. Table appears in migrations. Query risk: write errors will break history logging but UI degrades gracefully.【F:src/components/AskMentorChat.tsx†L156-L200】【F:supabase/functions/mentor-chat/index.ts†L69-L126】【bd4f30†L13-L21】
- **ai_output_validation_log** – Inserts validation metadata (`user_id`, `template_key`, `input_data`, `output_data`, `validation_passed`, `validation_errors`, `model_used`, `response_time_ms`) from multiple AI functions. Table defined in migrations; failures only affect observability.【F:supabase/functions/mentor-chat/index.ts†L107-L125】【bd4f30†L12-L20】
- **adaptive_push_settings**, **adaptive_push_queue**, **push_notification_queue**, **push_subscriptions**, **push_device_tokens**, **user_daily_pushes** – Read/write push scheduling data (user/device IDs, schedule windows, payloads). All exist in migrations. Missing data would cause push generation to no-op rather than crash; queues rely on rows existing.【bd4f30†L16-L35】【c15ddf†L1-L9】
- **profiles** – Read user profile traits (e.g., horoscope, onboarding data) and updates cosmic profile timestamps. Present in migrations; downstream functions assume fields like `onboarding_data`, `faction`, `cosmic_profile_generated_at` exist.【F:supabase/functions/calculate-cosmic-profile/index.ts†L30-L49】【bd4f30†L16-L23】
- **mentors** – Read mentor metadata for prompts, nudges, horoscopes, lessons; exist in migrations. Queries expect fields such as `id`, `name`, `voice`, `avatar_url` as selected in various edge functions.【F:supabase/functions/generate-proactive-nudges/index.ts†L221-L257】【bd4f30†L16-L23】
- **user_companion**, **companion_evolutions**, **companion_evolution_cards**, **companion_voice_templates**, **companion_postcards**, **companion_stories** – Store companion state and assets. All but `evolution-cards` (note hyphen) exist in migrations; the `evolution-cards` reference in `generate-cosmic-postcard` does **not** have a matching table and will fail at runtime without a synonym view/table.【bd4f30†L16-L34】【c15ddf†L1-L6】
- **daily_check_ins**, **daily_missions**, **daily_tasks**, **habit_completions**, **habits**, **xp_events**, **activity_feed** – Habit/daily mission tracking reads/writes. All present in migrations; queries assume timestamp fields (`created_at`, `completed_at`) and foreign keys (`user_id`, `habit_id`, `epic_id`). Missing columns would break weekly insights and check-in generation.【bd4f30†L23-L31】【c15ddf†L1-L7】
- **quotes**, **pep_talks**, **daily_quotes**, **daily_pep_talks** – Content catalogs. `quotes`/`pep_talks` exist in migrations; `daily_quotes` is **not** defined and will cause failures for the daily quote functions unless created. Daily pep talks table exists. Fields referenced include `id`, `quote`, `author`, `title`, `audio_url`, `mentor_id`, `date` where applicable.【F:src/components/InspireSection.tsx†L32-L55】【bd4f30†L27-L31】
- **lessons** – Read by batch generation functions for mentor-specific lessons (fields like `title`, `description`, `mentor_id`). Exists in migrations.【bd4f30†L16-L23】
- **epics**, **epic_members**, **epic_habits**, **guild_stories** – Guild/epic collaboration data. All exist in migrations; queries expect member roles, `epic_id`, `user_id`, `owner_id`, and habit associations. Writes missing these fields will fail and block guild features.【c15ddf†L7-L9】
- **guild_shouts**, **muted_guild_users**, **shout_push_log** – Guild messaging reads/writes for shout notifications. All exist in migrations; fields include `guild_id`, `user_id`, `message`, `created_at`. Missing fields would break notification fan-out.【c15ddf†L7-L9】
- **mentor_nudges** – Generated proactive nudges stored with `user_id`, `mentor_id`, `title`, `body`, `created_at`; present in migrations. Write failures degrade nudging but not core flows.【c15ddf†L1-L7】
- **referral_codes**, **referral_payouts** – Admin referral testing and payout processing read and update these tables with `code`, `status`, `approved_at`, `user_id`. Present in migrations; absent columns would block admin workflows.【c15ddf†L6-L9】
- **challenge_tasks** – Referenced by weekly challenge generator but **not** found in migrations; any inserts/selects against it will currently fail until a table is added.【bd4f30†L30-L34】
- **user_reflections** – Used for reflection replies but missing in migrations; queries will fail unless created.【bd4f30†L13-L21】
- **user_daily_quote_pushes** – Referenced in quote scheduling but missing in migrations; scheduling edge functions will error when accessing it.【bd4f30†L27-L31】

### Storage

- **mentors-avatars** bucket – `generate-companion-image` uploads PNG mentor/companion avatars to this bucket and reads public URLs. Bucket is created in migrations alongside pep talk storage, so upload failures would indicate missing bucket or permissions.【F:supabase/functions/generate-companion-image/index.ts†L355-L366】【eb0207†L1-L37】

## Firebase Firestore collections

These collections are accessed through the `src/lib/firebase/firestore.ts` helpers (get/set/update/delete) and via direct Firestore queries.

- **user_companion** – Loaded and updated with fields such as `favorite_color`, `spirit_animal`, `core_element`, `current_stage`, `current_xp`, `current_image_url`, and timestamps; drives companion state in the client. Missing fields would yield undefined values but not necessarily query errors; missing collection would return null and block companion UI.【F:src/hooks/useCompanion.ts†L50-L66】
- **favorites** – `QuoteCard` sets and deletes favorites keyed by user for quotes, implying fields `quote_id`, `user_id`, timestamps. No schema declared elsewhere; absent collection means favorites UI silently fails.【F:src/components/QuoteCard.tsx†L27-L52】
- **profiles** – Admin/profile pages read and update user profile documents with onboarding data and adaptive push settings; missing fields (`onboarding_data`, `adaptive_push_settings`) would break those forms. Collection is assumed to exist because functions and multiple hooks rely on it.【F:src/pages/Profile.tsx†L81-L109】
- **pep_talks**, **quotes**, **challenges**, **epics**, **habits**, **epic_habits**, **guild_rivalries**, **guild_shouts**, **muted_guild_users**, **user_challenges**, **adaptive_push_settings**, **mentors**, **companion_evolutions**, **companion_skins**, **epic_templates**, **epic_activity_feed** (subscription), etc. – Used across hooks for library browsing, guild interactions, and onboarding. Schema expectations come from code (e.g., `guild_shouts` documents include `guild_id`, `user_id`, `content`, timestamps) but no explicit schema files exist; missing fields may cause runtime undefined access, while missing collections will make UI lists empty.【F:src/hooks/useGuildShouts.ts†L141-L179】【F:src/hooks/useEpics.ts†L111-L158】【F:src/hooks/useGuildActivity.ts†L43-L63】

## Detected schema gaps / diffs

- Supabase tables referenced in code but **absent** from migrations: `user_reflections`, `evolution-cards` (hyphenated), `daily_quotes`, `user_daily_quote_pushes`, and `challenge_tasks`. These will cause runtime failures for any select/insert/update against them. Create matching tables or rename references to existing tables before deployment.【bd4f30†L27-L34】【c15ddf†L1-L6】
- Supabase functions assume timestamp columns like `created_at`, `updated_at`, `completed_at`, plus foreign keys (`user_id`, `mentor_id`, `epic_id`) on most domain tables. Ensure these columns exist; otherwise, inserts in edge functions (e.g., mentor chat logging, proactive nudges) will fail.【F:supabase/functions/mentor-chat/index.ts†L107-L125】【F:supabase/functions/generate-proactive-nudges/index.ts†L226-L263】
- Firestore collections lack checked-in security rules or seed data. If collections are missing in a given Firebase project, reads will return empty and writes will auto-create documents; ensure indexes exist for queries using `where`, `orderBy`, and `limit` to avoid Firestore index errors.【F:src/hooks/useGuildActivity.ts†L41-L68】

## Recommended next steps

1. Add Supabase migrations for the missing tables (`user_reflections`, `daily_quotes`, `user_daily_quote_pushes`, `challenge_tasks`) or update code to use existing tables.
2. Confirm whether `evolution-cards` should be `companion_evolution_cards` and align naming across code/migrations.
3. Validate that Firestore indexes exist for compound queries in `useGuildActivity` and `useGuildShouts`; add index definitions if Firestore flags them at runtime.
