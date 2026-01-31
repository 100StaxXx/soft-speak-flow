
# Fix Contact Interaction Logging Integration

## Problem Confirmed

The interaction logging system is fully built but **disconnected**:

| Component | Status |
|-----------|--------|
| `useTaskCompletionWithInteraction` hook | Built, but never imported |
| `InteractionLogModal` component | Built, but never rendered |
| `toggleTask` mutation | Returns contact data, but data is ignored |

When you complete a contact-linked task:
- Task gets marked complete
- XP is awarded
- Contact data is fetched and returned
- **Nothing happens with the contact data** - no modal, no interaction logged

## Solution

Wire up the existing components in **Journeys.tsx** (the main task list page):

### Changes Required

| File | Change |
|------|--------|
| `src/pages/Journeys.tsx` | Import hook + modal, integrate with task toggle flow |

### Implementation Details

**1. Add imports:**
```typescript
import { useTaskCompletionWithInteraction } from '@/hooks/useTaskCompletionWithInteraction';
import { InteractionLogModal } from '@/components/tasks/InteractionLogModal';
```

**2. Initialize the hook:**
```typescript
const {
  pendingInteraction,
  isModalOpen,
  handleTaskCompleted,
  logInteraction,
  skipInteraction,
  closeModal,
  isLogging,
} = useTaskCompletionWithInteraction();
```

**3. Update `handleToggleTask` callback:**

When a task is toggled complete and has contact data, call `handleTaskCompleted`:

```typescript
const handleToggleTask = useCallback((...) => {
  toggleTask({ taskId, completed, xpReward }, {
    onSuccess: (result) => {
      // If completed and has a contact, trigger interaction modal
      if (result.completed && result.contact && result.autoLogInteraction) {
        handleTaskCompleted(
          result.taskId,
          result.taskText,
          result.contact,
          result.autoLogInteraction
        );
      }
    }
  });
}, [..., handleTaskCompleted]);
```

**4. Render the modal:**

Add the `InteractionLogModal` near other dialogs at the bottom of the component:

```typescript
<InteractionLogModal
  open={isModalOpen}
  onOpenChange={closeModal}
  contactName={pendingInteraction?.contact?.name ?? ''}
  contactAvatarUrl={pendingInteraction?.contact?.avatar_url}
  taskTitle={pendingInteraction?.taskText ?? ''}
  onLog={async (type, summary) => {
    await logInteraction(type as InteractionType, summary);
  }}
  onSkip={skipInteraction}
/>
```

## Data Flow After Fix

```text
User checks task → toggleTask mutation
                        ↓
              Returns { contact, autoLogInteraction, ... }
                        ↓
              handleTaskCompleted() called
                        ↓
              InteractionLogModal opens
                        ↓
        User picks "Call/Email/Meeting/etc" + summary
                        ↓
              logInteraction() saves to DB
                        ↓
              contact_interactions table updated
                        ↓
              Smart Day Planner knows about the interaction
```

## Summary

This is a **single file change** (Journeys.tsx) that connects existing, working components. The hook, modal, and backend logic are all ready - they just need to be plugged in.
