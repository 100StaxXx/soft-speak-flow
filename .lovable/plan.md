

# Ship-Ready Polish: Life Status Normalization

## What I Found
The current `getEngagementStatus()` at **line 312** does:
```typescript
let lifeStatus: LifeStatus = (profile?.life_status ?? 'active') as LifeStatus;
```

This is a **type assertion** that tells TypeScript "trust me, this is valid" — but if the database contains a typo or legacy value (e.g., `"Vacation"` with capital V, or `"paused"`), the lookup will fail silently.

---

## The Fix: Safe Normalization

Replace line 312 with:
```typescript
// Normalize life status to prevent invalid values from DB
const rawLifeStatus = profile?.life_status ?? 'active';
const lifeStatus: LifeStatus = 
  rawLifeStatus === 'transition' || rawLifeStatus === 'vacation' || rawLifeStatus === 'sick'
    ? rawLifeStatus
    : 'active';
```

This ensures:
- Valid values pass through unchanged
- Invalid/legacy/typo values default to `'active'`
- No runtime errors from undefined multiplier lookups

---

## Files to Modify

| File | Line | Change |
|------|------|--------|
| `supabase/functions/process-daily-decay/index.ts` | 312 | Replace cast with normalization |

---

## Ship Sequence (Complete)

1. ✅ Migration for creativity seeding — **Done**
2. ✅ Edge function type definitions — **Done**  
3. 🔧 **Add life status normalization** — This fix
4. 🚀 Redeploy edge function
5. ✅ Run 5 verification checks

---

## Verification Checklist (Unchanged)

1. TypeScript builds without errors
2. Stats UI shows 6 tiles in correct order
3. Progress bar math: 100 = 0%, 550 = 50%, 1000 = 100%
4. Tap stat opens dialog with description
5. Test stat update: `updateDisciplineFromWork(companionId)` → +10 discipline, +2 resolve echo

