
# Fix: Next Chapter Awaits Not Showing on Older Campaigns

## Root Cause

The "Next Chapter Awaits" section only displays when there are **postcard milestones** in the `epic_milestones` table. 

**Database findings:**
| Campaign | Created | Milestones |
|----------|---------|------------|
| Money in the Bank | Feb 2, 2026 | 7 ✅ |
| Bulk up a Captain America | Jan 31, 2026 | 0 ❌ |

The "Bulk up" campaign was created **before** the milestone generation logic was added. Newer campaigns get milestones automatically; older ones were never backfilled.

---

## Solution

Add logic to **retroactively generate milestones** for legacy campaigns that have a `story_type_slug` but zero milestones.

### Approach: On-Demand Backfill in `useMilestones` Hook

When fetching milestones, if:
1. Epic has a `story_type_slug` 
2. No milestones exist
3. Epic is still active

Then auto-generate and insert default milestones.

---

## File Changes

### `src/hooks/useMilestones.ts`

Add a **backfill mutation** that generates milestones for legacy epics:

```typescript
// After fetching milestones, check if backfill needed
const backfillLegacyMilestones = useMutation({
  mutationFn: async (epicData: { 
    epicId: string; 
    targetDays: number; 
    storyTypeSlug: string 
  }) => {
    // Calculate chapter count based on duration
    let chapterCount = 5;
    if (epicData.targetDays <= 14) chapterCount = 3;
    else if (epicData.targetDays <= 30) chapterCount = 4;
    else if (epicData.targetDays <= 60) chapterCount = 5;
    else chapterCount = 6;
    
    const now = new Date();
    const milestonesToInsert = Array.from({ length: chapterCount }, (_, i) => {
      const percent = Math.round(((i + 1) / chapterCount) * 100);
      const daysOffset = Math.floor((epicData.targetDays * percent) / 100);
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + daysOffset);
      
      return {
        epic_id: epicData.epicId,
        user_id: user.id,
        title: i === chapterCount - 1 ? 'The Finale' : `Chapter ${i + 1}`,
        description: i === chapterCount - 1 ? 'Complete your epic journey!' : `Reach ${percent}% of your goal`,
        target_date: targetDate.toISOString().split('T')[0],
        milestone_percent: percent,
        is_postcard_milestone: true,
        phase_order: i + 1,
      };
    });

    const { error } = await supabase
      .from('epic_milestones')
      .insert(milestonesToInsert);

    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['milestones', epicId] });
  },
});
```

### `src/components/JourneyCard.tsx`

Trigger backfill when card mounts if conditions met:

```typescript
useEffect(() => {
  if (
    isActive && 
    journey.story_type_slug && 
    milestones?.length === 0 && 
    !isLoading
  ) {
    backfillLegacyMilestones({
      epicId: journey.id,
      targetDays: journey.target_days,
      storyTypeSlug: journey.story_type_slug,
    });
  }
}, [journey.id, journey.story_type_slug, milestones?.length, isActive, isLoading]);
```

---

## Alternative: One-Time Database Migration

If preferred, we could run a SQL migration to backfill all existing epics at once:

```sql
-- This would be a one-time script run manually
INSERT INTO epic_milestones (epic_id, user_id, title, description, ...)
SELECT ...
FROM epics 
WHERE story_type_slug IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM epic_milestones WHERE epic_id = epics.id);
```

However, the on-demand approach in the hook is safer and handles edge cases better.

---

## Technical Summary

| Component | Change |
|-----------|--------|
| `useMilestones.ts` | Add `backfillLegacyMilestones` mutation |
| `JourneyCard.tsx` | Trigger backfill on mount for legacy epics |

## Result

After this fix:
- All campaigns (old and new) will have milestones
- "Next Chapter Awaits" will appear on all active campaigns with a story type
- The backfill happens automatically the first time the campaign card loads
