
# Bug Fixes and Improvements for 6-Stat System

## Issues Found (Your Feedback Was Accurate)

### A) Migration Not Idempotent ⚠️ CRITICAL
**Current code (lines 38-43):**
```sql
UPDATE public.user_companion SET
  vitality = LEAST(1000, GREATEST(100, ROUND(COALESCE(vitality, 50) * 10)::INTEGER)),
  ...
```
This will multiply **already-scaled** values (e.g., 500) by 10 again on re-run, clamping them to 1000.

**Fix:** Only scale rows where stats are in legacy range (≤100):
```sql
UPDATE public.user_companion SET
  vitality   = LEAST(1000, GREATEST(100, ROUND(vitality * 10)::INTEGER)),
  wisdom     = LEAST(1000, GREATEST(100, ROUND(wisdom * 10)::INTEGER)),
  discipline = LEAST(1000, GREATEST(100, ROUND(discipline * 10)::INTEGER)),
  resolve    = LEAST(1000, GREATEST(100, ROUND(resolve * 10)::INTEGER)),
  alignment  = LEAST(1000, GREATEST(100, ROUND(alignment * 10)::INTEGER))
WHERE GREATEST(
  COALESCE(vitality, 0),
  COALESCE(wisdom, 0),
  COALESCE(discipline, 0),
  COALESCE(resolve, 0),
  COALESCE(alignment, 0)
) <= 100;
```

---

### B) `attributeDescriptions.ts` ✅ ALREADY CORRECT
**Current code (lines 97-104):**
```typescript
export const ECHO_MAP: Record<AttributeType, AttributeType[]> = {
  vitality: ['discipline', 'alignment'],
  ...
};
```
This is **valid TypeScript** with proper generics. No fix needed.

---

### C) `CompanionAttributes.tsx` ✅ ALREADY CORRECT
The component is **complete and functional**:
- Has Card wrapper (line 42)
- Has Dialog with open state (line 85)
- Uses `getStatPercentage()` correctly in `style={{ width: `${percentage}%` }}` (line 71)
- Progress bar renders correctly

No fix needed.

---

### D) `useCompanionAttributes.ts` - Gain Numbers Mismatch ⚠️
**Current gains (lines 92-138):**
| Method | Current | Plan Says |
|--------|---------|-----------|
| Fitness → Vitality | +50 | +12 |
| Learning → Wisdom | +40 | +8 |
| Ritual → Discipline | +30 | +15 |
| Work → Discipline | +50 | +10/+15 |
| Resist → Resolve | +80 | +20 |
| Shipping → Creativity | +50 | +10 |
| Reflection → Alignment | +30 | +6 |

**Decision needed:** Slow-grind (+12/+15 etc.) or medium gains (+30/+50)?

**Recommendation:** Use slow-grind numbers to match the "months to max" feel.

**Fix:** Update the activity methods with slow-grind values.

---

### E) Edge Function - Missing Life Status Expiry ⚠️
**Current code (lines 300-308):**
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('stat_mode, stats_enabled, life_status')  // Missing life_status_expires_at!
  .eq('id', userId)
  .single();

const lifeStatus = profile?.life_status ?? 'active';  // Never checks expiry
```

**Fix:** Add expiry check:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('stat_mode, stats_enabled, life_status, life_status_expires_at')
  .eq('id', userId)
  .single();

let lifeStatus = profile?.life_status ?? 'active';

// Auto-expire life status
if (profile?.life_status_expires_at && 
    new Date(profile.life_status_expires_at) < new Date()) {
  lifeStatus = 'active';
  // Update profile to reset expired status
  await supabase
    .from('profiles')
    .update({ life_status: 'active', life_status_expires_at: null })
    .eq('id', userId);
}
```

---

## Additional Improvements

### F) Add Maintenance Summary Storage
**Add columns for user-visible maintenance feedback:**
```sql
ALTER TABLE public.user_companion
  ADD COLUMN IF NOT EXISTS last_maintenance_summary TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_maintenance_at TIMESTAMPTZ NULL;
```

**Update edge function to store summary:**
```typescript
// In applyWeeklyMaintenance(), determine message:
let summary = '';
if (finalMult === 0) {
  summary = 'Maintenance Check: Great training week! No maintenance needed.';
} else if (activeDays >= 2) {
  summary = `Maintenance Check: You trained ${activeDays} days. Some skills need attention.`;
} else {
  summary = 'Maintenance Check: Low training week. Skills need attention.';
}

// Include in update:
updates.last_maintenance_summary = summary;
updates.last_maintenance_at = new Date().toISOString();
```

---

## File Changes Summary

| File | Action | Changes |
|------|--------|---------|
| `supabase/migrations/...` | New migration | Fix idempotent scaling + add maintenance columns |
| `supabase/functions/process-daily-decay/index.ts` | Modify | Add life_status_expires_at check, store maintenance summary |
| `src/hooks/useCompanionAttributes.ts` | Modify | Update gain values to slow-grind numbers |

---

## Slow-Grind Gain Values (Final)

| Activity | Primary Stat | Gain | Echo Gains |
|----------|--------------|------|------------|
| Fitness quest | Vitality | +12 | Discipline +2, Alignment +2 |
| Learning/reading | Wisdom | +8 | Creativity +2, Alignment +2 |
| Daily ritual | Discipline | +15 | Resolve +3 |
| Deep work/Pomodoro | Discipline | +10 | Resolve +2 |
| Resist victory | Resolve | +20 | Discipline +4, Alignment +4 |
| Shipping/building | Creativity | +10 | Wisdom +2, Discipline +2 |
| Reflection/journal | Alignment | +6 | Resolve +1 |
| Streak 7 days | Discipline | +15 | - |
| Streak 14 days | Discipline | +25 | - |
| Streak 30 days | Discipline | +40 | - |
| Perfect day | Alignment | +8 | Resolve +2 |

With base weekly maintenance of -40 discipline at full scale, users need ~3 activities per week just to break even. That's the "slow grind."

---

## Implementation Order

1. **New migration** - Fix scaling + add maintenance columns
2. **Edge function fixes** - Life status expiry + maintenance summary storage
3. **Hook updates** - Slow-grind gain values

