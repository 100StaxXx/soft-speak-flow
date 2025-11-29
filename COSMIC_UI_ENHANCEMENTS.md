# 🌌 Cosmiq - Cosmic UI Enhancements

This document outlines the new cosmic UI features added to enhance the visual experience without breaking existing functionality.

## ✨ New Components

### 1. **CosmicButton**
Interactive button with particle burst effects on click.

**Usage:**
```tsx
import { CosmicButton } from "@/components/CosmicButton";

<CosmicButton variant="glow" onClick={handleClick}>
  Launch Quest
</CosmicButton>
```

**Variants:**
- `default` - Basic cosmic button with shimmer
- `glow` - Animated gradient border that glows on hover
- `glass` - Glass-morphism style

**Features:**
- ✨ Particle burst animation on click (6 particles radiate from click point)
- 🎯 Respects accessibility (reduced motion)
- 💫 Smooth scale animation on press

---

### 2. **CosmicCard (Enhanced)**
Glass-morphism card with optional animated border.

**Usage:**
```tsx
import { CosmicCard } from "@/components/CosmicCard";

// Standard card
<CosmicCard glowColor="purple" intensity="medium">
  <h3>Quest Title</h3>
  <p>Quest description...</p>
</CosmicCard>

// Animated border variant
<CosmicCard animated glowColor="gold">
  <h3>Premium Feature</h3>
</CosmicCard>
```

**Props:**
- `glowColor`: "purple" | "pink" | "blue" | "gold"
- `intensity`: "subtle" | "medium" | "strong"
- `animated`: boolean - enables rotating gradient border

**Features:**
- 🌟 Constellation pattern overlay
- 💎 Glass-morphism backdrop blur
- 🌈 Animated conic gradient border (when `animated={true}`)
- ⚡ Hover scale effect

---

### 3. **ScrollStars**
Ambient star particles that appear when scrolling.

**Usage:**
```tsx
import { ScrollStars } from "@/components/ScrollStars";

// Add to your layout/App component
<div>
  <ScrollStars />
  {/* Your content */}
</div>
```

**Features:**
- 🌠 Stars drift upward during scrolling
- 📊 Velocity-based - only appears on significant scroll
- 🎯 Non-intrusive (pointer-events: none)
- 🔄 Auto-cleanup after animation

---

### 4. **CosmicTransition**
Animated page/component transitions with cosmic effects.

**Usage:**
```tsx
import { CosmicTransition } from "@/components/CosmicTransition";
import { useState } from "react";

function MyComponent() {
  const [show, setShow] = useState(true);
  
  return (
    <CosmicTransition show={show} mode="warp">
      <div>Your content here</div>
    </CosmicTransition>
  );
}
```

**Modes:**
- `warp` - Scale blur effect (400ms)
- `constellation` - Fade with subtle blur (500ms)

**Features:**
- 🚀 Smooth enter/exit animations
- 🔄 Proper unmounting after exit
- 🎬 Perfect for route transitions

---

## 🎨 New CSS Utility Classes

### Animations

```css
/* Star twinkling */
.animate-twinkle

/* Orbital motion (20s loop) */
.animate-orbit

/* Supernova burst (for completions) */
.animate-supernova

/* Warp effect */
.animate-warp

/* Cosmic pulsing glow */
.animate-cosmic-pulse

/* Particle burst (with CSS variables) */
.animate-particle-burst

/* Drift up (for scroll particles) */
.animate-drift-up

/* Constellation transitions */
.animate-constellation-fade-in
.animate-constellation-fade-out
```

### Interactive Classes

```css
/* Animated gradient border on hover */
.cosmic-hover

/* Enhanced card with spinning border */
.cosmic-card-enhanced

/* Star shimmer loading effect */
.star-shimmer
```

---

## 🪝 New Hooks

### **useCosmicHover**
Track hover state with distance-based glow intensity.

**Usage:**
```tsx
import { useCosmicHover } from "@/hooks/useCosmicHover";
import { useRef } from "react";

function MyCard() {
  const cardRef = useRef<HTMLDivElement>(null);
  const { isHovered, glowIntensity, cosmicHoverProps } = useCosmicHover(cardRef);
  
  return (
    <div 
      ref={cardRef}
      {...cosmicHoverProps}
      style={{
        boxShadow: isHovered 
          ? `0 0 ${glowIntensity * 40}px rgba(167, 108, 255, ${glowIntensity * 0.6})`
          : 'none'
      }}
    >
      Hover me!
    </div>
  );
}
```

**Returns:**
- `isHovered`: boolean
- `glowIntensity`: number (0-1) - stronger near edges
- `cosmicHoverProps`: Mouse event handlers

---

## 🎯 Usage Examples

### Quest Completion with Supernova Effect

```tsx
function QuestCard({ quest, onComplete }) {
  const [isCompleting, setIsCompleting] = useState(false);
  
  const handleComplete = () => {
    setIsCompleting(true);
    setTimeout(() => {
      onComplete(quest.id);
    }, 600);
  };
  
  return (
    <CosmicCard 
      animated 
      className={isCompleting ? "animate-supernova" : ""}
    >
      <h3>{quest.title}</h3>
      <CosmicButton variant="glow" onClick={handleComplete}>
        Complete Quest
      </CosmicButton>
    </CosmicCard>
  );
}
```

### Page Transition

```tsx
function PageTransition({ children, location }) {
  return (
    <CosmicTransition 
      show={true} 
      mode="warp"
      key={location.pathname}
    >
      {children}
    </CosmicTransition>
  );
}
```

### Ambient Cosmic Experience

```tsx
function App() {
  return (
    <div className="min-h-screen relative">
      <StarfieldBackground />
      <ScrollStars />
      
      <main className="relative z-10">
        {/* Your app content */}
      </main>
    </div>
  );
}
```

---

## 🎨 Color Palette

All cosmic colors are available as CSS variables:

```css
--nebula-pink: 330 70% 55%
--celestial-blue: 210 80% 50%
--stardust-gold: 45 100% 65%
--deep-space: 240 15% 8%
--cosmic-glow: 270 80% 65%
```

**Usage in Tailwind:**
```tsx
<div className="bg-[hsl(var(--nebula-pink))]">
  Pink nebula background
</div>

<div className="text-[hsl(var(--stardust-gold))]">
  Golden stardust text
</div>
```

---

## ⚡ Performance Notes

- All animations respect `prefers-reduced-motion`
- ScrollStars has velocity threshold to prevent over-rendering
- Particle effects auto-cleanup to prevent memory leaks
- Glass-morphism uses optimized backdrop-filter
- Animated borders use CSS transforms (GPU-accelerated)

---

## 🚀 Quick Integration Checklist

1. ✅ StarfieldBackground - Already implemented
2. ✅ CosmicCard - Already implemented with new `animated` prop
3. ✅ CosmicButton - Ready to use for CTAs
4. ✅ ScrollStars - Add to layout for ambient effect
5. ✅ CosmicTransition - Use for route/modal transitions
6. ✅ CSS animations - Available globally
7. ✅ useCosmicHover - For custom interactive elements

---

## 🔮 Future Enhancements (Optional)

- **Constellation Lines**: Draw connecting lines between stars
- **Aurora Borealis**: Animated wave gradients in background
- **Meteor Showers**: Periodic burst of shooting stars
- **Planet Orbits**: Floating celestial bodies
- **Cosmic Dust**: Tiny particles in parallax layers

---

**Note:** All enhancements are non-breaking and can be adopted incrementally. Existing components will work exactly as before.
