# Comprehensive Implementation Plan
## Phased Bug Fix & Optimization Strategy

**Date Created:** 2025-11-25
**Status:** Ready for Implementation

---

## Executive Summary

This document outlines a 4-phase implementation plan to address:
- **5 Critical Crash-Level Bugs** (Phase 0)
- **Data Integrity Issues** (Phase 1)
- **Security Vulnerabilities** (Phase 2)
- **Performance & UX Improvements** (Phase 3)

**Good News:** Several issues are already fixed! ✅
- RestDayButton already uses `.maybeSingle()` 
- XPBreakdown uses correct field `xp_amount`
- RestDayButton cache invalidation is correct
- Quest completion uses atomic RPC function
- Quest toggle is already optimized

**Estimated Time:** 6-10 hours total
- Phase 0: 30 minutes
- Phase 1: 1-2 hours
- Phase 2: 2-3 hours
- Phase 3: 3-4 hours

---

## Phase 0: Emergency Hotfixes (30 minutes)
**Goal:** Fix remaining crash-level bugs immediately

### ✅ ALREADY FIXED (3/5)
1. ✓ **RestDayButton .single() → .maybeSingle()**
   - Status: FIXED (line 28)
   
2. ✓ **XPBreakdown Field Name**
   - Status: CORRECT (uses `xp_amount` on line 30)
   
3. ✓ **RestDayButton Cache Key**
   - Status: CORRECT (uses `['companion', user.id]` on line 83)

### 🔴 REQUIRES FIX (2/5)

#### 1. GlobalEvolutionListener Cache Key Fix
**File:** `src/components/GlobalEvolutionListener.tsx`
**Line:** 79
**Issue:** Cache invalidation doesn't include userId, causing stale data
**Fix:**
```typescript
// BEFORE
queryClient.invalidateQueries({ queryKey: ['companion'] });

// AFTER
if (user?.id) {
  queryClient.invalidateQueries({ queryKey: ['companion', user.id] });
}
```
**Impact:** Medium - causes companion data to be stale after evolution
**Risk:** Low - straightforward change

---

#### 2. OnboardingFlow Auto-Complete Fix
**File:** `src/components/OnboardingFlow.tsx`
**Lines:** 128-145
**Issue:** Complex `handleDialogChange` logic may complete onboarding prematurely when dialog closes
**Current Logic:**
```typescript
const handleDialogChange = (nextOpen: boolean) => {
  if (nextOpen) return;
  if (hasCompleted) { onComplete(); return; }
  if (currentSlide >= slides.length - 1) { handleComplete(); return; }
  onComplete(); // ⚠️ This allows early dismiss
};
```
**Problem:** The final `onComplete()` call allows users to dismiss without completing
**Fix:** Add confirmation or remove early dismiss capability
**Recommended Approach:**
```typescript
const handleDialogChange = (nextOpen: boolean) => {
  if (nextOpen) return;
  
  if (hasCompleted) {
    onComplete();
    return;
  }
  
  if (currentSlide >= slides.length - 1) {
    handleComplete();
    return;
  }
  
  // Don't allow dismiss until complete
  // User must click "Skip" or "Next" to proceed
};
```
**Impact:** High - affects onboarding completion tracking
**Risk:** Medium - may change user experience

---

## Phase 1: Data Integrity (1-2 hours)
**Goal:** Prevent XP/streak exploitation and timezone bugs

### 1. Timezone Normalization

#### 1.1 useDailyMissions Hook
**File:** `src/hooks/useDailyMissions.ts`
**Line:** 15
**Issue:** Uses `toISOString().split('T')[0]` which is timezone-naive
**Fix:**
```typescript
// BEFORE
const today = new Date().toISOString().split('T')[0];

// AFTER
const today = new Date().toLocaleDateString('en-CA');
```
**Impact:** Critical - prevents timezone-related mission duplication/skipping
**Also Affects:** Mission date matching, streak calculation

#### 1.2 Edge Function Timezone Handling
**File:** `supabase/functions/generate-daily-missions/index.ts`
**Line:** 68
**Current:**
```typescript
const today = new Date().toISOString().split('T')[0];
```
**Issue:** Server timezone may differ from user timezone
**Recommended Fix:**
```typescript
// Option A: Accept timezone from client
const { userId, forceRegenerate = false, timezone = 'UTC' } = await req.json();
const today = new Date().toLocaleDateString('en-CA', { timeZone: timezone });

// Option B: Use UTC consistently everywhere
const today = new Date().toISOString().split('T')[0]; // Keep as-is but document as UTC
```
**Note:** Requires decision on timezone strategy (client-side vs server-side)

