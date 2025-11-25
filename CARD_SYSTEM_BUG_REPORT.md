# Card System Bug Report & Analysis

**Generated:** 2025-11-25  
**Status:** Critical Issues Found  
**System:** Companion Evolution Card Game

---

## 🚨 CRITICAL BUGS

### 1. **STATS SCHEMA MISMATCH** (Severity: CRITICAL)

**Location:** `supabase/functions/generate-evolution-card/index.ts` (lines 73-77) vs `supabase/migrations/20251119035143_*.sql` (line 16)

**Issue:**
- **Database Schema** expects: `{"strength", "agility", "vitality", "intellect", "spirit", "affinity"}`
- **Function generates**: `{"mind", "body", "soul"}`

**Impact:** 
- Complete mismatch between generated data and database schema
- Cards may be stored incorrectly
- Frontend components reading wrong stat names
- Battle system will fail when trying to read stats

**Code Evidence:**
```typescript
// generate-evolution-card/index.ts (lines 73-77)
const stats = {
  mind: Math.floor(baseStatValue + avgAttribute * 0.15),
  body: Math.floor(baseStatValue + avgAttribute * 0.15),
  soul: Math.floor(baseStatValue + avgAttribute * 0.15),
};
```

```sql
-- Migration file (line 16)
stats jsonb NOT NULL DEFAULT '{"strength": 0, "agility": 0, "vitality": 0, "intellect": 0, "spirit": 0, "affinity": 0}'::jsonb,
```

**Frontend Usage:**
The frontend components (`EvolutionCardFlip.tsx`, `BattleCardSelector.tsx`) expect `mind/body/soul`, which suggests the database schema is wrong, not the function.

**Recommendation:**
Update the database migration to use `mind/body/soul` schema:
```sql
stats jsonb NOT NULL DEFAULT '{"mind": 0, "body": 0, "soul": 0}'::jsonb,
```

---

### 2. **ENERGY COST INCONSISTENCY** (Severity: HIGH)

**Location:** 
- `src/components/BattleCardSelector.tsx` (lines 22-28)
- `supabase/functions/generate-evolution-card/index.ts` (line 80)

**Issue:**
Two different energy cost systems exist:

**BattleCardSelector (WRONG):**
```typescript
const ENERGY_COSTS: Record<number, number> = {
  0: 1,
  5: 2,
  10: 3,
  15: 4,
  20: 5,
};
const energyCost = ENERGY_COSTS[card.evolution_stage] || 1;
```

This only works for exact stages 0, 5, 10, 15, 20. All other stages (1-4, 6-9, 11-14, 16-19) default to 1.

**generate-evolution-card (CORRECT):**
```typescript
const energyCost = stage <= 9 ? 1 : stage <= 14 ? 2 : 3;
```

This uses ranges and is more sensible.

**Impact:**
- BattleCardSelector shows wrong energy costs for non-milestone stages
- Cards at stage 8 would show 1 energy but should show 1 (happens to match)
- Cards at stage 12 would show 1 energy but should show 2 (MISMATCH!)
- Cards at stage 18 would show 1 energy but should show 3 (MISMATCH!)

**Test Results:**
```
Stage 0:  Generated: 1, Displayed: 1  ✅
Stage 5:  Generated: 1, Displayed: 2  ❌ MISMATCH
Stage 10: Generated: 2, Displayed: 3  ❌ MISMATCH  
Stage 15: Generated: 3, Displayed: 4  ❌ MISMATCH
Stage 20: Generated: 3, Displayed: 5  ❌ MISMATCH
```

**Recommendation:**
Remove the hardcoded map in `BattleCardSelector.tsx` and use the actual `energy_cost` column from the database:
```typescript
// Just use the value from the database
const energyCost = card.energy_cost || 1;
```

---

## ⚠️ DESIGN ISSUES

### 3. **No Stat Specialization** (Severity: MEDIUM)

**Location:** `supabase/functions/generate-evolution-card/index.ts` (lines 73-77)

**Issue:**
All three stats (mind, body, soul) are calculated identically. Every card has the same value for mind, body, and soul.

**Code:**
```typescript
const stats = {
  mind: Math.floor(baseStatValue + avgAttribute * 0.15),
  body: Math.floor(baseStatValue + avgAttribute * 0.15),
  soul: Math.floor(baseStatValue + avgAttribute * 0.15),
};
```

**Impact:**
- No diversity in card builds
- No strategic deck building (all cards are equivalent)
- No reason to choose one card over another at the same stage
- Element and species have no mechanical impact
- User's individual attributes (mind/body/soul) don't specialize their cards

**Example:**
Stage 10 card with user attributes (100/10/50):
- Should create a mind-focused card
- Actually creates: mind=115, body=115, soul=115 (all the same)

**Recommendation:**
Add stat specialization based on:
1. User's individual attributes (not just average)
2. Card element (fire = body bias, light = mind bias, nature = soul bias)
3. Species archetype

