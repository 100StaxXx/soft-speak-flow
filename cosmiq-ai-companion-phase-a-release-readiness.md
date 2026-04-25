# Cosmiq AI Companion Phase A Release Readiness

Use this with:

- [cosmiq-ai-companion-phase-a-implementation-brief.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-implementation-brief.md)
- [cosmiq-ai-companion-phase-a-qa-checklist.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-qa-checklist.md)
- [cosmiq-ai-companion-phase-a-dogfood-log.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-dogfood-log.md)

## Current Read
Phase A is functionally implemented.

The remaining question is not whether the planner loop exists.
It is whether the planner loop is trustworthy enough to ship.

## Local Validation Baseline
- Last local verification: `2026-04-24`
- Command: `npm run planner:phase-a:check`
- Result:
  - focused UI / hook / persistence slice passed
  - planner / orchestrator / bridge slice passed
  - Phase A slice typecheck passed

## What Is Ready
- `Plan My Day`
- `Adjust My Day`
- `What Should I Do Right Now`
- `What Do I Have Coming Up`
- proposal-backed save / confirm / reload flows
- batch confirmation in the compatibility planner path
- planner modes: `Lock In`, `Balanced`, `Recovery`
- campaign pressure and repeated-slip guidance across core planner surfaces
- deterministic fallback when planner AI output is slow or malformed
- read-only legacy fallback when the unified agent path is unavailable
- first-run onboarding stage resume across the cinematic flow
- explicit confirmation before destructive legacy account reset
- server-backed replayable intro/tutorial dismissals for Search, Campaigns, and Postcards

## What Still Decides Ship Readiness
- Does a fresh signup reach the companion and first Plan My Day without confusion?
- Does `Plan My Day` feel obviously right on real days?
- Does `Adjust My Day` calm the user down when the day breaks?
- Does `What Should I Do Right Now` return one useful next move quickly?
- Do proposal-backed cards stay trustworthy across reload, resume, and confirm flows?
- Does fallback stay invisible enough that users do not feel path drift?
- Does first-run recovery feel boring and predictable after refresh, network failure, or continue-later?

## Remaining Risks
- Real-day planner trust may still fail in ways synthetic tests will not catch.
- First-run trust may still fail in ways component tests cannot catch, especially on mobile web/iOS.
- Legacy fallback may still feel behaviorally different under unusual runtime conditions, even though it is now read-only.
- Repo-wide TypeScript debt still exists outside the scoped planner slice.

## Dogfood Status
- Real-day dogfood signoff is still pending.
- Logged sessions: `0 / 3` required.
- The release gate is not complete until those sessions are run and recorded.

## Launch Blockers
Treat any of the following as a blocker:

- `Plan My Day` feels unrealistic or overwhelming in real use.
- `Adjust My Day` increases stress instead of reducing it.
- `Right Now` regularly returns low-value or mistimed actions.
- Proposal-backed surfaces lose `Save`, `Saving`, or `Saved` state across reload/confirm flows.
- Any AI-originated write appears to bypass confirmation.
- Any account deletion or destructive reset starts without explicit user confirmation.
- A fresh user loses onboarding progress after refresh or a transient failed write.

## Non-Blockers For Phase A
- Full removal of compatibility infrastructure
- Deeper persisted stagnation counters
- More planner surfaces
- Phase C reflection / weekly expansion beyond what is already shipped
- Unrelated repo-wide cleanup outside the planner slice

## Signoff Checklist
- `npm run planner:phase-a:check` is green.
- The QA checklist has been run.
- Fresh signup / onboarding / guided tutorial checks have been run.
- At least 3 real-day dogfood sessions are logged.
- No open blocker remains in the dogfood log.
- The team would personally use the planner loop instead of planning elsewhere.

Note: Phase A validation is currently recorded as a local command run, not as a dedicated CI workflow.

## Recommended Next Step
Do not add more planner behavior first.

Run the QA checklist, fill out the dogfood log, and only reopen implementation when a trust failure is concrete.
