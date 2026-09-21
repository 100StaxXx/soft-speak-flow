# Quest editor, badge artwork and companion video preparation

## Changes

- Quest editors and their portaled pickers use a scoped dark Agenda-like palette, Barlow typography, thin borders and compact controls. Scheduling, recurrence, attachments, drafts and Inbox behavior are retained. The scenic Agenda background is unchanged.
- Seven generated badge-family illustrations replace the old orange placeholder artwork. Epic Starter uses the celestial-path illustration. Collection tiles are keyboard-accessible buttons; the detail view displays larger art and a quiet tier label. Artwork is bundled in public/badges-v2 (about 320 KB total), with no runtime generation charge. The obsolete generated URL map was removed; the legacy upload tool now writes its report outside app source. Old artwork and Git history remain available.
- Story portraits prefer the saved current cinema scene, including its element habitat, over a stock preset cutout. Earlier checkpoints look up their own saved evolution portrait rather than borrowing the current form. The query includes the current portrait/version so a newly promoted scene is not hidden by an old cache entry.
- The globally mounted CompanionVideoPreparation prepares Mind, Body and Soul together as soon as the claimed visual stage and portrait are available and trial/subscription access is active. It does not require opening the companion tab or tapping a category. Existing accounts follow this path on their next visit. Repeated calls reuse the server's durable appearance/category/prompt-version cache; paid failures are not automatically resubmitted.
- Video preparation now distinguishes absent clips, pending portraits, queued/processing work, access limits, changed appearances and actual failures. Transport failures say the preparation status could not be checked, not that a generated video failed playback. Activities remain usable. Completing a background render never automatically plays it.

## Hatch timing

The existing onboarding selection handler immediately starts companion creation. The existing migration 20260919140000_prepare_custom_hatch_at_creation.sql queues the first custom cinema package from the creation trigger, before the hatch XP requirement. This prepares the custom portrait/video without claiming the hatch.

A live read confirmed companion_prepare_first_hatch is installed on user_companion, after insertion or selection changes. Two additional attempts to re-read the full function definition timed out while establishing the database connection. No trigger, shared cinema function, migration, account, session or generated customer media was modified. Do not treat this check as a new end-to-end paid generation run.

## Validation and release boundary

- Final full frontend regression suite: 389 files, 2,941 tests passed, including the cleanup/lazy-loading changes.
- Animation backend: 15 tests passed, covering ownership/product/access boundaries, durable deduplication, three-second requests, at-most-once submission, bounded retries and pending portraits.
- Type checks, lint, unused-code/import-cycle checks and secret scan passed.
- Final production web build and JavaScript/CSS/image budgets passed; mobile visual review used the real quest editor rendered with test data at 430 × 932. This was not an authenticated physical-device flow.
- No subscription purchase, customer video generation or database migration was performed during validation.
- Release 4.8 (357) includes these changes and the saved-session hotfix from build 356. Native preflight, embedded web-asset checks and app/widget signing checks passed. Distribution verification is recorded below.
- Removed two regenerable temporary build-cache folders (about 2.3 GB); source, signed archives and upload logs were preserved.

Artwork prompts, tool mode and asset locations: [2026-09-20-badge-art-prompts.md](2026-09-20-badge-art-prompts.md).

## Deployment — September 20, 2026

- Compared live animation v2 source and its dependency closure: only the reviewed entry-point status/error changes differed.
- Deployed only `companion-wellbeing-video` to `opbfpbbqvuksuvmtmssd`; version 3 is ACTIVE. Before/after inventory confirms no other function version changed.
- Re-ran all 15 animation backend tests successfully before deployment. Live unauthenticated probe returns HTTP 401.
- No shared migration, configuration change, other function deployment or customer-media operation was performed.
- Release logs and pre-deployment source snapshot: `/private/tmp/cosmiq-release-357.lcjClV`.
- Xcode archive succeeded; app and embedded widget both report build 357, marketing version 4.8. All 475 archived web files exactly match the tested production build.
- Xcode upload succeeded on September 20 at 09:26:53 PDT (16:26:53 UTC): `Upload succeeded` / `EXPORT SUCCEEDED`. Apple reported the uploaded package is processing. TestFlight testing availability is not yet verified because the App Store Connect browser session expired; no claim of physical-device validation is made.
- Signed archive retained at `/Users/macbookair/Library/Developer/Xcode/Archives/2026-09-20/Cosmiq 4.8 (357) 2026-09-20.xcarchive`. Removed only the verified old Cosmiq DerivedData Build directory (575 MB) and this release's completed temporary DerivedData directory (977 MB); both are regenerable. Source, archives and release logs remain intact.
