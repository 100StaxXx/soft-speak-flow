

# Fix Contact Linking Integration for Quest Creation

## Problems Found

The contact interaction logging system is fully built and now connected for task completion, **but there's no way to actually link contacts to tasks when creating them**.

| Issue | Location | Impact |
|-------|----------|--------|
| `AddQuestData` missing contact fields | `src/components/AddQuestSheet.tsx` | Main quest creation has no contact support |
| `handleAddQuest` doesn't pass contact data | `src/pages/Journeys.tsx` | Contact data never reaches the database |
| `onQuickAdd` doesn't pass contact data | `src/pages/Journeys.tsx` | Quick-add from calendar ignores contacts |
| `AddQuestSheet` has no ContactPicker UI | `src/components/AddQuestSheet.tsx` | Users can't select contacts when creating quests |
| `TaskManagerPanel` missing contact pass-through | `src/features/tasks/components/TaskManagerPanel.tsx` | Secondary panel ignores contacts |

## Solution

Add contact linking capability to the main quest creation flow:

### Step 1: Update `AddQuestData` Interface

Add contact fields to the data structure in `AddQuestSheet.tsx`:

```typescript
export interface AddQuestData {
  // ... existing fields ...
  contactId: string | null;
  autoLogInteraction: boolean;
}
```

### Step 2: Add ContactPicker to AddQuestSheet UI

In the expanded mode of `AddQuestSheet.tsx`, add a contact picker section (similar to `TaskAdvancedEditSheet`):

- Add state for `contactId` and `autoLogInteraction`
- Import and render `ContactPicker` component
- Add toggle for "Log as interaction when completed"
- Include fields in the `handleSubmit` data payload

### Step 3: Update `handleAddQuest` in Journeys.tsx

Pass the new contact fields to `addTask`:

```typescript
await addTask({
  // ... existing fields ...
  contactId: data.contactId,
  autoLogInteraction: data.autoLogInteraction,
});
```

### Step 4: Update `onQuickAdd` in Journeys.tsx

Similarly pass contact data from `ParsedTask`:

```typescript
await addTask({
  // ... existing fields ...
  contactId: parsed.contactId,
  autoLogInteraction: parsed.autoLogInteraction ?? true,
});
```

### Step 5: Update TaskManagerPanel (secondary flow)

Update `handleTaskAdd` to include contact fields in the metadata.

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/AddQuestSheet.tsx` | Add interface fields, state, UI (ContactPicker + toggle), and submit logic |
| `src/pages/Journeys.tsx` | Pass contact data in `handleAddQuest` and `onQuickAdd` |
| `src/features/tasks/components/TaskManagerPanel.tsx` | Pass contact data in `handleTaskAdd` |

## Data Flow After Fix

```text
User creates quest → Selects contact in ContactPicker
                            ↓
              AddQuestSheet includes contactId in data
                            ↓
              handleAddQuest passes to addTask mutation
                            ↓
              Database saves contact_id + auto_log_interaction
                            ↓
              When task completed → InteractionLogModal appears
```

## Technical Notes

- The `ContactPicker` component already exists and works
- The `addTask` mutation already supports `contactId` and `autoLogInteraction` parameters
- The `ParsedTask` type already includes `contactId` and `autoLogInteraction` fields
- Only the UI integration and data pass-through are missing

