
# Add Photo(s) to Edit Quest Details Menu

## Overview

Add the ability to attach photos to quests from the "Edit Quest Details" drawer (TaskAdvancedEditSheet). This will use the existing `QuestImagePicker` and `QuestImageThumbnail` components that are already implemented in the codebase.

## Current State

The `EditQuestDialog` (the full quest editor sheet) already supports photos, but the simpler `TaskAdvancedEditSheet` (the quick edit drawer shown in your screenshot) does not have this feature yet.

The `ParsedTask` interface already has an `imageUrl` field, so we just need to add the UI controls.

## Changes

### File: `src/features/tasks/components/TaskAdvancedEditSheet.tsx`

| Change | Description |
|--------|-------------|
| Import image components | Add `QuestImagePicker`, `QuestImageThumbnail`, `useQuestImagePicker` |
| Add Camera icon | Import from lucide-react |
| Add imageUrl state | Track the photo URL |
| Add Photo section UI | Add section with picker and thumbnail display |
| Update handleSave | Include imageUrl in saved data |
| Handle image removal | Delete from storage when removed |

**New Photo Section (between Notes and Contact Link):**
```
┌───────────────────────────────────────┐
│ 📷 Photo                              │
│                                       │
│ [Current Photo]  [+ Add Photo]        │
│                                       │
└───────────────────────────────────────┘
```

## Implementation Details

1. **State Management**
   - Add `imageUrl` state initialized from `parsed.imageUrl`
   - Track image changes during editing

2. **UI Components**
   - Show current photo thumbnail if one exists (with remove option)
   - Show "Add Photo" button to add/replace photo
   - Use existing `QuestImagePicker` for native camera/gallery access

3. **Save Flow**
   - Include `imageUrl` in the updated `ParsedTask` when saving
   - Handle image removal (delete from storage)

## Files to Modify

| File | Changes |
|------|---------|
| `src/features/tasks/components/TaskAdvancedEditSheet.tsx` | Add photo upload/display section |

## Result

Users will be able to:
- Add a photo to any quest from the quick edit drawer
- View the current photo as a thumbnail
- Remove the photo if needed
- The photo will be saved with the quest and visible elsewhere in the app
