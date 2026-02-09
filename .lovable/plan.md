

# Remove Grey Box Background from Empty State

## Change

**File: `src/components/EmptyState.tsx`**

- Replace the `<Card>` wrapper (line 21) with a plain `<div>` that has no background, no border, and centers content
- Remove the `Card` import (line 3)
- New wrapper class: `flex flex-col items-center justify-center text-center space-y-6 py-20`

| File | Change |
|---|---|
| `src/components/EmptyState.tsx` | Remove `Card` import; replace `<Card className="...">` with `<div className="flex flex-col items-center justify-center text-center space-y-6 py-20">` and closing `</Card>` with `</div>` |

