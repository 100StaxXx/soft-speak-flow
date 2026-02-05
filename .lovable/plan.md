
# 7-Stat Grid Display Implementation

## Current State

Looking at your screenshot and the code, I found that:

1. **`CompanionAttributes` exists** but is **not being rendered** anywhere in the Companion page
2. The current UI shows a 3-column grid with: **Color | Spirit | Element**
3. The stats section needs to be added to `CompanionDisplay.tsx`

## Proposed Placement

The 7-stat grid will be displayed **below the Color/Spirit/Element badges**, right after the current grid (around line 486 in `CompanionDisplay.tsx`).

## Visual Layout

```text
┌─────────────────────────────────────────────────┐
│           [Companion Image]                     │
│                                                 │
│        🔥 Fire • Egg    🌱 Acquaintance Lvl 1  │
│                                                 │
│         0 / 10 XP to next evolution             │
│         ════════════════════════════            │
│                                                 │
│   Color      │    Spirit    │    Element        │
│   Purple     │     Cat      │     Fire          │
├─────────────────────────────────────────────────┤
│              COMPANION STATS                    │
│  ┌─────────────────┐  ┌─────────────────┐      │
│  │ 💪 Vitality  78 │  │ ⚡ Power     52 │      │
│  │ ████████░░░░░░░ │  │ ██████░░░░░░░░░ │      │
│  ├─────────────────┤  ├─────────────────┤      │
│  │ 📚 Wisdom    65 │  │ 🎯 Discipline 88│      │
│  │ ███████░░░░░░░░ │  │ █████████░░░░░░ │      │
│  ├─────────────────┤  ├─────────────────┤      │
│  │ 🛡️ Resolve   41 │  │ 💜 Connection 55│      │
│  │ █████░░░░░░░░░░ │  │ ██████░░░░░░░░░ │      │
│  ├─────────────────┴──┴─────────────────┤      │
│  │        ✨ Alignment        70        │      │
│  │        ███████░░░░░░░░░░░░          │      │
│  └──────────────────────────────────────┘      │
│            Tap a stat to learn more             │
├─────────────────────────────────────────────────┤
│   ⚠️ "Hello, friend."                          │
│      "We're just getting to know each other."  │
└─────────────────────────────────────────────────┘
```

## Technical Implementation

### Database Changes

Add 7 new columns to `user_companion` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `vitality` | integer | 50 | Life force, health |
| `power` | integer | 30 | Work output, execution |
| `wisdom` | integer | 30 | Learning, understanding |
| `discipline` | integer | 30 | Consistency |
| `resolve` | integer | 30 | Resistance to urges |
| `connection` | integer | 30 | Relational capacity |
| `alignment` | integer | 30 | Purpose, identity |

Migration will convert existing stats:
- `body` → `vitality`
- `mind` → splits to `wisdom` (60%) + `discipline` (40%)
- `soul` → splits to `connection` (40%) + `alignment` (60%)

### File Changes

| File | Action |
|------|--------|
| `src/config/attributeDescriptions.ts` | **Rewrite** - 7 stat definitions |
| `src/components/CompanionAttributes.tsx` | **Rewrite** - 2-column grid UI |
| `src/components/CompanionDisplay.tsx` | **Add** - Import and render CompanionAttributes |
| `src/hooks/useCompanionAttributes.ts` | **Rewrite** - 7 stat mutations + echo gains |
| `src/integrations/supabase/types.ts` | Auto-updated after migration |

### UI Specifications

**2-Column Grid Layout:**
- 6 stats in 3 rows of 2 columns
- 1 stat (Alignment) centered at bottom spanning full width
- Thin progress bars (`h-1.5`)
- Compact padding (`p-2`)
- Tap any stat to see detail modal

**Color Scheme per Stat:**

| Stat | Color Class |
|------|-------------|
| Vitality | `text-red-400` |
| Power | `text-amber-400` |
| Wisdom | `text-blue-400` |
| Discipline | `text-green-400` |
| Resolve | `text-purple-400` |
| Connection | `text-pink-400` |
| Alignment | `text-celestial-blue` |

### Component Props

The new `CompanionAttributes` will accept:

```typescript
interface CompanionAttributesProps {
  companion: {
    vitality?: number;
    power?: number;
    wisdom?: number;
    discipline?: number;
    resolve?: number;
    connection?: number;
    alignment?: number;
  };
}
```

## Phase Order

1. **Database migration** - Add 7 columns with defaults + conversion
2. **Config update** - New attribute descriptions
3. **Hook update** - 7-stat mutations with echo gains
4. **Component rewrite** - New 2-column grid UI
5. **Integration** - Add to CompanionDisplay
