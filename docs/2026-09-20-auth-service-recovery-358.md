# Sign-in outage and actionable recovery — build 358

## Incident and restoration

- User reported build 357 could not restore an existing Apple account and only exposed loading/retry. Preserve all quest, badge, companion and animation changes from 357.
- Live checks at approximately 16:50 UTC showed authentication and REST unhealthy while the database was reachable. All four authentication/Apple endpoint probes timed out after 20 seconds. Later database health also failed. These are server observations, not an inference from the screen.
- With explicit user approval, requested a restart of shared project `opbfpbbqvuksuvmtmssd` (Cosmiq/Graceward). Management API accepted with HTTP 200. No credentials, configurations, policies, account records, sessions, migrations or functions were changed.
- Database restart time verified as 2026-09-20 16:59:26 UTC. Authentication subsequently reported healthy. Public health returned 200; Apple authorization returned 302 to appleid.apple.com with the expected client/callback; deliberately invalid native/legacy Apple tokens were rejected with 400/401. The profile API zero-row query returned 200 in 581 ms. Management REST health still reported unhealthy at one sampling point, so direct API results are recorded separately.
- User confirmed fully closing/reopening restored their existing account, through Loading → Checking access → app. They asked about startup speed but preferred preserving safety. No entitlement/auth bypass or speculative speed optimization was introduced.

## App correction

- Both initial loading and failed-restoration screens offer **Back to sign in**, independent of the SDK's outstanding session promise. Retry remains available.
- Explicit recovery opens a fresh runtime on the login page and temporarily excludes only the old primary session token from SDK reads. The secure copy is retained until a successful real sign-in durably saves its replacement. Failed/cancelled authentication does not delete it. OAuth verifier storage remains functional; no fabricated session or protected-route bypass is used.
- All native secure-storage reads, migration writes, normal writes and removals now have bounded waits. A reproducer using the real SDK demonstrated that an indefinitely pending migration write held startup and subsequent auth operations indefinitely before this fix.
- Session checks now have an overall deadline and do not enqueue repeated reads after that deadline. A settled recovery error displays its actions immediately instead of starting another loading-screen timer. Existing authenticated users remain intact during transient recovery.
- Apple's identity, secure session persistence, subscription validation and all other build 357 functionality are unchanged.

## Verification / distribution

- Regression cases include expired-session startup with foreground auto-refresh/subscribers, stalled Keychain migration/write/removal, explicit Apple re-sign-in with an unreadable old token, preservation after a failed save, account-switch races and protected-route recovery controls.
- The paired iPhone was unavailable to this Mac, so native device inspection was not performed. The user's successful recovery is the device confirmation; Apple endpoint probes are not a real Apple authorization on their behalf.
- Auth-only validation completed: 390 test files / 2,950 tests passed; typecheck, lint, secret scan, iOS preflight, and build-358 archive succeeded. That archive was not uploaded before the user redirected work to calendar interactions. It predates the calendar changes and is not a release containing them.
- Diagnostic logs: `/private/tmp/cosmiq-auth-358-*.log` and `.jsonl`; release output: `/private/tmp/cosmiq-auth-358.QQkQVs`.
- Removed only verified regenerable export copies for completed builds 355, 356 and 357 (approximately 1.6 GB), retaining their original signed archives and all source.
