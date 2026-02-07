

# Fix Companion Name Display

## Summary

Fix four issues with the companion name: wrong value displayed, not centered, too small, and too much spacing before the image.

---

## Issues Found

| Issue | Current | Fix |
|-------|---------|-----|
| Wrong name | Shows "Blue Whale" (spirit_animal) | Fetch creature_name from evolution cards |
| Not centered | Inside left-aligned flex container | Move name outside flex container, use text-center |
| Too small | `text-base` (16px) | Use `text-xl` (20px) |
| Too much spacing | `mt-2` on name + `py-8` on image | Remove `mt-2`, reduce image padding to `py-4` |

---

## Root Cause: Wrong Name

The `cached_creature_name` column in `user_companion` is `null` for existing users. The fallback chain currently goes to `spirit_animal` ("Blue Whale"), but it should fetch the actual `creature_name` ("Tellus") from `companion_evolution_cards` table.

---

## Solution

### 1. Add creature name fetching to CompanionDisplay

Add a query to fetch the creature name from `companion_evolution_cards` when `cached_creature_name` is null, following the same pattern used in `useTalkPopup.ts`:

```tsx
// Inside CompanionDisplay component
const [creatureName, setCreatureName] = useState<string | null>(null);

useEffect(() => {
  const fetchCreatureName = async () => {
    if (!companion) return;
    
    // Use cached name if available
    if (companion.cached_creature_name) {
      setCreatureName(companion.cached_creature_name);
      return;
    }
    
    // Fetch from evolution cards
    const { data } = await supabase
      .from('companion_evolution_cards')
      .select('creature_name')
      .eq('companion_id', companion.id)
      .eq('evolution_stage', companion.current_stage)
      .maybeSingle();
    
    if (data?.creature_name) {
      setCreatureName(data.creature_name);
      // Cache it for next time
      supabase
        .from('user_companion')
        .update({ cached_creature_name: data.creature_name })
        .eq('id', companion.id);
    } else {
      // Final fallback to capitalized spirit animal
      setCreatureName(
        companion.spirit_animal.charAt(0).toUpperCase() + 
        companion.spirit_animal.slice(1)
      );
    }
  };
  
  fetchCreatureName();
}, [companion?.id, companion?.current_stage, companion?.cached_creature_name]);
```

### 2. Move name outside the flex container and style it

Current structure (lines 349-366):
```tsx
<div className="flex items-center justify-between">
  <div className="flex flex-col gap-1">
    {/* Stage title */}
    {/* Stage number */}
    {/* Name - WRONG LOCATION */}
  </div>
  <div><!-- Sparkle icon --></div>
</div>
```

New structure:
```tsx
<div className="flex items-center justify-between">
  <div className="flex flex-col gap-1">
    {/* Stage title */}
    {/* Stage number */}
  </div>
  <div><!-- Sparkle icon --></div>
</div>

{/* Companion Name - CENTERED BELOW */}
<p className="text-center text-xl font-semibold text-primary/90 tracking-wide">
  {creatureName || 'Companion'}
</p>
```

### 3. Reduce spacing before image

Change the image container padding from `py-8` to `py-4`:
```tsx
// Line 373
<div className="flex justify-center py-4 relative group" ...>
```

---

## Visual Result

```text
┌────────────────────────────────────────┐
│  EGG                              ✨   │
│  Stage 0                               │
│                                        │
│               Tellus                   │  ← Centered, bigger, correct name
│                                        │
│         [Companion Image]              │  ← Less spacing above
└────────────────────────────────────────┘
```

---

## Files to Change

| File | Changes |
|------|---------|
| `src/components/CompanionDisplay.tsx` | Add creature name fetch, move/restyle name element, reduce image padding |

