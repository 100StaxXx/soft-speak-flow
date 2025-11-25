# Evolution Card System - Quick Reference Guide
**Phase 2.5 Implementation Complete** ✅

---

## 🎴 Test Generator Usage

### Quick Test (5 sample cards per stage)
```bash
npx tsx src/utils/runCardTest.ts
```

### In Code
```typescript
import { printSampleCards, generateSampleCards } from '@/utils/cardTestGenerator';

// Print formatted table
printSampleCards([0, 5, 10, 15, 20]);

// Get raw data
const cards = generateSampleCards([0, 5, 10, 15, 20], { mind: 80, body: 60, soul: 70 });
```

---

## 📊 Card Stats at a Glance (Default User: 50/50/50)

| Stage | Rarity    | Stats    | Energy | Bond | Notes                    |
|-------|-----------|----------|--------|------|--------------------------|
| 0     | Common    | 27/27/27 | 1      | 60   | Starting evolution       |
| 5     | Epic      | 67/67/67 | 1      | 70   | Mid early-game          |
| 10    | Mythic    | 107/107  | 2      | 80   | Energy cost increases   |
| 15    | Celestial | 147/147  | 3      | 90   | Energy cost increases   |
| 20    | Origin    | 187/187  | 3      | 100  | Max evolution           |

**Stat Progression**: +8 per stage + 15% of avg user attributes

---

## 🐛 Critical Bugs Found

### 🔴 BUG #1: Schema Mismatch (CRITICAL)
**Problem**: Database schema expects 6 stats, code generates 3

**Schema**: `strength, agility, vitality, intellect, spirit, affinity`  
**Code**: `mind, body, soul`  
**UI**: `mind, body, soul`

**Fix Required**: Update schema default to match implementation
```sql
ALTER TABLE companion_evolution_cards 
ALTER COLUMN stats SET DEFAULT '{"mind": 0, "body": 0, "soul": 0}'::jsonb;
```

### 🟡 BUG #2: Bond Level Constraint
**Problem**: Formula might not respect minimum bond_level of 1

**Current**: `floor(10 + (totalAttributes / 3) + (stage * 2))`  
**Fix**: `max(1, min(100, floor(...)))`

### 🟡 BUG #3: Rarity Comments Don't Match Code
**Problem**: Comments mention "Mythic" for stages 13-15, but code assigns "Celestial"

**Fix**: Update comments to match actual rarity assignments

---

## ✅ Correct Formulas

### Base Stats
```typescript
baseStatValue = 20 + (stage × 8)
```
- Stage 0: 20
- Stage 20: 180
- Linear progression

### Final Stats
```typescript
stats = floor(baseStatValue + avgAttribute × 0.15)
```
- User attributes contribute ~5% variance
- All three stats (mind/body/soul) are identical

### Energy Cost
```typescript
energyCost = stage <= 9 ? 1 : stage <= 14 ? 2 : 3
```
- Stages 0-9: 1 energy
- Stages 10-14: 2 energy
- Stages 15-20: 3 energy

### Bond Level
```typescript
bondLevel = min(100, floor(10 + (totalAttributes / 3) + (stage × 2)))
```
- Base: 10
- User contribution: totalAttributes / 3
- Stage contribution: stage × 2

### Rarity
```typescript
stage >= 19 ? 'Origin'
stage >= 16 ? 'Primal'
stage >= 13 ? 'Celestial'
stage >= 10 ? 'Mythic'
stage >= 7  ? 'Legendary'
stage >= 4  ? 'Epic'
stage >= 1  ? 'Rare'
else 'Common'
```

---

## 📈 Stat Ranges by User Type

### Low Attributes (20/20/20)
- Stage 0: 23 stats, 30 bond
- Stage 20: 183 stats, 70 bond
- **Impact**: Minimal stat bonus, significantly lower bond

### Balanced Attributes (50/50/50)
- Stage 0: 27 stats, 60 bond
- Stage 20: 187 stats, 100 bond
- **Impact**: Moderate bonus, reaches max bond at stage 20

### High Attributes (80/80/80)
- Stage 0: 32 stats, 90 bond
- Stage 20: 192 stats, 100 bond
- **Impact**: Maximum stat bonus, reaches max bond at stage 5

---

## 🎯 Recommendations

### Immediate Fixes
1. ✅ **Fix schema mismatch** - Update stats column default
2. ✅ **Add bond level safety** - Use `max(1, ...)` wrapper
3. ✅ **Update rarity comments** - Match code to documentation

### Future Enhancements
1. **Differentiate Stats**: Make mind/body/soul vary based on user's dominant attribute
2. **Scale User Impact**: Consider increasing attribute multiplier (0.15 → 0.25) for more variance
3. **Dynamic Energy**: Consider making energy cost scale with rarity instead of fixed tiers
4. **Bond Cap Variation**: Allow high-stat users to exceed 100 bond at max stages

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `/src/utils/cardTestGenerator.ts` | Core test generation logic |
| `/src/utils/runCardTest.ts` | Standalone test runner |
| `/workspace/CARD_SYSTEM_ANALYSIS.md` | Detailed bug report (304 lines) |
| `/workspace/CARD_SYSTEM_QUICK_REFERENCE.md` | This file |

---

## 💡 Usage Examples

### Test Default Scenario
```typescript
import { runQuickTest } from '@/utils/runCardTest';
runQuickTest();
```

### Test All Boundaries
```typescript
import { runBoundaryTest } from '@/utils/runCardTest';
runBoundaryTest(); // Tests stages 0,1,4,7,9,10,13,14,15,16,19,20
```

### Test Custom Attributes
```typescript
import { runCustomTest } from '@/utils/runCardTest';
runCustomTest({ mind: 90, body: 40, soul: 60 }, [0, 10, 20]);
```

### Get Raw Data
```typescript
import { generateSampleCards } from '@/utils/cardTestGenerator';
const cards = generateSampleCards([0, 5, 10, 15, 20]);
// Use cards array for analysis, charts, etc.
```

---

**Phase 2.5 Complete** ✅  
Test generator functional and validation data ready for review.