---

### 2. XP Metadata Population

#### 2.1 Pep Talk XP Metadata
**File:** `src/components/TodaysPepTalk.tsx`
**Line:** 195
**Issue:** Missing `pep_talk_id` in metadata prevents exploitation detection
**Current:**
```typescript
awardPepTalkListened({ pep_talk_id: pepTalk.id });
```
**Status:** ✅ ALREADY PASSING METADATA CORRECTLY

#### 2.2 Mission Completion Metadata
**File:** `src/hooks/useDailyMissions.ts`
**Line:** 84
**Issue:** Missing mission_id in metadata
**Fix:**
```typescript
// BEFORE
await awardCustomXP(mission.xp_reward, `mission_${mission.mission_type}`, "Mission Complete!");

// AFTER
await awardCustomXP(
  mission.xp_reward, 
  `mission_${mission.mission_type}`, 
  "Mission Complete!",
  { mission_id: missionId, mission_type: mission.mission_type }
);
```
**Note:** Requires updating `awardCustomXP` signature to accept metadata parameter

#### 2.3 Update awardCustomXP Signature
**File:** `src/hooks/useXPRewards.ts`
**Line:** 172
**Fix:**
```typescript
// BEFORE
const awardCustomXP = async (xpAmount: number, eventType: string, displayReason?: string) => {
  // ...
  awardXP.mutate({ eventType, xpAmount });
};

// AFTER
const awardCustomXP = async (
  xpAmount: number, 
  eventType: string, 
  displayReason?: string,
  metadata?: Record<string, any>
) => {
  // ...
  awardXP.mutate({ eventType, xpAmount, metadata });
};
```

---

### 3. Mission Generation Error Handling

#### 3.1 User-Friendly Error Messages
**File:** `src/hooks/useDailyMissions.ts`
**Lines:** 39-42
**Current:**
```typescript
if (generationError) {
  console.error('Mission generation failed:', generationError);
  throw new Error(generationError.message || 'Unable to generate missions right now.');
}
```
**Issue:** Error is logged but user gets generic error toast
**Fix:**
```typescript
if (generationError) {
  console.error('Mission generation failed:', generationError);
  return []; // Return empty array, let UI handle empty state
}
```

#### 3.2 Add Retry Functionality
**New Hook Method:**
```typescript
const regenerateMissions = useMutation({
  mutationFn: async () => {
    const { data, error } = await supabase.functions.invoke('generate-daily-missions', {
      body: { userId: user.id, forceRegenerate: true }
    });
    if (error) throw error;
    return data?.missions || [];
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['daily-missions'] });
    toast({ title: "Missions generated!", description: "Your new missions are ready!" });
  }
});

return { 
  missions, 
  isLoading, 
  completeMission, 
  regenerateMissions // Export for UI
};
```

#### 3.3 Empty State Component
**New Component:** `src/components/MissionsEmptyState.tsx`
```typescript
export const MissionsEmptyState = ({ onRetry, isRetrying }: Props) => (
  <Card className="p-8 text-center">
    <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
    <h3 className="font-bold text-lg mb-2">No Missions Yet</h3>
    <p className="text-muted-foreground mb-4">
      We couldn't generate your daily missions. This usually resolves itself quickly.
    </p>
    <Button onClick={onRetry} disabled={isRetrying}>
      {isRetrying ? "Generating..." : "Try Again"}
    </Button>
  </Card>
);
```

---

## Phase 2: Security Hardening (2-3 hours)
**Goal:** Prevent arbitrary writes and XP manipulation

### 1. JWT Verification in Edge Functions

All edge functions currently trust the `userId` in the request body. This is a security risk.

#### Standard JWT Verification Pattern
```typescript
// Add to ALL edge functions that accept userId
const authHeader = req.headers.get('Authorization');
if (!authHeader) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

const token = authHeader.replace('Bearer ', '');
const { data: { user }, error: authError } = await supabase.auth.getUser(token);

if (authError || !user) {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// Use user.id instead of body.userId
const { forceRegenerate = false } = await req.json(); // Remove userId from destructure
```

