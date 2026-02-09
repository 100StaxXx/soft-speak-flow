

# Redesign Quests Tab as a Loose Timeline (Structured-style)

## Concept

Replace the current flat task list in `TodaysAgenda` with a **loose vertical timeline** inspired by Structured. This means:

- A thin dashed vertical line running down the left side
- Tasks positioned along it with time labels on the left and task cards on the right
- Unscheduled/anytime tasks grouped at the bottom without time markers
- Inbox tasks in a collapsible section at the very end
- Campaign rituals woven into the timeline at their scheduled times (not in a separate section)

Unlike Outlook's rigid hour-by-hour grid, this is **event-driven** -- only showing time slots where tasks actually exist, with natural spacing between them.

## What Changes

### 1. Restructure TodaysAgenda Layout

Replace the current progress-bar-and-flat-list layout with a timeline layout:

- **Remove** the large progress bar header (replace with a minimal "3/7" pill in the top-right)
- **Add** a vertical dashed line on the left (~48px from edge)
- **Group tasks by time**: Scheduled tasks show with their time label on the left of the line, task card on the right
- **Unscheduled tasks** appear under an "Anytime" divider at the bottom
- **Inbox section** collapses below everything

**File:** `src/components/TodaysAgenda.tsx` -- major layout refactor of the render section (lines ~790-1076)

### 2. Timeline Task Row Component

Create a reusable row component for the timeline:

```
  9:30 AM  ---o--- [ Task Card                    ]
                   [ difficulty badge | duration   ]
```

Each row shows:
- Time label (left of line) or empty for unscheduled
- A small dot/circle on the timeline line
- The task card (right of line) with existing swipe/tap/drag behavior

**New file:** `src/components/TimelineTaskRow.tsx`

### 3. Merge Rituals Into Timeline

Currently, rituals are in a separate "Campaigns" section at the bottom. In the timeline view, rituals with scheduled times should appear **inline** with quests at their appropriate time position. Campaign headers become subtle group dividers within the timeline rather than standalone sections.

- Rituals with `scheduled_time` appear in chronological order mixed with quests
- Campaign affiliation shown as a small colored dot or tag on the task card
- Unscheduled rituals go in the "Anytime" section

### 4. Compact Progress Indicator

Replace the large progress bar with a minimal indicator:
- Small circular progress ring or "3/7" badge in the date header area
- XP total shown as a subtle label next to it
- Keeps all progress info but uses ~20px of vertical space instead of ~100px

### 5. Inbox Section

Add the collapsible inbox section (from previous plan) at the very bottom of the timeline, below "Anytime" tasks.

---

## Visual Structure (top to bottom)

```text
[ Date Pills Scroller                              ]
[ Mon Feb 9, 2026                        3/7  42XP ]
                                                    
  |                                                 
  9:30 AM ---- o ---- [ Morning Review        ]    
  |                                                 
  10:00 AM --- o ---- [ CRM Updates     30min ]    
  |                    [ Medium +16 | Campaign ]    
  |                                                 
  2:00 PM ---- o ---- [ Team Standup          ]    
  |                                                 
  ---- Anytime ----                                 
  |                                                 
  o ---- [ Read chapter 5              ]           
  o ---- [ Buy groceries               ]           
  |                                                 
  ---- Inbox (3) ----                               
  |                                                 
  o ---- [ Research topic              ]           
  o ---- [ Call dentist                ]           
```

## Files Changed

| File | Change |
|---|---|
| `src/components/TimelineTaskRow.tsx` | **New** -- Single timeline row with time label, dot, and task card |
| `src/components/TodaysAgenda.tsx` | Refactor render to timeline layout: remove progress bar, add vertical line, sort all tasks by time, merge rituals inline |
| `src/components/TodaysAgenda.tsx` | Add Inbox section at bottom using `useInboxTasks` hook |

## What Stays the Same

- Date pills scroller at top (already working)
- Swipe actions on task cards (delete, move to next day)
- Long-press drag reordering
- Campaign headers (simplified to inline tags)
- FAB button for adding quests/campaigns
- All existing task mutation hooks

## Considerations

- The existing `calendar/TimelineView.tsx` already has similar timeline logic but is designed for the calendar tab. We will borrow its visual patterns (dashed line, time labels) but keep the Quests tab's richer task cards with XP, difficulty badges, and swipe actions.
- Campaign rituals mixing into the timeline means the separate "Campaigns" section disappears -- campaigns are visible via small tags on ritual cards and via the campaign strip (when no rituals are scheduled today).

