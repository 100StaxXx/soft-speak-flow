# Custom first hatch repair — 2026-09-19

Project: `opbfpbbqvuksuvmtmssd` (shared product backend).

The deployed backend is newer than this Cosmiq checkout. **Do not deploy the
older function directories from this checkout over production.** These narrowly
scoped patches were applied to downloaded production sources; each function was
staged separately with its own bundled dependencies. Different deployed functions
export different shared-file versions; combining downloads overwrites them.

## Applied changes

- Migrations `20260919140000` and `20260919143000`: add first-hatch preparation at
  creation, preserve manual claims, route legacy preset hatches through the queue,
  enforce server-side XP, support the shipped Cosmiq catalog, and bind previously
  unbound legacy accounts without changing trusted existing product bindings.
- `COSMIQ_CUSTOM_HATCH_ENABLED=true` enables only first-hatch cinema. Existing
  `COSMIQ_CINEMA_ENABLED=false` and zero-percent later rollout remain unchanged.
- Worker/evolution patches apply the separate first-hatch gate. Graceward retains
  its independent premade path and account boundaries.
- Prewarm routes installed clients into the same durable preparation queue;
  routine prewarm never restarts failed paid renders automatically.
- Auth gateway defaults omitted product mode to pre-split Cosmiq, preserving
  explicit Graceward requests. The next frontend also sends Cosmiq explicitly.
- One confirmed misbound Buttercat/storm account was individually repaired.
  No other existing account was reclassified. The repair did not claim its hatch.

## Reproducing or rolling forward

Download each current function into a **separate** clean staging directory using
`supabase functions download ... --use-api`. Review patch context before applying;
original versions: evolution 69, cinema worker 20, prewarm 29, auth gateway 41.
Apply `companionCinemaRollout.patch` to worker/evolution stages and each matching
entrypoint patch. Auth's source export omits a type-only `oauthState.ts`; its
required declaration is `export type OAuthProductMode = "cosmiq" | "graceward";`.

Type-check each staged entrypoint. Preserve `verify_jwt=false` for evolution,
worker and auth gateway (they authenticate inside their handlers), and `true`
for prewarm. Never disable handlers' authentication or product checks.

Run `hatch-rollout.test.ts` in the worker staging root and `auth-product.test.ts`
in the auth staging root. A rollback-only database regression also verified that
duplicate enqueue reused the same event, XP/stage stayed unchanged, forged client
XP was rejected, and legacy preset hatch queued without claiming stage 1.

The stats smoke test used deployed handler code with live read-only database
access and the repaired account's trusted product resolver. It returned 200 with
a validated analysis; cache writes and paid AI calls were intercepted. It does
not substitute for testing the installed app's UI and real session.

The frontend changes require a new TestFlight build. Server-side repairs are
deployed and support the currently installed client.

At 2026-09-19 12:30 UTC, the diagnosed egg's stage-1 cinema event reached `ready`.
Both portrait and video objects exist; exactly one first-hatch event exists.
The companion remained stage 0 with 10 XP and no stage-1 evolution claim.

Production build and 192 targeted frontend regressions passed, plus four backend
rollout/auth tests and the rollback-only database checks. Full app TypeScript
checking still reports unrelated existing errors outside this repair (router,
animation typings, subscriptions, planner/share utilities and test fixtures).
