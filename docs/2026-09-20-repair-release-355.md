# Cosmiq stabilization release — 4.8 (355)

## Release identity

- Based on the user's latest push, `fe2040b1ce395f72d5332e3af43bc62537daeb3b`, on `codex/cosmiq-product-repair`. Build 354 was independently confirmed as Testing in TestFlight before starting this release.
- Signed archive: `/Users/macbookair/Library/Developer/Xcode/Archives/2026-09-20/Cosmiq 4.8 (355) 2026-09-20.xcarchive`.
- Xcode archive and App Store Connect upload succeeded September 20, 2026 Pacific. Upload finished at 00:20:42. TestFlight processing/distribution is a separate check below.
- Verification logs: `/private/tmp/cosmiq-repair.88uHXk` (temporary, not durable source control).

## Repairs

1. Reconciled the already-live hatch/evolution and stats implementations into an isolated production baseline and made the root entry points use them. Preserves cinema preparation, bounded custom-video waiting, portrait promotion, and the Cosmiq stats product boundary. The shared backend's product-specific catalog is not copied into the Cosmiq frontend.
2. Fixed Mind/Body/Soul video preparation for custom `evolution-cards` portraits and approved bundled presets. Source matching, account ownership, product separation, and restricted URLs remain enforced. New paid generations and retries require active trial/subscription/promo access; existing cached clips remain readable. Added regression tests for real portrait shapes, entitlement expiry, trial access, and worker checks.
3. Added a 15-second playback startup/stall timeout, retained a close control, and preserved tap-to-play when autoplay is blocked. Generation still takes longer than the three-second finished clip and does not silently resubmit paid work.
4. Fixed calendar deferred date-reset ordering when closing creation/planning sheets. Updated integration tests to exercise the actual calendar toolbar and current navigation behavior.
5. Corrected paid-plan progression copy to the implemented 100 levels and seven companion forms, derived from progression configuration.
6. Repaired application/node type checking, lint, obsolete test mocks/expectations, and unused code after Daily Adventure removal. The production Supabase project pin remains strict; test setup uses a mocked client with network blocked.
7. Updated dependencies, moved test/build-only tools to development dependencies, and migrated the Vitest configuration/tests. Dependency audit reports zero vulnerabilities at verification time.
8. Fixed CI Node compatibility and pinned CI's public product identity. CI asset builds use inert test keys and are never signed or distributed. Replaced automatic broad shared-backend deployment with an explicit, version-checked function scope after validation; no automatic auth-config or database push.

## Live backend

- Deployed only `companion-wellbeing-video`, from v1 to v2; ACTIVE. All 12 downloaded deployed TypeScript sources match the tested local sources byte-for-byte.
- Unauthenticated POST returns 401. Gateway JWT configuration remains unchanged; the handler authenticates user/internal requests.
- Existing wellbeing table and claim function are present. Existing cron job 21 is active every minute and invokes the internal-authenticated function. Thirty scheduler runs succeeded during the preceding 30 minutes. This confirms scheduled invocation, not a successful newly generated clip.
- No database migration, auth configuration, calendar worker activation, Graceward function deployment, test purchase, customer calendar mutation, or paid AI generation was performed in this repair release.
- Existing shared $25 monthly feature/endpoint video budget is unchanged. It is not a per-user budget.

## Apple trial

- App Store Connect monthly product `6756406102` and yearly product `6756406164` both show **Free for the first 2 weeks**, starting September 19, no end date, across 175 regions.
- Yearly review notes were corrected from three days to 14 days for eligible new subscribers and saved. Monthly notes already agreed.
- Apple's offer eligibility still applies. This verification does not substitute for a sandbox purchase, restore, and entitlement-expiration test on an iPhone.

## Verification

| Check | Result |
| --- | --- |
| Frontend | 385 files, 2,918 tests passed |
| Backend | 43 isolated groups, 833 assertions passed |
| Static SQL migration tests | 27 passed; not a live DB regression suite |
| Scoped release validator | 4 passed |
| Application and Node types | Passed |
| Backend types | Passed |
| Lint | Passed, zero warnings |
| Unused code / import cycles | Passed |
| Dependency audit | Zero reported vulnerabilities |
| Secret scan | Passed, 2,329 files before this release note |
| Product boundary / function manifest | Passed |
| Production web build / bundle budgets / Maps asset checks | Passed |
| Native asset synchronization / signing preflight | Passed |
| Xcode signed archive / upload | Both succeeded |

## Still requires a real device

Do not interpret this release as proof that every possible bug is fixed. Complete the acceptance pass against build 355:

- Email and Apple login, account switching, background/foreground, force-close, offline recovery, and expired sessions.
- Eligible Apple trial purchase, restore, cancellation/expiration, and no surprise paywall while entitled or while access is temporarily unknown.
- First custom hatch and later evolution, preparation while away, one-time reveal, and replay.
- Mind/Body/Soul for new/existing portraits, real generated output, cached replay, slow network, backgrounding, reduced motion, and budget exhaustion. Soul prompts remain secular.
- Google/Outlook/Apple create/import/export/edit/complete/conflict/reconnect, recurring/all-day items, time zones, and permissions on real provider accounts.
- Day/Agenda/3-Day/Month layout, scrolling, keyboard, and accessibility on the phone.
- Separate Cosmiq and Graceward notification delivery and navigation.

Unattended calendar synchronization remains disabled pending safe provider round-trip testing. Multiple accounts per provider, complete recurring-series editing, and provider webhooks are not delivered by this stabilization release.

## Disk cleanup

Deleted the three explicitly approved regenerable caches for device smoke testing and builds 342/343 (about 1.2 GB), then removed this release's temporary DerivedData after successful archive/upload (about 976 MB). Both are regenerable; signed archives and source were preserved. Remaining disk space is still low, around 1 GB.

## TestFlight availability

Upload succeeded; Apple processing and tester availability are being verified separately.
