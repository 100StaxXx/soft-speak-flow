# Expressive companion motion and quieter Goals

Follow-up to build 360. Backend v6 is deployed; see `2026-09-20-release-361.md` for app delivery status.

- Moved the existing ConnectedTasks component from GoalsActivity to Profile Preferences, directly below calendar connections. Permission prompts, selected imports and sync behavior are unchanged. Goals retains progress and the persistent Inbox.
- Prompt version 4 replaces tiny head tilts, blinking and almost-static breathing with visible full-body actions: short exploratory arcs, crouch-and-hop, waking stretches, lowering to rest and rising again. Stage-specific Mind/Body/Soul choreography becomes more expressive without changing secular activity suggestions.
- Durations remain 4 seconds for four idle categories and 5 seconds for activities. Prompts explicitly allow the middle pose to differ, start movement within 0.3 seconds, and restore the original pose for the last half-second. The existing identical start/end habitat images and frame-ready player remain unchanged. Movement adapts to visible anatomy, with no new limbs or invented flight.
- Versioned lookup prepares new clips rather than reusing the minimal-motion version. Existing v3 clients can still read their saved clips; older queued jobs retain their saved prompts. No stored media is deleted, no accounts are changed, and no paid generation was manually triggered.
- Deploy only the wellbeing function, then ship the updated app together. No database migration is needed. Existing cost and daily limits apply, so new clips may wait for budget capacity. Validate the seven new outputs on a phone; stronger prompts are not proof of the final generated movement quality.

Checks: 41 focused app tests passed, including Settings placement and Goals absence; typecheck and changed-file lint passed. Backend regression checks cover preserving v3 recordings and idempotently preparing v4 jobs. Actual new video output remains unverified until generation after deployment.
