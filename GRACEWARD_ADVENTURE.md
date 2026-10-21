# Graceward Adventure first playable

This branch adds the first complete game-to-companion flow to the existing Graceward app. It is based on `codex/graceward-cosmiq-experience-flow` at `447c2d6` (September 20, 2026). Reconcile newer local iOS work before merging or releasing.

## Included

- An illustrated-color Adventure home and Play entry, plus three-tab Graceward navigation: Play, Companion, and Sanctuary. Existing companion, Sanctuary and guide screens remain accessible.
- Three five-question Bible Quest trails with original explanatory summaries and passage references. These 15 items need final editorial review before launch.
- Per-account, per-trail unfinished-answer storage. Closing and reopening a trail restores both the answer and its explanation. Storage failure is visible to the player.
- An additive database migration with authenticated, product-scoped completion, ordered unlocks, server scoring, atomic XP and first-completion coin awards, retry-safe receipts and read-only user progress access.
- Existing `graceward-motion/v1` lion/dove celebration videos for supported Young forms. All other forms animate their own portrait with reward sparkles. Reduced-motion mode, playback rejection, video errors, timeout, backgrounding and playback completion settle to the portrait. These are existing animation assets, not newly generated 3D character rigs.
- XP feeds `award_xp_v2` and respects its existing caps. Coins are an earned total for this first milestone; a cosmetics shop is not included.

## Enable in a test environment

1. Confirm the target Graceward project and current migrations; apply `supabase/migrations/20261020180000_graceward_bible_quest.sql` through the normal migration process.
2. Supply the existing Graceward `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `VITE_EXPECTED_SUPABASE_PROJECT_REF` through the normal private environment configuration. Do not substitute Cosmiq credentials.
3. Set `VITE_GRACEWARD_ADVENTURE=true` in the test build. It only activates when the product mode is Christian. It is off by default and compiled into the build.
4. Build with `npm run build:graceward`. Visit `/play`, finish a round, collect its reward and verify saved progress after restarting. Repeat with an existing high-level companion and an existing subscription.
5. Run a physical iPhone/TestFlight check for navigation, animation, audio preferences and all existing account/companion flows before enabling in a release build.

Disabling the flag and rebuilding restores the old navigation and root landing without removing progress. The new database table is additive; no destructive rollback is required. This is a build-time switch, not a remote rollback control for a shipped binary.

## Verification

- `npx vitest run --mode graceward src/pages/GracewardBibleQuest.test.tsx src/components/graceward/AdventureCompanion.test.tsx src/config/gracewardMotion.test.ts src/config/gracewardAdventure.test.ts`
- `node scripts/test-graceward-adventure-db.mjs`
- `npm run typecheck`
- `npx eslint src/components/graceward/AdventureCompanion.tsx src/pages/GracewardAdventure.tsx src/pages/GracewardBibleQuest.tsx src/hooks/useGracewardAdventure.ts src/data/gracewardBibleQuest.ts src/config/gracewardAdventure.ts`

The database test executes the actual new migration in an isolated PostgreSQL engine, with the pre-existing XP writer replaced by a test double. It verifies authentication, product isolation, locked nodes, malformed answers, duplicate retry, write denial, failure rollback, chapter completion and cross-user privacy. It does not establish live-project compatibility or physical-device behavior.

In this environment, Vite compilation completed. The production build verifier correctly stopped because the private Graceward backend configuration was absent. No production migration, release switch, App Store metadata or iOS submission has been applied. Browser binary downloads were unavailable, so rendered visual/device QA remains outstanding.

## Next milestones

Implement Word of Faith and Scripture Match, expand to the planned 30-node world and reviewed content inventory, add usable cosmetic rewards, then run beta pacing and cost measurements. The broader transformation is not complete in this first-playable branch.

## Three-tab organization

Play contains Bible Quest, Noah’s Pairs, and Scripture Builder; game back buttons return to Play. Companion keeps care, growth, memories, and keepsakes. Sanctuary contains daily reflection, Quiet pause, and Focus time. Older `/adventure` links redirect to Play. This navigation is gated to Graceward Adventure; Cosmiq remains unchanged.
