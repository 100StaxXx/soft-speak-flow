
# Add End Date for Recurring Quests

## Overview

When a user selects a recurrence pattern (Daily, Weekly, Weekdays), a new "Ends" field will appear allowing them to optionally set when the recurrence should stop.

## User Experience

| Step | Behavior |
|------|----------|
| Select recurrence | "Ends" option appears below the recurrence buttons |
| Default | "Never" (no end date) |
| Options | Never, On date (date picker), After X occurrences |

**Visual Design:**

```text
┌─────────────────────────────────────────┐
│ ↻ Recurrence                            │
│ ┌──────┐ ┌───────┐ ┌────────┐ ┌────────┐│
│ │ NONE │ │ DAILY │ │ WEEKLY │ │WEEKDAYS││
│ └──────┘ └───────┘ └────────┘ └────────┘│
│                                         │
│ Ends                                    │
│ ┌───────────────────────────────────────┤
│ │ 📅  Never                         ▼  ││
│ └───────────────────────────────────────┤
└─────────────────────────────────────────┘

When "On date" selected:
┌───────────────────────────────────────┐
│ Ends                                  │
│ ┌─────────────────────────────────────┤
│ │ 📅  On date                     ▼  ││
│ └─────────────────────────────────────┤
│                                       │
│ ┌─────────────────────────────────────┤
│ │ End Date: Feb 28, 2026          📅 ││
│ └─────────────────────────────────────┤
└───────────────────────────────────────┘
```

## Implementation

### 1. Database Migration

Add a new column to `daily_tasks`:

| Column | Type | Default | Purpose |
|--------|------|---------|---------|
| `recurrence_end_date` | `date` | `NULL` | Date after which recurrence stops |

### 2. Update Types

**File: `src/integrations/supabase/types.ts`** (auto-updated after migration)

**File: `src/features/quests/types.ts`**
- Add `recurrenceEndDate: string | null` to `QuestFormState` and `PendingTaskData`

**File: `src/features/tasks/hooks/useNaturalLanguageParser.ts`**
- Add `recurrenceEndDate: string | null` to `ParsedTask` interface

### 3. Update UI Components

**File: `src/features/tasks/components/TaskAdvancedEditSheet.tsx`**

Add after the recurrence buttons:

```tsx
{recurrencePattern && (
  <div className="space-y-2 mt-2">
    <Label className="text-sm font-medium">Ends</Label>
    <Select value={recurrenceEndType} onValueChange={setRecurrenceEndType}>
      <SelectTrigger>
        <SelectValue placeholder="Never" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="never">Never</SelectItem>
        <SelectItem value="on_date">On date</SelectItem>
      </SelectContent>
    </Select>
    
    {recurrenceEndType === 'on_date' && (
      <DatePicker 
        date={recurrenceEndDate}
        onSelect={setRecurrenceEndDate}
        minDate={new Date()}
      />
    )}
  </div>
)}
```

### 4. Update Recurring Task Spawner

**File: `src/hooks/useRecurringTaskSpawner.ts`**

Modify the `shouldSpawnToday` function and query:

```typescript
// Add to query select
recurrence_end_date

// Add check in filter
const needsSpawning = (templates || []).filter((template) => {
  // ... existing checks ...
  
  // Skip if recurrence has ended
  if (template.recurrence_end_date) {
    const endDate = parseISO(template.recurrence_end_date);
    if (selectedDate > endDate) return false;
  }
  
  return shouldSpawnToday(template, dayOfWeek);
});
```

### 5. Update Mutation Hooks

**File: `src/hooks/useTaskMutations.ts`**

- Add `recurrenceEndDate?: string | null` to `AddTaskParams`
- Include in insert and update operations

### 6. Update Form Hooks

**File: `src/features/quests/hooks/useQuestForm.ts`**

- Add `recurrenceEndDate` state and setter
- Include in `createPendingTaskData`

## Files to Modify

| File | Changes |
|------|---------|
| Database migration | Add `recurrence_end_date` column |
| `src/features/quests/types.ts` | Add `recurrenceEndDate` to types |
| `src/features/tasks/hooks/useNaturalLanguageParser.ts` | Add to `ParsedTask` |
| `src/features/tasks/components/TaskAdvancedEditSheet.tsx` | Add end date picker UI |
| `src/hooks/useRecurringTaskSpawner.ts` | Check end date before spawning |
| `src/hooks/useTaskMutations.ts` | Handle `recurrenceEndDate` in mutations |
| `src/features/quests/hooks/useQuestForm.ts` | Add state for end date |

## Result

- Users can set an optional end date when creating recurring quests
- Recurring tasks automatically stop spawning after the end date
- Clean, conditional UI that only shows when recurrence is enabled
- Follows existing patterns for date pickers in the codebase
