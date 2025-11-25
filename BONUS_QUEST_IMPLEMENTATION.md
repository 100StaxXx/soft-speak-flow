# Bonus Quest System - Implementation Complete ✅

## Overview
Implemented the **Bonus Quest** feature that unlocks a 5th quest slot when:
1. User completes all 4 base quests that day, **OR**
2. User is on a 7+ day streak

## Changes Made

### 1. Database Layer (`/workspace/supabase/migrations/`)

#### Migration: `20251125120000_add_bonus_quest_system.sql`
- **Trigger Function**: `check_and_create_bonus_mission()`
  - Fires AFTER mission completion
  - Checks if 4 base quests are complete OR user has 7+ day streak
  - Automatically creates bonus mission with `is_bonus: true`
  - Different bonus text based on unlock reason:
    - All 4 complete: "Bonus Challenge: Keep the momentum going! 🎯" (20 XP)
    - 7+ streak: "Streak Bonus: Your dedication has unlocked extra rewards! ⚡" (20 XP)
    - Both conditions: "Ultimate Challenge: You're unstoppable today! 🔥" (25 XP)
  - Logs unlock event to activity feed
  - Prevents creating more than 5 missions total
  - Prevents duplicate bonus missions

- **RPC Function**: `check_streak_bonus_on_login(p_user_id, p_date)`
  - Called when user loads missions
  - Creates bonus quest for users with 7+ day streak
  - Returns JSON with creation status and reason
  - Idempotent (won't create duplicates)

#### Migration: `20251125120100_add_mission_limit_validation.sql`
- **Validation Function**: `validate_mission_count()`
  - Enforces max 5 missions per day (4 base + 1 bonus)
  - Ensures only 1 bonus mission per day
  - Fires BEFORE INSERT to prevent invalid data
  - Clear error messages for limit violations

### 2. Backend Edge Function

#### File: `/workspace/supabase/functions/generate-daily-missions/index.ts`
**Changes:**
- Updated `missionCount: 3` → `missionCount: 4` (line 114)
- Updated `CATEGORY_GUIDELINES` to include 4 categories:
  1. Connection Mission (kindness/gratitude)
  2. Quick Win (momentum builder)
  3. Identity Mission (habits/discipline)
  4. Growth Challenge (comfort zone stretch) ← **NEW**
- Added note about 5th bonus quest in guidelines

### 3. Frontend Hook

#### File: `/workspace/src/hooks/useDailyMissions.ts`
**Changes:**
- **Timezone Fix**: Now uses user's saved timezone from profile instead of browser timezone
  - Added `userTimezone` state
  - Added `useEffect` to fetch timezone from profile
  - Calculate `today` using `useMemo` with user's timezone
  - Fallback to browser timezone if not set
  
- **Streak Bonus Check**: Automatically checks for bonus unlock on load
  - Checks if user has 7+ day streak when missions load
  - Calls `check_streak_bonus_on_login` RPC function
  - Shows toast notification when bonus unlocked
  - Refreshes missions to display bonus quest

**Added imports:**
```typescript
import { useState, useEffect, useMemo } from "react";
```

### 4. Frontend UI

#### File: `/workspace/src/components/DailyMissions.tsx`
**Changes:**
- **Visual Indicators**:
  - "Bonus Unlocked!" animated badge in header when bonus quest exists
  - "Bonus Done! 🌟" text when bonus quest completed
  - "Perfect Day! 💫" celebration when ALL missions (including bonus) done
  
- **Enhanced Celebrations**:
  - Gold confetti when 4 base quests completed (triggers bonus unlock)
  - Extra special confetti (200 particles, gold/purple mix) when bonus quest completed
  
- **Quest Status Tracking**:
  - Calculates `regularMissions`, `bonusMissions`, `completedRegular`
  - Tracks `hasBonusQuest`, `bonusUnlocked`, `bonusCompleted`
  - Better separation of base vs bonus quest completion states

### 5. Documentation Update

#### File: `/workspace/supabase/migrations/20251125103000_add_daily_task_helpers.sql`
**Changes:**
- Added clarifying comment distinguishing daily_tasks vs daily_missions
- Daily tasks: 4 per day limit (unchanged)
- Daily missions: 4 base + 1 bonus = 5 max (clarified)

---

## Testing Checklist

### Database Layer
- [ ] Test trigger fires when 4th quest completed
- [ ] Test trigger fires for users with 7+ day streak
- [ ] Test bonus mission created with correct text and XP
- [ ] Test duplicate bonus prevention (should only create 1)
- [ ] Test max 5 mission limit enforced
- [ ] Test activity feed logs bonus unlock event

### Backend
- [ ] Verify 4 missions generated (not 3)
- [ ] Verify AI generates missions for all 4 categories
- [ ] Test with different streak values (0, 3, 7, 14, 30)

### Frontend Hook
- [ ] Test timezone handling for users in different timezones
- [ ] Test streak bonus check on app load
- [ ] Test toast appears when bonus unlocked
- [ ] Test missions refresh after bonus creation
- [ ] Test query invalidation works correctly

### Frontend UI
- [ ] Verify "Bonus Unlocked!" badge appears
- [ ] Verify bonus quest has yellow border/badge
- [ ] Verify gold confetti on 4th quest completion
- [ ] Verify special confetti on bonus quest completion
- [ ] Verify "Perfect Day!" message when all 5 complete
- [ ] Test responsive design on mobile

### Edge Cases
- [ ] User completes 4 quests while already having 7+ streak (should still work)
- [ ] User gains 7th streak day while having incomplete quests (bonus appears)
- [ ] User loses streak (bonus shouldn't affect existing quests)
- [ ] Midnight rollover with pending bonus quest
- [ ] Race condition: multiple rapid quest completions
- [ ] User manually creates missions (shouldn't break limits)

---

## Database Schema Changes

### `daily_missions` table
No schema changes (already had `is_bonus` column from previous migration)

### New Functions
1. `public.check_and_create_bonus_mission()` - TRIGGER FUNCTION
2. `public.check_streak_bonus_on_login(uuid, date)` - RPC FUNCTION
3. `public.validate_mission_count()` - TRIGGER FUNCTION

### New Triggers
1. `check_bonus_mission_unlock` - ON UPDATE OF completed
2. `validate_mission_count_trigger` - BEFORE INSERT

---

## API Changes

### New RPC Endpoint
```typescript
// Frontend can call this directly if needed
const { data, error } = await supabase.rpc('check_streak_bonus_on_login', {
  p_user_id: userId,
  p_date: '2025-11-25'
});

// Returns:
{
  bonus_created: boolean,
  reason: 'streak_milestone' | 'not_eligible',
  streak: number,
  bonus_exists?: boolean
}
```

---

## Performance Considerations

1. **Database Triggers**: Fire only on quest completion (not high frequency)
2. **Timezone Lookup**: Cached in state, only fetches once per session
3. **Bonus Check**: Runs once on mission load, skipped if bonus exists
4. **Query Invalidation**: Properly scoped to avoid unnecessary refetches

---

## Security

1. **RLS Policies**: Existing policies protect missions table
2. **SECURITY DEFINER**: All functions use `SECURITY DEFINER` and `SET search_path = public`
3. **User ID Validation**: All functions verify user_id matches auth.uid()
4. **SQL Injection**: Uses parameterized queries throughout
5. **Limits Enforced**: Hard limits prevent abuse (max 5 missions)

---

## Known Limitations

1. **Bonus Text**: Currently hardcoded in trigger. Consider making this configurable or AI-generated in future.
2. **Timezone**: Requires user to have timezone set in profile. Falls back to browser timezone.
3. **Activity Type**: Bonus unlock creates 'bonus_quest_unlocked' activity, ensure this is handled in activity feed UI.

---

## Migration Order

These migrations will run in this order:
1. `20251117042338` - Creates daily_missions table
2. `20251117131325` - Adds is_bonus column
3. `20251125103000` - Task helper functions (updated with clarifications)
4. `20251125120000` - Bonus quest system (triggers & RPC) ← **NEW**
5. `20251125120100` - Mission limit validation ← **NEW**

---

## Rollback Plan

If issues occur, run this SQL to disable the system:
```sql
-- Disable triggers
DROP TRIGGER IF EXISTS check_bonus_mission_unlock ON daily_missions;
DROP TRIGGER IF EXISTS validate_mission_count_trigger ON daily_missions;

-- Delete existing bonus quests (optional)
DELETE FROM daily_missions WHERE is_bonus = true;
```

To fully remove:
```sql
-- Drop functions
DROP FUNCTION IF EXISTS public.check_and_create_bonus_mission();
DROP FUNCTION IF EXISTS public.check_streak_bonus_on_login(uuid, date);
DROP FUNCTION IF EXISTS public.validate_mission_count();
```

---

## Success Metrics

Track these to measure feature success:
- Number of bonus quests unlocked per day
- % of users who unlock bonus via completion vs streak
- % of bonus quests completed
- Average XP increase per user
- User retention after bonus quest implementation

---

## Next Steps

1. Deploy migrations to staging database
2. Test all scenarios in staging environment
3. Monitor error logs for 24-48 hours
4. Deploy to production during low-traffic window
5. Monitor analytics for bonus quest engagement
6. Consider A/B testing bonus XP amounts (20 vs 25 vs 30)
7. Add analytics dashboard for bonus quest metrics

---

## Implementation Complete ✅

All code changes have been implemented and are ready for testing and deployment.
