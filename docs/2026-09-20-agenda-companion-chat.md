# Agenda companion chat and visual refresh

## Implemented locally

- Restore the floating companion launcher on mobile, desktop, and Mac iPad mode. Normal tap opens chat directly; dragging still repositions it. Keep it out of the way during quest creation and blocking tutorial flows.
- Use a compact dark conversation panel, varied local greetings, and optional quick starters for quests, daily planning, rescheduling, Inbox capture, and campaigns. Reuse the existing authenticated companion service, history, voice, action confirmation, and campaign handoff.
- Convert pending quest-create actions into reviewable quest editor drafts. Retire the server action before opening the editor; a failed retirement leaves the action pending and does not open a second create path. Keep a transferred draft available when the editor is dismissed. Saving creates the quest through the existing editor workflow.
- Preserve unscheduled Inbox intent during the handoff, including a working Save to Inbox primary button. Scheduled quests retain date/time validation.
- Simplify task cards and chat proposal cards with restrained borders, typography, and colors. Add brief entrance, completion, and ambient light animations; respect reduced motion and do not move calendar touch targets.
- Keep the Agenda wallpaper sharp: remove full-grid backdrop blur and lighten its tint. Frost only cards/controls; the underlying wallpaper asset is unchanged.

## Validation and release boundary

- Relevant Agenda, launcher, planner, assistant, calendar interaction, and draft tests passed (238 tests in the initial targeted run; 98 in the follow-up draft/card run).
- App TypeScript checks, changed frontend file lint checks, product-boundary verification, and production web build passed.
- No live AI message, live calendar mutation, on-device chat/keyboard check, or TestFlight upload was performed. Existing provider permissions and server action confirmation remain necessary.
- This work remains local. No auth, subscription, or backend configuration was changed in this refresh. Prior video-background changes remain separate local work; this refresh does not regenerate videos.
- Removed two inactive temporary Xcode distribution pipelines for old builds 350/351 to free about 1.1 GB. Source, personal files, and signed archives were preserved; those temporary exports can be recreated.
