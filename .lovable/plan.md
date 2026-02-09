
# Fix Quests Tab Issues: Date Centering, Campaign Visibility, and Tutorial

## Issues to Fix

### 1. Date Pill Not Centering on Initial Load
The `useEffect` in DatePillsScroller fires before the DOM has finished layout, causing the scroll-to-center to miss. Additionally, there is no fallback for when `scrollTo` fails silently.

**Fix:** Add a small `requestAnimationFrame` or `setTimeout(0)` delay to ensure the DOM has painted before calculating scroll position. Also scroll without animation on mount (instant snap) and only use smooth scrolling for subsequent date changes.

**File:** `src/components/DatePillsScroller.tsx`

### 2. Campaign Section Invisible When No Rituals Surfaced Today
For users who HAVE campaigns but none of their rituals surface today (e.g., custom_days doesn't include today), or new users with no campaigns, there is zero visibility of the campaigns feature on the Quests tab. There should be a minimal campaign strip or "Create Campaign" prompt visible even when no rituals are surfaced.

**Fix:** When `activeEpics` is passed and has entries but `ritualTasks` is empty, show a compact campaign summary strip (campaign names + progress). When no campaigns exist at all, show nothing (the Pathfinder can be accessed elsewhere).

**File:** `src/components/TodaysAgenda.tsx` (add campaign strip below quest list when ritualTasks is empty but activeEpics exist)

### 3. Tutorial Modal for New Users
The `useFirstTimeModal` hook stores a flag in localStorage after first view. For fresh users on their first visit, this should trigger correctly. However, if the user cleared data or is testing, the tutorial won't re-appear.

**Fix:** No code change needed -- the tutorial works correctly for genuine first-time users. For testing, localStorage can be cleared. No regression here.

### 4. Date Header Showing Wrong Date
The header shows `format(selectedDate, "MMM d, yyyy")` which should always match the selected pill. The mismatch in the screenshot (Feb 12 vs MON 9) suggests a stale render or the date initialized to a cached value. This is likely a one-time render artifact rather than a persistent bug.

**Fix:** No code change needed -- the state logic is correct. The `selectedDate` defaults to `new Date()` which is always "today."

---

## Technical Changes

### File: `src/components/DatePillsScroller.tsx`
- Wrap the scroll-to-center logic in `requestAnimationFrame` to ensure DOM layout is complete
- Use `behavior: 'instant'` on first mount, `behavior: 'smooth'` on subsequent date changes
- Add a mount ref to track first render vs subsequent updates

### File: `src/components/TodaysAgenda.tsx`
- After the quest list section (around line 970), add a compact campaign strip that shows when:
  - `activeEpics.length > 0` AND `ritualTasks.length === 0`
- The strip shows each campaign name with its progress percentage
- Tapping opens the JourneyPathDrawer (same as existing campaign headers)
- This ensures campaigns are always visible on the Quests tab even on days when no rituals are scheduled

### Summary of Changes

| File | Change |
|---|---|
| `src/components/DatePillsScroller.tsx` | Fix scroll-to-center timing with RAF + instant scroll on mount |
| `src/components/TodaysAgenda.tsx` | Add compact campaign strip when epics exist but no rituals today |
