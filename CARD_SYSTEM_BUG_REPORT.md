# Card System Bug Report & Analysis

**Generated:** 2025-11-25  
**Status:** 🔴 CRITICAL BUGS FOUND

## Executive Summary

The card and battle system has **4 critical bugs** and **2 design issues** that will cause the system to fail:

1. ❌ **CRITICAL**: Database schema vs code mismatch for stats
2. ❌ **CRITICAL**: Energy cost formula inconsistency between backend and frontend
3. ⚠️ **MEDIUM**: Bond level formula produces questionable results
4. ⚠️ **MEDIUM**: Rarity tiers misaligned with comments

---

## 🔴 CRITICAL BUG #1: Stats Structure Mismatch

### The Problem

The database schema, card generation function, and frontend display are **completely out of sync** regarding what stats a card has.

### Evidence

**Database Schema** (`20251119035143_62c2c5a0-cc11-46bb-a29a-dc4f19d41eb8.sql:16`):
```sql
stats jsonb NOT NULL DEFAULT '{"strength": 0, "agility": 0, "vitality": 0, "intellect": 0, "spirit": 0, "affinity": 0}'::jsonb
```
- Expects: 6 stats (strength, agility, vitality, intellect, spirit, affinity)

**Card Generation Function** (`generate-evolution-card/index.ts:73-77`):
```typescript
const stats = {
  mind: Math.floor(baseStatValue + avgAttribute * 0.15),
  body: Math.floor(baseStatValue + avgAttribute * 0.15),
  soul: Math.floor(baseStatValue + avgAttribute * 0.15),
};
```
- Generates: 3 stats (mind, body, soul)

**Frontend Display** (`BattleCardSelector.tsx:102-115`):
```typescript
<div className="grid grid-cols-3 gap-1 text-xs">
  <div className="text-center">
    <div className="text-muted-foreground">🧠</div>
    <div className="font-bold">{card.stats?.mind || 10}</div>
  </div>
  <div className="text-center">
    <div className="text-muted-foreground">💪</div>
    <div className="font-bold">{card.stats?.body || 10}</div>
  </div>
  <div className="text-center">
    <div className="text-muted-foreground">🔥</div>
    <div className="font-bold">{card.stats?.soul || 50}</div>
  </div>
</div>
```
- Expects: 3 stats (mind, body, soul)

### Impact

- **Severity:** CRITICAL
- Cards generated will have `{mind, body, soul}` but the database default schema expects 6 different stats
- Frontend will display correctly, but there's a fundamental mismatch in the data model
- If any code tries to read the 6 "old" stats from the database default, it will fail

### Fix Required

**Option A (Recommended):** Update database schema to use mind/body/soul:
```sql
ALTER TABLE companion_evolution_cards 
ALTER COLUMN stats SET DEFAULT '{"mind": 0, "body": 0, "soul": 0}'::jsonb;
```

**Option B:** Update all code to use the 6-stat system (strength, agility, vitality, intellect, spirit, affinity)

---

## 🔴 CRITICAL BUG #2: Energy Cost Formula Mismatch

### The Problem

The backend generates different energy costs than what the frontend expects and displays.

### Evidence

**Backend Formula** (`generate-evolution-card/index.ts:80`):
```typescript
const energyCost = stage <= 9 ? 1 : stage <= 14 ? 2 : 3;
```

**Frontend Formula** (`BattleCardSelector.tsx:22-28`):
```typescript
const ENERGY_COSTS: Record<number, number> = {
  0: 1,
  5: 2,
  10: 3,
  15: 4,
  20: 5,
};
```

### Comparison Table

| Stage | Backend | Frontend | Match? |
|-------|---------|----------|--------|
| 0     | 1       | 1        | ✅     |
| 5     | 1       | 2        | ❌ BUG |
| 10    | 2       | 3        | ❌ BUG |
| 15    | 3       | 4        | ❌ BUG |
| 20    | 3       | 5        | ❌ BUG |

### Impact

- **Severity:** CRITICAL
- Cards at stage 5, 10, 15, 20 will show incorrect energy costs in the UI
- Game balance will be broken (players can use stronger cards for less energy than intended)
- Database will have wrong energy costs stored

### Fix Required

**Update backend to match frontend design:**