**Proposed Formula:**
```typescript
const baseStatValue = 20 + (stage * 8);

// Use individual user attributes, not average
const stats = {
  mind: Math.floor(baseStatValue + userAttributes.mind * 0.20 + avgAttribute * 0.05),
  body: Math.floor(baseStatValue + userAttributes.body * 0.20 + avgAttribute * 0.05),
  soul: Math.floor(baseStatValue + userAttributes.soul * 0.20 + avgAttribute * 0.05),
};

// Optional: Apply element modifiers
// Fire: +10% body, Water: +10% soul, Lightning: +10% mind, etc.
```

---

### 4. **Bond Level Caps Too Early** (Severity: LOW)

**Location:** `supabase/functions/generate-evolution-card/index.ts` (lines 220-223)

**Issue:**
Bond level reaches 100 (cap) too early in progression:
- Stage 10 with high attributes (75+) = 100 bond (capped)
- Stage 15-20 stuck at 100 bond (no progression)

**Formula:**
```typescript
const bondLevel = Math.min(100, Math.floor(10 + (totalAttributes / 3) + (stage * 2)));
```

**Test Results:**
```
Stage 0,  Attrs 100/100/100: Bond 110 → capped to 100
Stage 5,  Attrs 100/100/100: Bond 120 → capped to 100
Stage 10, Attrs 75/75/75:    Bond 105 → capped to 100
Stage 10, Attrs 100/100/100: Bond 130 → capped to 100
```

**Impact:**
- No bond progression after stage 10 for active users
- Bond level becomes meaningless for late-game cards
- Reduces sense of progression

**Recommendation:**
Increase the cap or adjust the formula:

**Option 1: Higher Cap**
```typescript
const bondLevel = Math.min(200, Math.floor(10 + (totalAttributes / 3) + (stage * 3)));
```

**Option 2: Percentage-Based**
```typescript
// Bond level as percentage of potential (0-100%)
const maxPotential = 20 + (stage * 5); // Stage 0: 20, Stage 20: 120
const userContribution = (totalAttributes / 300) * maxPotential; // Scale user attrs
const bondLevel = Math.min(100, Math.floor(userContribution));
```

---

### 5. **Energy Cost Doesn't Scale Well** (Severity: LOW)

**Location:** `supabase/functions/generate-evolution-card/index.ts` (line 80)

**Issue:**
Energy cost only has 3 tiers (1, 2, 3) across 21 stages (0-20).

**Current:**
```
Stages 0-9:   1 energy (10 stages)
Stages 10-14: 2 energy (5 stages)
Stages 15-20: 3 energy (6 stages)
```

**Impact:**
- Not enough granularity for a card game
- Stage 0 cards cost the same as Stage 9 cards (despite 9x power difference)
- Late game has no energy progression (15-20 all cost 3)

**Power Comparison:**
```
Stage 0:  63-105 power   (1 energy) = 63-105 power per energy
Stage 9:  ~270 power     (1 energy) = 270 power per energy ❌ Too efficient
Stage 10: 303-345 power  (2 energy) = 151-172 power per energy
Stage 20: 543-585 power  (3 energy) = 181-195 power per energy
```

**Recommendation:**
Use a more granular energy cost system:

**Option 1: 5-Tier System**
```typescript
const energyCost = 
  stage <= 3 ? 1 :
  stage <= 7 ? 2 :
  stage <= 12 ? 3 :
  stage <= 17 ? 4 : 5;
```

**Option 2: Milestone System** (Better aligns with card generation at stages 0, 5, 10, 15, 20)
```typescript
const energyCost = Math.floor(stage / 5) + 1; // 1, 2, 3, 4, 5
```

---

## 📊 STAT RANGES (Current Formula)

### Stage 0 (Egg, Common)
```
User Attrs: 10/10/10   → Card: 21/21/21,   Energy: 1, Bond: 20
User Attrs: 50/50/50   → Card: 27/27/27,   Energy: 1, Bond: 60
User Attrs: 100/100/100 → Card: 35/35/35,  Energy: 1, Bond: 100
```

### Stage 5 (Apprentice, Epic)
```
User Attrs: 10/10/10   → Card: 61/61/61,   Energy: 1, Bond: 30
User Attrs: 50/50/50   → Card: 67/67/67,   Energy: 1, Bond: 70
User Attrs: 100/100/100 → Card: 75/75/75,  Energy: 1, Bond: 100
```

### Stage 10 (Champion, Mythic)
```
User Attrs: 10/10/10   → Card: 101/101/101, Energy: 2, Bond: 40
User Attrs: 50/50/50   → Card: 107/107/107, Energy: 2, Bond: 80
User Attrs: 100/100/100 → Card: 115/115/115, Energy: 2, Bond: 100
```

