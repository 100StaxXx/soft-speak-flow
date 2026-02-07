
# Fix Spacing and Blue Focus Ring Issues

## Problems Identified

### 1. Missing Separator Between Quests and Campaigns/Rituals
Looking at `TodaysAgenda.tsx` line 974, the rituals section has only `mt-3` (12px margin-top) which creates insufficient visual separation from the quests list above.

### 2. Blue Focus Ring on Campaign Header
The blue outline appearing around "Money in the Bank" is caused by the `<button>` element wrapping the campaign header (line 999). When tapped on mobile (iOS), the native `:focus-visible` state applies the ring color defined in CSS (`--ring: 270 70% 55%` which is purple, but iOS Safari can render this with a blue tint due to how it handles focus states on touch).

The solution is to remove focus-visible ring styling from this specific button since it's a touch target that opens a drawer, not a keyboard-focusable interactive element.

---

## Visual Change

**Before:**
```text
[ ] Quest 1
[ ] Quest 2
📍 Money in the Bank    0%  0/3  >  ← Blue ring appears
📍 Bulk up a Captain... 1%  0/5  >
```

**After:**
```text
[ ] Quest 1
[ ] Quest 2

────────── CAMPAIGNS ──────────

📍 Money in the Bank    0%  0/3  >  ← No ring
📍 Bulk up a Captain... 1%  0/5  >
```

---

## Changes

| File | Change |
|------|--------|
| `src/components/TodaysAgenda.tsx` | (1) Add visual separator before campaigns section, (2) Remove focus-visible ring from campaign header buttons |

---

## Technical Details

### 1. Add Separator Before Campaigns Section (line 974)

Add more spacing and a subtle visual divider:

**Current:**
```tsx
{ritualTasks.length > 0 && (
  <div className="mt-3 space-y-2">
```

**New:**
```tsx
{ritualTasks.length > 0 && (
  <div className="mt-6 pt-4 border-t border-border/20 space-y-2">
```

This adds:
- `mt-6` (24px) top margin for breathing room
- `pt-4` (16px) top padding inside the container
- `border-t border-border/20` subtle horizontal line separator

### 2. Remove Focus Ring from Campaign Header Button (line 999)

**Current:**
```tsx
<button className="w-full text-left" aria-label={`Open ${group.title} journey path`}>
```

**New:**
```tsx
<button 
  className="w-full text-left focus:outline-none focus-visible:outline-none" 
  aria-label={`Open ${group.title} journey path`}
>
```

This removes the browser's default focus ring that was appearing on touch interactions.

---

## Result

- Clear visual separation between quests (one-time tasks) and campaigns/rituals (recurring habit systems)
- No more unexpected blue focus outlines when tapping campaign headers
- Maintains accessibility (aria-labels still present, keyboard users can still navigate)
