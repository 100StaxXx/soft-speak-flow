# Mobile Calendar layout cleanup

Implemented locally after TestFlight build 353. Not uploaded or deployed in this change.

## User-requested design

- Keep the existing `CinematicPageBackground` quests preset and scenery unchanged.
- Replace the mobile title/date-card stack with a compact month header and seven-day strip.
- Provide an accessible, checked view menu: Agenda, Day, 3-Day, Month.
- Remove the large empty-state/Add Quest panel and floating companion from the mobile calendar.
- Keep a small add button; move connections, refresh, voice capture, and help into Calendar options.
- Give Day and 3-Day their own full-height scroll areas above bottom navigation.
- Keep desktop week/day planner behavior intact.

## Behavior

- Day reuses the existing task detail, completion, editing, calendar-event details, and hold-to-create behavior.
- Agenda shows seven days from the selected date; header arrows move a week.
- 3-Day shows three consecutive dates, including overlapping appointments in separate lanes, untimed tasks, and connected events. Tapping an empty slot pre-fills task creation; tapping a date opens Day.
- Month is inline, with compact cells; tapping a date opens Day. Long-press creation cancels during scrolling and no longer also navigates after a successful hold.
- Calendar read ranges cover seven days after the selection at month boundaries. Linked external-event deduplication is preserved.
- Connected events in the new views open read-only event details, not the quest editor.
- Today retains the existing date-reset behavior and explicitly recenters 3-Day as well as Day.

## Verification

- 137 tests passed across toolbar, alternate views, month view, day agenda, Journeys integration, desktop planner, and local/external calendar hooks.
- Phone-sized browser component preview at 390 × 844: Day, 3-Day, and Month rendered; Day scroll position moved from 1159 to 0 while its header stayed at the top. Timeline bottom was 740 px, clear of the 104 px navigation reservation.
- Temporary preview used empty fixture data and the existing bundled scenic asset; no real calendar entries were changed. Preview files and server were removed after verification.
- Production web build passed. TypeScript remains blocked by 37 existing errors outside the changed calendar files; no errors in this change's files.
- No iOS archive, TestFlight upload, git commit, or push in this change. Physical iPhone verification remains a release check.
