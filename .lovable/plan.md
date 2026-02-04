
# Fix Ritual Creation - Form Fields & Database Error

## Problem Summary

You're experiencing two issues:

1. **Limited Form Fields** - When adding a new ritual, you only see a "Why" input and difficulty selector, missing options like frequency/days and scheduling
2. **"Failed to add ritual" Error** - The creation fails because the code tries to insert data into a column that doesn't exist

## Root Cause

**For the error:** The code incorrectly tries to save `epic_id` directly to the habits table, but that column doesn't exist. The app uses a separate linking table to connect rituals to campaigns.

**For limited fields:** The quick-add form is a simplified version - by design it only captures the essentials. However, we can enhance it to include the frequency picker at minimum.

---

## Fix Plan

### Step 1: Fix the Database Insert
Remove the non-existent column from the insert operation so the ritual saves successfully.

**File:** `src/components/EpicCheckInDrawer.tsx`

### Step 2: Enhance the Quick-Add Form
Add the frequency/day picker so you can specify which days the ritual should appear.

**File:** `src/components/EpicCheckInDrawer.tsx`

---

## Technical Details

```text
Current broken insert:
┌─────────────────────────┐
│ habits table            │
│ - epic_id: ??? ← ERROR  │
│ - title, difficulty...  │
└─────────────────────────┘

Fixed approach:
┌─────────────────────────┐    ┌──────────────────┐
│ habits table            │───>│ epic_habits      │
│ - title, difficulty...  │    │ - habit_id       │
│                         │    │ - epic_id        │
└─────────────────────────┘    └──────────────────┘
```

### Changes Required:

1. **Remove `epic_id` from insert** - The habits table uses a junction table (`epic_habits`) for campaign linkage, which the code already handles correctly in the second step

2. **Add frequency state & picker** - Include:
   - New state: `newRitualDays` for tracking selected days
   - `FrequencyPicker` component below the difficulty selector
   - Pass `custom_days` and `frequency` to the insert

### Expected Result:
- Rituals will save successfully
- You can specify which days each ritual should appear
- Rituals will properly link to your campaign
