# Card & Battle System Inspection Summary

**Date:** 2025-11-25  
**Inspected By:** AI Code Analysis  
**Status:** ✅ Complete - Critical Bugs Found

---

## 📋 Executive Summary

I've completed a thorough inspection of the card and future card game system. The analysis includes:
- ✅ Card generation formulas and stat calculations
- ✅ Energy cost systems
- ✅ Bond level mechanics
- ✅ Rarity tiers and progression
- ✅ Battle system tables and UI components
- ✅ Test generator for validating formulas

**Result:** Found **2 critical bugs** that will break the system, plus **6 design issues** that reduce gameplay quality.

---

## 🎯 Quick Stats

### Card Generation Formula (Current)
```
Base Stat = 20 + (stage × 8)
Final Stat = Base + (avgUserAttribute × 0.15)
Energy Cost = stage ≤ 9 ? 1 : stage ≤ 14 ? 2 : 3
Bond Level = min(100, floor(10 + (totalAttrs/3) + (stage × 2)))
```

### Stat Ranges (Sample)
| Stage | User (10/10/10) | User (100/100/100) | Energy | Bond |
|-------|-----------------|---------------------|--------|------|
| 0     | 21/21/21        | 35/35/35            | 1      | 20-100 |
| 5     | 61/61/61        | 75/75/75            | 1      | 30-100 |
| 10    | 101/101/101     | 115/115/115         | 2      | 40-100 |
| 15    | 141/141/141     | 155/155/155         | 3      | 50-100 |
| 20    | 181/181/181     | 195/195/195         | 3      | 60-100 |

**Total Power:** 63 (Stage 0, beginner) to 585 (Stage 20, maxed user)

---

## 🚨 Critical Bugs (Must Fix Immediately)

### Bug #1: Stats Schema Mismatch ⚠️ CRITICAL

**Files Affected:**
- `supabase/migrations/20251119035143_*.sql`
- `supabase/functions/generate-evolution-card/index.ts`

**Problem:**
Database expects: `{"strength", "agility", "vitality", "intellect", "spirit", "affinity"}`  
Function generates: `{"mind", "body", "soul"}`

**Impact:** Cards cannot be properly stored or retrieved. System is broken.

**Fix:**
Update the migration to match the code:
```sql
stats jsonb NOT NULL DEFAULT '{"mind": 0, "body": 0, "soul": 0}'::jsonb,
```

---

### Bug #2: Energy Cost Mismatch ⚠️ HIGH

**Files Affected:**
- `src/components/BattleCardSelector.tsx` (lines 22-28, 47)
- `supabase/functions/generate-evolution-card/index.ts` (line 80)

**Problem:**
BattleCardSelector uses hardcoded map for stages 0, 5, 10, 15, 20 only.  
All other stages default to 1 energy incorrectly.

**Comparison:**
```
Stage 5:  Generated=1, Displayed=2  ❌ Wrong by +1
Stage 10: Generated=2, Displayed=3  ❌ Wrong by +1
Stage 15: Generated=3, Displayed=4  ❌ Wrong by +1
Stage 20: Generated=3, Displayed=5  ❌ Wrong by +2
```

**Fix:**
Use the database value instead of hardcoded map:
```typescript
const energyCost = card.energy_cost || 1;
```

---

## ⚠️ Design Issues (Should Fix)

### Issue #3: No Stat Specialization
All cards have identical mind/body/soul values. No strategic diversity.

**Recommendation:** Use individual user attributes, not average:
```typescript
stats: {
  mind: baseStatValue + (userAttributes.mind × 0.20) + (avgAttribute × 0.05),
  body: baseStatValue + (userAttributes.body × 0.20) + (avgAttribute × 0.05),
  soul: baseStatValue + (userAttributes.soul × 0.20) + (avgAttribute × 0.05),
}
```

### Issue #4: Bond Level Caps Too Early
Reaches 100 at stage 10 with good attributes. No progression for stages 11-20.

**Recommendation:** Use higher cap (200) or percentage-based system.

### Issue #5: Energy Cost Too Simple
Only 3 tiers (1, 2, 3) across 21 stages. Stage 0 same cost as Stage 9 despite 4x power difference.

**Recommendation:** Use 5-tier system or milestone-based: `Math.floor(stage / 5) + 1`

### Issue #6: Element & Species Are Cosmetic
No mechanical impact on gameplay.

**Recommendation:** Add element-based stat modifiers (fire = +10% body, etc.)

### Issue #7: Rarity Doesn't Affect Stats
Purely cosmetic tier based on stage.

**Recommendation:** Epic+ cards get bonus stats (Origin = +20% stats)

### Issue #8: Limited Card Collection
Only 5 cards per companion (stages 0, 5, 10, 15, 20).

**Recommendation:** Generate cards every 2-3 stages or add variants.

---

## ✅ What's Working Well