#### 2.1 generate-daily-missions
**File:** `supabase/functions/generate-daily-missions/index.ts`
**Lines to Update:** 53-60
**Current:**
```typescript
const { userId, forceRegenerate = false } = await req.json();
```
**Fixed:**
```typescript
const authHeader = req.headers.get('Authorization');
const token = authHeader?.replace('Bearer ', '');
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) throw new Error('Unauthorized');

const { forceRegenerate = false } = await req.json();
const userId = user.id; // Use verified user ID
```

#### 2.2 generate-companion-evolution
**File:** `supabase/functions/generate-companion-evolution/index.ts`
**Status:** ✅ Already partially verified on line 208-209
**Issue:** Still accepts `userId` in request body (line 70)
**Fix:** Remove userId from request, verify auth earlier

#### 2.3 generate-companion-story
**File:** `supabase/functions/generate-companion-story/index.ts`
**Lines:** 191-209
**Status:** ✅ ALREADY IMPLEMENTED CORRECTLY
Uses `supabaseClient.auth.getUser()` to verify auth

---

### 2. Single-Writer XP Guard

#### 2.4 Create award_xp_with_dedup Function
**New Migration:** `supabase/migrations/[timestamp]_add_xp_dedup.sql`
```sql
-- Prevent duplicate XP awards from double-clicks/race conditions
CREATE OR REPLACE FUNCTION award_xp_with_dedup(
  p_user_id UUID,
  p_companion_id UUID,
  p_xp_amount INT,
  p_event_type TEXT,
  p_event_metadata JSONB DEFAULT NULL,
  p_dedup_key TEXT DEFAULT NULL -- Optional: use to prevent duplicate awards
) RETURNS JSON AS $$
DECLARE
  v_new_xp BIGINT;
  v_current_stage INT;
BEGIN
  -- Check for duplicate using dedup_key (if provided)
  IF p_dedup_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM xp_events 
      WHERE user_id = p_user_id 
        AND event_type = p_event_type
        AND event_metadata->>'dedup_key' = p_dedup_key
        AND created_at > NOW() - INTERVAL '5 minutes'
    ) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Duplicate XP award prevented',
        'duplicate', true
      );
    END IF;
  END IF;

  -- Award XP atomically
  UPDATE user_companion
  SET current_xp = current_xp + p_xp_amount
  WHERE id = p_companion_id AND user_id = p_user_id
  RETURNING current_xp, current_stage 
  INTO v_new_xp, v_current_stage;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Companion not found';
  END IF;

  -- Log XP event with dedup_key
  INSERT INTO xp_events (
    user_id, 
    companion_id, 
    xp_amount, 
    event_type, 
    event_metadata
  ) VALUES (
    p_user_id,
    p_companion_id,
    p_xp_amount,
    p_event_type,
    COALESCE(p_event_metadata, '{}'::jsonb) || 
      CASE WHEN p_dedup_key IS NOT NULL 
        THEN json_build_object('dedup_key', p_dedup_key)::jsonb 
        ELSE '{}'::jsonb 
      END
  );

  RETURN json_build_object(
    'success', true,
    'new_xp', v_new_xp,
    'current_stage', v_current_stage
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION award_xp_with_dedup IS 'Award XP with optional deduplication to prevent double-awards';
```

#### 2.5 Update useCompanion Hook
**File:** `src/hooks/useCompanion.ts`
**Update awardXP mutation to use new function:**
```typescript
// Option 1: Add dedup at hook level
const awardXP = useMutation({
  mutationFn: async ({ eventType, xpAmount, metadata, dedupKey }) => {
    const { data, error } = await supabase.rpc('award_xp_with_dedup', {
      p_user_id: user.id,
      p_companion_id: companion.id,
      p_xp_amount: xpAmount,
      p_event_type: eventType,
      p_event_metadata: metadata || {},
      p_dedup_key: dedupKey || null
    });
    
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'XP award failed');
    return data;
  },
  // ...
});
```

---

## Phase 3: Performance & UX Polish (3-4 hours)
**Goal:** Speed up queries and improve empty states

### 1. Shared useProfile Context

**Problem:** `useProfile` is called in multiple components, causing duplicate queries

**Files Using useProfile:**
- `src/components/GlobalEvolutionListener.tsx`
- Multiple pages and components

**Solution:** Create ProfileContext

