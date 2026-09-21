# Session, calendar and evolution-background repair

## Implemented

- Native sessions use iOS Keychain storage. Existing local sessions migrate only after a successful secure write. A temporarily unreadable session is recoverable, not a confirmed logout.
- Session reads cannot overwrite newer sign-in/sign-out events; native background/resume starts and stops token refresh. Root navigation and protected routes retain recovery instead of falsely showing Welcome.
- Native Apple token exchange retries transient transport/server failures with bounded delays. Invalid credentials are not repeatedly retried. No account or progress records were merged or reset.
- Calendar is focused on scheduled tasks and events. Goals contains daily progress, the mission thread and unscheduled inbox. Existing inbox links redirect to Goals, and editing/scheduling still opens Calendar.
- Google and Outlook OAuth requests and exchanges explicitly identify Cosmiq, including the hosted callback. This prevents the shared backend's other-product default from selecting the wrong callback rules.
- Apple Calendar declares the iOS full-access permission, offers writable calendars, and preserves local all-day dates.
- New `calendar-read-events` endpoint reads events only from an authenticated user's connection and selected calendar. It supports provider token refresh, validates pagination hosts, and cannot delete or modify external events or quests. Only refreshed connection credentials are persisted. Existing write/sync endpoints were not replaced.
- Companion scenery follows the claimed evolution form, with 42 bundled backgrounds across six elements and seven forms. See [habitat documentation](companion-habitats.md) and [saved generation prompts](companion-stage-habitat-prompts.json).

## Verification

- Focused frontend repair suite: 235 tests passed.
- Follow-up session/evolution suite: 120 tests passed.
- Calendar integration suite: 22 tests passed.
- Final root navigation, session, route protection and calendar callback suite: 49 tests passed.
- Read-only calendar endpoint: 8 backend tests passed; deployed endpoint rejects missing authentication with HTTP 401.
- Function manifest and diff whitespace checks passed.
- Final production build, release environment checks, bundle checks, Capacitor sync and bundled iOS asset verification passed.
- Final unsigned Xcode Debug build for a generic iOS device passed, including the new Keychain plugin and native calendar changes.
- Full app TypeScript checking is NOT clean: it reports broader existing issues in app routing/push handling, animation types, task/campaign types and test fixtures. Passing production/native builds do not replace this check.

Test suite counts overlap and should not be summed as distinct coverage. Provider tests use mocks; they do not prove third-party consent or Apple account authentication on a physical device.

## Release and device verification still needed

Update: these changes are now in the signed 4.8 (353) archive, uploaded successfully through Xcode. Apple processing/tester availability is unverified. See [build 353 release status](2026-09-19-testflight-353.md). The note below records the earlier repair pass.

The new calendar reader is deployed. Frontend/native changes are synchronized into Xcode but have not been uploaded to TestFlight in this repair pass.

On the new build, verify Apple sign-in, background/resume and cold launch; reconnect Google/Outlook in Preferences and approve access; grant Apple Calendar full access; verify event import, all-day dates and existing send/sync behavior. The affected Apple account has no saved calendar connection to exercise server-side end to end. Check Calendar scrolling and Goals scheduling, then hatch/evolve and verify the background advances only with the revealed form. Existing opaque companion portraits may conceal the layered habitat.
