

# Fix Quests Tab Missing Glow Effect

## Problem

The Quests tab uses `text-cosmiq-glow` for its active glow, but **`cosmiq-glow` is not defined in `tailwind.config.ts`**. 

While the CSS variable `--cosmiq-glow: 270 80% 65%` exists in `index.css`, Tailwind doesn't know about it, so the utility classes like `text-cosmiq-glow`, `from-cosmiq-glow/20`, etc. don't work.

---

## Fix Required

Add `cosmiq-glow` to the Tailwind config colors section.

| File | Change |
|------|--------|
| `tailwind.config.ts` | Add `'cosmiq-glow': 'hsl(var(--cosmiq-glow))'` to the colors object |

---

## Code Change

In `tailwind.config.ts`, add after line 71 (after `'deep-space': 'hsl(var(--deep-space))'`):

```typescript
'cosmiq-glow': 'hsl(var(--cosmiq-glow))',
```

This will enable these Tailwind utilities to work properly:
- `text-cosmiq-glow` - purple text color
- `bg-cosmiq-glow` - purple background
- `from-cosmiq-glow/20` - gradient start with opacity
- `to-cosmiq-glow/5` - gradient end with opacity

---

## Result

The Quests tab will have its signature purple glow when active:
- Purple icon with drop shadow
- Purple text label
- Purple gradient background on the tab