#### 3.1 Create ProfileContext
**New File:** `src/contexts/ProfileContext.tsx`
```typescript
import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Profile } from '@/types/profile';

interface ProfileContextType {
  profile: Profile | null;
  loading: boolean;
  refetch: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // Auto-create profile
        const { data: inserted, error: insertError } = await supabase
          .from('profiles')
          .insert({ id: user.id, email: user.email ?? null })
          .select('*')
          .maybeSingle();

        if (insertError) throw insertError;
        return inserted;
      }

      return data;
    },
    enabled: !!user,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  return (
    <ProfileContext.Provider value={{ 
      profile: profile ?? null, 
      loading: isLoading,
      refetch 
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
};
```

#### 3.2 Add ProfileProvider to App
**File:** `src/App.tsx` or main layout
```typescript
<AuthProvider>
  <ProfileProvider>
    <QueryClientProvider client={queryClient}>
      {/* ... rest of app */}
    </QueryClientProvider>
  </ProfileProvider>
</AuthProvider>
```

#### 3.3 Update Import Statements
**Replace in all files:**
```typescript
// OLD
import { useProfile } from '@/hooks/useProfile';

// NEW
import { useProfile } from '@/contexts/ProfileContext';
```

---

### 2. Quest Toggle Optimization
**Status:** ✅ ALREADY OPTIMIZED
- Uses `complete_quest_with_xp` RPC
- Single atomic call handles: quest completion + XP award + evolution check
- No changes needed!

---

### 3. Loading States & Empty States

#### 3.3 Mission Loading Spinner
**File:** `src/pages/Dashboard.tsx` (or wherever missions are displayed)
**Add:**
```typescript
{isLoadingMissions && (
  <Card className="p-8 flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-3">Generating your daily missions...</span>
  </Card>
)}

{!isLoadingMissions && missions.length === 0 && (
  <MissionsEmptyState onRetry={regenerateMissions} isRetrying={isRetrying} />
)}
```

#### 3.4 Pep Talk Empty State
**File:** `src/components/TodaysPepTalk.tsx`
**Add empty state when no pep talk exists:**
```typescript
if (!pepTalk && !isLoading) {
  return (
    <Card className="p-8 text-center">
      <MessageCircleHeart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <h3 className="font-bold text-lg mb-2">No Pep Talk Today</h3>
      <p className="text-muted-foreground mb-4">
        Your daily pep talk is being prepared by your mentor.
      </p>
      <Button onClick={() => refetch()}>
        Refresh
      </Button>
    </Card>
  );
}
```

#### 3.5 Disable Buttons During Async Operations
**Files to update:**
- `src/components/DailyMissions.tsx` - mission complete buttons
- Quest toggle already handles this in `useDailyTasks`

**Pattern:**
```typescript
<Button 
  onClick={handleComplete}
  disabled={isCompleting || mission.completed}
>
  {isCompleting ? <Loader2 className="animate-spin" /> : "Complete"}
</Button>
```

---

### 4. Dead Code Removal

#### 3.6 Review componentOptimization.ts Usage
**File:** `src/utils/componentOptimization.ts`
**Status:** Used for debounce/throttle hooks
**Recommendation:** 
- ✅ KEEP - These utilities are actively used
- Consider renaming to `performanceHooks.ts` for clarity
- Document which components use which hooks

**Actual Dead Code to Remove:**
```typescript
// Search for:
// - Unused imports
// - Commented-out code blocks
// - Unused type definitions
// - Old migration files that are no longer needed
```

---

## Implementation Order

### Critical Path (Do First)
1. ✅ Phase 0.2: GlobalEvolutionListener cache key (5 min)
2. ✅ Phase 0.4: OnboardingFlow dialog logic (15 min)
3. ✅ Phase 1.1: Timezone normalization (10 min)

### High Priority (Do Second)
4. Phase 1.3-1.4: XP metadata population (30 min)
5. Phase 1.6-1.7: Mission error handling + empty states (45 min)
6. Phase 2.1-2.3: JWT verification in edge functions (1 hour)

### Medium Priority (Do Third)
7. Phase 2.4-2.5: XP deduplication (1.5 hours)
8. Phase 3.1: Profile context (1 hour)
9. Phase 3.3-3.5: Loading states and disabled buttons (1 hour)

