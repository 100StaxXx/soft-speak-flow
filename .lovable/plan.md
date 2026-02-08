
# Fix Calendar Icon Bug in Edit Quest Details

## Problem Found

The "Edit Quest Details" form is accidentally rendering a **full Calendar component** instead of a **calendar icon**. This is a simple naming conflict bug.

---

## Root Cause

In `TaskAdvancedEditSheet.tsx`:

| Line | Import | What it actually is |
|------|--------|---------------------|
| 14 | `Calendar as CalendarIcon` | The lucide-react calendar **icon** |
| 29 | `Calendar` | The full Shadcn **calendar picker component** |
| 190 | `<Calendar className="w-3.5 h-3.5" />` | ❌ Uses the full component, not the icon! |

The code on line 190 uses `Calendar` (the full picker) when it should use `CalendarIcon` (the small icon).

---

## The Fix

**File: `src/features/tasks/components/TaskAdvancedEditSheet.tsx`**

Change line 190 from:
```tsx
<Calendar className="w-3.5 h-3.5 text-celestial-blue" />
```

To:
```tsx
<CalendarIcon className="w-3.5 h-3.5 text-celestial-blue" />
```

That's it! One character change: `Calendar` → `CalendarIcon`

---

## Why This Happened

The file imports both:
- A calendar **icon** (aliased to `CalendarIcon`)
- A calendar **component** (named `Calendar`)

Someone typed `Calendar` instead of `CalendarIcon` when adding the icon next to the "Date" label.

---

## Result After Fix

```text
Before (broken):                    After (fixed):
┌─────────────────────┐            ┌─────────────────────┐
│  📅📅📅📅📅📅📅📅   │            │  📅 Date            │
│  Date               │     →      │  [Feb 8, 2026    ▼] │
│  [Feb 8, 2026    ▼] │            │                     │
│  [OVERLAPPING UI]   │            │  📋 Duration        │
└─────────────────────┘            └─────────────────────┘
```

The inline calendar picker will disappear and be replaced with a small calendar icon next to the "Date" label.