```typescript
// Replace line 80 in generate-evolution-card/index.ts
const ENERGY_COSTS: Record<number, number> = {
  0: 1,
  5: 2,
  10: 3,
  15: 4,
  20: 5,
};
const energyCost = ENERGY_COSTS[stage] || Math.min(5, Math.floor(stage / 5) + 1);
```

The fallback formula `Math.min(5, Math.floor(stage / 5) + 1)` ensures:
- Stages 0-4: 1 energy
- Stages 5-9: 2 energy
- Stages 10-14: 3 energy
- Stages 15-19: 4 energy
- Stage 20+: 5 energy (capped)

---

## ⚠️ MEDIUM ISSUE #3: Bond Level Formula

### The Problem

The bond level formula can produce counterintuitive results, especially at early stages with high attributes.

### Current Formula

```typescript
// Line 223 in generate-evolution-card/index.ts
const bondLevel = Math.min(100, Math.floor(10 + (totalAttributes / 3) + (stage * 2)));
```

### Analysis

**Formula breakdown:**
- Base: 10
- Attribute contribution: `(mind + body + soul) / 3`
- Stage contribution: `stage * 2`
- Cap: 100

**Example Scenarios:**

| Stage | Attributes | Bond Level | Notes |
|-------|------------|------------|-------|
| 0     | 0/0/0      | 10         | Minimum possible |
| 0     | 10/10/10   | 20         | Low beginner |
| 0     | 50/50/50   | 60         | Stage 0 with max bond? |
| 0     | 80/80/80   | 90         | Almost max at stage 0? |
| 5     | 80/80/80   | 100        | Caps at stage 5 |
| 20    | 0/0/0      | 50         | Stage 20 with no bond? |
| 20    | 50/50/50   | 100        | Normal progression |

### Issues

1. **Bond level reaches 100 too early** for players with high attributes (stage 5)
2. **Stage 0 can have bond level 90** which doesn't make narrative sense
3. **Stage contribution is too weak** (only 2 per stage vs potentially 100 from attributes)

### Recommendations

**Option A - Rebalance the formula:**
```typescript
// More weight on stage progression
const bondLevel = Math.min(100, Math.floor(
  5 +                          // Lower base
  (totalAttributes / 10) +     // Less weight on attributes
  (stage * 4)                  // More weight on stages
));
```

This produces:
- Stage 0, low attrs: 5-35
- Stage 5, avg attrs: 40-50
- Stage 10, avg attrs: 60-70
- Stage 20, high attrs: 90-100

**Option B - Keep current formula if intentional** (reward high attributes early)

### Impact

- **Severity:** MEDIUM
- Doesn't break functionality, but may not match intended game design
- Players might feel less progression if they cap at 100 too early

---

## ⚠️ MEDIUM ISSUE #4: Rarity Tier Comments Are Misleading

### The Problem

The comments in the rarity assignment code don't match the actual stage names/tiers in the system.

### Current Code

```typescript
// Lines 56-63 in generate-evolution-card/index.ts
let rarity = 'Common';
if (stage >= 19) rarity = 'Origin';       // Stage 19-20: Apex, Ultimate
else if (stage >= 16) rarity = 'Primal';  // Stage 16-18: Regal, Eternal, Transcendent
else if (stage >= 13) rarity = 'Celestial'; // Stage 13-15: Titan, Mythic, Prime
else if (stage >= 10) rarity = 'Mythic';  // Stage 10-12: Champion, Ascended, Vanguard
else if (stage >= 7) rarity = 'Legendary'; // Stage 7-9: Fledgling, Warrior, Guardian
else if (stage >= 4) rarity = 'Epic';      // Stage 4-6: Juvenile, Apprentice, Scout
else if (stage >= 1) rarity = 'Rare';      // Stage 1-3: Hatchling, Sproutling, Cub
```

### Issues

1. Comments reference stage names that aren't defined anywhere
2. The word "Mythic" appears twice (as a comment in stage 13-15 AND as the actual rarity for stage 10-12)
3. Comments suggest there should be 21 named stages (0-20), but names aren't used elsewhere

### Impact

- **Severity:** LOW (cosmetic/documentation issue)
- Confusing for developers
- No functional impact if comments are just documentation

