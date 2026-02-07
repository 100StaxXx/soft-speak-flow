

# Adjust Companion Name Styling

## Summary

Make the companion name bigger and reduce the spacing above and below it.

---

## Current vs Proposed

| Element | Current | Proposed |
|---------|---------|----------|
| Name size | `text-xl` (20px) | `text-2xl` (24px) |
| Space above name | Default gap after flex container | Add `-mt-1` to pull it up |
| Space below name (image padding) | `py-4` | `py-2` |

---

## Changes

**File: `src/components/CompanionDisplay.tsx`**

1. **Line 407** - Make name bigger and reduce top margin:
```tsx
// From:
<p className="text-center text-xl font-semibold text-primary/90 tracking-wide">

// To:
<p className="text-center text-2xl font-semibold text-primary/90 tracking-wide -mt-1">
```

2. **Line 412** - Reduce image container padding:
```tsx
// From:
<div className="flex justify-center py-4 relative group" ...>

// To:
<div className="flex justify-center py-2 relative group" ...>
```

---

## Visual Result

```text
┌────────────────────────────────────────┐
│  EGG                              ✨   │
│  Stage 0                               │
│               Tellus                   │  ← Bigger text, tighter spacing
│         [Companion Image]              │  ← Less gap above
└────────────────────────────────────────┘
```

