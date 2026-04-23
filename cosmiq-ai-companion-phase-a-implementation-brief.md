# Cosmiq AI Companion Phase A Implementation Brief

Last updated: 2026-04-23

## Purpose

This brief translates the AI companion spec into the concrete Phase A build plan.

It is intentionally narrower than the full spec. The goal is not to implement the whole vision. The goal is to ship the smallest set of changes that makes Cosmiq feel reliably useful in the daily loop.

Phase A definition:

- `Plan My Day` v1
- `Adjust My Day` v1
- `What Should I Do Right Now`

Retained supporting surface:

- `What Do I Have Coming Up`

## Locked Decisions

These are not up for reinterpretation during Phase A.

- `companion-agent` is the only user-facing AI orchestrator.
- `companion-planner-chat` may remain as an internal planner engine or transition layer, but no new product-facing behavior should live only there.
- All AI-originated writes continue through `companion-agent` and `companion_pending_actions`.
- Storage naming stays legacy. Product and domain language stay Campaign, Quest, Ritual.
- Day mode is a lightweight request or session-level control in Phase A, not a new persistent subsystem.
- If the AI fails, the system falls back to deterministic read-only guidance. It does not create pending actions and it does not guess.

## Non-Goals

Do not pull these into Phase A:

- campaign-state inference such as moving, drifting, stalled, at risk
- stagnation-threshold logic
- weekly planning
- reflection-bridge structured output
- schema renames
- new write paths
- new AI surfaces beyond the core loop

## Workstreams

### 1. Orchestration Convergence

Outcome:

- one product-facing AI path
- planner-facing UI routes through `companion-agent`
- direct planner endpoint usage is treated as legacy or internal-only

Primary file targets:

- `src/hooks/useCompanionPlanner.ts`
- `src/hooks/useLegacyCompanionAssistantAdapter.ts`
- `src/hooks/useCompanionAssistant.ts`
- `src/components/journeys/JourneysCompanionPlannerModal.tsx`
- `src/components/companion/CompanionPlannerPanel.tsx`
- `supabase/functions/companion-agent/agent.ts`
- `supabase/functions/companion-agent/plannerBridge.ts`

Done when:

- new user-facing planner work no longer depends on direct `companion-planner-chat` invocation
- the journeys companion experience and companion panel both use the same orchestration expectations
- `companion-planner-chat` remains callable only as planner-core or compatibility infrastructure

### 2. Structured Output Expansion for Phase A

Outcome:

- Phase A surfaces have required structured blocks
- UI can render deterministic cards instead of parsing prose

Required blocks:

- `planDay` (already exists)
- `comingUp` (already exists; retained)
- `rightNow` (new)
- `dayAdjust` (new)

Primary file targets:

- `src/shared/companionStructuredOutput.ts`
- `src/types/companionAgent.ts`
- `src/types/companionPlanner.ts`
- `supabase/functions/companion-agent/types.ts`
- `supabase/functions/companion-agent/plannerBridge.ts`
- `supabase/functions/companion-planner-chat/planner.ts`

Done when:

- agent responses can return `rightNow` and `dayAdjust`
- UI has typed access to those blocks without ad hoc parsing
- malformed or absent structured output does not break rendering

### 3. `What Should I Do Right Now`

Outcome:

- user can open one surface and get one useful action for the next 30 to 60 minutes
- fallback still helps when no real quest fits

Behavior:

- one recommendation only
- clear why-it-wins-now explanation
- fallback recovery or setup action if no meaningful quest fits

Primary file targets:

- `src/shared/journeysCompanionLauncherTemplates.ts`
- `src/types/companionPlanner.ts`
- `src/utils/companionPlannerRequest.ts`
- `src/utils/companionPlannerRequestValidation.ts`
- `supabase/functions/companion-planner-chat/request.ts`
- `supabase/functions/companion-planner-chat/planner.ts`
- `src/shared/companionStructuredOutput.ts`
- `src/components/journeys/JourneysCompanionPlannerModal.tsx`
- `src/components/companion/CompanionPlannerPanel.tsx`

Done when:

- there is a dedicated launcher or entrypoint for right-now guidance
- response time targets the spec's under-3-second experience when possible
- the returned action feels immediately actionable during dogfooding

### 4. `Adjust My Day` as a Full Recovery Flow

Outcome:

- Adjust My Day becomes a whole-day rescue system, not a collection of isolated reschedule actions

Behavior:

- return `keep`
- return `move`
- return `drop_or_shrink`
- create confirmable updates only where concrete changes are proposed
- escalate to a campaign-level problem only when patterns clearly exceed one-day reshuffling

Primary file targets:

