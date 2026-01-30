

# Fix Welcome Page Background Cutoff (Take 2)

## Problem Analysis

The background still shows a dark area at the top because of a conflict in the motion properties:

**Current code (lines 63-83):**
```tsx
<motion.div 
  className="fixed -inset-8 -z-10"
  style={{
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    y: backgroundY,           // Scroll-based parallax
    scale: 1.1,
    transformOrigin: 'center center',
  }}
  animate={{
    x: gyroX,
    y: gyroY,                 // ← OVERRIDES style.y!
  }}
```

**The Issue:**
1. The `animate.y` property overrides `style.y` when Framer Motion renders
2. When gyroscope is not permitted, `gyroY = 0`, so the scroll parallax (`backgroundY`) is ignored
3. The `-inset-8` (~32px) may not be enough buffer when scale is 1.1

---

## Solution

Separate the scroll parallax and gyroscope effects to avoid property conflicts:

### Changes to Welcome.tsx

| Issue | Fix |
|-------|-----|
| `animate.y` overrides `style.y` | Remove `y` from animate, use a wrapper div for gyro effects |
| Insufficient buffer | Increase to `-inset-12` for more margin |
| Scale causing edge visibility | Increase scale slightly to 1.15 |

**New structure:**
```tsx
{/* Outer wrapper for gyroscope movement */}
<motion.div
  className="fixed -inset-12 -z-10"
  animate={{
    x: gyroX,
    y: gyroY,
  }}
  transition={{ type: "spring", stiffness: 100, damping: 30 }}
>
  {/* Inner div for scroll parallax */}
  <motion.div
    className="absolute inset-0"
    style={{
      backgroundImage: `url(${backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center center',
      y: backgroundY,
      scale: 1.15,
      transformOrigin: 'center center',
    }}
  />
</motion.div>
```

This separates concerns:
- Outer div handles gyroscope-based movement (x/y translation)
- Inner div handles scroll-based parallax (y transform via useTransform)
- Both effects can work independently without overriding each other

---

## Summary

| File | Change |
|------|--------|
| `src/pages/Welcome.tsx` | Split background into nested motion divs to separate gyro and scroll transforms |

This ensures the scroll parallax works correctly and the gyroscope effect doesn't override it, eliminating the black cutoff at the top.

