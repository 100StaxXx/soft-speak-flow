# Evolution Card System - Comprehensive Analysis Report
**Phase 2.5 - Snapshot & Test Generator**

Generated: 2025-11-25

---

## 🎴 Test Generator Created

A comprehensive test utility has been created at:
- **Utility**: `/src/utils/cardTestGenerator.ts`
- **Test Script**: `/test-cards.ts`

### Usage
```bash
npx tsx test-cards.ts
```

This will generate sample cards for stages [0, 5, 10, 15, 20] with multiple user attribute scenarios.

---

## 📊 Sample Card Data (Default User: 50/50/50)

| Stage | Rarity    | Mind/Body/Soul | Energy Cost | Bond Level | Base Stat | Avg Attr |
|-------|-----------|----------------|-------------|------------|-----------|----------|
| 0     | Common    | 27/27/27       | 1           | 60         | 20        | 50.0     |
| 5     | Epic      | 67/67/67       | 1           | 70         | 60        | 50.0     |
| 10    | Mythic    | 107/107/107    | 2           | 80         | 100       | 50.0     |
| 15    | Celestial | 147/147/147    | 3           | 90         | 140       | 50.0     |
| 20    | Origin    | 187/187/187    | 3           | 100        | 180       | 50.0     |

---

## 🐛 Critical Bugs & Issues Identified

### 🔴 **BUG #1: Schema vs Implementation Mismatch**

**Severity**: CRITICAL  
**Status**: ❌ BLOCKING ISSUE

#### Problem
The database schema defines stats with different keys than what the generation function uses:

**Schema (from migration):**
```sql
stats jsonb NOT NULL DEFAULT '{"strength": 0, "agility": 0, "vitality": 0, "intellect": 0, "spirit": 0, "affinity": 0}'::jsonb
```

**Implementation (generate-evolution-card/index.ts):**
```typescript
const stats = {
  mind: Math.floor(baseStatValue + avgAttribute * 0.15),
  body: Math.floor(baseStatValue + avgAttribute * 0.15),
  soul: Math.floor(baseStatValue + avgAttribute * 0.15),
};
```

**UI Usage (EvolutionCardFlip.tsx):**
```typescript
const stats = card.stats as { mind?: number; body?: number; soul?: number };
```

#### Impact
- Schema defines 6 attributes: `strength`, `agility`, `vitality`, `intellect`, `spirit`, `affinity`
- Code generates 3 attributes: `mind`, `body`, `soul`
- UI expects 3 attributes: `mind`, `body`, `soul`
- This creates confusion and makes the default schema values never used

#### Recommendation
**Option A (Recommended)**: Update schema to match implementation
```sql
ALTER TABLE companion_evolution_cards 
ALTER COLUMN stats SET DEFAULT '{"mind": 0, "body": 0, "soul": 0}'::jsonb;
```

**Option B**: Update code to use 6 attributes (more complex, requires UI changes)

---

### 🟡 **BUG #2: Bond Level Constraint Violation Potential**

**Severity**: MEDIUM  
**Status**: ⚠️ POTENTIAL ISSUE

#### Problem
The database constraint requires `bond_level >= 1`:
```sql
bond_level integer DEFAULT 1 CHECK (bond_level >= 1 AND bond_level <= 100)
```

However, the generation formula uses `Math.floor()`:
```typescript
const bondLevel = Math.min(100, Math.floor(10 + (totalAttributes / 3) + (stage * 2)));
```

For users with very low attributes at stage 0:
- `totalAttributes = 0` (new user, no attributes yet)
- `bondLevel = floor(10 + 0/3 + 0*2) = floor(10) = 10` ✅ OK

But the types file shows `bond_level: number | null`, allowing null values:
```typescript
bond_level: number | null
```

#### Impact
- Constraint mismatch between schema (NOT NULL, >= 1) and types (nullable)
- Could cause insertion failures if null is passed

#### Recommendation
```typescript
// Ensure bond level is always >= 1
const bondLevel = Math.max(1, Math.min(100, Math.floor(10 + (totalAttributes / 3) + (stage * 2))));
```

And update types to match schema:
```typescript
bond_level: number  // Remove | null
```

---

### 🟡 **BUG #3: Rarity Mapping Inconsistency**

**Severity**: MINOR  
**Status**: ⚠️ DOCUMENTATION ISSUE

#### Problem
The rarity tiers have overlapping/confusing names:

```typescript
// Line 60: "Mythic" is used for stages 10-12
else if (stage >= 10) rarity = 'Mythic';  // Stage 10-12
// Line 59: Comment says "Titan, Mythic, Prime" for stages 13-15
else if (stage >= 13) rarity = 'Celestial'; // Stage 13-15: Titan, Mythic, Prime
```

"Mythic" appears in both the code (stages 10-12) and comments (stages 13-15).

#### Impact
- Confusing comments that don't match code
- May lead to misunderstanding of rarity progression

