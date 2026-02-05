
# Final Fixes for 6-Stat System - Ship-Ready

Based on my review of the actual code, here's what needs to be fixed before shipping:

---

## Status Summary

| Item | Current Status | Action Required |
|------|----------------|-----------------|
| **A) Edge function Record types** | `Record<string, number>` (lines 78, 87) | Change to typed generics |
| **B) attributeDescriptions.ts ECHO_MAP** | `Record<AttributeType, AttributeType[]>` (line 97) | Already correct |
| **C) CompanionAttributes.tsx** | Complete and functional | Already correct |
| **D) useCompanionAttributes.ts gains** | +12/+8/+15/+10/+20/+10/+6 (slow-grind) | Already correct |
| **E) Edge function return types** | `Promise<boolean>`, `Promise<EngagementStatus>` (lines 277, 293) | Already correct |
| **F) Migration creativity seeding** | Hardcoded 300 instead of using power/connection | Need to use legacy values |
| **G) EngagementStatus.lifeStatus type** | `string` instead of typed union | Need to fix |

---

## Fix 1: Edge Function - Typed Record Constants (Lines 78-92)

**Current code has loose types:**
```typescript
const BASE_WEEKLY_MAINTENANCE: Record<string, number> = { ... }
const LIFE_STATUS_MULTIPLIERS: Record<string, number> = { ... }
```

**Fix:** Add proper type definitions and use them:
```typescript
type StatAttribute = 'vitality' | 'wisdom' | 'discipline' | 'resolve' | 'creativity' | 'alignment';
type LifeStatus = 'active' | 'transition' | 'vacation' | 'sick';

const BASE_WEEKLY_MAINTENANCE: Record<StatAttribute, number> = {
  discipline: 40,
  vitality: 30,
  creativity: 25,
  resolve: 20,
  wisdom: 15,
  alignment: 15,
};

const LIFE_STATUS_MULTIPLIERS: Record<LifeStatus, number> = {
  active: 1,
  transition: 0.5,
  vacation: 0.25,
  sick: 0.1,
};
```

---

## Fix 2: Edge Function - EngagementStatus Interface (Line 274)

**Current:**
```typescript
interface EngagementStatus {
  lifeStatus: string;  // Too loose
}
```

**Fix:**
```typescript
type LifeStatus = 'active' | 'transition' | 'vacation' | 'sick';

interface EngagementStatus {
  isEngaged: boolean;
  resistDays: number;
  ritualDays: number;
  statMode: 'casual' | 'rpg';
  statsEnabled: boolean;
  lifeStatus: LifeStatus;
}
```

---

## Fix 3: Migration - Seed Creativity from Legacy Values

**Current (line 22-24):**
```sql
UPDATE public.user_companion SET
  creativity = LEAST(1000, GREATEST(100, 300))
WHERE creativity IS NULL OR creativity = 0;
```

This ignores the existing `power` and `connection` columns that we confirmed exist in the database.

**Fix:** Create a new migration to properly seed creativity:
```sql
-- Seed creativity from average of legacy power + connection, scaled to 1000
UPDATE public.user_companion
SET creativity = LEAST(1000, GREATEST(100,
  ROUND(((COALESCE(power, 30) + COALESCE(connection, 30)) / 2) * 10)::INTEGER
))
WHERE (creativity IS NULL OR creativity = 0 OR creativity = 300)
  AND (power IS NOT NULL OR connection IS NOT NULL);

-- Fallback for rows with no legacy values
UPDATE public.user_companion
SET creativity = 300
WHERE creativity IS NULL OR creativity = 0;
```

---

## Fix 4: Edge Function - Type-safe Lookup for Life Status Multiplier

**Current (line 442):**
```typescript
const statusMult = LIFE_STATUS_MULTIPLIERS[engagement.lifeStatus] ?? 1;
```

With proper typing, this needs to handle the type coercion:

**Fix:**
```typescript
const statusMult = LIFE_STATUS_MULTIPLIERS[engagement.lifeStatus as LifeStatus] ?? 1;
```

Or better, since we're properly typing the interface now:
```typescript
const statusMult = LIFE_STATUS_MULTIPLIERS[engagement.lifeStatus] ?? 1;
```

---

## Implementation Order

1. **New database migration** - Fix creativity seeding with power/connection average
2. **Edge function updates** - Add type definitions and fix loose types
3. **Deploy edge function** - Redeploy after changes

---

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/[new]` | Seed creativity from power/connection legacy values |
| `supabase/functions/process-daily-decay/index.ts` | Add `StatAttribute` and `LifeStatus` types, update Record generics and interface |

---

## Verification Checklist (After Fixes)

1. **TypeScript builds without errors** - Run `npm run build` or check for red squiggles
2. **Stats UI shows 6 tiles** - vitality, wisdom, discipline, resolve, creativity, alignment
3. **Progress bar math is correct** - 100 = 0%, 550 = 50%, 1000 = 100%
4. **Tap stat opens dialog** - Shows description, boosted by list, and when it grows
5. **Test stat update** - Call `updateDisciplineFromWork(companionId)` and verify +10 discipline, +2 resolve echo

---

## What's Already Correct (No Changes Needed)

- `attributeDescriptions.ts` - ECHO_MAP has proper generics
- `CompanionAttributes.tsx` - Full component with Card, Dialog, progress bars
- `useCompanionAttributes.ts` - Slow-grind values (+12/+8/+15/+10/+20/+10/+6)
- Edge function core logic - Engagement gate, maintenance scaling, activity tiers
- `getEngagementStatus()` - Already has `Promise<EngagementStatus>` return type
- `isNewUser()` - Already has `Promise<boolean>` return type
