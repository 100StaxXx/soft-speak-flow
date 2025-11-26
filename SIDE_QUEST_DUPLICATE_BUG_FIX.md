# Side Quest Duplicate Bug Fix

## Problem
When creating a side quest (a non-main quest), the quest was being created twice, resulting in duplicate entries in the database.

## Root Cause
The issue was in the quest creation flow in `src/pages/Tasks.tsx`. Here's what was happening:

1. User clicks "Add Quest" button
2. If no main quest exists, a drawer opens asking "Set as Main Quest?"
3. User clicks "Add as Side Quest" button
4. This triggers **two separate actions**:
   - The button's `onClick` calls `handleMainQuestResponse(false)` → creates the quest
   - The `DrawerClose` wrapper closes the drawer, triggering `onOpenChange`
   - The drawer's `onOpenChange` calls `handleDrawerClose()` after 50ms
   - `handleDrawerClose()` checks if `pendingTaskData` still exists and calls `handleMainQuestResponse(false)` **again**

The race condition occurred because:
- `handleMainQuestResponse()` would call the async `actuallyAddTask()`
- The drawer would close and schedule `handleDrawerClose()` to run after 50ms
- By the time `handleDrawerClose()` ran, `pendingTaskData` was still set (because clearing it happened at the end of the async function)
- This caused the quest to be created a second time

## Solution
The fix involves clearing `pendingTaskData` **immediately** when the user makes a choice, rather than waiting for the async operation to complete:

### Changes Made

1. **Updated `handleAddTask()`** (lines 302-329):
   - Created `taskData` object inline instead of using `setPendingTaskData()` for the immediate creation case
   - Only set `pendingTaskData` when showing the main quest prompt
   - For direct side quest creation (when main quest already exists), pass data directly to `actuallyAddTask()`

2. **Updated `actuallyAddTask()`** (lines 331-362):
   - Changed signature to accept optional `dataToAdd` parameter: `actuallyAddTask(isMainQuest: boolean, dataToAdd?: typeof pendingTaskData)`
   - Uses passed-in data instead of relying on state
   - Removed `setPendingTaskData(null)` since it's now cleared before calling this function

3. **Updated `handleMainQuestResponse()`** (lines 364-370):
   - Immediately captures `pendingTaskData` in a local variable
   - Clears `pendingTaskData` state immediately with `setPendingTaskData(null)`
   - Passes captured data to `actuallyAddTask()`
   - This prevents the race condition by ensuring `pendingTaskData` is null before any async operations

## Flow After Fix

### Scenario 1: Creating side quest when main quest already exists
1. User enters quest text and clicks "Add Quest"
2. `handleAddTask()` detects main quest exists
3. Quest data is passed directly to `actuallyAddTask()` without using `pendingTaskData` state
4. Quest is created once ✅

### Scenario 2: Creating side quest via drawer (no main quest exists)
1. User enters quest text and clicks "Add Quest"
2. `handleAddTask()` stores data in `pendingTaskData` and opens drawer
3. User clicks "Add as Side Quest"
4. `handleMainQuestResponse()` immediately:
   - Captures `pendingTaskData` in local variable
   - Sets `pendingTaskData` to `null`
   - Calls `actuallyAddTask()` with captured data
5. Drawer closes and triggers `handleDrawerClose()` after 50ms
6. `handleDrawerClose()` checks `pendingTaskData` - it's now `null`, so no duplicate creation ✅

### Scenario 3: User dismisses drawer without choosing
1. User enters quest text and clicks "Add Quest"
2. Drawer opens with main quest prompt
3. User dismisses drawer (clicks outside, presses back, etc.)
4. `handleDrawerClose()` detects `pendingTaskData` still exists
5. Creates quest as side quest by calling `handleMainQuestResponse(false)` ✅

## Files Modified
- `src/pages/Tasks.tsx`

## Testing Recommendations
1. Create a side quest when no main quest exists (via drawer) - should create only 1 quest
2. Create a side quest when main quest already exists - should create only 1 quest
3. Dismiss the main quest prompt drawer - should create 1 side quest
4. Create a main quest via the drawer - should create only 1 quest
5. Check database to ensure no duplicates are created in any scenario