#### Recommendation
Update comments to match actual rarity values:
```typescript
if (stage >= 19) rarity = 'Origin';       // Stage 19-20
else if (stage >= 16) rarity = 'Primal';  // Stage 16-18
else if (stage >= 13) rarity = 'Celestial'; // Stage 13-15
else if (stage >= 10) rarity = 'Mythic';  // Stage 10-12
else if (stage >= 7) rarity = 'Legendary'; // Stage 7-9
else if (stage >= 4) rarity = 'Epic';      // Stage 4-6
else if (stage >= 1) rarity = 'Rare';      // Stage 1-3
else rarity = 'Common';                   // Stage 0
```

---

### 🟢 **BUG #4: Missing Stage 0 Rarity**

**Severity**: MINOR  
**Status**: ⚠️ LOGIC GAP

#### Problem
Stage 0 gets 'Common' rarity only if all other conditions fail. There's no explicit `stage === 0` condition.

```typescript
let rarity = 'Common';
if (stage >= 19) rarity = 'Origin';
// ... other conditions ...
else if (stage >= 1) rarity = 'Rare';
// Stage 0 stays 'Common' by default
```

#### Impact
- Works correctly but relies on implicit logic
- Less readable and could cause issues if `rarity` initialization changes

#### Recommendation
Make it explicit:
```typescript
let rarity: string;
if (stage >= 19) rarity = 'Origin';
// ... other conditions ...
else if (stage >= 1) rarity = 'Rare';
else rarity = 'Common'; // Stage 0
```

---

## ✅ Correct Implementations

### Energy Cost Formula ✅
```typescript
const energyCost = stage <= 9 ? 1 : stage <= 14 ? 2 : 3;
```
- Stage 0-9: 1 energy
- Stage 10-14: 2 energy
- Stage 15-20: 3 energy
- **Status**: Correct

### Base Stat Formula ✅
```typescript
const baseStatValue = 20 + (stage * 8);
```
- Stage 0: 20
- Stage 20: 180
- Progression: +8 per stage
- **Status**: Correct

### Stat Calculation ✅
```typescript
Math.floor(baseStatValue + avgAttribute * 0.15)
```
- Base stats scale with stage
- 15% bonus from average user attributes
- **Status**: Correct (formula is balanced)

---

## 📈 Formula Analysis

### Stat Range by Scenario

| User Attributes | Stage 0 | Stage 5 | Stage 10 | Stage 15 | Stage 20 |
|----------------|---------|---------|----------|----------|----------|
| Low (20/20/20) | 23      | 63      | 103      | 143      | 183      |
| Mid (50/50/50) | 27      | 67      | 107      | 147      | 187      |
| High (80/80/80)| 32      | 72      | 112      | 152      | 192      |

**Variance**: 
- Stage 0: 9 points (23-32)
- Stage 20: 9 points (183-192)
- User attributes contribute ~5% variance

### Bond Level Range by Scenario

| User Attributes | Stage 0 | Stage 5 | Stage 10 | Stage 15 | Stage 20 |
|----------------|---------|---------|----------|----------|----------|
| Low (20/20/20) | 30      | 40      | 50       | 60       | 70       |
| Mid (50/50/50) | 60      | 70      | 80       | 90       | 100      |
| High (80/80/80)| 90      | 100     | 100      | 100      | 100      |

**Notes**:
- High-stat users hit max bond (100) at stage 5
- Low-stat users max out at bond 70 (stage 20)
- Bond level heavily influenced by user attributes

---

## 🎯 Recommendations Summary

### Immediate Actions Required
1. **Fix Schema Mismatch** (Critical): Update stats column default or change code to use 6 attributes
2. **Fix Bond Level Constraint**: Add `Math.max(1, ...)` and update types
3. **Update Comments**: Clarify rarity tier names

### Future Enhancements
1. **Stat Differentiation**: Consider making mind/body/soul values different based on user's strongest attribute
2. **Rarity Names**: Consider renaming to avoid confusion (e.g., "Mythic" used twice in different contexts)
3. **Formula Documentation**: Add inline documentation to generation function
4. **Test Suite**: Add automated tests for edge cases (low attrs, high attrs, stage boundaries)

---

## 📝 Test Generator Features

The created test utility supports:
- ✅ Generate cards for any stages
- ✅ Test with custom user attributes
- ✅ Multiple scenario comparison
- ✅ Formatted table output
- ✅ Formula validation
- ✅ Easy integration with existing codebase

### Example Usage in Code
```typescript
import { generateSampleCards, printSampleCards } from '@/utils/cardTestGenerator';

// Quick visual test
printSampleCards([0, 5, 10, 15, 20]);

// Custom attributes
printSampleCards([0, 10, 20], { mind: 90, body: 30, soul: 50 });

// Get data for analysis
const cards = generateSampleCards([0, 5, 10, 15, 20]);
console.log(cards);
```

---

## 🔍 Files Analyzed

1. `/supabase/functions/generate-evolution-card/index.ts` - Card generation logic
2. `/supabase/migrations/20251119035143_62c2c5a0-cc11-46bb-a29a-dc4f19d41eb8.sql` - Schema definition
3. `/supabase/migrations/20251125022825_b9e61c2c-77e3-4fb8-9dc7-f6bdde595a1e.sql` - Energy cost addition
4. `/src/integrations/supabase/types.ts` - TypeScript types
5. `/src/components/EvolutionCardFlip.tsx` - UI card display
6. `/src/components/EvolutionCardGallery.tsx` - Card listing

---

**Report Complete** ✅
