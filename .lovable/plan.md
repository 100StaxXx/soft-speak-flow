
# Enhanced Loading Feedback for Companion Creation

## Overview

Add a dedicated loading screen with animated progress phases and messaging that sets expectations during companion creation. This is a **display-only change** - no modifications to the actual generation logic.

## Current Experience

```text
┌─────────────────────────────────────────┐
│   Button: [⟳ Creating your companion...]│
│                                         │
│   "Please wait while we create..."      │
│   "This may take up to 30 seconds"      │
└─────────────────────────────────────────┘
```

**Problem**: Minimal feedback during a 15-60+ second wait feels like the app is frozen.

## Proposed Experience

When `isLoading=true`, replace the form with a full-screen loading experience:

```text
┌─────────────────────────────────────────┐
│           ✨                            │
│     [Cosmic Pulse Animation]            │
│                                         │
│   "Weaving magical essence..."          │
│   ━━━━━━━━━━━━━━━━━━━━○ 60%            │
│                                         │
│   "Your companion is being brought      │
│    to life. This takes 20-40 seconds."  │
│                                         │
│   💡 Tip: Each companion is unique!     │
└─────────────────────────────────────────┘
```

## What Changes

| File | Change |
|------|--------|
| `src/components/CompanionPersonalization.tsx` | Show `CompanionCreationLoader` when `isLoading=true` |
| New: `src/components/CompanionCreationLoader.tsx` | Full-screen loading component with phases and tips |

## Component: CompanionCreationLoader

Features:
- Reuses the `PageLoader` cosmic pulse animation
- Cycles through encouraging messages every 4 seconds
- Shows a simulated progress bar (not tied to actual progress, just visual comfort)
- Displays helpful tips to keep users engaged
- Sets expectation: "This takes 20-40 seconds"

Messages cycle:
1. "Preparing the summoning ritual..."
2. "Weaving magical essence..."
3. "Shaping elemental energy..."
4. "Your companion is taking form..."
5. "Adding final touches..."
6. "Almost there..."

Tips cycle:
- "Each companion is uniquely generated just for you"
- "Your choices shape their appearance and personality"
- "They'll grow and evolve as you complete quests"

## Implementation

**CompanionCreationLoader.tsx**
```tsx
// Full-screen loading with cosmic animation
// Cycles through phases every 4 seconds
// Shows progress bar (visual only, advances over ~40s)
// Displays rotating tips
```

**CompanionPersonalization.tsx change**
```tsx
if (isLoading) {
  return <CompanionCreationLoader />;
}
// ... rest of form
```

## Why This Approach

- **Zero logic changes**: No touching the edge function, polling, or retries
- **Minimal disruption**: Single new component + one conditional render
- **Sets expectations**: Users know it takes time upfront
- **Keeps users engaged**: Rotating messages prevent "frozen app" feeling
- **Reuses existing patterns**: Uses `PageLoader` animation style

## Result

Users see an engaging, animated loading experience that explains what's happening and sets the expectation that companion creation takes 20-40 seconds. No actual speed changes, just better UX.