### Low Priority (Nice to Have)
10. Phase 3.6: Dead code removal (30 min)
11. Phase 1.2: Edge function timezone strategy (design decision needed)

---

## Testing Checklist

### Phase 0 Tests
- [ ] Evolution triggers cache refresh correctly
- [ ] Onboarding doesn't complete prematurely
- [ ] No crashes from .single() queries

### Phase 1 Tests
- [ ] Missions generate for correct timezone
- [ ] Cannot farm XP by repeating pep talk
- [ ] Cannot farm XP by double-completing missions
- [ ] Mission generation errors show user-friendly message
- [ ] Retry button successfully regenerates missions

### Phase 2 Tests
- [ ] Edge functions reject requests without valid JWT
- [ ] Edge functions reject requests with expired JWT
- [ ] Cannot award XP twice from double-click
- [ ] XP events log includes proper metadata

### Phase 3 Tests
- [ ] Profile queries only fire once per page
- [ ] Loading spinners show during async operations
- [ ] Empty states display with retry CTAs
- [ ] Buttons disable during async operations

---

## Rollback Plan

Each phase is isolated and can be rolled back independently:

### Phase 0 Rollback
- Revert specific file changes via git
- No database changes needed

### Phase 1 Rollback
- Revert hook changes
- XP awards will continue working (just without metadata)

### Phase 2 Rollback
- **Database:** Keep new functions (backward compatible)
- **Code:** Revert to old XP award method
- **Edge Functions:** Revert to accepting userId in body (less secure but functional)

### Phase 3 Rollback
- Remove ProfileProvider, restore old useProfile hook
- Remove empty state components

---

## Success Metrics

### Phase 0
- Zero Supabase errors from `.single()` returning null
- Zero premature onboarding completions
- Zero cache staleness bugs after evolution

### Phase 1
- Zero timezone-related mission duplication bugs
- XP events table populated with proper metadata
- Mission generation failures < 1%

### Phase 2
- Zero unauthorized edge function calls
- Zero duplicate XP awards from race conditions

### Phase 3
- Profile query count reduced by 60%+
- All async operations show loading state
- Empty states provide clear next steps

---

## Notes & Decisions Needed

1. **Timezone Strategy:** Client-side vs server-side date calculation
   - Recommendation: Client-side with timezone stored in profile
   - Alternative: All dates in UTC, convert in UI

2. **OnboardingFlow UX:** Allow early dismiss or force completion?
   - Current: Allows early dismiss (intentional?)
   - Proposed: Require completion or explicit skip

3. **XP Dedup Window:** How long to prevent duplicate awards?
   - Proposed: 5 minutes
   - Alternative: Use request ID for exact dedup

4. **Profile Context:** Should it include companion data too?
   - Current scope: Profile only
   - Future: Could expand to ProfileAndCompanionContext

---

## Files Modified Summary

### Phase 0 (2 files)
- `src/components/GlobalEvolutionListener.tsx`
- `src/components/OnboardingFlow.tsx`

### Phase 1 (5 files)
- `src/hooks/useDailyMissions.ts`
- `src/hooks/useXPRewards.ts`
- `src/components/TodaysPepTalk.tsx`
- `src/components/MissionsEmptyState.tsx` (new)
- `supabase/functions/generate-daily-missions/index.ts`

### Phase 2 (5 files)
- `supabase/functions/generate-daily-missions/index.ts`
- `supabase/functions/generate-companion-evolution/index.ts`
- `supabase/migrations/[timestamp]_add_xp_dedup.sql` (new)
- `src/hooks/useCompanion.ts`
- `src/integrations/supabase/types.ts` (if needed)

### Phase 3 (6+ files)
- `src/contexts/ProfileContext.tsx` (new)
- `src/App.tsx`
- Multiple files with useProfile imports
- `src/components/TodaysPepTalk.tsx`
- `src/pages/Dashboard.tsx`
- Various mission/quest UI components

**Total:** ~15-20 files modified, 3-4 new files

---

## Conclusion

This plan addresses all critical bugs while maintaining backward compatibility where possible. The phased approach allows for:
- Quick wins in Phase 0 (30 min)
- Iterative improvements in Phases 1-2
- Polish and optimization in Phase 3

Most importantly, several major issues are already resolved, reducing overall implementation time by ~40%.

Ready to begin implementation? Start with Phase 0.2 (GlobalEvolutionListener) as it's the quickest critical fix.