1. **Stage Name Mapping** - Clean 21-stage progression (Egg → Ultimate)
2. **Rarity Progression** - Logical tier system (Common → Origin)
3. **Card ID Generation** - Unique, structured identifiers
4. **Base Stat Formula** - Linear, balanced progression
5. **AI Content System** - Name/trait/story generation looks solid
6. **Battle Tables** - Well-structured database schema for 3-player matches
7. **UI Components** - Card display, flip animations, selection all work

---

## 🎮 Battle System Status

### Implemented ✅
- Database tables (matches, participants, rounds, rankings)
- Frontend UI (matchmaking, history, leaderboard)
- Card selection interface
- 3-player match structure
- XP and ranking systems

### Not Implemented ❌
- Battle mechanics (combat logic)
- Card play system
- Damage calculation
- Turn resolution
- Winner determination
- Matchmaking algorithm

**Note:** Battle system has UI/tables but no actual combat logic yet.

---

## 🛠️ Test Generator Tool

**Created:** `/workspace/test-card-generator.ts`

**Usage:**
```bash
cd /workspace
npx tsx test-card-generator.ts
```

**Output:**
- 5 sample cards per stage (0, 5, 10, 15, 20)
- Varying user attributes (low to max)
- Displays: mind/body/soul, energy cost, bond level, total power
- Formatted tables for easy visual inspection

**Purpose:** Sanity-check stat ranges after formula changes.

---

## 📊 Formula Analysis

### Current Formula Strengths:
- ✅ Linear, predictable progression
- ✅ Stage is primary factor (good)
- ✅ User attributes provide small bonus (balanced)
- ✅ No exponential explosions

### Current Formula Weaknesses:
- ❌ No card diversity (all cards same at stage X)
- ❌ User attributes barely matter (only 7% difference)
- ❌ Element/species have no mechanical impact
- ❌ No strategic deck building choices

---

## 🎯 Recommended Action Plan

### Phase 1: Fix Critical Bugs (Required)
1. Fix stats schema mismatch
2. Fix energy cost display inconsistency

### Phase 2: Improve Formulas (Important)
3. Add stat specialization (individual attrs)
4. Improve energy cost scaling (5 tiers)
5. Fix bond level progression (higher cap)

### Phase 3: Add Depth (Enhancement)
6. Make rarity affect stats
7. Add element-based modifiers
8. Generate cards at more stages

### Phase 4: Implement Battle System (Future)
9. Design combat mechanics
10. Implement damage calculations
11. Create matchmaking logic
12. Add turn-based gameplay

---

## 📁 Files Analyzed

### Core Card System
- `supabase/functions/generate-evolution-card/index.ts` - Card generation logic
- `supabase/migrations/20251119035143_*.sql` - Card table schema
- `supabase/migrations/20251125022825_*.sql` - Energy cost column

### Battle System
- `src/pages/BattleArena.tsx` - Main battle page
- `src/components/BattleMatchmaking.tsx` - Matchmaking UI
- `src/components/BattleCardSelector.tsx` - Card selection UI
- `src/components/BattleHistory.tsx` - Match history
- `src/components/BattleLeaderboard.tsx` - Rankings
- `supabase/migrations/20251124202739_*.sql` - Battle tables

### Display Components
- `src/components/EvolutionCardFlip.tsx` - Card display with flip
- `src/components/EvolutionCardGallery.tsx` - Card collection view

### Configuration
- `src/config/companionStages.ts` - Stage names
- `src/hooks/useCompanionAttributes.ts` - Attribute system

---

## 📝 Additional Notes

### Card Generation Triggers
Cards are generated when:
1. Companion evolves to milestone stage (0, 5, 10, 15, 20)
2. Called by `generate-companion-evolution` edge function
3. Requires user attributes (mind, body, soul)
4. Generates AI content (name, traits, story, lore)

### User Attributes System
```
Mind:  0-100 (gained from habit completions, +2 per habit)
Body:  0-100 (gained from daily activity, +10 per day, decays -5 for inactivity)
Soul:  0-100 (gained from reflections +3, streak milestones)
```

These feed into card stat generation but have minimal impact (15% of average).

### Database Schema
```sql
companion_evolution_cards (
  id, card_id, user_id, companion_id, evolution_id,
  evolution_stage, creature_name, species, element,
  stats (mind/body/soul), traits[], story_text, lore_seed,
  bond_level, rarity, frame_type, energy_cost,
  image_url, generated_at, created_at
)
```

---

## 🎉 Conclusion

The card system has a **solid foundation** with good UI and database structure, but has **2 critical bugs** that break functionality and **several design issues** that limit gameplay depth.

**Priority:** Fix the critical bugs immediately, then enhance stat diversity and energy scaling.

The test generator tool (Phase 2.5) has been created and successfully validates the formulas. Use it to verify any changes you make to the card generation system.

---

**Test Generator Output:** See console output or run `npx tsx test-card-generator.ts`

**Detailed Bug Report:** See `CARD_SYSTEM_BUG_REPORT.md`
