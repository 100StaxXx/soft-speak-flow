
# Remove Redundant Recurrence Option from Edit Ritual Sheet

## Problem

The "Edit Ritual" sheet shows two scheduling controls:
1. **Frequency Presets** (Daily, Weekdays, Weekly, Custom) - the main scheduling control
2. **Recurrence** in Advanced Options (None, Daily, Weekly, Custom Days) - redundant for rituals

This creates confusion since rituals already have their schedule defined by frequency, which is campaign-level scheduling.

## Solution

Hide the Recurrence section when `AdvancedQuestOptions` is used inside `EditRitualSheet`. The recurrence option is still useful for one-off quests, so we'll add a prop to conditionally hide it.

## Changes

### File: `src/components/AdvancedQuestOptions.tsx`

| Change | Description |
|--------|-------------|
| Add `hideRecurrence` prop | Optional boolean to hide the recurrence section |
| Conditionally render recurrence | Only show if `hideRecurrence` is false/undefined |

```typescript
interface AdvancedQuestOptionsProps {
  // ... existing props
  hideRecurrence?: boolean;  // NEW: hide for rituals
}
```

```tsx
{/* Recurrence Section - hide for rituals */}
{!props.hideRecurrence && (
  <div className="space-y-3">
    {/* ... recurrence picker ... */}
  </div>
)}
```

### File: `src/components/EditRitualSheet.tsx`

| Change | Description |
|--------|-------------|
| Pass `hideRecurrence={true}` | Hide recurrence section in advanced options |

```tsx
<AdvancedQuestOptions
  // ... existing props
  hideRecurrence={true}  // Rituals use FrequencyPresets instead
/>
```

## Result

- **Edit Ritual Sheet**: Shows only Scheduled Time, Duration, Reminder, Location, and More Information in advanced options
- **Add Quest Sheet**: Still shows all options including Recurrence (for one-off quests)
- Frequency Presets remain the single source of truth for ritual scheduling

## Cleanup

We can also remove the unused recurrence state variables from `EditRitualSheet` since they're no longer needed:
- `recurrencePattern` state → remove
- `onRecurrencePatternChange` prop → pass no-op or remove

However, I'll keep the state for now since the task update logic still uses it for backwards compatibility with existing tasks.
