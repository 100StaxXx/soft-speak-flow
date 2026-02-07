

# Fix Missing Quests Tab in Bottom Navigation

## Problem

The Quests tab was accidentally removed during the previous edit. Currently the BottomNav only has 2 tabs:
1. Mentor (line 61-90)
2. Companion (line 93-118)

**The Quests tab is completely missing!**

---

## Fix Required

Add the Quests NavLink between Mentor and Companion tabs.

| File | Change |
|------|--------|
| `src/components/BottomNav.tsx` | Add Quests NavLink between Mentor (line 90) and Companion (line 93) |

---

## Code to Add (after line 90, before Companion)

```tsx
<NavLink
  to="/journeys"
  className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 active:scale-95 touch-manipulation min-w-[56px] min-h-[56px]"
  activeClassName="bg-gradient-to-br from-cosmiq-glow/20 to-cosmiq-glow/5 shadow-soft"
  data-tour="quests-tab"
  onClick={() => haptics.light()}
  onMouseEnter={() => handlePrefetch('journeys')}
  onFocus={() => handlePrefetch('journeys')}
>
  {({ isActive }) => (
    <>
      <Compass className={`h-6 w-6 transition-all duration-300 ${isActive ? 'text-cosmiq-glow drop-shadow-[0_0_8px_hsl(270,70%,55%)]' : 'text-muted-foreground'}`} />
      <span className={`text-[9px] font-bold uppercase tracking-wider transition-all duration-300 ${isActive ? 'text-cosmiq-glow' : 'text-muted-foreground/80'}`}>
        Quests
      </span>
    </>
  )}
</NavLink>
```

---

## Result After Fix

```text
┌─────────────────────────────────────────────────────────────────┐
│     [Mentor]           [Quests]           [Companion]           │
│        🧔                 🧭                  🐾                │
└─────────────────────────────────────────────────────────────────┘
```

The `Compass` icon is already imported (line 2) but not being used - it was intended for the Quests tab.

