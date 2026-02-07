

# Add Companion Name to Companion Display

## Summary

Add the companion's unique name below "Stage X" and above the companion image, centered with clean, simple styling.

---

## Current Layout

```text
┌────────────────────────────────────────┐
│  EGG                              ✨   │
│  Stage 0                               │
│                                        │
│         [Companion Image]              │
└────────────────────────────────────────┘
```

---

## Proposed Layout

```text
┌────────────────────────────────────────┐
│  EGG                              ✨   │
│  Stage 0                               │
│               Aerion                   │  ← Centered name, clean styling
│                                        │
│         [Companion Image]              │
└────────────────────────────────────────┘
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/hooks/useCompanion.ts` | Add `cached_creature_name` to the Companion interface |
| `src/components/CompanionDisplay.tsx` | Add centered name display below "Stage X" |

---

## Technical Implementation

### 1. Update Companion Interface

Add `cached_creature_name` to the interface in `useCompanion.ts`:

```typescript
export interface Companion {
  // ... existing fields
  cached_creature_name?: string | null;
}
```

### 2. Add Name Display to CompanionDisplay

Add name resolution using the fallback chain:
1. `cached_creature_name`
2. Capitalized `spirit_animal`
3. Default "Companion"

Insert after the "Stage X" line, centered with simple styling:

```tsx
{/* Companion Name */}
<p className="text-center text-base font-semibold text-primary/90 tracking-wide">
  {companionName}
</p>
```

Styling:
- Centered text
- Semibold weight for subtle emphasis
- Primary color at 90% opacity
- Wide letter spacing for a name-like feel
- No decorations or accents

---

## Visual Result

The companion's name appears cleanly centered below the stage info:

- **EGG** (gradient heading)
- Stage 0 (muted text)
- Aerion (centered, clean, eye-catching)
- [Companion Image]

