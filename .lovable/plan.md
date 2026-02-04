
# Fix Resist Mode Not Spawning Astral Encounters

## Problem Summary

When you click "Resist" on a bad habit, no mini-game appears. The button works (no error), but nothing happens visually.

## Root Cause

The **AstralEncounterProvider** is completely disabled in App.tsx:

```tsx
// Line 36 - Import commented out:
// import { AstralEncounterProvider } from "@/components/astral-encounters";

// Line 271 - Component removed from tree:
{/* HIDDEN: AstralEncounterProvider removed - feature disabled */}
```

This provider is responsible for:
1. Rendering the `AstralEncounterModal` (the game UI)
2. Managing the `showEncounterModal` state that controls visibility
3. Coordinating between trigger events and modal display

Without it, when `ResistModePanel` calls `checkEncounterTrigger()`:
- An encounter record gets created in the database ✓
- The hook's local `showEncounterModal` state becomes `true` ✓
- But there's **no modal component rendered anywhere** ✗

## Solution

Re-enable the `AstralEncounterProvider` in App.tsx, wrapping the app content so the modal can render and respond to encounter triggers.

---

## Implementation Steps

### Step 1: Restore Import Statement
Uncomment the import for AstralEncounterProvider at line 36.

### Step 2: Wrap App Content with Provider
Re-add the `<AstralEncounterProvider>` component around the main content at line 271-272, and close it at line 325.

---

## Technical Details

```text
Before (broken):
┌─────────────────────────────────────────┐
│ App.tsx                                 │
│ ┌─────────────────────────────────────┐ │
│ │ RealtimeSyncProvider                │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ <Suspense>                      │ │ │
│ │ │   <Routes>                      │ │ │
│ │ │     /companion → ResistPanel    │ │ │
│ │ │       ↳ calls checkEncounter()  │ │ │
│ │ │       ↳ creates DB record       │ │ │
│ │ │       ↳ sets local modal=true   │ │ │
│ │ │       ↳ NO MODAL RENDERED 💔    │ │ │
│ │ └─────────────────────────────────┘ │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘

After (fixed):
┌─────────────────────────────────────────┐
│ App.tsx                                 │
│ ┌─────────────────────────────────────┐ │
│ │ RealtimeSyncProvider                │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ AstralEncounterProvider ✨      │ │ │
│ │ │ ┌─────────────────────────────┐ │ │ │
│ │ │ │ <Suspense>                  │ │ │ │
│ │ │ │   <Routes>...               │ │ │ │
│ │ │ └─────────────────────────────┘ │ │ │
│ │ │ <AstralEncounterModal /> ← 🎮   │ │ │
│ │ └─────────────────────────────────┘ │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Files to Modify

**`src/App.tsx`**:
1. Line 36: Uncomment import statement
2. Lines 271-272: Add `<AstralEncounterProvider>` opening tag
3. Lines 325-326: Add `</AstralEncounterProvider>` closing tag

### Expected Behavior After Fix
- Click "Resist" on any bad habit
- Trigger overlay animation appears (rift/portal effect)
- Astral Encounter modal opens with one of the four random mini-games:
  - Energy Beam
  - Tap Sequence  
  - Orb Match
  - Galactic Match
- Completing the game updates streak, awards XP, and boosts companion
