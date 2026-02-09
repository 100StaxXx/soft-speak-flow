

# Add Edit Button to Inbox Tasks (Replace Calendar with Edit + Schedule)

## Problem
Inbox tasks only show a calendar (schedule) button and a delete button. There is no way to edit a task's text or details from the Inbox. The user expects an edit button.

## Solution
Add an edit button (pencil icon) to each inbox task row, alongside the existing schedule and delete buttons. Tapping edit will open the `EditQuestDialog` (same one used on the Quests page).

## Changes

### 1. `src/pages/Inbox.tsx`
- Import `Pencil` from lucide-react
- Import `EditQuestDialog` from `src/features/quests/components/EditQuestDialog`
- Import `useTaskMutations` to get `updateTask` and `deleteTask` with proper save handling
- Add `editingTask` state to track which task is being edited
- Add a pencil/edit button between the calendar and trash buttons for each task
- Clicking edit opens `EditQuestDialog` pre-filled with the task data
- Wire up `onSave` to update the task via `updateTask` mutation and invalidate inbox-tasks cache
- Render the `EditQuestDialog` component at the bottom of the page

### Technical Details

**New state:**
```typescript
const [editingTask, setEditingTask] = useState<DailyTask | null>(null);
```

**New button per task row (between calendar and trash):**
```tsx
<button onClick={() => setEditingTask(task)} aria-label="Edit task">
  <Pencil className="w-4 h-4" />
</button>
```

**EditQuestDialog rendered once, controlled by `editingTask` state:**
```tsx
<EditQuestDialog
  task={editingTask}
  open={!!editingTask}
  onOpenChange={(open) => !open && setEditingTask(null)}
  onSave={handleSaveEdit}
  isSaving={isUpdating}
/>
```

