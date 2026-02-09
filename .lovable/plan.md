

# Make Inbox Empty State More Slick

## Changes

### File: `src/components/EmptyState.tsx`

Remove the `Card` wrapper and its grey box background. Replace it with a plain centered `div` so the content floats cleanly on the page background. Also vertically center the content in the available space.

- Replace `<Card className="p-12 text-center space-y-6 bg-gradient-to-br ...">` with a simple `<div className="flex flex-col items-center justify-center text-center space-y-6 py-20">`
- Remove the `Card` import
- Keep the icon circle, title, description, and button centered as-is

| File | Change |
|---|---|
| `src/components/EmptyState.tsx` | Replace `Card` wrapper with a borderless, background-free centered `div`; remove Card import |

