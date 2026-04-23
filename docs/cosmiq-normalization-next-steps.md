# Cosmiq Normalization Next Steps

## Current Status
- Phases 1 through 5 from [PLANc2.md](/Users/macbookair/Downloads/PLANc2.md) are implemented on the normalization branch.
- The wrapper boundaries are now enforced in code:
  - `useEpics` is isolated behind `useCampaigns`
  - `useTaskMutations` is isolated behind `useQuestMutations`
  - `useDailyTasks` is isolated behind `useQuests`
  - `useLegacyCompanionAssistantAdapter` has no runtime imports
- `CampaignCard` now consumes canonical `Campaign` props directly, so the temporary `toCampaignCardModel(...)` compatibility bridge has been removed.

## Immediate Packaging Work
- Split the normalization work into a focused merge path off `main`.
- Keep the normalization PR limited to the canonical vocabulary, adapters, wrappers, AI boundary cleanup, schema drift fixes, boundary migrations, and architecture guardrails.
- Keep unrelated mentor, UI polish, versioning, and migration work out of the normalization PR.

## Post-Plan Follow-Up

### 1. `useJournalEntries`
- Current state:
  - [useJournalEntries.ts](/Users/macbookair/Developer/soft-speak-flow/src/hooks/useJournalEntries.ts) owns a `["journal-entries", ...]` query key and fetches three tables directly.
- Why it matters:
  - this is the clearest remaining divergence from the plan's "compose existing hooks / avoid duplicate fetch paths" rule
  - it creates explicit invalidation responsibility for every write path that affects reflections or check-ins
- Recommended follow-up:
  - either split it into table-owned hooks and compose the results client-side
  - or keep the aggregate query but harden it with a clearer invalidation or realtime strategy

### 2. Boundary Enforcement
- Keep [normalizationBoundaries.architecture.test.ts](/Users/macbookair/Developer/soft-speak-flow/src/hooks/normalizationBoundaries.architecture.test.ts) and [useCompanionAssistant.architecture.test.ts](/Users/macbookair/Developer/soft-speak-flow/src/hooks/useCompanionAssistant.architecture.test.ts) green.
- Consider adding lint-level import restrictions once the normalization PR is packaged and merged.

### 3. Deferred Work
- Physical SQL renames
- Journal table consolidation
- Calendar storage unification
- Broader profile / gamification / referral normalization
- Any future `MemoryItem` implementation

## Verification Checklist
- `rg -n 'import \\{ useEpics \\}|useEpics\\(' src --glob '!**/*.test.*'`
  - expect only [useCampaigns.ts](/Users/macbookair/Developer/soft-speak-flow/src/hooks/useCampaigns.ts)
- `rg -n 'import \\{ useTaskMutations \\}|useTaskMutations\\(' src --glob '!**/*.test.*'`
  - expect only [useQuestMutations.ts](/Users/macbookair/Developer/soft-speak-flow/src/hooks/useQuestMutations.ts)
- `rg -n 'import \\{ useDailyTasks \\}|useDailyTasks\\(' src --glob '!**/*.test.*'`
  - expect only [useQuests.ts](/Users/macbookair/Developer/soft-speak-flow/src/hooks/useQuests.ts)
- `npx vitest run src/hooks/normalizationBoundaries.architecture.test.ts src/hooks/useCompanionAssistant.architecture.test.ts`
