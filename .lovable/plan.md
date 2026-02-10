
# Restore Campaign Dropdown Folders for Rituals

## Problem
Rituals from campaigns used to be grouped under collapsible campaign headers (showing campaign name, progress, days remaining, and a chevron to expand/collapse). Now they're mixed into the flat timeline alongside regular quests because all tasks are merged into a single list (lines 281-289 in `TodaysAgenda.tsx`).

## Solution
Restore the campaign-grouped collapsible sections so rituals appear under their campaign headers as dropdown folders, while regular quests remain in the timeline.

## Changes in `src/components/TodaysAgenda.tsx`

### 1. Remove rituals from the unified timeline
- Update the merge logic (lines 281-289) to only include `questTasks` (not `ritualTasks`) in `scheduledItems` and `anytimeItems`.

### 2. Group rituals by campaign
- Add a `useMemo` that groups `ritualTasks` by their `epic_id`, matching against `activeEpics` to get campaign metadata (title, progress, days remaining).

### 3. Add collapsible campaign sections after the quest timeline
- Add a "Campaigns" separator (similar to the "ANYTIME" divider) below the quest timeline.
- For each campaign with rituals today, render a collapsible header showing:
  - Campaign name (with `Target` icon)
  - Progress percentage and days remaining
  - Completion count for today's rituals (e.g., "2/5")
  - Chevron toggle button (with `event.stopPropagation()` to avoid conflicts)
- Inside each collapsible, render the grouped ritual tasks using the existing `renderTaskItem`.

### 4. Track expanded campaign state
- Add a `useState<Set<string>>` for `expandedCampaigns`, defaulting all campaigns to expanded.
- Chevron toggles the campaign ID in/out of the set.

### 5. Update the empty-campaign strip condition
- The existing campaign strip (line 843-876) already only shows when `ritualTasks.length === 0`, so it will continue to work as a fallback for campaigns with no rituals surfaced today.

## Visual Result
- Quests appear in the timeline as they do now
- Below quests, a "Campaigns" section shows each active campaign as a collapsible dropdown
- Each campaign header shows real-time stats and a chevron to expand/collapse its rituals
- Tapping the campaign header name opens the Journey Path Drawer (existing behavior)