### Stage 15 (Prime, Celestial)
```
User Attrs: 10/10/10   → Card: 141/141/141, Energy: 3, Bond: 50
User Attrs: 50/50/50   → Card: 147/147/147, Energy: 3, Bond: 90
User Attrs: 100/100/100 → Card: 155/155/155, Energy: 3, Bond: 100
```

### Stage 20 (Ultimate, Origin)
```
User Attrs: 10/10/10   → Card: 181/181/181, Energy: 3, Bond: 60
User Attrs: 50/50/50   → Card: 187/187/187, Energy: 3, Bond: 100
User Attrs: 100/100/100 → Card: 195/195/195, Energy: 3, Bond: 100
```

**Observations:**
- User attributes have minimal impact (only ~7% difference between low and high users)
- Stage progression is linear and predictable
- No variety in stat distribution (all cards are identical at same stage)

---

## 🎯 ADDITIONAL OBSERVATIONS

### 6. **Rarity Doesn't Affect Stats**

Rarity is purely cosmetic - determined by stage only. It doesn't affect gameplay at all.

**Recommendation:**
Consider making rarity meaningful:
- Epic+ cards get +5% stats
- Legendary+ cards get +10% stats
- Mythic+ cards get +15% stats
- Origin cards get +20% stats

---

### 7. **Element and Species Are Cosmetic**

Element and species don't affect stats or abilities, only appearance and naming.

**Recommendation:**
Add element-based stat biases or special abilities:
```typescript
const elementBonuses = {
  fire: { body: 1.15, soul: 1.0, mind: 0.95 },
  water: { body: 0.95, soul: 1.15, mind: 1.0 },
  lightning: { body: 1.0, soul: 0.95, mind: 1.15 },
  // etc...
};
```

---

### 8. **Cards Only Generated at Milestones**

Based on `BattleMatchmaking.tsx` line 79: "Cards unlock at stages 0, 5, 10, 15, and 20"

This means:
- Only 5 cards per companion (stages 0, 5, 10, 15, 20)
- Intermediate stages (1-4, 6-9, 11-14, 16-19) don't generate cards
- Users reach stage 20 with only 5 total cards

**Impact:**
- Very limited deck building (need minimum 3 cards to play)
- Not much variety or collection aspect
- Intermediate evolution stages feel less rewarding

**Recommendation:**
Generate cards at more stages or allow card variants:
- **Option 1:** Every 2-3 stages (0, 3, 6, 9, 12, 15, 18, 21 = 8 cards)
- **Option 2:** Allow users to re-generate cards at milestones for variety
- **Option 3:** Add "mutation" system where each evolution can branch into 2-3 variants

---

## ✅ WORKING CORRECTLY

### Things That Work Well:

1. **Stage Name Mapping** - Correctly maps 21 stages (0-20) to thematic names
2. **Rarity Progression** - Logical progression from Common → Origin
3. **Card ID Generation** - Unique identifiers with good structure
4. **Base Stat Formula** - Linear progression is balanced (20 + stage × 8)
5. **Bond Level Concept** - Good idea to combine user effort + evolution stage
6. **AI Content Generation** - Name generation, traits, story, lore system looks solid

---

## 🔧 RECOMMENDED FIXES (Priority Order)

### Priority 1: Critical Bugs (Must Fix)
1. ✅ Fix stats schema mismatch (choose mind/body/soul or strength/agility/etc)
2. ✅ Fix energy cost inconsistency (use database value, not hardcoded map)

### Priority 2: Balance Issues (Should Fix)
3. ⚠️ Add stat specialization (make cards different)
4. ⚠️ Improve energy cost scaling (better balance)
5. ⚠️ Fix bond level cap (allow late-game progression)

### Priority 3: Enhancements (Nice to Have)
6. 💡 Make rarity affect stats
7. 💡 Add element-based stat modifiers
8. 💡 Generate cards at more stages or add variants

---

## 📝 TEST GENERATOR USAGE

To regenerate this analysis after making changes:

```bash
cd /workspace
npx tsx test-card-generator.ts
```

This will output:
- Sample cards for stages 0, 5, 10, 15, 20
- 5 samples per stage (low, low-med, medium, high, max user attributes)
- Mind/Body/Soul stats, Energy Cost, Bond Level
- Visual table for easy sanity checking

---

## 📌 FILES TO UPDATE

### Fix Bug #1 (Stats Schema):
- `supabase/migrations/20251119035143_*.sql` - Update stats default
- OR `supabase/functions/generate-evolution-card/index.ts` - Match existing schema

### Fix Bug #2 (Energy Cost):
- `src/components/BattleCardSelector.tsx` - Remove hardcoded ENERGY_COSTS map

### Implement Stat Specialization:
- `supabase/functions/generate-evolution-card/index.ts` - Update lines 73-77

### Improve Energy Scaling:
- `supabase/functions/generate-evolution-card/index.ts` - Update line 80

### Fix Bond Level Cap:
- `supabase/functions/generate-evolution-card/index.ts` - Update lines 220-223

---

**End of Report**