### Fix Required

Either:
1. Remove the confusing comments
2. OR: Add actual stage naming to the system and use those names consistently

---

## 📊 Stat Ranges Analysis (From Test Generator)

### Mind/Body/Soul Stats

All three stats use the **same formula**, producing identical values:

```
Formula: base(20 + stage * 8) + avg_attribute * 0.15
```

| Stage | Min Stats | Max Stats | Range |
|-------|-----------|-----------|-------|
| 0     | 20        | 35        | 15    |
| 5     | 60        | 75        | 15    |
| 10    | 100       | 115       | 15    |
| 15    | 140       | 155       | 15    |
| 20    | 180       | 195       | 15    |

### Observations

✅ **Good:**
- Linear progression is predictable
- User attributes have minimal impact (15 point range)
- Prevents P2W scenarios where grinding attributes gives massive advantage

⚠️ **Consider:**
- All three stats are identical - is this intentional?
- Should cards have specializations? (e.g., high mind, low body)
- Current system makes all cards at same stage virtually identical stat-wise

---

## 🧪 Test Generator Tool

A test generator has been created at `/workspace/card-test-generator.ts` that:

✅ Generates 5 sample cards per stage (0, 5, 10, 15, 20)  
✅ Shows mind/body/soul stats  
✅ Displays energy_cost and bond_level  
✅ Tests with 3 different attribute profiles (Beginner, Average, Advanced)  
✅ Highlights the energy cost mismatch bug  
✅ Shows stat ranges at a glance  

### Usage

```bash
npx tsx card-test-generator.ts
```

### Sample Output

```
┌────────────────────────────────────────────────────────────┐
│ TEST-S10-Average               Stage 10 │
├────────────────────────────────────────────────────────────┤
│ Rarity: Mythic               Energy: ⚡2         │
│ Bond Level:  80                                      │
├────────────────────────────────────────────────────────────┤
│ Stats (Mind/Body/Soul):                                    │
│   🧠 Mind: 107                                         │
│   💪 Body: 107                                         │
│   🔥 Soul: 107                                         │
├────────────────────────────────────────────────────────────┤
│ Formula: base(100) + avg_attr(50.0) * 0.15                │
└────────────────────────────────────────────────────────────┘
```

---

## 🔧 Recommended Fixes Priority

### Priority 1 - MUST FIX (Critical Bugs)

1. **Fix stats schema mismatch**
   - Update database default to use mind/body/soul
   - Verify no existing code depends on old 6-stat system

2. **Fix energy cost formula**
   - Update backend to match frontend expectations
   - Update any existing cards in database with correct energy costs

### Priority 2 - SHOULD FIX (Design Issues)

3. **Review bond level formula**
   - Decide if current formula is intentional
   - If not, rebalance as suggested

4. **Clean up rarity comments**
   - Either implement stage naming system or remove confusing comments

### Priority 3 - CONSIDER

5. **Add stat specialization**
   - Consider making mind/body/soul different based on card element or species
   - Would add strategic depth to card selection

---

## 📝 Testing Checklist

After fixes are applied:

- [ ] Run card test generator to verify formulas
- [ ] Generate test cards at each stage in database
- [ ] Verify stats display correctly in frontend
- [ ] Test energy costs match between backend and frontend
- [ ] Verify bond levels make sense narratively
- [ ] Test battle system with generated cards

---

## 🎯 Additional Observations

### Cards at Major Stages Only?

The current system generates cards at stages 0, 5, 10, 15, 20 (as mentioned in BattleMatchmaking.tsx:79). This is good for:
- Predictable progression
- Clear milestones
- Easier balancing

But consider:
- What happens to stages 1-4, 6-9, etc?
- Are those just stat bumps without card rewards?
- Frontend expects exactly these 5 stages for energy costs

### Battle System Status

From reviewing the code:
- ✅ Database schema is complete (battle_matches, battle_participants, etc.)
- ✅ Card selection UI is implemented
- ✅ Matchmaking UI is ready
- ⚠️ Actual battle logic is TODO (BattleMatchmaking.tsx:46)
- ⚠️ Backend matchmaking function doesn't exist yet

---

**End of Report**

Run the test generator anytime you change formulas to visually verify the stat ranges and catch bugs early!
