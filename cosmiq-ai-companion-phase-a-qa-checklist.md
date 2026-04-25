# Cosmiq AI Companion Phase A QA Checklist

Use this alongside [cosmiq-ai-companion-phase-a-implementation-brief.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-implementation-brief.md).
Capture actual sessions in [cosmiq-ai-companion-phase-a-dogfood-log.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-dogfood-log.md).

## Goal
Validate that the core daily ritual loop feels:

- clear
- trustworthy
- calm under pressure
- resilient across reloads and fallback paths

## First-Run / Tutorial Scenarios
### Fresh Onboarding
- Create a fresh test account and enter `/onboarding`.
- Complete prologue, destiny, faction, questionnaire, story tone, and companion color/species dropdowns.
- Refresh after each major stage and verify the flow resumes from the saved step instead of restarting at prologue.
- Confirm questionnaire failures are visible and do not silently advance to mentor result.

### Legacy / Broken Companion Recovery
- Create or simulate a legacy companion state that requires reset.
- Visit `/onboarding`.
- Verify no account deletion starts automatically.
- Verify the destructive reset requires explicit `Reset my account` confirmation.
- Verify `Not now` exits without deleting account data.

### Guided Tutorial
- Complete onboarding and verify the companion tutorial starts with `meet_companion`.
- Trigger `Plan My Day` and verify the tutorial advances only after the companion request succeeds.
- Reload during the guided tutorial and verify server/local progress stay aligned.
- Dismiss the guided tutorial and verify `/onboarding` does not force journey-begins recovery afterward.
- Replay Search, Campaigns, and Postcards tutorial modals from their help controls.

## Daily Ritual Scenarios
### Plan My Day
- Trigger `Plan My Day` from the companion panel.
- Trigger `Plan My Day` from the journeys launcher.
- Confirm at least one proposal.
- Confirm all when multiple proposals are ready.
- Reload the app and verify the structured plan card returns.
- Verify confirmed suggestions render as `Saved`.

### Right Now
- Trigger `What Should I Do Right Now`.
- Save the suggested move.
- Confirm the pending action.
- Reload before confirming and verify the suggestion still replays correctly.

### Adjust My Day
- Trigger `Adjust My Day`.
- Save a proposal from the `Keep` column.
- Reload before confirming and verify the same proposal is still actionable.
- Confirm it and verify it remains `Saved`.

### Coming Up
- Trigger `What Do I Have Coming Up`.
- If a `Before That` proposal exists, save it.
- Reload before confirming and verify it still replays with the right starter intent.

### Tomorrow / Weekly
- Trigger `Prepare me for tomorrow`.
- Trigger `Plan My Week`.
- Save a proposal from each.
- Reload before confirming and verify both replay into confirmable actions.

## Campaign / Priority Scenarios
### What Matters
- Trigger `What Matters`.
- Save a proposal-backed campaign adjustment.
- Confirm it.
- Reload and verify the card state stays consistent.

### Make Room
- Trigger `Make Room`.
- Save a proposal-backed adjustment.
- Verify replay uses the `make_room` path instead of the generic `what_matters` path.

### Advance My Campaign
- Trigger `Advance My Campaign`.
- Save `nextStep`.
- Confirm it.
- Reload and verify the saved proposal stays marked.

## Planning Mode Scenarios
- Trigger `Plan My Day` in `Balanced`.
- Trigger `Low Energy` and verify `Recovery` behavior is used on the first request.
- Switch to `Lock In` and trigger `Plan My Day` again.
- Verify the request feels denser without becoming unrealistic.

## Confirmation Boundary Scenarios
- Save a structured suggestion and confirm it.
- Save a structured suggestion and cancel it.
- Verify:
  - nothing writes before confirmation
  - cancelled actions do not remain `Saved`
  - confirmed actions become receipts and/or saved badges

## Reload / Resume Scenarios
- Create a proposal-backed planner thread.
- Switch to another thread and back.
- Verify the structured cards restore in-session.
- Reload the app.
- Verify the same thread restores:
  - structured cards
  - saved badges
  - pending proposal state

## Legacy Fallback Scenarios
- Force the unified path unavailable in a dev/test environment.
- Verify fallback preserves:
  - current transcript
  - starter intent
  - planner surface context
  - saved/pending proposal ids
- Verify planner guidance becomes read-only in fallback:
  - proposal-backed cards no longer create writes
  - no confirmation boundary is bypassed while the agent path is down
- Trigger a launch intent during fallback and verify it does not wait on unified bootstrap.

## Failure / Resilience Scenarios
- Simulate planner timeout.
- Verify the response falls back to grounded read-only guidance.
- Simulate malformed or missing structured output.
- Verify no write is created and the UI stays stable.
- Simulate prepare-response missing `proposalId`.
- Verify the tapped suggestion still shows `Saving`.

## Quality Questions
Ask after each real-day dogfood session:

1. Did it help me decide what to do?
2. Did it help me recover when the day changed?
3. Did I trust it without second-guessing?

If any answer is `no`, prioritize that failure before adding scope.

## Useful Validation Commands
```bash
npm run planner:phase-a:ui
```

```bash
npm run planner:phase-a:backend
```

```bash
npm run planner:phase-a:check
```

```bash
npm run planner:phase-a:typecheck
```

## Dogfood Output
Record real-day results in:

- [cosmiq-ai-companion-phase-a-dogfood-log.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-dogfood-log.md)
