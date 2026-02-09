

# Remove Scheduled Time from Advanced Options in Edit Quest

## Change

**File: `src/features/quests/components/EditQuestDialog.tsx`**

The "Scheduled Time" field already appears in the main form (above the advanced section). It is duplicated inside `AdvancedQuestOptions`. Add the `hideScheduledTime` prop to the `AdvancedQuestOptions` component to hide the duplicate.

| File | Change |
|---|---|
| `src/features/quests/components/EditQuestDialog.tsx` (line ~344) | Add `hideScheduledTime` prop to `<AdvancedQuestOptions>` |

