

# Fix Difficulty Labels and Remove Duplicate Close Button

## Two Changes

### 1. Rename Difficulty Labels (AddQuestSheet.tsx)
- "Chill" -> "Easy"
- "Steady" -> "Medium"  
- "Beast" -> "Hard"

### 2. Remove Duplicate X Button
The Sheet component (`sheet.tsx`) has a **built-in close button** (X) that always renders in the top-right corner. The AddQuestSheet also adds its **own custom X button** on both Step 1 and Step 2 headers, resulting in two X icons stacked in the top-right.

**Fix:** Remove the built-in close button from `SheetContent` in `sheet.tsx` by deleting the `SheetPrimitive.Close` element. This preserves the custom-styled close buttons already in `AddQuestSheet` and avoids affecting other sheets that also have their own close buttons.

### Technical Details

| File | Change |
|---|---|
| `src/components/AddQuestSheet.tsx` (lines 320-322) | Rename labels: "Chill" to "Easy", "Steady" to "Medium", "Beast" to "Hard" |
| `src/components/ui/sheet.tsx` (lines 60-63) | Remove the built-in `SheetPrimitive.Close` element from `SheetContent` |

