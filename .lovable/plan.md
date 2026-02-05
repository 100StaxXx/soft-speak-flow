

# Restrict Astral Encounters to Resist Mode Only

## Overview

This plan addresses the user's request to ensure astral encounter mini-games **only** trigger from the "Resist" mode in the Companion tab - not from quest completions, ritual completions, or epic check-ins.

The RPG-style companion talk popup already exists (with portrait + speech bubble like Battle Symphony). The focus is on restricting when encounters trigger.

---

## Current Trigger Points

| Source | Current Behavior | Desired Behavior |
|--------|------------------|------------------|
| Quest completion | Triggers encounter after X quests | **No encounter** |
| Ritual completion | Triggers encounter after X rituals | **No encounter** |
| Epic progress checkpoint | Triggers encounter on progress | **No encounter** |
| Morning check-in | Triggers encounter check | **No encounter** |
| **Resist Mode** | Triggers encounter immediately | **Keep as-is** |

---

## Changes Required

### 1. Remove Quest Completion Trigger

**File:** `src/components/astral-encounters/AstralEncounterProvider.tsx`

Remove the event listener for `quest-completed`:

```text
Lines 189-193: DELETE
// Listen for quest-completed events
useEffect(() => {
  window.addEventListener('quest-completed', handleQuestCompleted);
  ...
```

Also remove the `handleQuestCompleted` function (lines 175-177).

---

### 2. Remove Epic Check-In Trigger

**File:** `src/components/astral-encounters/AstralEncounterProvider.tsx`

Remove the event listener for `epic-progress-checkpoint`:

```text
Lines 195-201: DELETE
// Listen for epic check-in events
useEffect(() => {
  const listener = (event: Event) => ...
  window.addEventListener('epic-progress-checkpoint', listener);
  ...
```

Also remove the `handleEpicCheckin` function (lines 180-187).

---

### 3. Keep Resist Mode Trigger (Unchanged)

**File:** `src/components/companion/ResistModePanel.tsx`

This file correctly calls `checkEncounterTrigger('urge_resist', ...)` directly when user presses "Resist" - **no changes needed**.

---

### 4. Clean Up Unused Code

**File:** `src/components/astral-encounters/AstralEncounterProvider.tsx`

After removing quest/epic triggers:
- Remove `handleActivityCompleted` function (no longer needed)
- Remove `checkActivityMilestone` import and usage
- Remove `ActivityType` import
- Remove `EpicCheckinEventDetail` interface

The provider will become simpler - it only renders the modal and handles resist-triggered encounters.

---

### 5. Optional: Keep Activity Counter (for potential future use)

The `useEncounterTrigger` hook and activity counting logic can remain for now (tracking quests completed), as it might be useful for other features. However, it won't trigger encounters.

---

## Summary of File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `src/components/astral-encounters/AstralEncounterProvider.tsx` | Simplify | Remove quest/ritual/epic event listeners and handlers |

---

## Companion Talk Popup Note

The current `CompanionTalkPopup` component already implements an RPG-style dialogue similar to Battle Symphony:
- Portrait on the left (64x64px with glow effect)
- Quote bubble with companion name
- Auto-dismiss progress bar
- Tap anywhere to dismiss

If you want the popup to look more like the pixel-art style in Battle Symphony (with a speech bubble "tail" pointing to the portrait), let me know and I can create a follow-up enhancement.

---

## Expected Behavior After Fix

1. **Quests/Rituals** → Companion talk popup may still appear (based on Living Companion system), but **no astral encounter game**
2. **Epic Check-ins** → Same as above, no encounter game
3. **Resist Mode** → Pressing "Resist" immediately launches the astral encounter mini-game with a random game type