- `src/components/SmartDayPlanner/components/QuickAdjustDrawer.tsx`
- `src/components/SmartAdjustPlanDrawer.tsx`
- `src/pages/Journeys.tsx`
- `src/shared/companionStructuredOutput.ts`
- `src/shared/companionPlannerPriority.ts`
- `src/utils/companionPlannerSchedule.ts`
- `supabase/functions/companion-planner-chat/planner.ts`
- `supabase/functions/companion-agent/plannerBridge.ts`
- `supabase/functions/companion-agent/agent.ts`

Done when:

- the assistant can produce a coherent whole-day adjustment response
- the UI can show keep, move, and drop-or-shrink sections
- concrete moves still honor pending-action confirmation

### 5. Day Mode Plumbing

Outcome:

- Phase A supports `Lock In`, `Balanced`, and `Recovery`
- day mode changes planner density and task intensity without introducing a new permanent subsystem

Placement:

- store in request or session state for Phase A
- optionally persist later if it proves valuable

Primary file targets:

- `src/types/companionPlanner.ts`
- `src/utils/companionPlannerRequest.ts`
- `src/utils/companionPlannerRequestValidation.ts`
- `supabase/functions/companion-planner-chat/request.ts`
- `supabase/functions/companion-planner-chat/planner.ts`
- `src/shared/companionPlannerPriority.ts`
- `src/hooks/companionPlannerShared.ts`
- `src/components/journeys/JourneysCompanionPlannerModal.tsx`
- `src/features/tasks/components/PlanMyDayClarification.tsx`

Done when:

- the user can explicitly choose a day mode in the Phase A flow
- mode changes the number, intensity, or density of recommended work
- Recovery mode reliably softens the plan instead of just changing copy

### 6. Deterministic Fallback and Latency Protection

Outcome:

- the planner fails safely
- the user still gets useful guidance if the model is slow or malformed

Fallback rules:

- no pending action on timeout
- no pending action on malformed structured output
- no pending action on normalization failure
- return deterministic read-only guidance built from planner context

Preferred fallback outputs:

- simple schedule summary
- next best action
- lighter recovery guidance

Primary file targets:

- `supabase/functions/companion-agent/agent.ts`
- `supabase/functions/companion-agent/plannerBridge.ts`
- `supabase/functions/companion-agent/types.ts`
- `src/shared/companionStructuredOutput.ts`
- `src/hooks/useCompanionAssistant.ts`
- `src/utils/asyncTimeout.ts`

Done when:

- timeout and malformed-output cases are handled intentionally
- the user sees a read-only fallback instead of an error when possible
- fallback never mutates data

### 7. Preserve `What Do I Have Coming Up`

Outcome:

- supporting situational-awareness surface continues to work while Phase A core loop improves

Primary file targets:

- `src/shared/journeysCompanionLauncherTemplates.ts`
- `src/shared/companionStructuredOutput.ts`
- `supabase/functions/companion-planner-chat/planner.ts`
- `src/components/journeys/JourneysCompanionPlannerModal.tsx`

Done when:

- `What Do I Have Coming Up` remains accessible
- `comingUp` structured output is not regressed by Phase A changes
- supporting-surface status is explicit in product planning

## Recommended Build Order

1. Orchestration convergence
2. Structured output expansion
3. `What Should I Do Right Now`
4. `Adjust My Day` full recovery flow
5. Day mode plumbing
6. Deterministic fallback and latency protection
7. Final pass on retained `comingUp` support

This order keeps architecture risk ahead of UX polish.

## Acceptance Criteria

### `Plan My Day`

- returns usually 3 to 5 quests, and fewer when honest capacity is low
- plan feels realistic within a few seconds
- user can see the day's direction without reading a long explanation

### `Adjust My Day`

- user gets a believable keep, move, and drop-or-shrink answer
- recovery feels simpler than manual replanning
- concrete changes still require confirmation

### `What Should I Do Right Now`

- returns one clear action
- answer is fast enough to feel immediate
- fallback is still useful if nothing meaningful fits

### System-level

- only one product-facing AI orchestrator is used for new work
- no AI failure silently creates or mutates source-of-truth data
- deterministic fallback exists and is tested
- `What Do I Have Coming Up` continues to work

## Verification Checklist

### Functional

- dogfood the three core surfaces on real days for at least one week
- confirm the system helps decide, recover, and build trust
- verify each Phase A surface returns its required structured block

### Reliability

- simulate LLM timeout and confirm deterministic fallback fires
- simulate malformed structured output and confirm no pending action is created
- verify failed validation returns a safe receipt and no write

### Metrics

- daily-loop start rate
- suggestion-confirm rate
- same-day completion rate for confirmed AI quests
- Adjust My Day usage after missed work
- 7-day repeat use of `Plan My Day`

## Notes for Implementation

- Keep the spec strategic and this doc operational.
- If a change does not materially improve decide, recover, or trust, it is probably not Phase A work.
- Aim for consistent usefulness, not perfection.
