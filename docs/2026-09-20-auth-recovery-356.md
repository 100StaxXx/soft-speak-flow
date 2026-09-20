# Saved-session recovery hotfix — 4.8 (356)

## Report and evidence

- Existing signed-in account reopened after updating and saw the protected-route sign-in timeout, without visiting Apple sign-in. The paired iPhone reports build 355.
- The old warning appeared after six seconds. Its retry called the same in-flight `getSession` promise, so it could not restart a stuck SDK initialization/renewal.
- Auth fetches and native secure-storage reads had no application deadline. The real SDK reproduces a hung renewal; mocked `useAuth` tests did not cover this.
- A configured-key auth health check eventually returned HTTP 200 in 6.67 seconds. Another request timed out. This demonstrates slow connectivity, not proof of the exact cause of the phone's original incident.
- Real-SDK cold-start testing also exposed unhandled promises on secure-storage failure: the initial-session notification and the process-lock queue tail. Neither should erase a session.
- Native device diagnostics could confirm the version but could not attach a debugger to the installed app. No customer credentials were extracted, no account was signed out, and no device app was replaced.

## Changes

1. Bound only this project's auth requests and response bodies to 15 seconds, aborting stalled transport. Non-auth requests are unchanged. Failures remain retryable; 400/401 server responses retain their normal meaning.
2. Bound read-only native session reads to five seconds; preserve Keychain and legacy storage on failures. Secure writes and migration remain mandatory, with no less-secure persistence fallback.
3. Retry explicitly reloads the app runtime/SDK without clearing either session store, instead of awaiting the same stuck operation.
4. Allow 35 seconds before the stalled-start warning, matching the SDK's network-retry window rather than prematurely warning at six seconds.
5. Distinguish secure-storage recovery from connection recovery with fixed, non-sensitive UI copy. Native errors include operation codes and OSStatus, never token values.
6. Narrow `@supabase/auth-js` 2.81.1 patch catches the initial notification's unobserved read rejection and observes the lock queue's failures while still propagating the caller's error. Timed-out lock waiters do not bypass earlier operations. Source, ESM and CommonJS are all patched.

## Validation

- Initial full frontend suite: 387 files / 2,929 tests passed with the recovery changes.
- Final focused auth run: 44 tests passed; two additional slow-start and lock-serialization regressions passed in the 22-test changed-file run.
- Type checks and lint passed. Release preflight, bundled web assets, Maps assets, product pinning and widget signing passed for build 356.
- Secret scan passed (2,339 files).
- Xcode archive succeeded. Previous signed archives and all source are retained; only this hotfix's temporary DerivedData cache was removed after success to free export space.
- Final full frontend suite: 387 files / 2,931 tests passed.
- Distribution status will be recorded after upload completes.

## Boundaries

No backend function/config/database changes, user-session deletion, security downgrade, new purchase, or AI generation. A proposal to persist refreshed legacy sessions outside Keychain was rejected by safety review and was not applied. Physical-device recovery of the user's exact session remains to be verified after the update; do not represent automated tests as an actual Apple sign-in or phone recovery.
