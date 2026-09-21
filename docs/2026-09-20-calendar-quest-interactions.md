# Calendar quest interactions

Implemented Outlook-style vertical rescheduling for Day, mobile 3-Day, and desktop Week. Mouse movement starts after a distance threshold; touch requires a 500 ms hold. The existing drag engine now accepts the actual grid pixels-per-minute scale and snaps to five-minute times. Quest duration and date are unchanged.

Normal swipes before the hold cancel the pending drag. Pointer/touch cancellation never saves. Release clicks are suppressed so a drop cannot open details or toggle completion. Completion controls remain separate. External read-only events and completed quests are not draggable.

Mobile quest titles/cards now open a compact dark summary with date, time range, duration, notes, location, subtasks, expandable reminders/repetition, and an explicit Edit action. Agenda, 3-Day and Month use the same summary. Desktop retains its existing details popover and double-click-to-edit behavior. Existing time-update serialization, local/offline task storage, and linked-calendar syncing are retained; queued writes do not immediately attempt remote calendar sync.

Validation:

- Full regression suite: 391 files / 2,958 tests passed.
- Final focused calendar suite (including the subsequently added desktop-week drag test): 5 files / 163 tests passed.
- TypeScript, lint, production build, secret scan, and bundle budget checks passed.
- Browser preview at 430 × 932: summary layout checked; dragging a sample quest from 09:00 to 10:00 did not open details; a subsequent click showed 10:00–11:00 with the original 60-minute duration.
- Temporary preview files and server were removed/stopped. No real account data was changed during browser verification. Physical iPhone touch testing remains necessary before declaring device validation complete.

Distribution: source and web build updated locally. No TestFlight upload for these calendar changes has been performed. The earlier build-358 auth-only archive predates this implementation and must not be distributed as containing it.
