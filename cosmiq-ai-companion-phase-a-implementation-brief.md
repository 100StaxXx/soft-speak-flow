# Cosmiq AI Companion Phase A Implementation Brief

## Objective
Ship the core daily ritual loop for Cosmiq's AI companion without changing the architecture:

- `Plan My Day`
- `Adjust My Day`
- `What Should I Do Right Now`
- retained supporting surface: `What Do I Have Coming Up`

Architecture remains:

- AI proposes
- server validates
- Supabase persists
- AI-originated writes go through `companion-agent`
- `companion_pending_actions` is the confirmation boundary

## Locked Decisions
- `companion-agent` is the primary user-facing AI orchestrator.
- `companion-planner-chat` remains planner-core / compatibility infrastructure until full cutover.
- Storage naming stays legacy (`daily_tasks`, `epics`, `habits`); product language stays Quest / Campaign / Ritual.
- Day mode is lightweight request/session state, not canonical persisted truth.
- If AI fails, the system falls back to grounded read-only guidance rather than unsafe writes.

## Phase A Scope
### Core surfaces
- `Plan My Day`
- `Adjust My Day`
- `What Should I Do Right Now`

### Supporting surfaces
- `What Do I Have Coming Up`
- `Plan My Week`
- `Prepare me for tomorrow`
- `What Matters`
- `Make Room`
- `Advance My Campaign`

## Current Status
### Implemented
- Structured planner cards render across companion and journeys surfaces.
- `Lock In`, `Balanced`, and `Recovery` planning modes are wired through launcher, panel, and planner requests.
- Proposal-backed planner suggestions can be saved, confirmed, and protected from duplicate saves. Batch confirmation remains available in the compatibility planner path; the unified `companion-agent` path intentionally resolves one pending action at a time.
- Agent and planner paths persist and restore structured planner state through thread replay.
- Timeout and malformed-output fallback paths are in place for planner/agent flows.
- Agent-side campaign adjustments now execute through a dedicated pending-action path instead of leaking ad hoc campaign statuses into storage.
- Legacy assistant fallback is explicitly read-only for planner suggestions, so degraded runtime conditions cannot bypass the `companion_pending_actions` boundary.
- Campaign pressure and repeated-slip logic now shape:
  - `Plan My Day`
  - `Adjust My Day`
  - `Right Now`
  - `Coming Up`
  - `What Matters`
  - `Make Room`
  - `Advance My Campaign`
  - `Plan My Week`
  - `Prepare me for tomorrow`
- Unified assistant analytics now track:
  - submitted AI turns
  - suggestion preparation
  - confirm
  - cancel

### Last local verification
- Date: `2026-04-24`
- Command: `npm run planner:phase-a:check`
- Result:
  - focused UI / hook / persistence slice passed
  - planner / orchestrator / bridge slice passed
  - Phase A slice typecheck passed

### Recently hardened
- Shared structured-card renderer now has direct coverage across:
  - `Plan My Day`
  - `Plan My Week`
  - `What Matters`
  - `Make Room`
  - `Prepare me for tomorrow`
  - `Advance My Campaign`
  - `What Should I Do Right Now`
  - `What Do I Have Coming Up`
  - `Adjust My Day`
- Unified assistant replay is now reload-safe across proposal-backed surfaces:
  - `Plan My Day`
  - `Plan My Week`
  - `What Matters`
  - `Make Room`
  - `Prepare me for tomorrow`
  - `Advance My Campaign`
  - `What Should I Do Right Now`
  - `Adjust My Day`
  - `What Do I Have Coming Up`
- Pending-confirmation turns preserve existing structured cards when the agent omits `structuredResponse`.
- Companion panel quick actions now pass `planningMode` on the first request.

## Remaining Work
## Completion Estimate
- Product behavior implementation: `90–95%`
- Confidence / hardening against real usage: `70–80%`

What that means:
- the planner system itself is largely built
- the main remaining risk is trust under real-day usage, not missing feature breadth

### Highest value
- Manual dogfooding across real days:
  - decide
  - recover
  - trust
- Release signoff is still pending because no real-day dogfood sessions are logged yet.
- Broader end-to-end QA of unified path vs legacy fallback edge cases.
- Final repo-wide validation / cleanup where worthwhile beyond the planner slice.

Use:
- [cosmiq-ai-companion-phase-a-qa-checklist.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-qa-checklist.md)
- [cosmiq-ai-companion-phase-a-dogfood-log.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-dogfood-log.md)
- [cosmiq-ai-companion-phase-a-release-readiness.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-release-readiness.md)

### Not required for Phase A completion
- Deeper persisted stagnation thresholds
- Stronger campaign-state backing signals beyond current heuristics
- Full orchestration cutover that removes compatibility layers entirely
- Phase C reflection/weekly expansion beyond the current shipped surfaces

## Done Gate
Call Phase A effectively done when all of the following are true:

- focused UI / hook / persistence suites stay green
- planner / orchestrator / bridge suites stay green
- the QA checklist has been run against real-day flows
- no major trust failures remain in:
  - `Plan My Day`
  - `Adjust My Day`
  - `What Should I Do Right Now`
- proposal-backed surfaces survive reload, resume, and confirmation without losing state

## Do Not Keep Doing
- adding new planner surfaces before dogfooding the current loop
- chasing tiny edge hardening indefinitely without a real user or QA signal
- expanding Phase B ideas before the Phase A trust loop is proven

## Quality Bar
- The first `Plan My Day` should feel obviously right.
- `Adjust My Day` should make a broken day feel recoverable.
- `What Should I Do Right Now` should return one useful action quickly.
- Proposal-backed surfaces should survive reloads and thread restores without losing confirmability.
- No AI-originated write should bypass confirmation.

## Validation Commands
### UI / hook slice
```bash
npm run planner:phase-a:ui
```

### Planner / edge-function slice
```bash
npm run planner:phase-a:backend
```

### Combined phase check
```bash
npm run planner:phase-a:check
```

### Slice typecheck
```bash
npm run planner:phase-a:typecheck
```

### Dogfood log
- [cosmiq-ai-companion-phase-a-dogfood-log.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-dogfood-log.md)

### Release readiness
- [cosmiq-ai-companion-phase-a-release-readiness.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-release-readiness.md)

## Practical Read
The product is no longer in “invent the planner” mode.
It is in “prove the planner is trustworthy on real days” mode.
