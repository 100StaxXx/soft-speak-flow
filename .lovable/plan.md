

# Fix Welcome Page Background Cutoff

## Problem Identified

The Welcome page background shows a large black area at the top because of the parallax effect configuration:

**Current Code (Welcome.tsx lines 63-71):**
```tsx
<motion.div 
  className="fixed -inset-4 -z-10"
  style={{
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center top',
    y: backgroundY,
    scale: 1.2,
    transformOrigin: 'center top',  // ← Problem here
  }}
```

**Why This Causes the Cutoff:**
1. `scale: 1.2` enlarges the background by 20%
2. `transformOrigin: 'center top'` means the top edge stays fixed while the image expands downward
3. The beautiful nebula clouds in the background image are positioned toward the top
4. When scaled from top, the visible area shifts down, revealing black space above

---

## Solution

Change the transform origin so the background scales from the center, keeping the image balanced and preventing top cutoff.

### Changes to Welcome.tsx

**Before:**
```tsx
style={{
  backgroundImage: `url(${backgroundImage})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center top',
  y: backgroundY,
  scale: 1.2,
  transformOrigin: 'center top',
}}
```

**After:**
```tsx
style={{
  backgroundImage: `url(${backgroundImage})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center center',
  y: backgroundY,
  scale: 1.1,
  transformOrigin: 'center center',
}}
```

---

## Technical Details

| Property | Before | After | Reason |
|----------|--------|-------|--------|
| `backgroundPosition` | `center top` | `center center` | Centers the nebula/clouds in viewport |
| `scale` | `1.2` | `1.1` | Slightly less scaling = less overflow needed |
| `transformOrigin` | `center top` | `center center` | Scales equally in all directions |
| `className` | `-inset-4` | `-inset-8` | More overflow buffer for parallax movement |

### Also Apply to Auth.tsx

The Auth page (lines 721-730) has similar styling that should be updated for consistency:

```tsx
<motion.div 
  className="fixed inset-0 -z-10"
  style={{
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',  // Already centered
    y: backgroundY,
    scale: 1.1,
  }}
/>
```

---

## Summary

| File | Change |
|------|--------|
| `src/pages/Welcome.tsx` | Update background positioning and scale origin |

This fix ensures the cosmic nebula background displays fully without any black cutoff at the top, while preserving the subtle parallax effect.

