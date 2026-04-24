# Cosmiq AI Companion Phase A Dogfood Log

Use this alongside:

- [cosmiq-ai-companion-phase-a-implementation-brief.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-implementation-brief.md)
- [cosmiq-ai-companion-phase-a-qa-checklist.md](/Users/macbookair/Developer/soft-speak-flow/cosmiq-ai-companion-phase-a-qa-checklist.md)

## Purpose
Capture real-day validation for the Phase A planner loop so we can decide based on trust failures, not vague impressions.

## Current Automated Baseline
- Last verified: `2026-04-24`
- Command: `npm run planner:phase-a:check`
- Result:
  - focused UI / hook / persistence slice passed
  - planner / orchestrator / bridge slice passed
  - Phase A slice typecheck passed
- Real-day sessions logged so far: `0`

## How To Use This Log
For each dogfood session:

1. Run `npm run planner:phase-a:check` first.
2. Exercise the core loop on a real day:
   - `Plan My Day`
   - `Adjust My Day`
   - `What Should I Do Right Now`
3. Fill out one entry below.
4. Only open new implementation work when a trust failure is concrete.

## Session Template
### Session
- Date:
- Build / branch:
- Automated check run:
- Day mode used:
- Real context:

### Surfaces used
- `Plan My Day`:
- `Right Now`:
- `Adjust My Day`:
- `Coming Up`:
- Other:

### Outcome
- Decide:
- Recover:
- Trust:

### What felt right
- 

### What broke trust
- 

### Confirmation / reload notes
- 

### Fixes needed
- 

### Decision
- `ship-ready`
- `needs fix before launch`
- `watch but do not fix yet`

---

## Session 1
### Session
- Date:
- Build / branch:
- Automated check run:
- Day mode used:
- Real context:

### Surfaces used
- `Plan My Day`:
- `Right Now`:
- `Adjust My Day`:
- `Coming Up`:
- Other:

### Outcome
- Decide:
- Recover:
- Trust:

### What felt right
- 

### What broke trust
- 

### Confirmation / reload notes
- 

### Fixes needed
- 

### Decision
- 
