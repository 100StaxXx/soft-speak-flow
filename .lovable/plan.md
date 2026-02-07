

# Merge Profile into Companion Page - Navigation Simplification

## Summary

Transform the navigation from **4 tabs to 3 tabs** by:
1. **Removing** the "Command" tab from the bottom nav
2. **Moving Companion to the right** position (where Command currently is)
3. **Keeping Quests centered** and **Mentor on the left**
4. **Replacing the "ⓘ" info icon** on Companion page with a **⚙️ settings gear** that navigates to the Command Center (Profile page)

This keeps the Command Center **fully intact** as its own page - it's just accessed via a gear icon instead of a nav tab.

---

## Visual Change

**Before (4 tabs):**
```text
┌─────────────────────────────────────────────────────────────────┐
│  [Mentor]    [Companion]    [Quests]    [Command]               │
│     🧔          🐾            🧭           ⌘                    │
└─────────────────────────────────────────────────────────────────┘
```

**After (3 tabs):**
```text
┌─────────────────────────────────────────────────────────────────┐
│     [Mentor]           [Quests]           [Companion]           │
│        🧔                 🧭                  🐾                │
└─────────────────────────────────────────────────────────────────┘
```

**Companion Page Header Change:**
```text
Before:  "Companion"                                    [ⓘ]
After:   "Companion"                                    [⚙️]
                                                        ↓
                                            Navigates to /profile
```

---

## Changes Overview

| File | Change |
|------|--------|
| `src/components/BottomNav.tsx` | Remove Command tab, reorder tabs (Mentor → Quests → Companion), update prefetch map |
| `src/pages/Companion.tsx` | Replace PageInfoButton with Settings button that navigates to /profile, remove PageInfoModal |

---

## Technical Details

### 1. Update BottomNav.tsx

**Remove the Command tab entirely and reorder:**

```tsx
// Current order: Mentor → Companion → Quests → Command
// New order: Mentor → Quests → Companion

// Update prefetch map - remove profile, keep the rest
const prefetchMap: Record<string, () => Promise<unknown>> = {
  mentor: () => import('@/pages/Mentor'),
  journeys: () => import('@/pages/Journeys'),
  companion: () => import('@/pages/Companion'),
};

// Nav items in new order:
// 1. Mentor (left) - unchanged
// 2. Quests (center) - move up from position 3
// 3. Companion (right) - move from position 2, gets gold glow treatment
```

The tabs will render in this order:
1. **Mentor** (left) - unchanged styling (orange theme)
2. **Quests** (center) - unchanged styling (purple theme)  
3. **Companion** (right) - unchanged styling (gold theme)

### 2. Update Companion.tsx Header

**Replace the info button with a settings gear:**

```tsx
// Current:
import { PageInfoButton } from "@/components/PageInfoButton";
<PageInfoButton onClick={() => setShowPageInfo(true)} />

// New:
import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();

// In header:
<Button
  variant="ghost"
  size="icon"
  onClick={() => navigate('/profile')}
  className="h-8 w-8 rounded-full bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
  aria-label="Settings"
>
  <Settings className="h-4 w-4" />
</Button>
```

**Remove these (no longer needed):**
- `PageInfoModal` import and component
- `showPageInfo` state
- The `PageInfoModal` at bottom of component

---

## What Stays the Same

| Element | Status |
|---------|--------|
| `/profile` route | Unchanged - still accessible at /profile |
| Profile page content | Unchanged - all tabs, settings, sign out work as before |
| Companion page functionality | Unchanged - all tabs (Overview, Focus, Stories, Postcards, Collection) work |
| Companion tutorial modal | Unchanged - still shows for first-time users |
| App initial redirect | Unchanged - still redirects to /journeys on first load |

---

## User Flow After Change

1. **User opens app** → Lands on Quests (center tab) 
2. **User taps Companion** → Sees companion with ⚙️ gear in header
3. **User taps ⚙️** → Navigates to Command Center (full Profile page)
4. **User navigates back** → Returns to Companion

This is exactly like Instagram/TikTok where profile settings are behind a gear icon, not a main tab.

---

## Route Considerations

The `/profile` route remains valid and accessible:
- Via the gear icon on Companion page
- Via direct URL
- Via any existing navigation in the app (e.g., from Help Center deep links)

The Profile page's "hidden dev trigger" (long-press header → IAP test) also remains functional.

